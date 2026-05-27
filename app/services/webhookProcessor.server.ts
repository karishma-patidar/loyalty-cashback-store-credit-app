import { unauthenticated } from '../shopify.server';
import {
  getShopPrograms,
  addStoreCredit,
  calculateCashbackAmount,
  calculateExpirationDate,
  AdminClient,
  ShopifyOrderPayload,
} from './storeCredit.server';
import { connectMongoDB, getCustomerModel } from '../db.mongodb.server';

/**
 * Helper to calculate the store credit amount applied/redeemed on an order.
 * Filters out duplicate transaction kinds (e.g. AUTHORIZATION vs CAPTURE) to prevent double counting.
 */
function extractRedeemedAmount(txs: any[], hasStoreCreditGateway: boolean, totalDiscounts: string): number {
  const storeCreditTxs = (txs || []).filter((tx) => {
    const gatewayLower = (tx.gateway || "").toLowerCase();
    const isStoreCredit = gatewayLower.includes("store_credit") || gatewayLower.includes("store credit");
    const isSuccess = !tx.status || tx.status.toUpperCase() === "SUCCESS";
    return isStoreCredit && isSuccess;
  });

  let redeemedAmount = 0;
  const hasCaptureOrSale = storeCreditTxs.some(
    (tx) => tx.kind === "CAPTURE" || tx.kind === "SALE"
  );

  if (hasCaptureOrSale) {
    for (const tx of storeCreditTxs) {
      if (tx.kind === "CAPTURE" || tx.kind === "SALE") {
        redeemedAmount += parseFloat(tx.amountSet?.presentmentMoney?.amount || "0");
      }
    }
  } else {
    for (const tx of storeCreditTxs) {
      if (tx.kind === "AUTHORIZATION") {
        redeemedAmount += parseFloat(tx.amountSet?.presentmentMoney?.amount || "0");
      }
    }
  }

  if (redeemedAmount === 0 && hasStoreCreditGateway) {
    redeemedAmount = parseFloat(totalDiscounts || "0");
  }

  return Number(redeemedAmount.toFixed(2));
}

/**
 * Centralized order webhook handler to process order-based store credit rewards.
 * Supports both ORDERS_CREATE (creates unpaid orders with "Pending" status)
 * and ORDERS_FULFILLED (issues store credit, saves with "Completed" status).
 */
