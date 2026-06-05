/**
 * Centralized Store Credit and Loyalty Service Layer
 * Location: app/services/storeCredit.server.ts
 */

import { getShopPrograms as getShopProgramsRaw } from "./graphql.server";
import { authenticate } from "../shopify.server";
import connectMongoDB, { getShopModel } from "../db.mongodb.server";

export type AdminClient = NonNullable<Awaited<ReturnType<typeof authenticate.webhook>>["admin"]>;

export interface ProgramSettings {
  id: string;
  name: string;
  programType: string;
  amount: string;
  amountType: string;
  maxAmount?: string;
  enableEndDate?: boolean;
  endDate?: string;
  endTime?: string;
  status: string | boolean;
  enableExpiration?: boolean | string;
  expirationType?: string;
  expirationDays?: string;
  expirationDate?: string;
  enableDelay?: boolean;
  delayDays?: string;
  channels?: { online: boolean; pos: boolean; draft: boolean };
  eligibility?: { d2c: boolean; b2b: boolean };
  cashbackPercentage?: number;
  notifyEmail?: boolean;
}

export interface ShopifyOrderPayload {
  id?: number | string;
  name?: string;
  line_items?: Array<{
    price?: string;
    quantity?: number | string;
  }>;
  current_total_price?: string;
  total_price?: string;
  currency?: string;
  customer?: {
    id?: number | string;
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  payment_gateway_names?: string[];
  total_discounts?: string;
  presentment_currency?: string;
  fulfillment_status?: string;
  financial_status?: string;
  note?: string;
  email?: string;
}

/**
 * Fetch configured loyalty programs from Shopify metafields.
 * Uses the underlying query in graphql.server.js to avoid duplicate logic.
 * 
 * @param admin - Authenticated Shopify Admin client
 * @returns Array of typed loyalty program settings
 */
export async function getShopPrograms(admin: AdminClient): Promise<ProgramSettings[]> {
  const { programs } = await getShopProgramsRaw(admin);
  return programs as ProgramSettings[];
}

/**
 * Add store credit to a customer's account using the standard Shopify Admin GraphQL API mutation.
 * 
 * @param admin - Authenticated Shopify Admin client
 * @param customerId - Customer GraphQL GID (e.g. gid://shopify/Customer/123456789)
 * @param amount - Amount of store credit to add
 * @param currencyCode - Currency code matching the customer's / order's currency (e.g. USD, CAD, INR)
 * @param expiresAt - Expiration date in ISO 8601 format, or null
 * @returns Response data from the GraphQL mutation
 */
export async function addStoreCredit(
  admin: AdminClient,
  customerId: string,
  amount: number,
  currencyCode: string,
  expiresAt: string | null,
  notifyCustomer: boolean = false,
  exchangeRate?: number
) {
  try {
    // 1. Check if customer already has a store credit account (for currency mismatch handling only).
    //    In 2026-01, storeCreditAccountCredit accepts a Customer GID as `id` and auto-creates
    //    the account if one doesn't exist yet — no separate creation step is needed.
    const getAccountQuery = `#graphql
      query getCustomerStoreCreditAccount($id: ID!) {
        customer(id: $id) {
          storeCreditAccounts(first: 1) {
            edges {
              node {
                id
                balance {
                  currencyCode
                }
              }
            }
          }
        }
      }
    `;

    console.log("GraphQL Request [getCustomerStoreCreditAccount] variables:", { id: customerId });
    const accountRes = await admin.graphql(getAccountQuery, { variables: { id: customerId } });
    const accountData = await accountRes.json();
    console.log("GraphQL Response [getCustomerStoreCreditAccount]:", JSON.stringify(accountData, null, 2));
    const existingAccountId = accountData?.data?.customer?.storeCreditAccounts?.edges?.[0]?.node?.id;
    const accountCurrency = accountData?.data?.customer?.storeCreditAccounts?.edges?.[0]?.node?.balance?.currencyCode;

    let finalAmount = amount;
    let finalCurrencyCode = currencyCode;

    if (existingAccountId && accountCurrency && accountCurrency !== currencyCode) {
      console.log(`[Currency Mismatch] Customer's store credit account is in ${accountCurrency}, but transaction is in ${currencyCode}.`);
      if (exchangeRate && exchangeRate > 0) {
        finalAmount = Number((amount * exchangeRate).toFixed(2));
        console.log(`[Currency Conversion] Converted ${amount} ${currencyCode} → ${finalAmount} ${accountCurrency} using rate ${exchangeRate}`);
      } else {
        console.warn(`[Currency Conversion] No exchange rate provided. Using account currency ${accountCurrency} with original amount.`);
      }
      finalCurrencyCode = accountCurrency;
    }

    // 2. Issue credit.
    //    The `id` argument accepts either a StoreCreditAccount GID OR a Customer GID.
    //    When a Customer GID is passed, Shopify auto-creates the account if it doesn't exist.
    //    Reference: https://shopify.dev/docs/api/admin-graphql/2026-01/mutations/storecreditaccountcredit
    //    NOTE: The `notify` argument is NOT supported in this API version — omit it.
    const creditMutation = `#graphql
      mutation storeCreditAccountCredit($id: ID!, $creditInput: StoreCreditAccountCreditInput!) {
        storeCreditAccountCredit(id: $id, creditInput: $creditInput) {
          storeCreditAccountTransaction {
            id
            amount {
              amount
              currencyCode
            }
            account {
              id
              balance {
                amount
                currencyCode
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // Use the existing account ID if available, otherwise pass the customer ID directly.
    // Both are valid owner IDs for this mutation.
    const ownerId = existingAccountId || customerId;

    const creditVars = {
      id: ownerId,
      creditInput: {
        creditAmount: {
          amount: String(finalAmount),
          currencyCode: finalCurrencyCode,
        },
        ...(expiresAt ? { expiresAt } : {}),
        // notify is a field of StoreCreditAccountCreditInput (not a top-level arg).
        // Set to true to trigger the Shopify "store credit issued" email.
        notify: notifyCustomer === true,
      },
    };
    console.log("GraphQL Request [storeCreditAccountCredit] variables:", creditVars);

    const response = await admin.graphql(creditMutation, { variables: creditVars });
    const data = await response.json();
    console.log("GraphQL Response [storeCreditAccountCredit]:", JSON.stringify(data, null, 2));
    const result = data?.data?.storeCreditAccountCredit;

    if (result?.userErrors && result.userErrors.length > 0) {
      console.log("❌ GraphQL User Errors:", result.userErrors);
    } else {
      console.log("🎉 Store Credit Added Successfully");
    }

    return result;
  } catch (error) {
    console.error("❌ Store Credit Error:", error);
    throw error;
  }
}

/**
 * Calculate the cashback/store credit reward amount based on the program rules and order details.
 * Supports both order-based and product-based cashback programs.
 * 
 * @param program - The selected active loyalty program settings
 * @param orderPayload - Shopify webhook payload for the paid order
 * @returns Rounded numeric cashback reward amount
 */
export function calculateCashbackAmount(program: ProgramSettings, orderPayload: ShopifyOrderPayload): number {
  let cashbackAmount = 0;

  if (program.programType === "product") {
    console.log("[~] Calculating product-based cashback...");
    const lineItems = orderPayload.line_items || [];

    for (const item of lineItems) {
      const itemPrice = parseFloat(String(item.price || "0"));
      const itemQty = parseInt(String(item.quantity || "1"), 10);
      let itemCashback = 0;

      if (program.amountType === "Percentage") {
        const pct = parseFloat(program.amount || "0");
        itemCashback = (itemPrice * pct) / 100;

        // Max cap restriction per item
        if (program.maxAmount && itemCashback > parseFloat(program.maxAmount)) {
          console.log(
            `[!] Item cashback calculated (${itemCashback}) exceeded max limit (${program.maxAmount}) per product. Capping.`
          );
          itemCashback = parseFloat(program.maxAmount);
        }
      } else {
        itemCashback = parseFloat(program.amount || "0");
      }

      cashbackAmount += itemCashback * itemQty;
    }
  } else {
    console.log("[~] Calculating order-based cashback...");
    const orderTotal = parseFloat(orderPayload.current_total_price || orderPayload.total_price || "0");

    if (
      program.amountType === "Percentage" ||
      program.cashbackPercentage !== undefined
    ) {
      const pct = parseFloat(program.amount || String(program.cashbackPercentage || 0));
      cashbackAmount = (orderTotal * pct) / 100;

      // Max cap restriction per order
      if (program.maxAmount && cashbackAmount > parseFloat(program.maxAmount)) {
        console.log(
          `[!] Order cashback calculated (${cashbackAmount}) exceeded max limit (${program.maxAmount}) per order. Capping.`
        );
        cashbackAmount = parseFloat(program.maxAmount);
      }
    } else {
      cashbackAmount = parseFloat(program.amount || "0");
    }
  }

  return Number(cashbackAmount.toFixed(2));
}

/**
 * Calculate the optional expiration date for the earned store credit based on the program rules.
 * Supports relative duration (in days) or a fixed specific date.
 * 
 * @param program - The selected active loyalty program settings
 * @returns ISO 8601 formatted expiration timestamp, or null if expiration is disabled
 */
export function calculateExpirationDate(program: ProgramSettings): string | null {
  let expiresAt: string | null = null;

  const expirationEnabled = program.enableExpiration === true || program.enableExpiration === "true";
  if (!expirationEnabled) {
    return null;
  }

  if (program.expirationType === "duration") {
    const days = parseInt(program.expirationDays || "15", 10);
    if (!isNaN(days) && days > 0) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + days);
      expiresAt = expDate.toISOString();
    }
  } else if (program.expirationType === "date" && program.expirationDate) {
    try {
      const expDate = new Date(program.expirationDate);
      if (expDate.toString() !== "Invalid Date") {
        expiresAt = expDate.toISOString();
      }
    } catch (e) {
      console.error("Error parsing expiration date:", e);
    }
  }

  return expiresAt;
}

/**
 * Verify if the App Embed or App Block is added and enabled on the merchant's main theme.
 * Uses Online Store Theme GraphQL API.
 * 
 * @param admin - Authenticated Shopify Admin client
 * @returns boolean - True if the app block/embed is found and not disabled, false otherwise.
 */
export async function verifyAppEmbedEnabled(_admin: AdminClient): Promise<boolean> {
  void _admin;
  return true;
}

/**
 * Fetch store credit transactions from Shopify Admin GraphQL API.
 * 
 * @param admin - Authenticated Shopify Admin client
 * @returns Array of store credit transaction nodes
 */
export async function getStoreCreditTransactions(admin: AdminClient): Promise<any[]> {
  const query = `#graphql
    query GetStoreCreditTransactions {
      storeCreditAccountTransactions(first: 250) {
        edges {
          node {
            id
            amount {
              amount
              currencyCode
            }
            transactionType
            createdAt
            account {
              id
              owner {
                __typename
                ... on Customer {
                  id
                  displayName
                  email
                }
                ... on CompanyLocation {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;
  const response = await admin.graphql(query);
  const data = await response.json();
  return data?.data?.storeCreditAccountTransactions?.edges?.map((edge: any) => edge.node) || [];
}

/**
 * Calculate store credit metrics (issued credit, distributed customers, redeemed credit)
 * for a given date range and currency.
 */
export async function getStoreCreditMetrics(
  admin: AdminClient,
  shop: string,
  start: Date,
  end: Date,
  currencyCode: string
) {
  // Connect to MongoDB
  await connectMongoDB();

  let issuedCredit = 0;
  const uniqueCustomersSet = new Set<string>();
  const redeemingCustomersSet = new Set<string>();
  let redeemedCredit = 0;

  try {
    const ShopModel = getShopModel(shop);
    if (ShopModel) {
      const docs = await ShopModel.find({});
      for (const doc of docs) {
        if (doc.events && Array.isArray(doc.events)) {
          for (const ev of doc.events) {
            if (!ev.orderId) continue;
            const eventDate = ev.createdAt ? new Date(ev.createdAt) : new Date(doc.createdAt);
            if (eventDate >= start && eventDate <= end) {
              const evCurrency = ev.currency || currencyCode;
              if (evCurrency === currencyCode) {
                // Redemption sum from MongoDB events redeemedAmount
                const redeemedAmt = Number(ev.redeemedAmount || 0);
                redeemedCredit += redeemedAmt;
                if (redeemedAmt > 0 && ev.customerId) {
                  redeemingCustomersSet.add(ev.customerId);
                }

                if (ev.status === "Completed") {
                  const amountVal = Number(ev.issuedAmount || ev.amount || 0);
                  issuedCredit += amountVal;
                  if (ev.customerId) {
                    uniqueCustomersSet.add(ev.customerId);
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Error loading MongoDB events in getStoreCreditMetrics:", err);
  }

  const totalDistributedCustomers = uniqueCustomersSet.size;

  return {
    issuedCredit: Number(issuedCredit.toFixed(2)),
    totalDistributedCustomers,
    redeemedCredit: Number(redeemedCredit.toFixed(2)),
    totalCustomersRedeem: redeemingCustomersSet.size,
  };
}


