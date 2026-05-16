import { unauthenticated } from '../shopify.server';
import {
  getShopPrograms,
  addStoreCredit,
  calculateCashbackAmount,
  calculateExpirationDate,
} from './storeCredit.server';
import { connectMongoDB, getCustomerModel } from '../db.mongodb.server';

/**
 * Centralized order webhook handler to process order-based store credit rewards.
 * Supports both ORDERS_CREATE (creates unpaid orders with "Pending" status)
 * and ORDERS_PAID (issues store credit, saves with "Completed" status).
 */
export async function processOrderWebhook(shop: string, admin: any, orderPayload: any, topic: string) {
  const numericCustomerId = orderPayload?.customer?.id;
  if (!numericCustomerId) {
    console.log('❌ No customer ID found in order');
    return;
  }
  const customerId = `gid://shopify/Customer/${numericCustomerId}`;
  const orderId = String(orderPayload?.id || "");
  const orderName = String(orderPayload?.name || "");

  console.log(`[+] Processing ${topic} for Order ${orderName} (${orderId})`);

  let adminClient = admin;
  if (!adminClient) {
    try {
      const { admin: unauthAdmin } = await unauthenticated.admin(shop);
      adminClient = unauthAdmin;
    } catch (unauthErr) {
      console.error(`❌ Failed unauthenticated admin lookup for ${shop}:`, unauthErr);
    }
  }

  if (!adminClient) {
    console.log('❌ No admin client available to process webhook');
    return;
  }

  // 1. Check if app is active
  const appActiveQuery = `#graphql
    query GetAppActive {
      shop {
        metafield(namespace: "loyalty_cashback_app", key: "app_active") {
          value
        }
      }
    }
  `;
  let isAppActive = true;
  try {
    const appActiveRes = await adminClient.graphql(appActiveQuery);
    const appActiveData = await appActiveRes.json();
    isAppActive = appActiveData?.data?.shop?.metafield?.value !== "false";
  } catch (err) {
    console.error("Error fetching app_active status:", err);
  }

  if (!isAppActive) {
    console.log('[-] Aborted: App is currently INACTIVE.');
    return;
  }

  // 2. Fetch loyalty programs
  const programs = await getShopPrograms(adminClient);
  if (!programs || programs.length === 0) {
    console.log('[-] Aborted: No loyalty programs configured.');
    return;
  }

  const program = programs[0];
  if (program.status !== "Active" && program.status !== "true" && program.status !== true) {
    console.log(`[-] Aborted: Program is not Active.`);
    return;
  }

  // 3. Calculate cashback
  const cashbackAmount = calculateCashbackAmount(program, orderPayload);
  if (cashbackAmount <= 0) {
    console.log("[-] Aborted: Cashback amount is 0 or negative.");
    return;
  }

  const currencyCode = orderPayload?.currency || 'USD';
  const expiresAt = calculateExpirationDate(program);
  const customerName = `${orderPayload?.customer?.first_name || ""} ${orderPayload?.customer?.last_name || ""}`.trim() || "Anonymous Customer";

  // 4. Database actions
  try {
    await connectMongoDB();
  } catch (connErr) {
    console.error("❌ Failed to connect to MongoDB:", connErr);
    return;
  }

  const ShopModel = getCustomerModel(shop);
  const todayStr = new Date().toISOString().split("T")[0];

  // Check existing transaction
  const existingDoc = await ShopModel.findOne({ "events.orderId": orderId });
  let existingTx = null;
  if (existingDoc && existingDoc.events) {
    existingTx = existingDoc.events.find((e: any) => e.orderId === orderId);
  }

  // Handle Order Payment -> Save as PENDING (only once, on ORDERS_PAID)
  if (topic === 'ORDERS_PAID') {
    // existingTx check already guards against duplicate across all date documents
    if (existingTx) {
      console.log(`[-] Order ${orderName} already in DB (${existingTx.status}). Skipping duplicate.`);
      return;
    }

    const cashbackAmount = calculateCashbackAmount(program, orderPayload);
    if (cashbackAmount <= 0) {
      console.log(`[-] Cashback amount is 0 for ${orderName}. Skipping.`);
      return;
    }

    console.log(`[+] Saving order ${orderName} as PENDING...`);
    const newEvent = {
      shop,
      orderId,
      orderName,
      customerId,
      customerName,
      amount: cashbackAmount,
      currency: orderPayload.currency || 'USD',
      status: "Pending",
      emailStatus: "Not Sent",
      type: program.programType === "product" ? "Custom Program" : "Cashback",
      issuedAt: null,
      createdAt: new Date(),
    };

    // Try pushing into today's date doc, only if this orderId doesn't already exist
    const updateResult = await ShopModel.updateOne(
      { date: todayStr, "events.orderId": { $ne: orderId } },
      { $push: { events: newEvent } }
    );

    if (updateResult.matchedCount === 0) {
      // No doc for today yet — create one
      const dateDoc = await ShopModel.findOne({ date: todayStr });
      if (!dateDoc) {
        try {
          await ShopModel.create({ date: todayStr, events: [newEvent] });
          console.log(`🎉 Created new date doc and saved ${orderName} as PENDING.`);
        } catch (err) {
          console.error(`❌ Failed to create date doc for ${orderName}:`, err);
        }
      } else {
        console.log(`[-] Order ${orderName} already exists in today's doc. Skipping.`);
      }
    } else {
      console.log(`🎉 Order ${orderName} saved as PENDING in MongoDB.`);
    }
  } 
  // Handle Fulfillment / Updates -> Mark as COMPLETED and Issue Credit
  else if (topic === 'ORDERS_FULFILLED' || topic === 'ORDERS_UPDATED') {
    if (existingTx && existingTx.status === "Completed") {
      console.log(`[-] Order ${orderName} is already Completed. Skipping.`);
      return;
    }

    console.log(`[~] Fulfillment/Update event detected for ${orderName}. Fetching full order details...`);

    // Fetch full order details via GraphQL to ensure accurate status and price info
    const getOrderQuery = `#graphql
      query getOrderDetails($id: ID!) {
        order(id: $id) {
          id
          name
          displayFulfillmentStatus
          currentTotalPriceSet {
            presentmentMoney {
              amount
              currencyCode
            }
          }
          customer {
            id
            firstName
            lastName
          }
          lineItems(first: 50) {
            nodes {
              discountedUnitPriceSet {
                presentmentMoney {
                  amount
                }
              }
              quantity
            }
          }
          note
        }
      }
    `;

    let fullOrder;
    try {
      const orderGid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;
      const res = await adminClient.graphql(getOrderQuery, { variables: { id: orderGid } });
      const data = await res.json();
      fullOrder = data?.data?.order;
    } catch (err) {
      console.error("❌ Error fetching order details from Shopify:", err);
    }

    if (!fullOrder) {
      console.log("[-] Aborted: Could not fetch order details from Shopify API.");
      return;
    }

    // Check if order is fully fulfilled
    const isFulfilled = fullOrder.displayFulfillmentStatus?.toUpperCase() === 'FULFILLED';
    console.log(`[DEBUG] Order ${orderName} fulfillment status from API: ${fullOrder.displayFulfillmentStatus}`);
    
    if (!isFulfilled) {
      console.log(`[-] Order ${orderName} fulfillment status is ${fullOrder.displayFulfillmentStatus}. Not yet ready for credit.`);
      return;
    }

    console.log(`[+] Order ${orderName} is FULFILLED. Processing store credit...`);

    // Map GraphQL order back to the structure expected by calculateCashbackAmount
    const mappedOrder = {
      current_total_price: fullOrder.currentTotalPriceSet?.presentmentMoney?.amount,
      currency: fullOrder.currentTotalPriceSet?.presentmentMoney?.currencyCode,
      line_items: fullOrder.lineItems?.nodes?.map((node: any) => ({
        price: node.discountedUnitPriceSet?.presentmentMoney?.amount,
        quantity: node.quantity
      }))
    };

    const cashbackAmount = calculateCashbackAmount(program, mappedOrder);
    if (cashbackAmount <= 0) return;

    const currencyCode = mappedOrder.currency || 'USD';
    const expiresAt = calculateExpirationDate(program);

    const storeCreditResult = await addStoreCredit(
      adminClient,
      customerId,
      cashbackAmount,
      currencyCode,
      expiresAt
    );

    const isSuccessful = storeCreditResult && 
                       (!storeCreditResult.userErrors || storeCreditResult.userErrors.length === 0) && 
                       storeCreditResult.storeCreditAccountTransaction;

    if (isSuccessful) {
      // 1. Update MongoDB
      if (existingDoc && existingTx) {
        await ShopModel.updateOne(
          { _id: existingDoc._id, "events.orderId": orderId },
          {
            $set: {
              "events.$.status": "Completed",
              "events.$.amount": cashbackAmount,
              "events.$.emailStatus": program.notifyEmail ? "Sent" : "Not Sent",
              "events.$.issuedAt": new Date(),
            }
          }
        );
        console.log(`🎉 Updated order ${orderName} to COMPLETED in MongoDB.`);
      } else {
        const newEvent = {
          shop,
          orderId,
          orderName,
          customerId,
          customerName,
          amount: cashbackAmount,
          currency: currencyCode,
          status: "Completed",
          emailStatus: program.notifyEmail ? "Sent" : "Not Sent",
          type: program.programType === "product" ? "Custom Program" : "Cashback",
          issuedAt: new Date(),
          createdAt: new Date(),
        };

        const updateResult = await ShopModel.updateOne(
          { date: todayStr, "events.orderId": { $ne: orderId } },
          { $push: { events: newEvent } }
        );

        if (updateResult.matchedCount === 0) {
          const dateDoc = await ShopModel.findOne({ date: todayStr });
          if (!dateDoc) {
            try {
              await ShopModel.create({ date: todayStr, events: [newEvent] });
            } catch (err) {}
          }
        }
        console.log(`🎉 Saved new COMPLETED transaction for order ${orderName} in MongoDB.`);
      }


      // 2. Update Shopify Order Note
      try {
        const orderUpdateMutation = `#graphql
          mutation OrderUpdate($input: OrderInput!) {
            orderUpdate(input: $input) {
              order { id note }
            }
          }
        `;
        const appNote = `[Loyalty App] Issued ${cashbackAmount} ${currencyCode} store credit.`;
        const currentNote = fullOrder.note || "";
        
        if (!currentNote.includes(appNote)) {
          await adminClient.graphql(orderUpdateMutation, {
            variables: {
              input: { id: fullOrder.id, note: currentNote ? `${currentNote}\n${appNote}` : appNote }
            }
          });
          console.log(`✅ Updated Shopify Order Note for ${orderName}`);
        }
      } catch (err) {
        console.error(`⚠️ Failed to update order note for ${orderName}:`, err);
      }
    } else {
      console.log(`❌ Store credit issue failed for ${orderName}. Result:`, JSON.stringify(storeCreditResult));
    }
  }
}
