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

// ─── Types ───────────────────────────────────────────────────────────────────

interface Metafield {
  ownerId: string;
  namespace: string;
  key: string;
  type: string;
  value: string;
}

interface OrderEvent {
  shop: string;
  orderId: string;
  orderName: string;
  customerId: string;
  customerName: string;
  issuedAmount: number;
  currency: string;
  status: string;
  emailStatus: string;
  emailFailReason?: string;
  programType: string;
  redeemedAmount: number;
  issuedAt: Date | null;
  createdAt: Date;
  exchangeRate?: number;
  processAt?: Date;
  expiresAt?: string | null;
  shouldNotify?: boolean;
  programId?: string;
  programName?: string;
}

// ─── Shopify Helpers ──────────────────────────────────────────────────────────

async function updateOrderShopifyData(
  adminClient: AdminClient,
  orderId: string,
  metafields: Metafield[],
  note?: string,
): Promise<void> {
  try {
    const orderGid = toGid('Order', orderId);
    const hasNote = typeof note === 'string';

    const mutation = `#graphql
      mutation UpdateOrderShopifyData(
        $metafields: [MetafieldsSetInput!]!
        ${hasNote ? ', $input: OrderInput!' : ''}
      ) {
        metafieldsSet(metafields: $metafields) {
          userErrors { field message }
        }
        ${hasNote ? `
        orderUpdate(input: $input) {
          userErrors { field message }
        }` : ''}
      }
    `;

    const variables: Record<string, unknown> = { metafields };
    if (hasNote) {
      variables.input = { id: orderGid, note };
    }

    const response = await adminClient.graphql(mutation, { variables });
    const data = await response.json();

    logErrors(`metafields on Order ${orderId}`, data?.data?.metafieldsSet?.userErrors);
    if (hasNote) {
      logErrors(`note on Order ${orderId}`, data?.data?.orderUpdate?.userErrors);
    }
  } catch (err) {
    console.error(`❌ Error updating Shopify data for Order ${orderId}:`, err);
  }
}

function buildOrderMetafields(
  orderGid: string,
  cashbackAmount: number,
  currencyCode: string,
  notifyEvent: OrderEvent,
  status: string,
): Metafield[] {
  return [
    { ownerId: orderGid, namespace: 'loyalty_cashback_app', key: 'issued_amount', type: 'number_decimal', value: String(cashbackAmount) },
    { ownerId: orderGid, namespace: 'loyalty_cashback_app', key: 'currency', type: 'single_line_text_field', value: String(currencyCode) },
    { ownerId: orderGid, namespace: 'loyalty_cashback_app', key: 'cashback_notify', type: 'json', value: JSON.stringify({ ...notifyEvent, status }) },
  ];
}

// ─── Utility Helpers ──────────────────────────────────────────────────────────

function toGid(type: string, id: string): string {
  return id.startsWith('gid://') ? id : `gid://shopify/${type}/${id}`;
}

function logErrors(context: string, errors?: { field: string; message: string }[]): void {
  if (errors?.length) {
    console.error(`❌ Failed to set ${context}:`, errors);
  } else {
    console.log(`✅ Successfully set ${context}`);
  }
}

function appendNoteIfMissing(currentNote: string, appNote: string): string | undefined {
  if (currentNote.includes(appNote)) return undefined;
  return currentNote ? `${currentNote}\n${appNote}` : appNote;
}

// ─── Store Credit Helpers ─────────────────────────────────────────────────────

function extractRedeemedAmount(
  txs: any[],
  hasStoreCreditGateway: boolean,
  totalDiscounts: string,
): number {
  const storeCreditTxs = (txs ?? []).filter((tx) => {
    const gateway = (tx.gateway ?? '').toLowerCase();
    const isStoreCredit = gateway.includes('store_credit') || gateway.includes('store credit');
    const isSuccess = !tx.status || tx.status.toUpperCase() === 'SUCCESS';
    return isStoreCredit && isSuccess;
  });

  const hasCaptureOrSale = storeCreditTxs.some(
    (tx) => tx.kind === 'CAPTURE' || tx.kind === 'SALE',
  );

  let redeemedAmount = 0;
  for (const tx of storeCreditTxs) {
    const amount = parseFloat(tx.amountSet?.presentmentMoney?.amount ?? '0');
    if (hasCaptureOrSale) {
      if (tx.kind === 'CAPTURE' || tx.kind === 'SALE') redeemedAmount += amount;
    } else {
      if (tx.kind === 'AUTHORIZATION') redeemedAmount += amount;
    }
  }

  if (redeemedAmount === 0 && hasStoreCreditGateway) {
    redeemedAmount = parseFloat(totalDiscounts ?? '0');
  }

  return Number(redeemedAmount.toFixed(2));
}

