import { ActionFunctionArgs } from 'react-router';
import connectDB from '../db.server';
import { Order } from '../models/order.model';
import { CustomerOrders } from '../models/CustomerOrders.model';
import mongoose from 'mongoose';
import { authenticate } from '../shopify.server';
import {
  getShopPrograms,
  addStoreCredit,
  calculateCashbackAmount,
  calculateExpirationDate,
  ProgramSettings,
} from '../services/storeCredit.server';

interface WebhookProgramSettings extends ProgramSettings {
  notifyEmail?: boolean;
}

export const action = async ({
  request,
}: ActionFunctionArgs) => {
  console.log("📥 [Webhook Router] Received incoming request:", request.method, request.url);
  console.log("📥 Headers:", JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2));

  await connectDB();
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
        try {
          const dbConnection = mongoose.connection.db;
          if (dbConnection) {
            await dbConnection.collection("shopify_sessions").deleteMany({ shop });
            console.log(`✅ Successfully deleted sessions for shop: ${shop}`);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`❌ Error deleting sessions on uninstall for ${shop}:`, errorMessage);
        }
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

      let program: WebhookProgramSettings = {
        id: "default",
        name: "Standard Cashback",
        programType: "order",
        amount: "10",
        amountType: "Percentage",
        status: "Active",
        notifyEmail: false
      };
      
      let isAppActive = true;

      if (admin) {
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
        if (programs && programs.length > 0) {
          program = programs[0];
          console.log('[+] Selected Program Settings:', JSON.stringify(program));
        }

        // Check Status
        if (program.status !== "Active" && program.status !== "true" && program.status !== true) {
          console.log(`[-] Aborted: Program is not Active (Status: ${program.status})`);
          break;
        }
      } else {
        console.log('⚠️ No Shopify admin API client found. Falling back to default settings for DB storage.');
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

      // ✅ Add store credit to paid order customer (only if admin client is available)
      if (admin) {
        await addStoreCredit(
          admin,
          customerId,
          cashbackAmount,
          currencyCode,
          expiresAt
        );
        console.log("✅ Successfully awarded store credit via Shopify API");
      } else {
        console.log("⚠️ Skipped Shopify store credit award: No admin API client available (Development/Mock Mode).");
      }

      // ✅ Save transaction to the database for the Transactions list
      try {
        const customerName = `${orderPayload?.customer?.first_name || ""} ${orderPayload?.customer?.last_name || ""}`.trim() || "Anonymous Customer";
        
        await Order.create({
          shop,
          orderId: String(orderPayload?.id || ""),
          orderName: String(orderPayload?.name || ""),
          customerId,
          customerName,
          customerEmail: orderPayload?.customer?.email || null,
          orderTotal: parseFloat(orderPayload?.current_total_price || 0),
          cashbackAmount: cashbackAmount,
          currency: currencyCode,
          financialStatus: orderPayload?.financial_status === "paid" ? "PAID" : "PENDING",
          cashbackStatus: orderPayload?.financial_status === "paid" ? "Completed" : "Pending",
          emailStatus: program.notifyEmail ? "Sent" : "Not Sent",
          programType: program.programType === "product" ? "Custom Program" : "Cashback",
          programId: program.id || null,
        });
        console.log("🎉 Webhook saved flat transaction to database successfully!");

        // ✅ Save to CustomerOrders collection (grouped nested array of orders)
        await CustomerOrders.findOneAndUpdate(
          { shop, customerId },
          {
            $set: {
              customerName,
              customerEmail: orderPayload?.customer?.email || null,
            },
            $push: {
              orders: {
                orderId: String(orderPayload?.id || ""),
                orderName: String(orderPayload?.name || ""),
                orderTotal: parseFloat(orderPayload?.current_total_price || 0),
                cashbackAmount: cashbackAmount,
                currency: currencyCode,
                financialStatus: orderPayload?.financial_status === "paid" ? "PAID" : "PENDING",
                cashbackStatus: orderPayload?.financial_status === "paid" ? "Completed" : "Pending",
                emailStatus: program.notifyEmail ? "Sent" : "Not Sent",
                programType: program.programType === "product" ? "Custom Program" : "Cashback",
                programId: program.id || null,
                issuedAt: new Date(),
              }
            }
          },
          { upsert: true, new: true }
        );
        console.log("🎉 Webhook saved customer-centric order history successfully!");
      } catch (dbErr) {
        const errorMessage = dbErr instanceof Error ? dbErr.message : String(dbErr);
        console.error("❌ Error saving transaction/order to database in webhook:", errorMessage);
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