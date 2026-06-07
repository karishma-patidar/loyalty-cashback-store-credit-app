
import { authenticate } from '../shopify.server';

export const action = async ({ request }) => {
    const { payload, session, admin } = await authenticate.flow(request);

    // Access properties from the Flow action payload
    const { handle, properties, shop_id, shopify_domain, action_run_id } = payload;

    // Identify the action by its handle
    if (handle === 'issue-store-credit') {
        console.log("Payload :", payload)
    }
    // Return 200 to indicate success
    return new Response();
};