// ─── MongoDB Helpers ──────────────────────────────────────────────────────────

async function upsertOrderEvent(
  ShopModel: any,
  dateStr: string,
  orderId: string,
  newEvent: OrderEvent,
  existingDocId?: string,
): Promise<void> {
  if (existingDocId) {
    await ShopModel.updateOne(
      { _id: existingDocId, 'events.orderId': orderId },
      { $set: { 'events.$': newEvent } },
    );
    return;
  }

  const updateResult = await ShopModel.updateOne(
    { date: dateStr, 'events.orderId': { $ne: orderId } },
    { $push: { events: newEvent } },
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

// ─── Webhook Handlers ─────────────────────────────────────────────────────────

async function handleOrderCreate(
  ctx: WebhookContext,
  existingTx: OrderEvent | undefined,
): Promise<void> {
  const { adminClient, orderPayload, shop, program, ShopModel, todayStr,
    customerId, customerName, orderId, orderName, orderGid,
    cashbackAmount, currencyCode } = ctx;

  if (existingTx) {
    return console.log(`[-] Order ${orderName} already in DB. Skipping duplicate.`);
  }

  const gateways: string[] = orderPayload.payment_gateway_names ?? [];
  const hasStoreCreditGateway = gateways.some(
    (g) => g.toLowerCase().includes('store_credit') || g.toLowerCase().includes('store credit'),
  );

  if (cashbackAmount <= 0 && !hasStoreCreditGateway) {
    return console.log(`[-] Cashback 0 and no store credit used. Skipping.`);
  }

  let redeemedAmount = 0;
  try {
    const res = await adminClient.graphql(
      `#graphql
        query getOrderTransactions($id: ID!) {
          order(id: $id) {
            transactions(first: 10) {
              gateway kind status
              amountSet { presentmentMoney { amount } }
            }
          }
        }`,
      { variables: { id: orderGid } },
    );
    const data = await res.json();
    redeemedAmount = extractRedeemedAmount(
      data?.data?.order?.transactions ?? [],
      hasStoreCreditGateway,
      orderPayload.total_discounts ?? '0',
    );
    if (redeemedAmount > 0) {
      console.log(`[Store Credit Applied] ${redeemedAmount} for order ${orderName}`);
    }
  } catch (err) {
    console.error('❌ Error fetching order transactions:', err);
  }

  const newEvent: OrderEvent = {
    shop, orderId, orderName, customerId, customerName,
    issuedAmount: cashbackAmount, currency: currencyCode,
    status: 'Pending', emailStatus: 'Not Sent',
    programType: program.programType === 'custom' ? 'Custom Program' : 'Cashback',
    programId: program.programId || program.id,
    programName: program.programName || program.internalName || program.name,
    redeemedAmount, issuedAt: null, createdAt: new Date(),
  };

  await upsertOrderEvent(ShopModel, todayStr, orderId, newEvent);
  await updateOrderShopifyData(
    adminClient, orderId, buildOrderMetafields(orderGid, cashbackAmount, currencyCode, newEvent, 'Pending'),
  );
  console.log(`🎉 Order ${orderName} saved as PENDING in MongoDB.`);
}

async function handleOrderFulfilled(
  ctx: WebhookContext,
  existingTx: OrderEvent | undefined,
  existingDocId?: string,
): Promise<void> {
  const { adminClient, orderPayload, shop, program, ShopModel, todayStr,
    customerId, customerName, orderId, orderName, orderGid,
    cashbackAmount, currencyCode } = ctx;

  if (existingTx?.status === 'Completed') {
    return console.log(`[-] Order ${orderName} already Completed. Skipping.`);
  }

  if (orderPayload.fulfillment_status !== 'fulfilled') {
    return console.log(`[-] Order ${orderName} is not fully fulfilled. Status: ${orderPayload.fulfillment_status}`);
  }

  if (cashbackAmount <= 0) return;

  const isPaymentSuccessful = ['paid', 'partially_paid', 'authorized'].includes(
    orderPayload.financial_status ?? '',
  );
  const customerEmail: string = orderPayload.customer?.email ?? orderPayload.email ?? '';
  const hasValidEmail = customerEmail.trim().length > 0 && customerEmail.includes('@');
  const isNotifyEnabled = !!program.notifyEmail;
  const shouldNotify = isNotifyEnabled && isPaymentSuccessful && hasValidEmail;

  const { emailStatus: computedEmailStatus, emailFailReason: computedFailReason } =
    resolveEmailStatus(isNotifyEnabled, isPaymentSuccessful, orderPayload.financial_status, hasValidEmail);

  const delayDays = parseInt(program.delayDays ?? '0', 10);
  const hasDelay = !!program.enableDelay && delayDays > 0;
  const expiresAt = calculateExpirationDate(program);
  const exchangeRate =
    parseFloat(orderPayload.total_price ?? '0') > 0
      ? parseFloat(orderPayload.total_price ?? '0') / parseFloat(orderPayload.current_total_price ?? '0')
      : 1;

  const gateways: string[] = orderPayload.payment_gateway_names ?? [];
  const hasStoreCreditGateway = gateways.some(
    (g) => g.toLowerCase().includes('store_credit') || g.toLowerCase().includes('store credit'),
  );
  const redeemedAmount = existingTx?.redeemedAmount ?? 0;

  if (hasDelay) {
    if (existingTx?.processAt) {
      return console.log(`[-] Order ${orderName} already scheduled for delay.`);
    }

    const processAt = new Date();
    processAt.setDate(processAt.getDate() + delayDays);

    const delayEvent: OrderEvent = {
      shop, orderId, orderName, customerId, customerName,
      issuedAmount: cashbackAmount, currency: currencyCode, exchangeRate,
      status: 'Pending', emailStatus: 'Not Sent', emailFailReason: '',
      programType: program.programType === 'custom' ? 'Custom Program' : 'Cashback',
      programId: program.programId || program.id,
      programName: program.programName || program.internalName || program.name,
      redeemedAmount, issuedAt: null, processAt, expiresAt, shouldNotify,
      createdAt: existingTx?.createdAt ?? new Date(),
    };

    await upsertOrderEvent(ShopModel, todayStr, orderId, delayEvent, existingDocId);
    console.log(`🎉 Scheduled order ${orderName} for delay (${delayDays} days).`);
    return;
  }

  const storeCreditResult = await addStoreCredit(
    adminClient, customerId, cashbackAmount, currencyCode, expiresAt, shouldNotify, exchangeRate,
  );
  const isSuccessful =
    storeCreditResult &&
    !storeCreditResult.userErrors?.length &&
    storeCreditResult.storeCreditAccountTransaction;

  let finalEmailStatus = computedEmailStatus;
  let finalEmailFailReason = computedFailReason;
  if (storeCreditResult?.emailUnsupported) {
    finalEmailStatus = 'Failed';
    finalEmailFailReason = 'Shopify API version unsupported for email';
  }

  const eventToSave: OrderEvent = {
    shop, orderId, orderName, customerId, customerName,
    issuedAmount: cashbackAmount, currency: currencyCode, exchangeRate,
    status: isSuccessful ? 'Completed' : 'Failed',
    emailStatus: isSuccessful ? finalEmailStatus : 'Failed',
    emailFailReason: isSuccessful
      ? finalEmailFailReason
      : storeCreditResult?.userErrors?.map((e: any) => e.message).join(', ') ?? 'Failed',
    programType: program.programType === 'custom' ? 'Custom Program' : 'Cashback',
    programId: program.programId || program.id,
    programName: program.programName || program.internalName || program.name,
    redeemedAmount, issuedAt: new Date(), createdAt: existingTx?.createdAt ?? new Date(),
  };

  await upsertOrderEvent(ShopModel, todayStr, orderId, eventToSave, existingDocId);

  if (isSuccessful) {
    const appNote = `[Loyalty App] Issued ${cashbackAmount} ${currencyCode} store credit.`;
    const updatedNote = appendNoteIfMissing(orderPayload.note ?? '', appNote);
    await updateOrderShopifyData(
      adminClient, orderId,
      buildOrderMetafields(orderGid, cashbackAmount, currencyCode, eventToSave, 'Completed'),
      updatedNote,
    );
    console.log(`🎉 Updated order ${orderName} to COMPLETED.`);
  } else {
    console.log(`❌ Store credit issue failed for ${orderName}: ${eventToSave.emailFailReason}`);
  }
}

// ─── Email Status Resolver ────────────────────────────────────────────────────

function resolveEmailStatus(
  isNotifyEnabled: boolean,
  isPaymentSuccessful: boolean,
  financialStatus: string | undefined,
  hasValidEmail: boolean,
): { emailStatus: string; emailFailReason: string } {
  if (!isNotifyEnabled) {
    return { emailStatus: 'Not Sent', emailFailReason: 'notifyEmail disabled' };
  }
  if (!isPaymentSuccessful) {
    return { emailStatus: 'Failed', emailFailReason: `Payment status: ${financialStatus}` };
  }
  if (!hasValidEmail) {
    return { emailStatus: 'Failed', emailFailReason: 'Invalid/missing email' };
  }
  return { emailStatus: 'Sent', emailFailReason: '' };
}

// ─── Context Builder ──────────────────────────────────────────────────────────

interface WebhookContext {
  adminClient: AdminClient;
  orderPayload: ShopifyOrderPayload;
  shop: string;
  program: any;
  ShopModel: any;
  todayStr: string;
  customerId: string;
  customerName: string;
  orderId: string;
  orderName: string;
  orderGid: string;
  cashbackAmount: number;
  currencyCode: string;
}

// ─── Main Webhook Processor ───────────────────────────────────────────────────

export async function processOrderWebhook(
  shop: string,
  admin: AdminClient | undefined,
  orderPayload: ShopifyOrderPayload,
  topic: string,
): Promise<void> {
  const numericCustomerId = orderPayload?.customer?.id;
  if (!numericCustomerId) {
    return console.log('❌ No customer ID found in order');
  }

  const customerId = `gid://shopify/Customer/${numericCustomerId}`;
  const orderId = String(orderPayload?.id ?? '');
  const orderName = String(orderPayload?.name ?? '');
  const orderGid = toGid('Order', orderId);

  console.log(`[+] Processing ${topic} for Order ${orderName} (${orderId})`);

  let adminClient = admin;
  if (!adminClient) {
    try {
      const { admin: unauthAdmin } = await unauthenticated.admin(shop);
      adminClient = unauthAdmin;
    } catch (err) {
      return console.error(`❌ Failed unauthenticated admin lookup for ${shop}:`, err);
    }
  }

  // Background: process any delayed credits
  processDelayedCredits(shop, adminClient).catch(
    (err) => console.error('❌ Error processing delayed credits:', err),
  );

  // Check if the app is active
  try {
    const res = await adminClient.graphql(`#graphql
      query GetAppActive {
        shop { metafield(namespace: "loyalty_cashback_app", key: "app_active") { value } }
      }
    `);
    const data = await res.json();
    if (data?.data?.shop?.metafield?.value === 'false') {
      return console.log('[-] Aborted: App is currently INACTIVE.');
    }
  } catch (err) {
    console.error('Error fetching app_active status:', err);
  }

  // Fetch loyalty program
  const programs = await getShopPrograms(adminClient);
  const program = programs?.[0];
  const isActive =
    program?.status === 'Active' || program?.status === 'true' || program?.status === true;

  if (!programs?.length || !isActive) {
    return console.log('[-] Aborted: No Active loyalty programs configured.');
  }

  // Connect to DB
  try {
    await connectMongoDB();
  } catch (err) {
    return console.error('❌ MongoDB connection failed:', err);
  }

  const ShopModel = getCustomerModel(shop);
  if (!ShopModel) return console.error('❌ ShopModel could not be initialized');

  const todayStr = new Date().toISOString().split('T')[0];
  const existingDoc = await ShopModel.findOne({ 'events.orderId': orderId });
  const existingTx: OrderEvent | undefined = existingDoc?.events?.find(
    (e: any) => e.orderId === orderId,
  );

  const customerName =
    `${orderPayload?.customer?.first_name ?? ''} ${orderPayload?.customer?.last_name ?? ''}`.trim() || 'Anonymous Customer';
  const currencyCode = orderPayload.presentment_currency ?? orderPayload.currency ?? 'USD';

  const mappedOrder = {
    current_total_price: orderPayload.current_total_price,
    currency: orderPayload.currency,
    line_items: orderPayload.line_items?.map((item: any) => ({
      price: item.price,
      quantity: item.quantity,
    })) ?? [],
  };
  const cashbackAmount = existingTx?.issuedAmount ?? calculateCashbackAmount(program, mappedOrder);

  const ctx: WebhookContext = {
    adminClient, orderPayload, shop, program, ShopModel, todayStr,
    customerId, customerName, orderId, orderName, orderGid,
    cashbackAmount, currencyCode,
  };

  if (topic === 'ORDERS_CREATE') {
    await handleOrderCreate(ctx, existingTx);
  } else if (topic === 'ORDERS_FULFILLED') {
    await handleOrderFulfilled(ctx, existingTx, existingDoc?._id);
  }
}

// ─── Delayed Credits Processor ────────────────────────────────────────────────

export async function processDelayedCredits(
  shop: string,
  adminClient: AdminClient,
): Promise<void> {
  try {
    await connectMongoDB();
    const ShopModel = getCustomerModel(shop);
    if (!ShopModel) {
      return console.error('❌ ShopModel could not be initialized for delayed credits');
    }

    const now = new Date();
    const docs = await ShopModel.find({
      events: { $elemMatch: { status: 'Pending', processAt: { $lte: now } } },
    });
    if (!docs?.length) return;

    const programs = await getShopPrograms(adminClient);
    if (!programs?.length) {
      return console.log('[-] Aborted delayed processing: No programs.');
    }
    const program = programs[0];

    for (const doc of docs) {
      for (const ev of doc.events) {
        const isReady = ev.status === 'Pending' && ev.processAt && ev.processAt <= now;
        if (!isReady) continue;

        console.log(`[+] Processing delayed credit for Order ${ev.orderName}`);

        const expiresAt = ev.expiresAt?.toISOString() ?? calculateExpirationDate(program);
        const shouldNotify = ev.shouldNotify ?? !!program.notifyEmail;

        const res = await addStoreCredit(
          adminClient, ev.customerId, ev.issuedAmount, ev.currency ?? 'USD',
          expiresAt, shouldNotify, ev.exchangeRate,
        );
        const isSuccessful = res && !res.userErrors?.length && res.storeCreditAccountTransaction;

        if (isSuccessful) {
          const emailFailed = res.emailUnsupported;
          ev.status = 'Completed';
          ev.emailStatus = program.notifyEmail ? (emailFailed ? 'Failed' : 'Sent') : ev.emailStatus;
          ev.emailFailReason = emailFailed ? 'Unsupported API' : '';
          ev.issuedAt = new Date();

          await ShopModel.updateOne(
            { _id: doc._id, 'events.orderId': ev.orderId },
            { $set: { 'events.$': ev } },
          );

          const appNote = `[Loyalty App] Issued ${ev.issuedAmount} ${ev.currency ?? 'USD'} store credit (Delayed).`;
          const orderGid = toGid('Order', ev.orderId);

          const noteRes = await adminClient.graphql(`#graphql
            query { order(id: "${orderGid}") { note } }
          `);
          const noteData = await noteRes.json();
          const updatedNote = appendNoteIfMissing(noteData?.data?.order?.note ?? '', appNote);

          await updateOrderShopifyData(adminClient, ev.orderId, [
            { ownerId: orderGid, namespace: 'loyalty_cashback_app', key: 'issued_amount', type: 'number_decimal', value: String(ev.issuedAmount) },
            { ownerId: orderGid, namespace: 'loyalty_cashback_app', key: 'currency', type: 'single_line_text_field', value: String(ev.currency) },
            { ownerId: orderGid, namespace: 'loyalty_cashback_app', key: 'cashback_notify', type: 'json', value: JSON.stringify(ev) },
          ], updatedNote);

          console.log(`🎉 [Delayed] Updated order ${ev.orderName} to COMPLETED.`);
        } else {
          ev.status = 'Failed';
          ev.emailStatus = 'Failed';
          ev.emailFailReason = res?.userErrors?.map((e: any) => e.message).join(', ') ?? 'Failed';

          await ShopModel.updateOne(
            { _id: doc._id, 'events.orderId': ev.orderId },
            { $set: { 'events.$': ev } },
          );
          console.log(`❌ [Delayed] Failed for ${ev.orderName}: ${ev.emailFailReason}`);
        }
      }
    }
  } catch (err) {
    console.error('❌ Error processing delayed credits:', err);
  }
}