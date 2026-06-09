import { authenticate } from '../shopify.server';
import connectMongoDB, { getCustomerModel } from '../db.mongodb.server';
import { getShopPrograms, addStoreCredit, calculateExpirationDate } from '../services/storeCredit.server';

export const action = async ({ request }) => {
    const { payload, session, admin } = await authenticate.flow(request);

    // Access properties from the Flow action payload
    const { handle, properties, shop_id, shopify_domain, action_run_id } = payload;

    // Identify the action by its handle
    if (handle === 'issue-store-credit') {
        console.log("Flow Action Triggered! Payload:", JSON.stringify(payload, null, 2));

        try {
            const customerIdRaw = properties.customer_id;
            const orderIdRaw = properties.order_id;
            const programId = properties.program_id;

            if (!customerIdRaw || !programId) {
                console.error("❌ Missing required fields (customer_id or program_id) in Flow Action!");
                return new Response();
            }

            // Format GraphQL IDs correctly
            const customerId = customerIdRaw.startsWith("gid://") ? customerIdRaw : `gid://shopify/Customer/${customerIdRaw.split('/').pop()}`;

            let orderId = "";
            let orderGid = null;

            if (orderIdRaw && orderIdRaw.trim() !== "") {
                orderId = orderIdRaw.startsWith("gid://") ? orderIdRaw.split('/').pop() : orderIdRaw;
                orderGid = orderIdRaw.startsWith("gid://") ? orderIdRaw : `gid://shopify/Order/${orderIdRaw}`;
            } else {
                orderId = `FLOW_${Date.now()}`; // Fallback if flow trigger does not supply an order
            }

            // Fetch configured programs for this shop
            const programs = await getShopPrograms(admin);
            console.log("Looking for programId:", programId);
            console.log("Available IDs:", programs.map(p => ({ id: p.id, programId: p.programId })));

            const program = programs.find(p => p.programId === programId || p.id === programId);
            console.log("Found program:", program);

            if (!program) {
                console.error(`❌ Program not found: ${programId}`);
                return new Response();
            }

            if (program.status !== "Active" && program.status !== true && program.status !== "true") {
                console.error(`❌ Program is inactive: ${programId}`);
                return new Response();
            }

            // Fetch order or customer to determine cashback amount
            let orderTotal = 0;
            let currencyCode = program.currencyCode || "USD";
            let customerName = "Flow Customer";

            if (orderGid) {
                try {
                    const orderRes = await admin.graphql(`#graphql
                        query getOrderDetails($id: ID!) {
                            order(id: $id) {
                                currentTotalPriceSet { shopMoney { amount currencyCode } }
                                customer { firstName lastName }
                            }
                        }
                    `, { variables: { id: orderGid } });

                    const orderData = await orderRes.json();
                    const orderNode = orderData?.data?.order;
                    if (orderNode) {
                        orderTotal = parseFloat(orderNode.currentTotalPriceSet?.shopMoney?.amount || "0");
                        currencyCode = orderNode.currentTotalPriceSet?.shopMoney?.currencyCode || currencyCode;
                        customerName = `${orderNode.customer?.firstName || ""} ${orderNode.customer?.lastName || ""}`.trim() || customerName;
                    }
                } catch (e) {
                    console.error("Warning: Failed to fetch order details", e);
                }
            } else {
                try {
                    const custRes = await admin.graphql(`#graphql
                        query getCustomerDetails($id: ID!) {
                            customer(id: $id) { firstName lastName }
                        }
                    `, { variables: { id: customerId } });
                    const custData = await custRes.json();
                    const custNode = custData?.data?.customer;
                    if (custNode) {
                        customerName = `${custNode.firstName || ""} ${custNode.lastName || ""}`.trim() || customerName;
                    }
                } catch (e) {
                    console.error("Warning: Failed to fetch customer details", e);
                }
            }

            // Calculate cashback amount based on program logic
            let cashbackAmount = 0;
            if (program.amountType === "Percentage" || program.programType === "percentage") {
                cashbackAmount = (orderTotal * parseFloat(program.amount || "0")) / 100;
                if (program.maxAmount && cashbackAmount > parseFloat(program.maxAmount)) {
                    cashbackAmount = parseFloat(program.maxAmount);
                }
            } else {
                cashbackAmount = parseFloat(program.amount || "0");
            }

            cashbackAmount = Number(cashbackAmount.toFixed(2));

            if (cashbackAmount <= 0) {
                console.log("[-] Calculated cashback is 0, skipping store credit issuance.");
                return new Response();
            }

            // Issue store credit to the customer
            const expiresAt = calculateExpirationDate(program);
            const shouldNotify = !!program.notifyEmail;

            console.log(`🎉 Flow Action Issuing ${cashbackAmount} ${currencyCode} store credit to ${customerId}...`);
            const result = await addStoreCredit(admin, customerId, cashbackAmount, currencyCode, expiresAt, shouldNotify);
            const isSuccessful = result && !result.userErrors?.length && result.storeCreditAccountTransaction;

            if (isSuccessful) {
                console.log(`✅ Flow Action Store credit issued successfully!`);
            } else {
                console.log(`❌ Flow Action Failed to issue credit:`, result?.userErrors);
            }

            // Connect to MongoDB and save the event just like native webhooks
            try {
                await connectMongoDB();
                const ShopModel = getCustomerModel(shopify_domain);

                if (ShopModel) {
                    const eventToSave = {
                        shop: shopify_domain,
                        orderId: orderId,
                        orderName: orderIdRaw ? `Order ${orderId}` : "Flow Action",
                        customerId: customerId,
                        customerName: customerName,
                        issuedAmount: cashbackAmount,
                        currency: currencyCode,
                        exchangeRate: 1,
                        status: isSuccessful ? 'Completed' : 'Failed',
                        emailStatus: isSuccessful && shouldNotify ? 'Sent' : 'Not Sent',
                        emailFailReason: result?.userErrors?.map(e => e.message).join(', ') || '',
                        programType: program.programType || 'Flow Program',
                        programId: program.programId || program.id,
                        programName: program.programName || program.name,
                        redeemedAmount: 0,
                        issuedAt: new Date(),
                        createdAt: new Date(),
                    };

                    const todayStr = new Date().toISOString().split('T')[0];

                    const updateResult = await ShopModel.updateOne(
                        { date: todayStr, 'events.orderId': { $ne: orderId } },
                        { $push: { events: eventToSave } }
                    );

                    if (updateResult.matchedCount === 0) {
                        const dateDoc = await ShopModel.findOne({ date: todayStr });
                        if (!dateDoc) {
                            await ShopModel.create({ date: todayStr, events: [eventToSave] });
                        } else {
                            await ShopModel.updateOne({ date: todayStr }, { $push: { events: eventToSave } });
                        }
                    }

                    console.log("✅ Successfully saved Flow Action event to MongoDB dashboard.");
                }
            } catch (dbErr) {
                console.error("❌ Failed to save Flow Action event to MongoDB:", dbErr);
            }

        } catch (error) {
            console.error("❌ Global Error in flow-extension:", error);
        }
    }

    // Return 200 to indicate success to Shopify Flow
    return new Response();
};