export async function processOrderWebhook(shop: string, admin: AdminClient | undefined, orderPayload: ShopifyOrderPayload, topic: string) {
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

  // Trigger background check for matured delayed credits whenever any webhook is processed
  processDelayedCredits(shop, adminClient).catch(err => {
    console.error("❌ Error processing delayed credits during webhook:", err);
  });

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

  const customerName = `${orderPayload?.customer?.first_name || ""} ${orderPayload?.customer?.last_name || ""}`.trim() || "Anonymous Customer";

  // 4. Database actions
  try {
    await connectMongoDB();
  } catch (connErr) {
    console.error("❌ Failed to connect to MongoDB:", connErr);
    return;
  }

  const ShopModel = getCustomerModel(shop);
  if (!ShopModel) {
    console.error("❌ ShopModel could not be initialized");
    return;
  }
  const todayStr = new Date().toISOString().split("T")[0];

  // Check existing transaction
  const existingDoc = await ShopModel.findOne({ "events.orderId": orderId });
  let existingTx = null;
  if (existingDoc && existingDoc.events) {
    existingTx = existingDoc.events.find((e: any) => e.orderId === orderId);
  }

  // Handle Order Creation -> Save as PENDING (only once, on ORDERS_CREATE)
  if (topic === 'ORDERS_CREATE') {
    // existingTx check already guards against duplicate across all date documents
    if (existingTx) {
      console.log(`[-] Order ${orderName} already in DB (${existingTx.status}). Skipping duplicate.`);
      return;
    }

    const gateways = orderPayload.payment_gateway_names || [];
    const hasStoreCreditGateway = gateways.some((g: string) => g.toLowerCase().includes("store_credit") || g.toLowerCase().includes("store credit"));

    const cashbackAmount = calculateCashbackAmount(program, orderPayload);
    if (cashbackAmount <= 0 && !hasStoreCreditGateway) {
      console.log(`[-] Cashback amount is 0 and no store credit used for ${orderName}. Skipping.`);
      return;
    }

    let redeemedAmount = 0;
    try {
      const getOrderTransactionsQuery = `#graphql
        query getOrderTransactions($id: ID!) {
          order(id: $id) {
            transactions(first: 10) {
              gateway
              kind
              status
              amountSet {
                presentmentMoney {
                  amount
                }
              }
            }
          }
        }
      `;
      const orderGid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;
      const res = await adminClient.graphql(getOrderTransactionsQuery, { variables: { id: orderGid } });
      const data = await res.json();
      const txs = data?.data?.order?.transactions || [];
      redeemedAmount = extractRedeemedAmount(txs, hasStoreCreditGateway, orderPayload.total_discounts || "0");
      if (redeemedAmount > 0) {
        console.log(`[Store Credit Applied] Applied/used credit of ${redeemedAmount} for order ${orderName} (${orderId})`);
      }
    } catch (err) {
      console.error("❌ Error fetching order transactions for redeemedAmount on ORDERS_CREATE:", err);
    }

    console.log(`[+] Saving order ${orderName} as PENDING...`);
    const newEvent = {
      shop,
      orderId,
      orderName,
      customerId,
      customerName,
      issuedAmount: cashbackAmount,
      currency: orderPayload.presentment_currency || orderPayload.currency || 'USD',
      status: "Pending",
      emailStatus: "Not Sent",
      programType: program.programType === "custom" ? "Custom Program" : "Cashback",
      redeemedAmount: redeemedAmount,
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
  // Handle Fulfillment -> Mark as COMPLETED and Issue Credit
  else if (topic === 'ORDERS_FULFILLED') {
    if (existingTx && existingTx.status === "Completed") {
      console.log(`[-] Order ${orderName} is already Completed. Skipping.`);
      return;
    }

    console.log(`[~] Fulfillment event detected for ${orderName}. Fetching full order details...`);

    // Fetch full order details via GraphQL to ensure accurate status and price info
    const getOrderQuery = `#graphql
      query getOrderDetails($id: ID!) {
        order(id: $id) {
          id
          name
          displayFulfillmentStatus
          displayFinancialStatus
          currentTotalPriceSet {
            presentmentMoney {
              amount
              currencyCode
            }
            shopMoney {
              amount
              currencyCode
            }
          }
          customer {
            id
            firstName
            lastName
            email
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
          transactions(first: 10) {
            gateway
            kind
            status
            amountSet {
              presentmentMoney {
                amount
              }
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
      line_items: fullOrder.lineItems?.nodes?.map((node: {
        discountedUnitPriceSet?: {
          presentmentMoney?: {
            amount?: string;
          };
        };
        quantity?: number;
      }) => ({
        price: node.discountedUnitPriceSet?.presentmentMoney?.amount,
        quantity: node.quantity
      }))
    };

    const presentmentAmt = parseFloat(fullOrder.currentTotalPriceSet?.presentmentMoney?.amount || "0");
    const shopAmt = parseFloat(fullOrder.currentTotalPriceSet?.shopMoney?.amount || "0");
    const exchangeRate = presentmentAmt > 0 ? (shopAmt / presentmentAmt) : 1;

    const gateways = orderPayload.payment_gateway_names || [];
    const hasStoreCreditGateway = gateways.some((g: string) => g.toLowerCase().includes("store_credit") || g.toLowerCase().includes("store credit"));
    const redeemedAmount = extractRedeemedAmount(fullOrder.transactions, hasStoreCreditGateway, orderPayload.total_discounts || "0");
    if (redeemedAmount > 0) {
      console.log(`[Store Credit Applied] Applied/used credit of ${redeemedAmount} for order ${orderName} (${orderId})`);
    }

    const cashbackAmount = calculateCashbackAmount(program, mappedOrder);
    if (cashbackAmount <= 0) return;

    const currencyCode = mappedOrder.currency || 'USD';
    const expiresAt = calculateExpirationDate(program);

    // Email Send Conditions:
    const isNotifyEmailSettingTrue = !!program.notifyEmail;
    const isPaymentSuccessful = fullOrder.displayFinancialStatus?.toUpperCase() === "PAID" ||
                                fullOrder.displayFinancialStatus?.toUpperCase() === "PARTIALLY_PAID" ||
                                fullOrder.displayFinancialStatus?.toUpperCase() === "AUTHORIZED";
    const customerEmail = fullOrder.customer?.email || "";
    const hasValidEmail = typeof customerEmail === 'string' && customerEmail.trim().length > 0 && customerEmail.includes('@');

    const shouldNotify = isNotifyEmailSettingTrue && isPaymentSuccessful && isFulfilled && hasValidEmail;

    let computedEmailStatus = "Not Sent";
    let computedEmailFailReason = "";

    if (isNotifyEmailSettingTrue) {
      if (!isPaymentSuccessful) {
        computedEmailStatus = "Failed";
        computedEmailFailReason = `Payment status is ${fullOrder.displayFinancialStatus || 'Unknown'} (expected Paid/Authorized)`;
      } else if (!isFulfilled) {
        computedEmailStatus = "Failed";
        computedEmailFailReason = `Fulfillment status is ${fullOrder.displayFulfillmentStatus || 'Unknown'} (expected Fulfilled)`;
      } else if (!hasValidEmail) {
        computedEmailStatus = "Failed";
        computedEmailFailReason = customerEmail ? "Customer email is invalid" : "Customer has no email address";
      } else {
        computedEmailStatus = "Sent";
      }
    } else {
      computedEmailStatus = "Not Sent";
      computedEmailFailReason = "Metafield notifyEmail setting is disabled";
    }

    // Check if delayed credit is enabled
    const delayDaysNum = parseInt(program.delayDays || "0", 10);
    const hasDelay = !!program.enableDelay && delayDaysNum > 0;

    if (hasDelay) {
      const processAt = new Date();
      processAt.setDate(processAt.getDate() + delayDaysNum);
      
      console.log(`[+] Delay enabled (${delayDaysNum} days). Scheduling order ${orderName} to be processed at ${processAt.toISOString()}...`);

      if (existingDoc && existingTx) {
        if (existingTx.processAt) {
          console.log(`[-] Order ${orderName} already scheduled for delay. Skipping rescheduling.`);
          return;
        }

        await ShopModel.updateOne(
          { _id: existingDoc._id, "events.orderId": orderId },
          {
            $set: {
              "events.$.status": "Pending",
              "events.$.issuedAmount": cashbackAmount,
              "events.$.currency": currencyCode,
              "events.$.exchangeRate": exchangeRate,
              "events.$.emailStatus": "Not Sent",
              "events.$.emailFailReason": "",
              "events.$.processAt": processAt,
              "events.$.expiresAt": expiresAt,
              "events.$.shouldNotify": shouldNotify,
              "events.$.redeemedAmount": redeemedAmount,
            }
          }
        );
        console.log(`🎉 Scheduled existing order ${orderName} for delay in MongoDB.`);
      } else {
        const newEvent = {
          shop,
          orderId,
          orderName,
          customerId,
          customerName,
          issuedAmount: cashbackAmount,
          currency: currencyCode,
          exchangeRate: exchangeRate,
          status: "Pending",
          emailStatus: "Not Sent",
          programType: program.programType === "custom" ? "Custom Program" : "Cashback",
          redeemedAmount: redeemedAmount,
          issuedAt: null,
          processAt: processAt,
          expiresAt: expiresAt,
          shouldNotify: shouldNotify,
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
            } catch (err) {
              console.error("❌ Failed to create scheduled date doc:", err);
            }
          }
        }
        console.log(`🎉 Scheduled new order ${orderName} for delay in MongoDB.`);
      }
      return;
    }

    const storeCreditResult = await addStoreCredit(
      adminClient,
      customerId,
      cashbackAmount,
      currencyCode,
      expiresAt,
      shouldNotify,
      exchangeRate
    );

    const isSuccessful = storeCreditResult && 
                       (!storeCreditResult.userErrors || storeCreditResult.userErrors.length === 0) && 
                       storeCreditResult.storeCreditAccountTransaction;

    if (isSuccessful) {
      let finalEmailStatus = computedEmailStatus;
      let finalEmailFailReason = computedEmailFailReason;

      if (storeCreditResult.emailUnsupported) {
        finalEmailStatus = "Failed";
        finalEmailFailReason = "Shopify API version does not support native email notifications";
      }

      // 1. Update MongoDB on successful credit issue
      if (existingDoc && existingTx) {
        await ShopModel.updateOne(
          { _id: existingDoc._id, "events.orderId": orderId },
          {
            $set: {
              "events.$.status": "Completed",
              "events.$.issuedAmount": cashbackAmount,
              "events.$.currency": currencyCode,
              "events.$.exchangeRate": exchangeRate,
              "events.$.emailStatus": finalEmailStatus,
              "events.$.emailFailReason": finalEmailFailReason,
              "events.$.issuedAt": new Date(),
              "events.$.redeemedAmount": redeemedAmount,
            }
          }
        );
        console.log(`🎉 Updated order ${orderName} to COMPLETED with emailStatus: ${finalEmailStatus} in MongoDB.`);
      } else {
        const newEvent = {
          shop,
          orderId,
          orderName,
          customerId,
          customerName,
          issuedAmount: cashbackAmount,
          currency: currencyCode,
          exchangeRate: exchangeRate,
          status: "Completed",
          emailStatus: finalEmailStatus,
          emailFailReason: finalEmailFailReason,
          programType: program.programType === "custom" ? "Custom Program" : "Cashback",
          redeemedAmount: redeemedAmount,
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
            } catch (err) {
              console.error("❌ Failed to create fallback completed date doc:", err);
            }
          }
        }
        console.log(`🎉 Saved new COMPLETED transaction for order ${orderName} with emailStatus: ${finalEmailStatus} in MongoDB.`);
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
      // 3. Update MongoDB on failed credit issue
      const errorMsg = storeCreditResult?.userErrors?.map((e: any) => e.message).join(", ") || "Failed to add store credit";
      console.log(`❌ Store credit issue failed for ${orderName}. Error: ${errorMsg}`);
      
      if (existingDoc && existingTx) {
        await ShopModel.updateOne(
          { _id: existingDoc._id, "events.orderId": orderId },
          {
            $set: {
              "events.$.status": "Failed",
              "events.$.emailStatus": "Failed",
              "events.$.emailFailReason": errorMsg,
              "events.$.issuedAt": new Date(),
              "events.$.redeemedAmount": redeemedAmount,
            }
          }
        );
      } else {
        const newEvent = {
          shop,
          orderId,
          orderName,
          customerId,
          customerName,
          issuedAmount: cashbackAmount,
          currency: currencyCode,
          status: "Failed",
          emailStatus: "Failed",
          emailFailReason: errorMsg,
          programType: program.programType === "custom" ? "Custom Program" : "Cashback",
          redeemedAmount: redeemedAmount,
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
      }
    }
  }
}

/**
 * Periodically processes matured delayed credits.
 * Queries MongoDB for any Pending events where processAt <= now.
 */
export async function processDelayedCredits(shop: string, adminClient: AdminClient) {
  try {
    await connectMongoDB();
    const ShopModel = getCustomerModel(shop);
    if (!ShopModel) {
      console.error("❌ ShopModel could not be initialized for delayed credits");
      return;
    }

    const now = new Date();
    // Find documents containing events with status "Pending" and processAt <= now
    const docs = await ShopModel.find({
      "events": {
        $elemMatch: {
          status: "Pending",
          processAt: { $lte: now }
        }
      }
    });

    if (!docs || docs.length === 0) {
      return;
    }

    console.log(`[~] Found ${docs.length} date documents containing matured delayed credits for ${shop}`);

    // Fetch active program settings for configuration
    const programs = await getShopPrograms(adminClient);
    if (!programs || programs.length === 0) {
      console.log('[-] Aborted delayed processing: No loyalty programs configured.');
      return;
    }
    const program = programs[0];

    for (const doc of docs) {
      for (const ev of doc.events) {
        if (ev.status === "Pending" && ev.processAt && ev.processAt <= now) {
          console.log(`[+] Processing delayed credit for Order ${ev.orderName} (${ev.orderId})`);

          const expiresAt = ev.expiresAt ? ev.expiresAt.toISOString() : calculateExpirationDate(program);
          const shouldNotify = ev.shouldNotify !== undefined ? ev.shouldNotify : !!program.notifyEmail;

          const storeCreditResult = await addStoreCredit(
            adminClient,
            ev.customerId,
            ev.issuedAmount,
            ev.currency || 'USD',
            expiresAt,
            shouldNotify,
            ev.exchangeRate
          );

          const isSuccessful = storeCreditResult && 
                             (!storeCreditResult.userErrors || storeCreditResult.userErrors.length === 0) && 
                             storeCreditResult.storeCreditAccountTransaction;

          if (isSuccessful) {
            let finalEmailStatus = ev.emailStatus || "Not Sent";
            let finalEmailFailReason = ev.emailFailReason || "";

            if (program.notifyEmail) {
              if (storeCreditResult.emailUnsupported) {
                finalEmailStatus = "Failed";
                finalEmailFailReason = "Shopify API version does not support native email notifications";
              } else {
                finalEmailStatus = "Sent";
              }
            }

            // Update MongoDB status to Completed
            await ShopModel.updateOne(
              { _id: doc._id, "events.orderId": ev.orderId },
              {
                $set: {
                  "events.$.status": "Completed",
                  "events.$.emailStatus": finalEmailStatus,
                  "events.$.emailFailReason": finalEmailFailReason,
                  "events.$.issuedAt": new Date(),
                }
              }
            );
            console.log(`🎉 [Delayed] Updated order ${ev.orderName} to COMPLETED in MongoDB.`);

            // Also update the order note in Shopify
            try {
              const orderUpdateMutation = `#graphql
                mutation OrderUpdate($input: OrderInput!) {
                  orderUpdate(input: $input) {
                    order { id note }
                  }
                }
              `;
              const appNote = `[Loyalty App] Issued ${ev.issuedAmount} ${ev.currency || 'USD'} store credit (Delayed).`;
              
              const getOrderNoteQuery = `#graphql
                query getOrderNote($id: ID!) {
                  order(id: $id) {
                    id
                    note
                  }
                }
              `;
              const orderGid = ev.orderId.startsWith("gid://") ? ev.orderId : `gid://shopify/Order/${ev.orderId}`;
              const noteRes = await adminClient.graphql(getOrderNoteQuery, { variables: { id: orderGid } });
              const noteData = await noteRes.json();
              const currentNote = noteData?.data?.order?.note || "";

              if (!currentNote.includes(appNote)) {
                await adminClient.graphql(orderUpdateMutation, {
                  variables: {
                    input: { id: orderGid, note: currentNote ? `${currentNote}\n${appNote}` : appNote }
                  }
                });
                console.log(`✅ [Delayed] Updated Shopify Order Note for ${ev.orderName}`);
              }
            } catch (noteErr) {
              console.error(`⚠️ [Delayed] Failed to update order note for ${ev.orderName}:`, noteErr);
            }
          } else {
            const errorMsg = storeCreditResult?.userErrors?.map((e: any) => e.message).join(", ") || "Failed to add store credit";
            console.log(`❌ [Delayed] Store credit issue failed for ${ev.orderName}. Error: ${errorMsg}`);
            
            await ShopModel.updateOne(
              { _id: doc._id, "events.orderId": ev.orderId },
              {
                $set: {
                  "events.$.status": "Failed",
                  "events.$.emailStatus": "Failed",
                  "events.$.emailFailReason": errorMsg,
                  "events.$.issuedAt": new Date(),
                }
              }
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ Error processing delayed credits:", error);
  }
}
