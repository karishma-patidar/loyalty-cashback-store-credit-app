import { ActionFunctionArgs } from 'react-router';
import db from '../db.server';
import { authenticate } from '../shopify.server';
import { processOrderWebhook } from '../services/webhookProcessor.server';
import { syncMongoStoreSession } from '../db.mongodb.server';



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

  if (session) {
    await syncMongoStoreSession(session);
  }

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

    case 'ORDERS_CREATE':
    case 'ORDERS_FULFILLED': {
      console.log(`=== [Webhook Received] ${topic} ===`);
      console.log('Shop:', shop);

      const payload = await clonedRequest.json();
      const orderPayload = payload;

      if (!orderPayload) {
        console.error("❌ No order payload found in webhook body");
        return new Response();
      }

      await processOrderWebhook(shop, admin, orderPayload, topic);
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