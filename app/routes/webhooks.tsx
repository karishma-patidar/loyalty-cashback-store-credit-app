import { ActionFunctionArgs } from 'react-router';
import db from '../db.server';
import { authenticate } from '../shopify.server';
import {
  getShopPrograms,
  addStoreCredit,
  calculateCashbackAmount,
  calculateExpirationDate,
} from '../services/storeCredit.server';

export const action = async ({
  request,
}: ActionFunctionArgs) => {
  const clonedRequest = request.clone();

  const {
    topic,
    shop,
    session,
    admin,
  } = await authenticate.webhook(request);

  switch (topic) {
    case 'APP_UNINSTALLED':
      if (session) {
        await db.session.deleteMany({
          where: { shop },
        });
      }
      break;

    case 'CUSTOMERS_CREATE': {
      console.log(
        '=== [Webhook Received] CUSTOMERS_CREATE ==='
      );
      console.log('Shop:', shop);
      const customerPayload = await clonedRequest.json();
      console.log(
        'Customer Payload:',
        JSON.stringify(customerPayload, null, 2)
      );
      break;
    }

    case 'ORDERS_PAID': {
      console.log(
        '=== [Webhook Received] ORDERS_PAID ==='
      );
      console.log('Shop:', shop);

      const orderPayload = await clonedRequest.json();
      console.log(
        'Order Payload:',
        JSON.stringify(orderPayload, null, 2)
      );

      // ✅ Customer ID from paid order
      const numericCustomerId = orderPayload?.customer?.id;

      if (!numericCustomerId) {
        console.log(
          '❌ No customer ID found in order'
        );
        break;
      }

      // ✅ Convert to Shopify GID
      const customerId = `gid://shopify/Customer/${numericCustomerId}`;
      console.log('✅ Customer GID:', customerId);

      if (!admin) {
        console.log('❌ No admin client found');
        break;
      }

      // ✅ Fetch global app_active status
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
        const appActiveRes = await admin.graphql(appActiveQuery);
        const appActiveData = await appActiveRes.json();
        isAppActive = appActiveData?.data?.shop?.metafield?.value !== "false";
      } catch (err) {
        console.error("Error fetching app_active status:", err);
      }

      if (!isAppActive) {
        console.log('[-] Aborted: App is currently set to INACTIVE in the dashboard.');
        break;
      }

      // ✅ Fetch configured loyalty programs
      const programs = await getShopPrograms(admin);

      if (!programs || programs.length === 0) {
        console.log('[-] Aborted: No loyalty/cashback programs configured.');
        break;
      }

      const program = programs[0];
      console.log('[+] Selected Program Settings:', JSON.stringify(program));

      // Check Status
      if (program.status !== "Active" && program.status !== "true" && program.status !== true) {
        console.log(`[-] Aborted: Program is not Active (Status: ${program.status})`);
        break;
      }

      // ✅ Calculate store credit reward amount
      const cashbackAmount = calculateCashbackAmount(program, orderPayload);
      console.log("[+] Calculated Store Credit Reward Amount:", cashbackAmount);

      if (cashbackAmount <= 0) {
        console.log("[-] Aborted: Reward cashback amount is 0 or negative.");
        break;
      }

      // ✅ Calculate Expiration Date
      const expiresAt = calculateExpirationDate(program);
      console.log("[+] Calculated Store Credit Expiration (expiresAt):", expiresAt);

      // ✅ Dynamic Currency matching order
      const currencyCode = orderPayload?.currency || 'USD';
      console.log('✅ Dynamic Currency:', currencyCode);

      // ✅ Add store credit to paid order customer
      await addStoreCredit(
        admin,
        customerId,
        cashbackAmount,
        currencyCode,
        expiresAt
      );

      // ✅ Save transaction to the database for the Transactions list
      try {
        const customerName = `${orderPayload?.customer?.first_name || ""} ${orderPayload?.customer?.last_name || ""}`.trim() || "Anonymous Customer";
        
        await db.transaction.create({
          data: {
            shop,
            orderId: String(orderPayload?.id || ""),
            orderName: String(orderPayload?.name || ""),
            customerId,
            customerName,
            amount: cashbackAmount,
            currency: currencyCode,
            status: orderPayload?.financial_status === "paid" ? "Completed" : "Pending",
            emailStatus: program.notifyEmail ? "Sent" : "Not Sent",
            type: program.programType === "product" ? "Custom Program" : "Cashback",
          }
        });
        console.log("🎉 Webhook saved transaction to database successfully!");
      } catch (dbErr) {
        console.error("❌ Error saving transaction to database in webhook:", dbErr);
      }

      break;
    }

    case 'CUSTOMERS_DATA_REQUEST':
    case 'CUSTOMERS_REDACT':
    case 'SHOP_REDACT':
      console.log(
        `=== [GDPR Webhook Received] ${topic} ===`
      );
      break;

    default:
      throw new Response(
        'Unhandled webhook topic',
        { status: 404 }
      );
  }

  return new Response();
};