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
      const storeDoc = ShopModel ? await ShopModel.findOne({ shop }) : null;
      let event = null;

      const numericOrderId = orderId.split("/").pop();

      if (storeDoc && storeDoc.details) {
        for (const dateEntry of storeDoc.details.values()) {
          if (dateEntry.events && Array.isArray(dateEntry.events)) {
            event = dateEntry.events.find(
              (e) => String(e.orderId) === String(orderId) || String(e.orderId) === String(numericOrderId)
            );
            if (event) break;
          }
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
    // 1. Fetch customer store credit balance and store currencies from Shopify GraphQL Admin API
    let balance = "0.00";
    let currency = "USD";
    const balances = {};
    let enabledCurrencies = [];

    try {
      const { admin } = await unauthenticated.admin(shop);
      
      // Fetch shop currencies
      try {
        const shopCurrencyQuery = `#graphql
          query getShopCurrencies {
            shop {
              currencyCode
              enabledPresentmentCurrencies
            }
          }
        `;
        const currencyRes = await admin.graphql(shopCurrencyQuery);
        const currencyJson = await currencyRes.json();
        currency = currencyJson?.data?.shop?.currencyCode || "USD";
        enabledCurrencies = currencyJson?.data?.shop?.enabledPresentmentCurrencies || [currency];
      } catch (currencyErr) {
        console.error("Error fetching shop default currencies:", currencyErr);
        enabledCurrencies = ["USD"];
      }

      // Fetch customer store credit accounts
      const shopifyQuery = `#graphql
        query getCustomerStoreCreditAccount($id: ID!) {
          customer(id: $id) {
            storeCreditAccounts(first: 10) {
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
      const customerGid = customerId.startsWith("gid://shopify/Customer/")
        ? customerId
        : `gid://shopify/Customer/${customerId}`;

      const res = await admin.graphql(shopifyQuery, { variables: { id: customerGid } });
      const resJson = await res.json();
      const accounts = resJson?.data?.customer?.storeCreditAccounts?.edges || [];
      
      if (accounts.length > 0) {
        const firstAccount = accounts[0].node;
        balance = firstAccount.balance.amount;
        currency = firstAccount.balance.currencyCode;
        
        accounts.forEach(edge => {
          const bal = edge.node?.balance;
          if (bal) {
            balances[bal.currencyCode] = bal.amount;
          }
        });
      }

      // Ensure all enabled currencies have at least 0.00 balance
      enabledCurrencies.forEach(code => {
        if (balances[code] === undefined) {
          balances[code] = "0.00";
        }
      });
    } catch (err) {
      console.error("Error fetching balance from Shopify Admin API:", err);
    }

    // 2. Load transactions from MongoDB
    await connectMongoDB();
    const ShopModel = getShopModel(shop);
    const storeDoc = ShopModel ? await ShopModel.findOne({ shop }) : null;

    // One-time self-healing database migration to backfill missing expiresAt values
    let migrated = false;
    let program = null;
    try {
      const { admin } = await unauthenticated.admin(shop);
      const { getShopPrograms } = await import("../services/storeCredit.server");
      const programs = await getShopPrograms(admin) || [];
      program = programs.find(p => p.status === 'Active' || p.status === 'true' || p.status === true) || programs[0];
    } catch (err) {
      console.error("Error fetching program for database self-healing:", err);
    }

    const defaultExpDays = program && (program.enableExpiration === true || program.enableExpiration === "true") && program.expirationType === "duration"
      ? parseInt(program.expirationDays || "15", 10)
      : 15;

    if (storeDoc && storeDoc.details) {
      let docChanged = false;
      for (const [dateStr, dateEntry] of storeDoc.details.entries()) {
        const events = dateEntry.events || [];
        for (const ev of events) {
          if (ev.status === "Completed" && ev.issuedAmount > 0 && !ev.expiresAt) {
            const created = ev.issuedAt || ev.createdAt || new Date();
            const expDate = new Date(created);
            expDate.setDate(expDate.getDate() + defaultExpDays);
            ev.expiresAt = expDate;
            docChanged = true;
            migrated = true;
          }
        }
        if (docChanged) {
          storeDoc.details.set(dateStr, { events });
          docChanged = false;
        }
      }
      if (migrated) {
        storeDoc.markModified('details');
        await storeDoc.save();
      }
    }

    const transactions = [];
    const customerGid = customerId;
    const customerNumericId = customerId.split("/").pop();

    if (storeDoc && storeDoc.details) {
      for (const dateEntry of storeDoc.details.values()) {
        if (dateEntry.events && Array.isArray(dateEntry.events)) {
          for (const ev of dateEntry.events) {
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
    }

    // Sort transactions by date descending
    transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return new Response(
      JSON.stringify({
        balance,
        currency,
        balances,
        enabledCurrencies,
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
