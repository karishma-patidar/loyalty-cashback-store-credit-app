import { unauthenticated } from "../shopify.server";
import connectMongoDB, { getShopModel } from "../db.mongodb.server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const loader = async ({ request }) => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const customerId = url.searchParams.get("customerId");
  const orderId = url.searchParams.get("orderId");

  console.log("=== API STORE CREDIT LOADER ===", { shop, customerId, orderId });

  if (!shop) {
    return new Response(JSON.stringify({ error: "Missing shop parameter" }), {
      status: 400,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      },
    });
  }

  if (orderId) {
    try {
      await connectMongoDB();
      const ShopModel = getShopModel(shop);
      const docs = ShopModel ? await ShopModel.find({}) : [];
      let event = null;

      const numericOrderId = orderId.split("/").pop();

      for (const doc of docs) {
        if (doc.events && Array.isArray(doc.events)) {
          event = doc.events.find(
            (e) => String(e.orderId) === String(orderId) || String(e.orderId) === String(numericOrderId)
          );
          if (event) break;
        }
      }

      if (event) {
        return new Response(
          JSON.stringify({
            issuedAmount: event.issuedAmount || 0,
            currency: event.currency || "USD",
            status: event.status,
          }),
          {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json",
            },
          }
        );
      } else {
        return new Response(
          JSON.stringify({ error: "Order event not found" }),
          {
            status: 404,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json",
            },
          }
        );
      }
    } catch (dbError) {
      console.error("Error fetching order cashback from MongoDB:", dbError);
      return new Response(
        JSON.stringify({ error: "Internal Server Error checking order" }),
        {
          status: 500,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
          },
        }
      );
    }
  }

  if (!customerId) {
    return new Response(JSON.stringify({ error: "Missing customerId parameter" }), {
      status: 400,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      },
    });
  }

  try {
    // 1. Fetch customer store credit balance from Shopify GraphQL Admin API
    let balance = "0.00";
    let currency = "USD";

    try {
      const { admin } = await unauthenticated.admin(shop);
      const shopifyQuery = `#graphql
        query getCustomerStoreCreditAccount($id: ID!) {
          customer(id: $id) {
            storeCreditAccounts(first: 1) {
              edges {
                node {
                  balance {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      `;
      const res = await admin.graphql(shopifyQuery, { variables: { id: customerId } });
      const resJson = await res.json();
      const account = resJson?.data?.customer?.storeCreditAccounts?.edges?.[0]?.node;
      if (account && account.balance) {
        balance = account.balance.amount;
        currency = account.balance.currencyCode;
      } else {
        // If no account, get shop default currency
        const shopCurrencyQuery = `#graphql
          query getShopCurrency {
            shop {
              currencyCode
            }
          }
        `;
        const currencyRes = await admin.graphql(shopCurrencyQuery);
        const currencyJson = await currencyRes.json();
        currency = currencyJson?.data?.shop?.currencyCode || "USD";
      }
    } catch (err) {
      console.error("Error fetching balance from Shopify Admin API:", err);
    }

    // 2. Load transactions from MongoDB
    await connectMongoDB();
    const ShopModel = getShopModel(shop);
    const docs = ShopModel ? await ShopModel.find({}) : [];

    const transactions = [];
    const customerGid = customerId;
    const customerNumericId = customerId.split("/").pop();

    for (const doc of docs) {
      if (doc.events && Array.isArray(doc.events)) {
        for (const ev of doc.events) {
          const evCustomerGid = ev.customerId;
          const evCustomerNumericId = evCustomerGid ? evCustomerGid.split("/").pop() : "";

          if (
            (evCustomerGid && evCustomerGid === customerGid) ||
            (evCustomerNumericId && evCustomerNumericId === customerNumericId)
          ) {
            // Add credit transaction
            if (ev.status === "Completed" && ev.issuedAmount > 0) {
              transactions.push({
                id: `${ev._id || ev.orderId}-credit`,
                amount: ev.issuedAmount,
                currencyCode: ev.currency || currency || "USD",
                type: "credit",
                createdAt: ev.issuedAt || ev.createdAt,
                expiresAt: ev.expiresAt || null,
                // If it has expiresAt and is not expired, remainingAmount is the issuedAmount
                remainingAmount: ev.expiresAt && new Date(ev.expiresAt) > new Date() ? ev.issuedAmount : null,
              });
            }
            // Add debit transaction
            if (ev.redeemedAmount > 0) {
              transactions.push({
                id: `${ev._id || ev.orderId}-debit`,
                amount: ev.redeemedAmount,
                currencyCode: ev.currency || currency || "USD",
                type: "debit",
                createdAt: ev.createdAt,
                expiresAt: null,
                remainingAmount: null,
              });
            }
          }
        }
      }
    }

    // Sort transactions by date descending
    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return new Response(
      JSON.stringify({
        balance,
        currency,
        transactions,
      }),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in api/store-credit:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      },
    });
  }
};

export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
};
