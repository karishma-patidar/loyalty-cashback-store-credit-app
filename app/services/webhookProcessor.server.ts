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

declare const process: any;

/**
 * Updates an order's metafields and note in a single GraphQL request
 */
async function updateOrderShopifyData(adminClient: AdminClient, orderId: string, metafields: any[], note?: string) {
  try {
    const orderGid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;
    
    const hasNote = typeof note === 'string';
    const mutation = `#graphql
      mutation UpdateOrderShopifyData($metafields: [MetafieldsSetInput!]!${hasNote ? ', $input: OrderInput!' : ''}) {
        metafieldsSet(metafields: $metafields) {
          userErrors { field message }
        }
        ${hasNote ? `orderUpdate(input: $input) {
          userErrors { field message }
        }` : ''}
      }
    `;

    const variables: any = { metafields };
    if (hasNote) {
      variables.input = { id: orderGid, note };
    }

    const response = await adminClient.graphql(mutation, { variables });
    const data = await response.json();
    
    const mfErrors = data?.data?.metafieldsSet?.userErrors;
    if (mfErrors?.length) {
      console.error(`❌ Failed to set metafields on Order ${orderId}:`, mfErrors);
    } else {
      console.log(`✅ Successfully set metafields on Order ${orderId}`);
    }

    if (hasNote) {
      const noteErrors = data?.data?.orderUpdate?.userErrors;
      if (noteErrors?.length) {
        console.error(`❌ Failed to set note on Order ${orderId}:`, noteErrors);
      } else {
        console.log(`✅ Successfully set note on Order ${orderId}`);
      }
    }
  } catch (err) {
    console.error(`❌ Error updating Shopify data for Order ${orderId}:`, err);
  }
}

/**
 * Helper to calculate the store credit amount applied/redeemed on an order.
 */
function extractRedeemedAmount(txs: any[], hasStoreCreditGateway: boolean, totalDiscounts: string): number {
  const storeCreditTxs = (txs || []).filter((tx) => {
    const gatewayLower = (tx.gateway || "").toLowerCase();
    const isStoreCredit = gatewayLower.includes("store_credit") || gatewayLower.includes("store credit");
    const isSuccess = !tx.status || tx.status.toUpperCase() === "SUCCESS";
    return isStoreCredit && isSuccess;
  });

  let redeemedAmount = 0;
  const hasCaptureOrSale = storeCreditTxs.some(tx => tx.kind === "CAPTURE" || tx.kind === "SALE");

  for (const tx of storeCreditTxs) {
    if (hasCaptureOrSale) {
      if (tx.kind === "CAPTURE" || tx.kind === "SALE") redeemedAmount += parseFloat(tx.amountSet?.presentmentMoney?.amount || "0");
    } else {
      if (tx.kind === "AUTHORIZATION") redeemedAmount += parseFloat(tx.amountSet?.presentmentMoney?.amount || "0");
    }
  }

  if (redeemedAmount === 0 && hasStoreCreditGateway) {
    redeemedAmount = parseFloat(totalDiscounts || "0");
  }

  return Number(redeemedAmount.toFixed(2));
}

/**
 * Reusable MongoDB upsert helper for updating or inserting an event
 */
