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




