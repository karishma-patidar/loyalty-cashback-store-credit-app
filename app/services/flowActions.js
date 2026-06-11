
import connectMongoDB, { getCustomerModel, connectLoyaltyDB, getFlowProgramModel } from "../db.mongodb.server.js";

export const storeCreditAccountCredit = async (data) => {
    const ammount = data.ammount;
    const id = data.id;
    const currencyCode = data.currencyCode;
    const expireDate = data.expirationDate;
    const notifyCustomerWithMail = data?.notifyCustomer || false;
    const query = {
        query: `mutation storeCreditAccountCredit($id: ID!, $creditInput: StoreCreditAccountCreditInput!) {
      storeCreditAccountCredit(id: $id, creditInput: $creditInput) {
        storeCreditAccountTransaction {
          amount {
            amount
            currencyCode
          }
          createdAt
          expiresAt
          event
          account {
            id
            balance {
              amount
              currencyCode
            }
          }
        }
        userErrors {
          message
          field
        }
      }
    }`,
        variables: {
            id: `gid://shopify/Customer/${id}`,// "gid://shopify/Customer/7007753961784",
            creditInput: {
                creditAmount: {
                    amount: ammount, //"1.99",
                    currencyCode: currencyCode, // "USD"
                },
                ...(expireDate && { expiresAt: expireDate }),
                notify: notifyCustomerWithMail
            }
        }
    };
    return query;
};

