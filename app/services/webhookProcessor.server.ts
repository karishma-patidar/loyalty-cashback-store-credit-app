import { unauthenticated } from '../shopify.server';
import {
  getShopPrograms,
  addStoreCredit,
  calculateCashbackAmount,
  calculateExpirationDate,
  AdminClient,
  ShopifyOrderPayload,
  ProgramSettings,
} from './storeCredit.server';
import { connectMongoDB, getCustomerModel } from '../db.mongodb.server';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Metafield {
  ownerId: string;
  namespace: string;
  key: string;
  type: string;
  value: string;
}

interface ShopifyTransaction {
  gateway?: string;
  status?: string;
  kind?: string;
  amountSet?: {
    presentmentMoney?: {
      amount?: string;
    };
  };
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
  expiresAt?: Date | string | null;
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
  const payload = {
    [currencyCode]: {
      ...notifyEvent,
      status,
      issuedAmount: cashbackAmount,
      currency: currencyCode,
    }
  };
  return [
    { ownerId: orderGid, namespace: 'loyalty_cashback_app', key: 'cashback_notify', type: 'json', value: JSON.stringify(payload) },
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
  txs: ShopifyTransaction[],
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
  ShopModel: ReturnType<typeof getCustomerModel>,
  dateStr: string,
  orderId: string,
  newEvent: OrderEvent,
  existingDocId?: string,
): Promise<void> {
  if (!ShopModel) return;
  const programId = newEvent.programId;

  if (existingDocId) {
    const query: Record<string, unknown> = { _id: existingDocId, 'events.orderId': orderId };
    const arrayFilters: Record<string, unknown>[] = [{ 'elem.orderId': orderId }];

    if (programId) {
      query['events.programId'] = programId;
      arrayFilters[0]['elem.programId'] = programId;
    } else {
      query['events.programId'] = { $exists: false };
      arrayFilters[0]['elem.programId'] = { $exists: false };
    }

    const updateResult = await ShopModel.updateOne(
      query,
      { $set: { 'events.$[elem]': newEvent } },
      { arrayFilters }
    );
    
    if (updateResult.matchedCount > 0 || updateResult.modifiedCount > 0) {
      return;
    }

    // Event wasn't found in the array, push it
    await ShopModel.updateOne(
      { _id: existingDocId },
      { $push: { events: newEvent } }
    );
    return;
  }

  const elemMatchQuery: Record<string, unknown> = { orderId };
  if (programId) {
    elemMatchQuery.programId = programId;
  } else {
    elemMatchQuery.programId = { $exists: false };
  }

  const updateResult = await ShopModel.updateOne(
    { date: dateStr, 'events': { $not: { $elemMatch: elemMatchQuery } } },
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

  const programId = program.programId || program.id;

  if (existingTx) {
    return console.log(`[-] Order ${orderName} already in DB for program ${programId}. Skipping duplicate.`);
  }

  const gateways: string[] = orderPayload.payment_gateway_names ?? [];
  const hasStoreCreditGateway = gateways.some(
    (g) => g.toLowerCase().includes('store_credit') || g.toLowerCase().includes('store credit'),
  );

  if (cashbackAmount <= 0 && !hasStoreCreditGateway) {
    return console.log(`[-] Cashback 0 and no store credit used for program ${programId}. Skipping.`);
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

  const isCustom = program.programType === 'custom';
  const newEvent: OrderEvent = {
    shop, orderId, orderName, customerId, customerName,
    issuedAmount: cashbackAmount, currency: currencyCode,
    status: 'Pending', emailStatus: 'Not Sent',
    programType: isCustom ? 'Custom Program' : 'Cashback',
    ...(isCustom ? { programId } : {}),
    programName: program.programName || program.internalName || program.name,
    redeemedAmount, issuedAt: null, createdAt: new Date(),
  };

  await upsertOrderEvent(ShopModel, todayStr, orderId, newEvent);
  await updateOrderShopifyData(
    adminClient, orderId, buildOrderMetafields(orderGid, cashbackAmount, currencyCode, newEvent, 'Pending'),
  );
  console.log(`🎉 Order ${orderName} saved as PENDING in MongoDB for program ${programId}.`);
}

async function handleOrderFulfilled(
  ctx: WebhookContext,
  existingTx: OrderEvent | undefined,
  existingDocId?: string,
): Promise<void> {
  const { adminClient, orderPayload, shop, program, ShopModel, todayStr,
    customerId, customerName, orderId, orderName, orderGid,
    cashbackAmount, currencyCode } = ctx;

  const programId = program.programId || program.id;

  if (existingTx?.status === 'Completed') {
    return console.log(`[-] Order ${orderName} already Completed for program ${programId}. Skipping.`);
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

  const redeemedAmount = existingTx?.redeemedAmount ?? 0;

  if (hasDelay) {
    if (existingTx?.processAt) {
      return console.log(`[-] Order ${orderName} already scheduled for delay.`);
    }

    const processAt = new Date();
    processAt.setDate(processAt.getDate() + delayDays);

    const isCustom = program.programType === 'custom';
    const delayEvent: OrderEvent = {
      shop, orderId, orderName, customerId, customerName,
      issuedAmount: cashbackAmount, currency: currencyCode, exchangeRate,
      status: 'Pending', emailStatus: 'Not Sent', emailFailReason: '',
      programType: isCustom ? 'Custom Program' : 'Cashback',
      ...(isCustom ? { programId } : {}),
      programName: program.programName || program.internalName || program.name,
      redeemedAmount, issuedAt: null, processAt, expiresAt, shouldNotify,
      createdAt: existingTx?.createdAt ?? new Date(),
    };

    await upsertOrderEvent(ShopModel, todayStr, orderId, delayEvent, existingDocId);
    console.log(`🎉 Scheduled order ${orderName} for delay (${delayDays} days) for program ${programId}.`);
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

  const isCustom = program.programType === 'custom';
  const eventToSave: OrderEvent = {
    shop, orderId, orderName, customerId, customerName,
    issuedAmount: cashbackAmount, currency: currencyCode, exchangeRate,
    status: isSuccessful ? 'Completed' : 'Failed',
    emailStatus: isSuccessful ? finalEmailStatus : 'Failed',
    emailFailReason: isSuccessful
      ? finalEmailFailReason
      : storeCreditResult?.userErrors?.map((e: { message: string }) => e.message).join(', ') ?? 'Failed',
    programType: isCustom ? 'Custom Program' : 'Cashback',
    ...(isCustom ? { programId } : {}),
    programName: program.programName || program.internalName || program.name,
    redeemedAmount, issuedAt: new Date(), createdAt: existingTx?.createdAt ?? new Date(),
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  };

  await upsertOrderEvent(ShopModel, todayStr, orderId, eventToSave, existingDocId);

  if (isSuccessful) {
    const appNote = `[Loyalty App] Issued ${cashbackAmount} ${currencyCode} store credit from program ${program.programName || program.name}.`;
    const updatedNote = appendNoteIfMissing(orderPayload.note ?? '', appNote);
    await updateOrderShopifyData(
      adminClient, orderId,
      buildOrderMetafields(orderGid, cashbackAmount, currencyCode, eventToSave, 'Completed'),
      updatedNote,
    );
    console.log(`🎉 Updated order ${orderName} to COMPLETED for program ${programId}.`);
  } else {
    console.log(`❌ Store credit issue failed for ${orderName} (Program ${programId}): ${eventToSave.emailFailReason}`);
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
  program: ProgramSettings;
  ShopModel: ReturnType<typeof getCustomerModel>;
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

  // Fetch all active loyalty programs
  const programs = await getShopPrograms(adminClient);
  const activePrograms = programs?.filter((p: ProgramSettings) => 
    (p.status === 'Active' || p.status === 'true' || p.status === true)
  ) || [];

  if (!activePrograms.length) {
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

  const customerName =
    `${orderPayload?.customer?.first_name ?? ''} ${orderPayload?.customer?.last_name ?? ''}`.trim() || 'Anonymous Customer';
  const currencyCode = orderPayload.presentment_currency ?? orderPayload.currency ?? 'USD';

  const mappedOrder = {
    current_total_price: orderPayload.current_total_price,
    currency: orderPayload.currency,
    line_items: orderPayload.line_items?.map((item: { price?: string; quantity?: number | string }) => ({
      price: item.price,
      quantity: item.quantity,
    })) ?? [],
  };

  // Loop through all active programs and process rewards for each one
  for (const program of activePrograms) {
    const programId = program.programId || program.id;
    const programName = program.name || program.programName || "Unknown Program";
    
    // Skip native execution for Flow programs, as they are triggered by Shopify Flow Extension
    if (program.isFlowProgram) {
        console.log(`[-] Skipping native execution of Flow Program '${programName}'. It will be handled by Shopify Flow.`);
        continue;
    }

    console.log(`[+] Evaluating program: ${programName} (${programId})`);

    const isCustom = program.programType === 'custom';
    const existingTx: OrderEvent | undefined = existingDoc?.events?.find(
      (e: OrderEvent) => e.orderId === orderId && (isCustom ? e.programId === programId : !e.programId),
    );

    const cashbackAmount = existingTx?.issuedAmount ?? calculateCashbackAmount(program, mappedOrder);

    const ctx: WebhookContext = {
      adminClient, orderPayload, shop, program, ShopModel, todayStr,
      customerId, customerName, orderId, orderName, orderGid,
      cashbackAmount, currencyCode,
    };

    try {
      if (topic === 'ORDERS_CREATE') {
        await handleOrderCreate(ctx, existingTx);
      } else if (topic === 'ORDERS_FULFILLED') {
        await handleOrderFulfilled(ctx, existingTx, existingDoc?._id);
      }
    } catch (err) {
      console.error(`❌ Error processing program ${programName} (${programId}) natively:`, err);
    }
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

    for (const doc of docs) {
      for (const ev of doc.events) {
        const isReady = ev.status === 'Pending' && ev.processAt && ev.processAt <= now;
        if (!isReady) continue;

        console.log(`[+] Processing delayed credit for Order ${ev.orderName} (Program ${ev.programId})`);

        const program = programs.find((p: ProgramSettings) => ev.programId ? (p.programId === ev.programId || p.id === ev.programId) : (!p.isFlowProgram && p.programType !== 'custom')) || programs[0];
        
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
          ev.expiresAt = expiresAt ? new Date(expiresAt) : null;

          const arrayFilters: Record<string, unknown>[] = [{ 'elem.orderId': ev.orderId }];
          if (ev.programId) {
            arrayFilters[0]['elem.programId'] = ev.programId;
          } else {
            arrayFilters[0]['elem.programId'] = { $exists: false };
          }

          await ShopModel.updateOne(
            { _id: doc._id },
            { $set: { 'events.$[elem]': ev } },
            { arrayFilters }
          );

          const appNote = `[Loyalty App] Issued ${ev.issuedAmount} ${ev.currency ?? 'USD'} store credit (Delayed, Program ${ev.programName}).`;
          const orderGid = toGid('Order', ev.orderId);

          const noteRes = await adminClient.graphql(`#graphql
            query { order(id: "${orderGid}") { note } }
          `);
          const noteData = await noteRes.json();
          const updatedNote = appendNoteIfMissing(noteData?.data?.order?.note ?? '', appNote);

          const payload = {
            [ev.currency || 'USD']: {
              ...ev,
              issuedAmount: ev.issuedAmount,
              currency: ev.currency,
              status: ev.status,
            }
          };

          await updateOrderShopifyData(adminClient, ev.orderId, [
            {
              ownerId: orderGid,
              namespace: 'loyalty_cashback_app',
              key: 'cashback_notify',
              type: 'json',
              value: JSON.stringify(payload)
            },
          ], updatedNote);

          console.log(`🎉 [Delayed] Updated order ${ev.orderName} to COMPLETED.`);
        } else {
          ev.status = 'Failed';
          ev.emailStatus = 'Failed';
          ev.emailFailReason = res?.userErrors?.map((e: { message: string }) => e.message).join(', ') ?? 'Failed';

          const arrayFilters: Record<string, unknown>[] = [{ 'elem.orderId': ev.orderId }];
          if (ev.programId) {
            arrayFilters[0]['elem.programId'] = ev.programId;
          } else {
            arrayFilters[0]['elem.programId'] = { $exists: false };
          }

          await ShopModel.updateOne(
            { _id: doc._id },
            { $set: { 'events.$[elem]': ev } },
            { arrayFilters }
          );
          console.log(`❌ [Delayed] Failed for ${ev.orderName}: ${ev.emailFailReason}`);
        }
      }
    }
  } catch (err) {
    console.error('❌ Error processing delayed credits:', err);
  }
}