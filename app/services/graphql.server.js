/**
 * Centralized GraphQL Service Layer for Shopify Admin APIs
 * Location: app/services/graphql.server.js
 */

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





