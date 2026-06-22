/**
 * Centralized GraphQL Service Layer for Shopify Admin APIs
 * Location: app/services/graphql.server.js
 */

import { connectLoyaltyDB, getFlowProgramModel, connectMongoDB, getShopModel } from "../db.mongodb.server.js";

/**
 * Fetch the Shop ID and the list of loyalty/cashback programs from Shopify metafields.
 * @param {object} admin - Authenticated Shopify Admin client
 * @returns {Promise<{ shopId: string, programs: Array, metafieldId: string|null }>}
 */
export async function getShopPrograms(admin) {
  const query = `
    query GetShopPrograms {
      shop {
        id
        metafield(namespace: "loyalty_cashback_app", key: "programs") {
          id
          value
        }
      }
    }
  `;
  const response = await admin.graphql(query);
  const data = await response.json();
  const shopId = data?.data?.shop?.id;
  const value = data?.data?.shop?.metafield?.value;
  const metafieldId = data?.data?.shop?.metafield?.id;

  let programs = [];
  if (value) {
    try {
      programs = JSON.parse(value);
      if (!Array.isArray(programs)) programs = [];
    } catch (e) {
      console.error("Error parsing programs JSON:", e);
    }
  }
  return { shopId, programs, metafieldId };
}

/**
 * Set/Save the complete list of programs in the shop's metafield.
 * @param {object} admin - Authenticated Shopify Admin client
 * @param {string} shopId - Shop Admin GraphQL GID
 * @param {Array} programs - Array of loyalty programs
 * @returns {Promise<{ success: boolean }>}
 */
export async function setShopPrograms(admin, shopId, programs) {
  try {
    const defMutation = `
      mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $definition) {
          createdDefinition {
            id
            name
          }
        }
      }
    `;
    await admin.graphql(defMutation, {
      variables: {
        definition: {
          name: "Loyalty Cashback Programs",
          namespace: "loyalty_cashback_app",
          key: "programs",
          type: "json",
          description: "Stores loyalty program configurations for Loyalty Store Credit app",
          ownerType: "SHOP"
        }
      }
    });
  } catch (err) {
    // Ignore if already created
  }

  // ==== CALCULATE ISSUED AMOUNT FROM MONGODB ====
  let shopDomain = null;
  let shopCurrency = "USD";
  try {
    const shopQuery = `
      query {
        shop {
          myshopifyDomain
          currencyCode
        }
      }
    `;
    const shopRes = await admin.graphql(shopQuery);
    const shopData = await shopRes.json();
    shopDomain = shopData?.data?.shop?.myshopifyDomain;
    shopCurrency = shopData?.data?.shop?.currencyCode || "USD";
  } catch (err) {
    console.error("Error fetching shop data in setShopPrograms:", err);
  }

  if (shopDomain) {
    try {
      await connectMongoDB();
      const ShopModel = getShopModel(shopDomain);
      const docs = ShopModel ? await ShopModel.find({}) : [];

      // Determine unique currencies in MongoDB
      const allEvents = [];
      for (const doc of docs) {
        if (doc.events && Array.isArray(doc.events)) {
          allEvents.push(...doc.events);
        }
      }
      const mongoCurrencies = Array.from(new Set(allEvents.map(e => e.currency))).filter(Boolean);
      const isSingleCurrency = mongoCurrencies.length <= 1;
      const activeCurrency = (isSingleCurrency && mongoCurrencies.length === 1) ? mongoCurrencies[0] : shopCurrency;

      // Identify the "first" program of each category to absorb old legacy events
      const firstCashbackProg = programs.find(p => p.programType !== "custom" && !p.isFlowProgram);
      const firstCustomProg = programs.find(p => p.programType === "custom" || p.isFlowProgram);

      const currencySymbols = {
        INR: "₹",
        USD: "$",
        CAD: "C$",
        AUD: "A$",
        GBP: "£",
        EUR: "€",
        JPY: "¥",
      };

      const formatCurrencyLocal = (amount, currencyCode) => {
        const symbol = currencySymbols[currencyCode] || currencyCode || "$";
        const formatted = Number(amount || 0).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        return `${symbol}${formatted} ${currencyCode || "USD"}`;
      };

      for (const prog of programs) {
        let totalIssued = 0;
        const progId = prog.programId || prog.id;

        for (const doc of docs) {
          if (doc.events && Array.isArray(doc.events)) {
            for (const ev of doc.events) {
              if (ev.status === "Completed") {
                const evCurrency = ev.currency || shopCurrency;

                // Discard other currencies if MongoDB contains multiple currencies
                if (!isSingleCurrency && evCurrency !== shopCurrency) {
                  continue;
                }

                let amountVal = Number(ev.issuedAmount || 0);

                if (ev.programId) {
                  // Precise matching for new events
                  if (ev.programId === progId) {
                    totalIssued += amountVal;
                  }
                } else {
                  // Fallback for old events that lack a programId
                  const evIsCustom = ev.programType === "Custom Program" || ev.programType === "custom" || ev.programType === "fixed" || ev.programType === "percentage";
                  const isProgCustom = prog.programType === "custom" || prog.isFlowProgram;

                  if (isProgCustom && evIsCustom && prog.id === firstCustomProg?.id) {
                    totalIssued += amountVal;
                  } else if (!isProgCustom && !evIsCustom && prog.id === firstCashbackProg?.id) {
                    totalIssued += amountVal;
                  }
                }
              }
            }
          }
        }

        prog.issued = formatCurrencyLocal(totalIssued, activeCurrency);
      }
    } catch (err) {
      console.error("Error calculating dynamic program issued amounts in setShopPrograms:", err);
    }
  }

  const mutation = `
    mutation SetPrograms($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors {
          message
          field
        }
      }
    }
  `;

  const response = await admin.graphql(mutation, {
    variables: {
      metafields: [
        {
          ownerId: shopId,
          namespace: "loyalty_cashback_app",
          key: "programs",
          type: "json",
          value: JSON.stringify(programs),
        },
      ],
    },
  });

  const data = await response.json();
  const userErrors = data?.data?.metafieldsSet?.userErrors;
  if (userErrors && userErrors.length > 0) {
    throw new Error(userErrors[0].message);
  }

  // ==== SYNC TO MONGODB ====
  try {
    if (shopDomain) {
      await connectLoyaltyDB();
      const FlowProgramModel = getFlowProgramModel();
      if (FlowProgramModel) {
        // Consolidate all programs into a single session document
        await FlowProgramModel.findOneAndUpdate(
          { shop: shopDomain },
          { $set: { shop: shopDomain, programs: programs } },
          { upsert: true, new: true }
        );

        console.log(`[MongoDB Sync] Synchronized ${programs.length} programs into a single session document for ${shopDomain}`);
      }
    }
  } catch (syncError) {
    console.error("[MongoDB Sync Error] Failed to sync programs to MongoDB:", syncError);
  }

  return { success: true };
}