export async function setCustomerMetafieldForFlowActionStoreCredit(accessToken, id, storeName, value, key, namespace) {
    const ownerId = `gid://shopify/Customer/${id}`;
    const body = {
        query: `
    mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          key
          namespace
          value
          createdAt
          updatedAt
        }
        userErrors {
          field
          message
          code
        }
      }
    }
  `,
        variables: {
            metafields: [
                {
                    key: key,
                    namespace: namespace,
                    ownerId: ownerId,
                    type: "json",
                    value: JSON.stringify(value),
                },
            ],
        },
    };

    try {
        const response = await fetch(`https://${storeName}/admin/api/2025-04/graphql.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken
            },
            body: JSON.stringify(body),
        });

        const result = await response.json();
        const errors = result?.data?.MetafieldsSet?.userErrors;
        if (errors?.length) {
            console.error("User Errors:", errors);
            return null;
        }
        return result;
    } catch (error) {
        console.error("Error crediting store credit:", error);
        return null;
    }
}

export async function getCustomerDetailsFlowActionData(customerId, shopifyDomain, accessToken) {
    const graphqlEndpoint = `https://${shopifyDomain}/admin/api/2025-07/graphql.json`;
    console.log("customerId ::", customerId);
    const query = `
    query {
      customer(id: "gid://shopify/Customer/${customerId}") {
        id
        firstName
        metafield(namespace : "flow_action_workflow_namespace", key : "flow_store_credit_key"){
          value
        }
        lastName
        email
        phone
        numberOfOrders
        amountSpent {
          amount
          currencyCode
        }
        createdAt
        updatedAt
        note
        verifiedEmail
        validEmailAddress
        tags
        lifetimeDuration
        defaultAddress {
          formattedArea
          address1
        }
        addresses {
          address1
        }
        image {
          src
        }
        canDelete
      }
    }
  `;

    try {
        const response = await fetch(graphqlEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken
            },
            body: JSON.stringify({ query: query })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! status: ${response.status}, errors: ${JSON.stringify(errorData.errors)}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching customer details:', error);
        throw error; // Re-throw to allow calling code to handle it
    }
}

export async function creditStoreCreditToCustomerApi({ storeName, accessToken, creditMutation }) {
    try {
        const response = await fetch(`https://${storeName}/admin/api/2026-01/graphql.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken
            },
            body: JSON.stringify(creditMutation),
        });

        const result = await response.json();

        const errors = result?.data?.storeCreditAccountCredit?.userErrors;
        if (errors?.length) {
            console.error("User Errors:", errors);
            return null;
        }
        return result;
    } catch (error) {
        console.error("Error crediting store credit:", error);
        return null;
    }
}

export async function addCustomerTags({ storeName, customerId, customerTag, accessToken }) {
    const url = `https://${storeName}/admin/api/2025-07/graphql.json`;
    const ownerId = `gid://shopify/Customer/${customerId}`;

    const query = `
    mutation addTags($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        node {
          id
        }
        userErrors {
          message
        }
      }
    }
  `;

    const variables = {
        id: ownerId,
        tags: customerTag      // e.g. ["one", "two", "three"]
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": accessToken
            },
            body: JSON.stringify({
                query,
                variables
            })
        });

        const result = await response.json();

        if (result.errors || result.data?.tagsAdd?.userErrors?.length) {
            console.error("GraphQL Errors:", result.errors || result.data.tagsAdd.userErrors);
        }
        return result.data;
    } catch (error) {
        console.error("Request failed:", error);
        throw error;
    }
}


// 📡 Shopify API Utilities
// ─────────────────────────────────────────────────────────────────────────────

async function shopifyStoreCreditMetafieldRequest({ storeName, accessToken }) {
    console.log("=== [Flow Actions] shopifyStoreCreditMetafieldRequest ===");
    console.log("Store Name:", storeName);
    const url = `https://${storeName}/admin/api/2025-07/graphql.json`;
    const query = `
  {
    shop {
      metafield(namespace: "loyalty_cashback_app", key: "programs") {
        value
      }
    }
  }
`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": accessToken,
            },
            body: JSON.stringify({ query }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ shopifyStoreCreditMetafieldRequest GraphQL request failed:", response.status, errorText);
            throw new Error(`Request failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log("GraphQL Response Result:", JSON.stringify(result, null, 2));
        const responseData =
            result?.data?.shop?.metafield?.value || null;
        console.log("Retrieved metafield value (customer_dashboard.flow-programs-list):", responseData);
        return responseData;
    } catch (error) {
        console.error("❌ shopifyStoreCreditMetafieldRequest Error:", error);
        throw error;
    }
}

async function shopifyOrderApi(orderId, storeName, accessToken) {
    const url = `https://${storeName}/admin/api/2025-07/graphql.json`;
    const query = `
      query {
        order(id:${JSON.stringify(orderId)}) {
          id
          name
        currencyCode
          totalPriceSet {
            presentmentMoney {
              amount
              currencyCode
            }
          }
        }
      }
`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": accessToken,
            },
            body: JSON.stringify({ query }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Request failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        return result.data.order.totalPriceSet.presentmentMoney;
    } catch (error) {
        console.error("Shopify GraphQL request error:", error);
        throw error;
    }
}

async function convertCurrency(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return parseFloat(amount).toFixed(2);

    const apiKey =
        "A83A6T8ZE0r0uAWtSje56LAAjoDMeMy5YAt8cDZXluXtXdUP4h4f7V1AvBPtUSlW";
    const url = `https://api.unirateapi.com/api/convert?api_key=${apiKey}&amount=${amount}&from=${fromCurrency}&to=${toCurrency}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data || typeof data.result !== "number") {
            console.warn(
                `⚠️ Invalid response from currency API: ${JSON.stringify(data)}`
            );
            return parseFloat(amount).toFixed(2);
        }

        return parseFloat(data.result).toFixed(2);
    } catch (error) {
        console.error(`❌ Currency conversion failed: ${error.message}`);
        return parseFloat(amount).toFixed(2);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧠 Reward Validation Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a program and calculates the reward amount.
 * Pure function — no side effects.
 */
function validateAndPrepareReward(program, orderAmount = 0) {
    try {
        const now = new Date();

        // 1️⃣ Program active check
        if (!program.status) return { valid: false, reason: "Program is disabled" };

        // 2️⃣ Start date check
        const startDateTime = new Date(
            `${program.startsAtDate}T${program.startsAtTime || "00:00"}`
        );
        if (now < startDateTime)
            return { valid: false, reason: "Program not started yet" };

        // 3️⃣ End date check
        if (program.enableEndsAt && program.endsAtDate && program.endsAtTime) {
            const endDateTime = new Date(
                `${program.endsAtDate}T${program.endsAtTime}`
            );
            if (now > endDateTime)
                return { valid: false, reason: "Program has ended" };
        }

        // 4️⃣ Expiration date setup
        let expiresOn = null;
        if (program.enableExpirationDate && Number(program.expirationDays) > 0) {
            const expirationDate = new Date();
            expirationDate.setDate(
                expirationDate.getDate() + Number(program.expirationDays)
            );
            expirationDate.setUTCHours(23, 59, 59, 0);
            expiresOn = expirationDate.toISOString();
        }

        // 5️⃣ Reward calculation
        let rewardAmount = 0;
        if (program.programType === "fixed") {
            rewardAmount = Number(program.amount);
        } else if (program.programType === "percentage") {
            rewardAmount = (Number(orderAmount) * Number(program.amount)) / 100;
        } else {
            return { valid: false, reason: "Invalid program type" };
        }

        return {
            valid: true,
            rewardAmount: rewardAmount.toFixed(2),
            currencyCode: program.currencyCode || "USD",
            expiresOn,
            reason: "Program valid and reward calculated",
            programType: program.programType,
            programId: program.programId,
            programName: program.programName || program.name || program.internalName || "Flow Program",
            notifyCustomer: program?.notify || false,
            dateTime: new Date()
                .toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                })
                .replace(",", " at"),
        };
    } catch (error) {
        return {
            valid: false,
            reason: "Error in validation logic",
            error: error.message,
        };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔍 Step 1 — Trigger Resolver
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves which trigger fired based on the properties sent by Shopify Flow.
 * Add new detection rules here when new triggers are introduced.
 */
function resolveTrigger(properties) {
    const { order_id, segment_id, customer_id } = properties;

    if (order_id?.includes("/Order/")) return "order_fulfilled";
    if (order_id?.includes("/Segment/")) return "customer_segment_added";
    if (customer_id) return "customer_create";

    return "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// ⚙️ Step 5 — Centralized Reward Engine (processProgram)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Core reward engine.
 * Fetches metaobject data, locates the matching program, validates it,
 * applies any currency conversion (for order triggers), and returns
 * a structured reward response.
 */
async function processProgram({
    shopify_domain,
    accessToken,
    program_id,
    customer_id,
    triggerType,
    order_amount = 0,
    order_currency = null,
    order_id = null,
}) {
    console.log("=== [Flow Actions] processProgram ===");
    console.log("Shopify Domain:", shopify_domain);
    console.log("Program ID:", program_id);
    console.log("Customer ID:", customer_id);
    console.log("Trigger Type:", triggerType);
    console.log("Order Amount:", order_amount, "Currency:", order_currency, "Order ID:", order_id);

    // Fetch Metafield entry
    const metafieldValue = await shopifyStoreCreditMetafieldRequest({
        storeName: shopify_domain,
        accessToken,
    });

    if (!metafieldValue) {
        console.warn("❌ metafieldValue is empty or null for customer_dashboard.flow-programs-list");
        return { success: false, message: "customer_dashboard.flow-programs-list metafield not found" };
    }

    // Parse and find matching program
    const programList = JSON.parse(metafieldValue || "[]");
    console.log("Programs parsed from metafield:", programList.length);

    const matchedProgram = programList.find((p) => p.programId === program_id);
    if (!matchedProgram) {
        console.warn("❌ Matched program NOT found for ID:", program_id);
        return { success: false, message: "Program not found in flowActionProgram" };
    }
    console.log("Matched Program:", JSON.stringify(matchedProgram, null, 2));

    // Validate and prepare reward
    const rewardCheck = validateAndPrepareReward(matchedProgram, order_amount);
    console.log("Validation Result:", JSON.stringify(rewardCheck, null, 2));

    if (!rewardCheck.valid) {
        console.log("❌ Program invalid:", rewardCheck.reason);
        return { success: false, message: rewardCheck.reason };
    }

    // 💱 Currency handling — only relevant for fixed-amount order_fulfilled triggers
    let finalRewardAmount = rewardCheck.rewardAmount;
    let finalCurrencyCode = matchedProgram.currencyCode;

    if (
        triggerType === "order_fulfilled" &&
        matchedProgram.programType === "fixed" &&
        matchedProgram.currencyCode !== order_currency
    ) {
        finalRewardAmount = await convertCurrency(
            rewardCheck.rewardAmount,
            matchedProgram.currencyCode,
            order_currency
        );
        finalCurrencyCode = order_currency;
    } else if (triggerType === "order_fulfilled") {
        finalCurrencyCode = order_currency || matchedProgram.currencyCode;
    }

    // ✅ Structured reward response
    return {
        success: true,
        triggerType,
        customer_id,
        program_id,
        accessToken,
        shopify_domain,
        reward: {
            ...rewardCheck,
            rewardAmount: finalRewardAmount,
            currencyCode: finalCurrencyCode,
            triggerType,
            order_amount,
            ...(order_id?.includes("/Order/") && {
                order_id: order_id.split("/").pop(),
            }),
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🎯 Step 4 — Trigger Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles the "order_fulfilled" trigger.
 * Fetches order details and delegates reward calculation to processProgram.
 */
async function handleOrderTrigger({
    shopify_domain,
    accessToken,
    properties,
}) {
    const { customer_id, order_id, program_id } = properties;

    let order_amount = 0;
    let order_currency = null;

    if (order_id) {
        try {
            const orderDetails = await shopifyOrderApi(
                order_id,
                shopify_domain,
                accessToken
            );
            order_amount = parseFloat(orderDetails?.amount || 0);
            order_currency = orderDetails?.currencyCode || null;
        } catch (err) {
            console.error("❌ Failed to fetch order details:", err);
            return { success: false, message: "Failed to fetch order details" };
        }
    }

    return processProgram({
        shopify_domain,
        accessToken,
        program_id,
        customer_id,
        triggerType: "order_fulfilled",
        order_amount,
        order_currency,
        order_id,
    });
}

/**
 * Handles the "customer_create" trigger.
 * Passes customer data directly to processProgram.
 * Tags applied: ["custlo_reward"]
 */
async function handleCustomerTrigger({
    shopify_domain,
    accessToken,
    properties,
    triggerType,
}) {
    const { customer_id, program_id } = properties;

    return processProgram({
        shopify_domain,
        accessToken,
        program_id,
        customer_id,
        triggerType,
    });
}

/**
 * Handles the "customer_segment_added" trigger.
 * Fetches the customer's current tags first and checks for "newsletter_reward".
 * If already tagged → reward is skipped (duplicate protection).
 * If not tagged → reward is issued with tags ["custlo_reward", "newsletter_reward"].
 */
async function handleCustomerSegmentTrigger({
    shopify_domain,
    accessToken,
    properties,
    triggerType,
}) {
    const { customer_id, program_id } = properties;

    // Fetch customer details to check for existing newsletter_reward tag
    const customerId = customer_id?.split("/").pop();
    const customerDetails = await getCustomerDetailsFlowActionData(
        customerId,
        shopify_domain,
        accessToken
    );

    const singleCustomerData = customerDetails?.data?.customer || {};

    if (!singleCustomerData?.id) {
        console.warn("⚠️ Segment trigger: customer not found, skipping reward.");
        return { success: false, message: "Customer not found" };
    }

    // Duplicate-reward guard: skip if customer already has the newsletter_reward tag
    const existingTags = singleCustomerData?.tags || [];
    if (existingTags.includes("newsletter_reward")) {
        console.log("ℹ️ Segment trigger: customer already has newsletter_reward tag — reward skipped.");
        return { success: false, message: "Reward already issued for this segment" };
    }

    return processProgram({
        shopify_domain,
        accessToken,
        program_id,
        customer_id,
        triggerType,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 🗺️ Step 2 — Trigger Handler Registry
// Adding a new trigger only requires adding a new entry here.
// ─────────────────────────────────────────────────────────────────────────────

const triggerHandlers = {
    order_fulfilled: handleOrderTrigger,
    customer_create: handleCustomerTrigger,
    customer_segment_added: handleCustomerSegmentTrigger,
    // future triggers → add here, e.g.:
    // customer_tag_added: handleCustomerTrigger,
};

// ─────────────────────────────────────────────────────────────────────────────
// 🧩 Step 3 — Main Flow Router (flowActionMainFunction)
// Acts only as a router — no business logic lives here.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entry point for Shopify Flow trigger actions.
 * Responsibilities:
 *  1. Resolve which trigger fired
 *  2. Fetch the Shopify session / access token
 *  3. Look up and invoke the correct handler
 *  4. Return the handler's response
 */
export async function flowActionMainFunction(reqBody, admin, session) {
    const { shopify_domain, properties } = reqBody;

    console.log("=== [Flow Actions] flowActionMainFunction ===");
    console.log("Request Body:", JSON.stringify(reqBody, null, 2));

    // 1️⃣ Resolve trigger
    const triggerType = resolveTrigger(properties);
    console.log("Resolved Trigger Type:", triggerType);

    if (triggerType === "unknown") {
        console.warn("⚠️ Unknown trigger type for properties:", properties);
        return { success: false, message: "Unknown trigger type" };
    }

    // 2️⃣ Use session access token passed from authenticate.flow
    const accessToken = session?.accessToken;
    if (!accessToken) {
        console.error("❌ No access token found in session object");
        throw new Error("No access token found in session");
    }

    // 3️⃣ Dispatch to the correct handler
    const handler = triggerHandlers[triggerType];
    console.log("Invoking trigger handler for type:", triggerType);

    const result = await handler({
        shopify_domain,
        accessToken,
        properties,
        triggerType,
    });

    console.log("Handler Output Result:", JSON.stringify(result, null, 2));
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// 💳 Store Credit Crediting Logic (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export async function setCreditCustomerStoreCreditApi(data) {
    console.log("=== [Flow Actions] setCreditCustomerStoreCreditApi ===");
    console.log("Input Data payload:", JSON.stringify(data, null, 2));

    const customerId = data?.customer_id?.split("/").pop();
    const accessToken = data?.accessToken;
    const storeName = data?.shopify_domain;
    const reward = data?.reward;
    console.log("reward", reward);

    // Use caller-supplied tags, falling back to the default tag set
    const customerTag = Array.isArray(data?.customerTag) && data.customerTag.length > 0
        ? data.customerTag
        : ["custlo_reward"];

    const creditMutation = await storeCreditAccountCredit({
        ammount: reward?.rewardAmount,
        id: customerId,
        currencyCode: reward?.currencyCode,
        expirationDate: reward?.expiresOn,
        notifyCustomer: reward?.notifyCustomer
    });
    console.log("Prepared Store Credit Mutation Query:", JSON.stringify(creditMutation, null, 2));

    // Fetch actual Flow Program name from flow_programs collection if it's a flow program
    let flowProgramName = reward?.programName || 'Flow Program';
    try {
        await connectLoyaltyDB();
        const FlowProgramModel = getFlowProgramModel();
        if (FlowProgramModel) {
            const flowProgDoc = await FlowProgramModel.findOne({ shop: storeName });
            if (flowProgDoc && Array.isArray(flowProgDoc.programs)) {
                const matchedProg = flowProgDoc.programs.find(p => p.programId === reward?.programId || p.id === reward?.programId);
                if (matchedProg) {
                    flowProgramName = matchedProg.programName || matchedProg.name || matchedProg.internalName || flowProgramName;
                }
            }
        }
    } catch (err) {
        console.error("❌ Error fetching Flow Program from MongoDB:", err);
    }

    // Main object for shop and customer metafields
    const analyticsDataObj = {
        rewardAmount: reward?.rewardAmount,
        currencyCode: reward?.currencyCode,
        programId: reward?.programId,
        expiresOn: reward?.expiresOn,
        dateTime: reward?.dateTime,
        programName: flowProgramName,
        order_amount: reward?.order_amount,
        ...(reward?.order_id && { order_id: reward?.order_id }),
        customerId,
    };

    console.log("Calling creditStoreCreditToCustomerApi...");
    const result = await creditStoreCreditToCustomerApi({ storeName, accessToken, creditMutation });
    console.log("creditStoreCreditToCustomerApi Result Response:", JSON.stringify(result, null, 2));

    console.log("Fetching Customer details flow action data...");
    const customerDetails = await getCustomerDetailsFlowActionData(
        customerId,
        storeName,
        accessToken
    );
    console.log("Customer Details Response:", JSON.stringify(customerDetails, null, 2));

    const singleCustomerData = customerDetails?.data?.customer || {};

    if (!singleCustomerData?.id) {
        console.error("❌ Customer details GID not found in getCustomerDetailsFlowActionData response");
        return { Message: "Customer not found", valid: false };
    }

    const metafieldData = singleCustomerData?.metafield?.value;
    console.log("Existing customer metafield value:", metafieldData);

    let customerMetafield = null;

    if (metafieldData) {
        customerMetafield = JSON.parse(metafieldData);
    }

    const customerOrderMetafieldValue = Array.isArray(customerMetafield)
        ? [...customerMetafield, analyticsDataObj]
        : [analyticsDataObj];

    console.log("Saving Customer Metafield flow action store credit history...");
    const metafieldSetResult = await setCustomerMetafieldForFlowActionStoreCredit(
        accessToken,
        customerId,
        storeName,
        customerOrderMetafieldValue,
        "flow_store_credit_key",
        "flow_action_workflow_namespace"
    );
    console.log("Metafield Set Response Result:", JSON.stringify(metafieldSetResult, null, 2));

    // Save event to MongoDB for analytics dashboard
    const isSuccessful = result && !result.errors && result.data?.storeCreditAccountCredit?.storeCreditAccountTransaction;
    console.log("Is credit transaction successful in Shopify?", isSuccessful);
    try {
        await connectMongoDB();
        const ShopModel = getCustomerModel(storeName);

        if (ShopModel) {
            const orderId = reward?.order_id || `FLOW_${Date.now()}`;
            const customerName = `${singleCustomerData?.firstName || ""} ${singleCustomerData?.lastName || ""}`.trim() || "Flow Customer";
            const eventToSave = {
                shop: storeName,
                orderId: orderId,
                orderName: reward?.order_id ? `Order ${orderId}` : "Flow Action",
                customerId: `gid://shopify/Customer/${customerId}`,
                customerName: customerName,
                issuedAmount: parseFloat(reward?.rewardAmount || 0),
                currency: reward?.currencyCode || "USD",
                exchangeRate: 1,
                status: isSuccessful ? 'Completed' : 'Failed',
                emailStatus: isSuccessful && reward?.notifyCustomer ? 'Sent' : 'Not Sent',
                emailFailReason: result?.errors?.map(e => e.message).join(', ') || '',
                programType: reward?.programType || 'Flow Program',
                programId: reward?.programId,
                programName: flowProgramName,
                redeemedAmount: 0,
                issuedAt: new Date(),
                createdAt: new Date(),
            };

            const todayStr = new Date().toISOString().split('T')[0];

            const updateResult = await ShopModel.updateOne(
                { date: todayStr, 'events': { $not: { $elemMatch: { orderId: orderId, programId: reward?.programId } } } },
                { $push: { events: eventToSave } }
            );

            if (updateResult.matchedCount === 0) {
                const dateDoc = await ShopModel.findOne({ date: todayStr });
                if (!dateDoc) {
                    await ShopModel.create({ date: todayStr, events: [eventToSave] });
                }
            }

            console.log("✅ Successfully saved Flow Action event to MongoDB dashboard.");
        }
    } catch (dbErr) {
        console.error("❌ Failed to save Flow Action event to MongoDB:", dbErr);
    }

    addCustomerTags({ storeName, customerId, customerTag, accessToken });

    return { Message: "Store Credit successfully rewarded", valid: true };
}
