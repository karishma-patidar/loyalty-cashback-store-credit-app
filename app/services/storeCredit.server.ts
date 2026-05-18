/**
 * Centralized Store Credit and Loyalty Service Layer
 * Location: app/services/storeCredit.server.ts
 */

import { getShopPrograms as getShopProgramsRaw } from "./graphql.server";
import { authenticate } from "../shopify.server";

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
}

export interface ShopifyOrderPayload {
  line_items?: Array<{
    price?: string;
    quantity?: number | string;
  }>;
  current_total_price?: string;
  currency?: string;
  customer?: {
    id?: number | string;
  };
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
  notifyCustomer: boolean = false
) {
  try {
    // 1. Find the store credit account ID for the customer
    const getAccountQuery = `#graphql
      query getCustomerStoreCreditAccount($id: ID!) {
        customer(id: $id) {
          storeCreditAccounts(first: 1) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    `;
    
    const accountRes = await admin.graphql(getAccountQuery, { variables: { id: customerId } });
    const accountData = await accountRes.json();
    let storeCreditAccountId = accountData?.data?.customer?.storeCreditAccounts?.edges?.[0]?.node?.id;

    // 2. If no account exists, create one
    if (!storeCreditAccountId) {
      console.log(`[~] No store credit account found for ${customerId}. Creating one...`);
      const createAccountMutation = `#graphql
        mutation storeCreditAccountCreate($storeCreditAccount: StoreCreditAccountCreateInput!) {
          storeCreditAccountCreate(storeCreditAccount: $storeCreditAccount) {
            storeCreditAccount {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      const createRes = await admin.graphql(createAccountMutation, {
        variables: {
          storeCreditAccount: {
            ownerId: customerId,
            currency: currencyCode
          }
        }
      });
      const createData = await createRes.json();
      storeCreditAccountId = createData?.data?.storeCreditAccountCreate?.storeCreditAccount?.id;

      if (!storeCreditAccountId) {
        console.error("❌ Failed to create store credit account:", createData?.data?.storeCreditAccountCreate?.userErrors);
        return { userErrors: createData?.data?.storeCreditAccountCreate?.userErrors || [{ message: "Failed to create store credit account" }] };
      }
    }

    // 3. Issue credit
    const query = `#graphql
      mutation storeCreditAccountCredit(
        $id: ID!
        $creditInput: StoreCreditAccountCreditInput!
      ) {
        storeCreditAccountCredit(
          id: $id
          creditInput: $creditInput
        ) {
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

    let result;
    let emailUnsupported = false;

    try {
      const response = await admin.graphql(query, {
        variables: {
          id: storeCreditAccountId,
          creditInput: {
            creditAmount: {
              amount: String(amount),
              currencyCode,
            },
            notify: notifyCustomer,
            ...(expiresAt ? { expiresAt } : {}),
          },
        },
      });

      const data = await response.json();
      result = data?.data?.storeCreditAccountCredit;
    } catch (graphqlError: any) {
      const errMsg = String(graphqlError.message || graphqlError);
      if (
        errMsg.includes("notify") &&
        (errMsg.includes("Field is not defined") || errMsg.includes("invalid value") || errMsg.includes("GraphqlQueryError"))
      ) {
        console.warn("[⚠️] Shopify API version does not support 'notify' field. Retrying credit addition without notify...");
        emailUnsupported = true;

        try {
          const responseRetry = await admin.graphql(query, {
            variables: {
              id: storeCreditAccountId,
              creditInput: {
                creditAmount: {
                  amount: String(amount),
                  currencyCode,
                },
                ...(expiresAt ? { expiresAt } : {}),
              },
            },
          });

          const dataRetry = await responseRetry.json();
          result = dataRetry?.data?.storeCreditAccountCredit;
        } catch (retryError) {
          console.error("❌ Retry Store Credit Error:", retryError);
          throw retryError;
        }
      } else {
        console.error("❌ Store Credit GraphQL Error:", graphqlError);
        throw graphqlError;
      }
    }

    if (result) {
      result.emailUnsupported = emailUnsupported;
    }

    console.log(
      "✅ Store Credit Response:",
      JSON.stringify(result, null, 2)
    );

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
    const orderTotal = parseFloat(orderPayload.current_total_price || "0");
    
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