/**
 * Delete the loyalty programs metafield entirely from the Shop.
 * @param {object} admin - Authenticated Shopify Admin client
 * @param {string} shopId - Shop Admin GraphQL GID
 * @returns {Promise<{ success: boolean }>}
 */
export async function deleteShopPrograms(admin, shopId) {
  const mutation = `
    mutation DeleteProgramsMetafield($metafields: [MetafieldIdentifierInput!]!) {
      metafieldsDelete(metafields: $metafields) {
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await admin.graphql(mutation, {
    variables: {
      metafields: [
        {
          ownerId: shopId,
          namespace: "loyalty_cashback_app",
          key: "programs",
        },
      ],
    },
  });

  const data = await response.json();
  const userErrors = data?.data?.metafieldsDelete?.userErrors;
  if (userErrors && userErrors.length > 0) {
    throw new Error(userErrors[0].message);
  }

  return { success: true };
}

/**
 * Fetch the widget styling configurations from Shopify metafields.
 * @param {object} admin - Authenticated Shopify Admin client
 * @returns {Promise<{ shopId: string, bgColor: string, textColor: string, creditIcon: string, hideWatermark: boolean }>}
 */
export async function getShopStyling(admin) {
  const query = `#graphql
    query GetStylingMetafields {
      shop {
        id
        bg_color: metafield(namespace: "loyalty_cashback_app", key: "widget_bg_color") {
          value
        }
        text_color: metafield(namespace: "loyalty_cashback_app", key: "widget_text_color") {
          value
        }
        credit_icon: metafield(namespace: "loyalty_cashback_app", key: "widget_credit_icon") {
          value
        }
        hide_watermark: metafield(namespace: "loyalty_cashback_app", key: "hide_watermark") {
          value
        }
      }
    }
  `;

  const response = await admin.graphql(query);
  const data = await response.json();
  const shop = data?.data?.shop;

  return {
    shopId: shop?.id || null,
    bgColor: shop?.bg_color?.value || "#cfb84a",
    textColor: shop?.text_color?.value || "#000000",
    creditIcon: shop?.credit_icon?.value || "icon2",
    hideWatermark: shop?.hide_watermark?.value === "true",
  };
}

/**
 * Set/Save the widget styling configurations in Shopify metafields.
 * @param {object} admin - Authenticated Shopify Admin client
 * @param {string} shopId - Shop Admin GraphQL GID
 * @param {object} styling - Widget styling configurations
 * @returns {Promise<{ success: boolean }>}
 */
export async function setShopStyling(admin, shopId, { bgColor, textColor, creditIcon, hideWatermark }) {
  const mutation = `#graphql
    mutation SetStylingMetafields($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors {
          message
        }
      }
    }
  `;

  const response = await admin.graphql(mutation, {
    variables: {
      metafields: [
        {
          ownerId: shopId,
          namespace: "loyalty_cashback_app",
          key: "widget_bg_color",
          type: "single_line_text_field",
          value: bgColor,
        },
        {
          ownerId: shopId,
          namespace: "loyalty_cashback_app",
          key: "widget_text_color",
          type: "single_line_text_field",
          value: textColor,
        },
        {
          ownerId: shopId,
          namespace: "loyalty_cashback_app",
          key: "widget_credit_icon",
          type: "single_line_text_field",
          value: creditIcon,
        },
        {
          ownerId: shopId,
          namespace: "loyalty_cashback_app",
          key: "hide_watermark",
          type: "single_line_text_field",
          value: String(hideWatermark),
        },
      ],
    },
  });

  const data = await response.json();
  const userErrors = data?.data?.metafieldsSet?.userErrors;

  if (userErrors && userErrors.length > 0) {
    throw new Error(userErrors[0].message);
  }

  return { success: true };
}