async function upsertOrderEvent(ShopModel: any, dateStr: string, orderId: string, newEvent: any, existingDocId?: string) {
  if (existingDocId) {
    await ShopModel.updateOne(
      { _id: existingDocId, "events.orderId": orderId },
      { $set: { "events.$": newEvent } }
    );
  } else {
    const updateResult = await ShopModel.updateOne(
      { date: dateStr, "events.orderId": { $ne: orderId } },
      { $push: { events: newEvent } }
    );
    if (updateResult.matchedCount === 0) {
      const dateDoc = await ShopModel.findOne({ date: dateStr });
      if (!dateDoc) {
        try {
          await ShopModel.create({ date: dateStr, events: [newEvent] });
        } catch (err) {
          console.error(`❌ Failed to create date doc for ${orderId}:`, err);
        }
      }
    }
  }
}

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
      return;
    }
  }

  // Trigger background check for delayed credits
  processDelayedCredits(shop, adminClient).catch(err => console.error("❌ Error processing delayed credits:", err));

  // 1. Fetch loyalty programs (and app active status implicitly or explicitly if needed)
  try {
    const appActiveRes = await adminClient.graphql(`#graphql
      query GetAppActive { shop { metafield(namespace: "loyalty_cashback_app", key: "app_active") { value } } }
    `);
    const appActiveData = await appActiveRes.json();
    if (appActiveData?.data?.shop?.metafield?.value === "false") {
      console.log('[-] Aborted: App is currently INACTIVE.');
      return;
    }
  } catch (err) {
    console.error("Error fetching app_active status:", err);
  }

  const programs = await getShopPrograms(adminClient);
  if (!programs?.length || (programs[0].status !== "Active" && programs[0].status !== "true" && programs[0].status !== true)) {
    console.log('[-] Aborted: No Active loyalty programs configured.');
    return;
  }
  const program = programs[0];

  // 2. Database connection & existing check
  try { await connectMongoDB(); } catch (err) { return console.error("❌ MongoDB connection failed:", err); }
  
  const ShopModel = getCustomerModel(shop);
  if (!ShopModel) return console.error("❌ ShopModel could not be initialized");
  
  const todayStr = new Date().toISOString().split("T")[0];
  const existingDoc = await ShopModel.findOne({ "events.orderId": orderId });
  const existingTx = existingDoc?.events?.find((e: any) => e.orderId === orderId);

  const customerName = `${orderPayload?.customer?.first_name || ""} ${orderPayload?.customer?.last_name || ""}`.trim() || "Anonymous Customer";
  const currencyCode = orderPayload.presentment_currency || orderPayload.currency || 'USD';
  const orderGid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;
  
  const gateways = orderPayload.payment_gateway_names || [];
  const hasStoreCreditGateway = gateways.some((g: string) => g.toLowerCase().includes("store_credit") || g.toLowerCase().includes("store credit"));
  
  let redeemedAmount = existingTx?.redeemedAmount || 0;

  // Calculate cashback Amount
  const mappedOrder = {
    current_total_price: orderPayload.current_total_price,
    currency: orderPayload.currency,
    line_items: orderPayload.line_items?.map((item: any) => ({
      price: item.price,
      quantity: item.quantity
    })) || []
  };
  const cashbackAmount = existingTx?.issuedAmount || calculateCashbackAmount(program, mappedOrder);

  // Helper for setting Metafields
  const getOrderMetafields = (status: string, notifyEvent: any) => [
    { ownerId: orderGid, namespace: "loyalty_cashback_app", key: "issued_amount", type: "number_decimal", value: String(cashbackAmount) },
    { ownerId: orderGid, namespace: "loyalty_cashback_app", key: "currency", type: "single_line_text_field", value: String(currencyCode) },
    { ownerId: orderGid, namespace: "loyalty_cashback_app", key: "cashback_notify", type: "json", value: JSON.stringify({ ...notifyEvent, status }) }
  ];

  if (topic === 'ORDERS_CREATE') {
    if (existingTx) return console.log(`[-] Order ${orderName} already in DB. Skipping duplicate.`);
    if (cashbackAmount <= 0 && !hasStoreCreditGateway) return console.log(`[-] Cashback 0 and no store credit used. Skipping.`);

    try {
      const getOrderTxsQuery = `#graphql
        query getOrderTransactions($id: ID!) {
          order(id: $id) {
            transactions(first: 10) { gateway kind status amountSet { presentmentMoney { amount } } }
          }
        }`;
      const res = await adminClient.graphql(getOrderTxsQuery, { variables: { id: orderGid } });
      const data = await res.json();
      redeemedAmount = extractRedeemedAmount(data?.data?.order?.transactions || [], hasStoreCreditGateway, orderPayload.total_discounts || "0");
      if (redeemedAmount > 0) console.log(`[Store Credit Applied] ${redeemedAmount} for order ${orderName}`);
    } catch (err) {
      console.error("❌ Error fetching order transactions:", err);
    }

    const newEvent = {
      shop, orderId, orderName, customerId, customerName,
      issuedAmount: cashbackAmount, currency: currencyCode,
      status: "Pending", emailStatus: "Not Sent",
      programType: program.programType === "custom" ? "Custom Program" : "Cashback",
      redeemedAmount, issuedAt: null, createdAt: new Date()
    };

    await upsertOrderEvent(ShopModel, todayStr, orderId, newEvent);
    await updateOrderShopifyData(adminClient, orderId, getOrderMetafields("Pending", newEvent));

    console.log(`🎉 Order ${orderName} saved as PENDING in MongoDB.`);
  } 
  else if (topic === 'ORDERS_FULFILLED') {
    if (existingTx && existingTx.status === "Completed") return console.log(`[-] Order ${orderName} already Completed. Skipping.`);

    const isFulfilled = orderPayload.fulfillment_status === 'fulfilled';
    if (!isFulfilled) return console.log(`[-] Order ${orderName} is not fully fulfilled. Status: ${orderPayload.fulfillment_status}`);

    if (cashbackAmount <= 0) return;

    const isPaymentSuccessful = ['paid', 'partially_paid', 'authorized'].includes(orderPayload.financial_status || '');
    const customerEmail = orderPayload.customer?.email || orderPayload.email || "";
    const hasValidEmail = typeof customerEmail === 'string' && customerEmail.trim().length > 0 && customerEmail.includes('@');
    const isNotifyEmailSettingTrue = !!program.notifyEmail;
    
    const shouldNotify = isNotifyEmailSettingTrue && isPaymentSuccessful && isFulfilled && hasValidEmail;
    let computedEmailStatus = "Not Sent", computedEmailFailReason = "";
    
    if (isNotifyEmailSettingTrue) {
      if (!isPaymentSuccessful) { computedEmailStatus = "Failed"; computedEmailFailReason = `Payment status: ${orderPayload.financial_status}`; }
      else if (!isFulfilled) { computedEmailStatus = "Failed"; computedEmailFailReason = "Not fulfilled"; }
      else if (!hasValidEmail) { computedEmailStatus = "Failed"; computedEmailFailReason = "Invalid/missing email"; }
      else { computedEmailStatus = "Sent"; }
    } else {
      computedEmailFailReason = "notifyEmail disabled";
    }

    const delayDaysNum = parseInt(program.delayDays || "0", 10);
    const hasDelay = !!program.enableDelay && delayDaysNum > 0;
    const expiresAt = calculateExpirationDate(program);
    const exchangeRate = parseFloat(orderPayload.total_price || "0") > 0 ? parseFloat(orderPayload.total_price || "0") / parseFloat(orderPayload.current_total_price || "0") : 1;

    if (hasDelay) {
      if (existingTx?.processAt) return console.log(`[-] Order ${orderName} already scheduled for delay.`);
      
      const processAt = new Date();
      processAt.setDate(processAt.getDate() + delayDaysNum);
      
      const delayEvent = {
        shop, orderId, orderName, customerId, customerName,
        issuedAmount: cashbackAmount, currency: currencyCode, exchangeRate,
        status: "Pending", emailStatus: "Not Sent", emailFailReason: "",
        programType: program.programType === "custom" ? "Custom Program" : "Cashback",
        redeemedAmount, issuedAt: null, processAt, expiresAt, shouldNotify, createdAt: existingTx?.createdAt || new Date()
      };
      
      await upsertOrderEvent(ShopModel, todayStr, orderId, delayEvent, existingDoc?._id);
      console.log(`🎉 Scheduled order ${orderName} for delay (${delayDaysNum} days).`);
      return;
    }

    const storeCreditResult = await addStoreCredit(adminClient, customerId, cashbackAmount, currencyCode, expiresAt, shouldNotify, exchangeRate);
    const isSuccessful = storeCreditResult && (!storeCreditResult.userErrors?.length) && storeCreditResult.storeCreditAccountTransaction;

    let finalEmailStatus = computedEmailStatus, finalEmailFailReason = computedEmailFailReason;
    if (storeCreditResult?.emailUnsupported) {
      finalEmailStatus = "Failed";
      finalEmailFailReason = "Shopify API version unsupported for email";
    }

    const eventToSave = {
      shop, orderId, orderName, customerId, customerName,
      issuedAmount: cashbackAmount, currency: currencyCode, exchangeRate,
      status: isSuccessful ? "Completed" : "Failed",
      emailStatus: isSuccessful ? finalEmailStatus : "Failed",
      emailFailReason: isSuccessful ? finalEmailFailReason : (storeCreditResult?.userErrors?.map((e:any) => e.message).join(", ") || "Failed"),
      programType: program.programType === "custom" ? "Custom Program" : "Cashback",
      redeemedAmount, issuedAt: new Date(), createdAt: existingTx?.createdAt || new Date()
    };

    await upsertOrderEvent(ShopModel, todayStr, orderId, eventToSave, existingDoc?._id);

    if (isSuccessful) {
      const appNote = `[Loyalty App] Issued ${cashbackAmount} ${currencyCode} store credit.`;
      const currentNote = orderPayload.note || "";
      const updatedNote = currentNote.includes(appNote) ? undefined : (currentNote ? `${currentNote}\n${appNote}` : appNote);
      
      await updateOrderShopifyData(adminClient, orderId, getOrderMetafields("Completed", eventToSave), updatedNote);
      console.log(`🎉 Updated order ${orderName} to COMPLETED.`);
    } else {
      console.log(`❌ Store credit issue failed for ${orderName}: ${eventToSave.emailFailReason}`);
    }
  }
}

