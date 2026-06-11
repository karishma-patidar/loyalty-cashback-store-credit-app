import { authenticate } from '../shopify.server';
import { flowActionMainFunction, setCreditCustomerStoreCreditApi } from '../services/flowActions';

export const action = async ({ request }) => {
    const { payload, session, admin } = await authenticate.flow(request);
    const { handle, properties, shop_id, shopify_domain, action_run_id } = payload;

    try {
        const returnData = await flowActionMainFunction(payload, admin, session);
        if (returnData?.success && returnData?.reward?.valid) {
            await setCreditCustomerStoreCreditApi(returnData);
            return new Response(JSON.stringify({ success: true, message: "Store Credit issued to Customer" }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }
        return new Response(JSON.stringify({ success: true, message: "Fetch but credit is not issued to customer" }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        console.error("Flow Action Error:", err);
        return new Response(JSON.stringify({ error: "Something went wrong" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};