export async function processDelayedCredits(shop: string, adminClient: AdminClient) {
  try {
    await connectMongoDB();
    const ShopModel = getCustomerModel(shop);
    if (!ShopModel) return console.error("❌ ShopModel could not be initialized for delayed credits");

    const now = new Date();
    const docs = await ShopModel.find({ "events": { $elemMatch: { status: "Pending", processAt: { $lte: now } } } });
    if (!docs?.length) return;

    const programs = await getShopPrograms(adminClient);
    if (!programs?.length) return console.log('[-] Aborted delayed processing: No programs.');
    const program = programs[0];

    for (const doc of docs) {
      for (const ev of doc.events) {
        if (ev.status === "Pending" && ev.processAt && ev.processAt <= now) {
          console.log(`[+] Processing delayed credit for Order ${ev.orderName}`);

          const expiresAt = ev.expiresAt ? ev.expiresAt.toISOString() : calculateExpirationDate(program);
          const shouldNotify = ev.shouldNotify ?? !!program.notifyEmail;

          const res = await addStoreCredit(adminClient, ev.customerId, ev.issuedAmount, ev.currency || 'USD', expiresAt, shouldNotify, ev.exchangeRate);
          const isSuccessful = res && !res.userErrors?.length && res.storeCreditAccountTransaction;

          let emailStatus = ev.emailStatus || "Not Sent";
          let failReason = ev.emailFailReason || "";

          if (isSuccessful) {
            if (program.notifyEmail) {
              emailStatus = res.emailUnsupported ? "Failed" : "Sent";
              failReason = res.emailUnsupported ? "Unsupported API" : "";
            }
            
            ev.status = "Completed"; ev.emailStatus = emailStatus; ev.emailFailReason = failReason; ev.issuedAt = new Date();
            await ShopModel.updateOne({ _id: doc._id, "events.orderId": ev.orderId }, { $set: { "events.$": ev } });
            
            const appNote = `[Loyalty App] Issued ${ev.issuedAmount} ${ev.currency || 'USD'} store credit (Delayed).`;
            const orderGid = ev.orderId.startsWith("gid://") ? ev.orderId : `gid://shopify/Order/${ev.orderId}`;
            
            // Re-fetch note to safely append, then update metafields + note
            const noteRes = await adminClient.graphql(`#graphql
              query { order(id: "${orderGid}") { note } }
            `);
            const noteData = await noteRes.json();
            const currentNote = noteData?.data?.order?.note || "";
            const updatedNote = currentNote.includes(appNote) ? undefined : (currentNote ? `${currentNote}\n${appNote}` : appNote);
            
            await updateOrderShopifyData(adminClient, ev.orderId, [
              { ownerId: orderGid, namespace: "loyalty_cashback_app", key: "issued_amount", type: "number_decimal", value: String(ev.issuedAmount) },
              { ownerId: orderGid, namespace: "loyalty_cashback_app", key: "currency", type: "single_line_text_field", value: String(ev.currency) },
              { ownerId: orderGid, namespace: "loyalty_cashback_app", key: "cashback_notify", type: "json", value: JSON.stringify(ev) }
            ], updatedNote);
            
            console.log(`🎉 [Delayed] Updated order ${ev.orderName} to COMPLETED.`);
          } else {
            ev.status = "Failed"; ev.emailStatus = "Failed";
            ev.emailFailReason = res?.userErrors?.map((e:any) => e.message).join(", ") || "Failed";
            await ShopModel.updateOne({ _id: doc._id, "events.orderId": ev.orderId }, { $set: { "events.$": ev } });
            console.log(`❌ [Delayed] Failed for ${ev.orderName}: ${ev.emailFailReason}`);
          }
        }
      }
    }
  } catch (err) {
    console.error("❌ Error processing delayed credits:", err);
  }
}
