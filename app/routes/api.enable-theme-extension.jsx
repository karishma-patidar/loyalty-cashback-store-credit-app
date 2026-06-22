/* global process */
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { admin, session } = await authenticate.admin(request);
  const payload = await request.json();
  let themeId = payload.themeId;

  if (!themeId || themeId === "current") {
    try {
      const response = await admin.graphql(`#graphql
        query {
          themes(first: 10) {
            edges {
              node {
                id
                role
              }
            }
          }
        }
      `);
      const data = await response.json();
      const mainTheme = data?.data?.themes?.edges?.find(edge => edge.node.role === "MAIN")?.node;
      if (mainTheme) {
        themeId = mainTheme.id.split("/").pop();
      }
    } catch (error) {
      console.error("Error resolving theme ID in enable-theme-extension:", error);
    }
  }

  if (!themeId) {
    return new Response(JSON.stringify({ success: false, error: "themeId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const extensionId = process.env.SHOPIFY_THEME_APP_EXTENSION_ID || "65b30aae-2fc0-9b48-3e28-e6bf3e801b92f9c75ad7";

  try {
    // 1. Fetch config/settings_data.json
    const shop = session.shop;
    const accessToken = session.accessToken;
    const apiVersion = "2026-01";

    const fetchUrl = `https://${shop}/admin/api/${apiVersion}/themes/${themeId}/assets.json?asset[key]=config/settings_data.json`;
    const getRes = await fetch(fetchUrl, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!getRes.ok) {
      const errorText = await getRes.text();
      let errorMsg = `Failed to fetch theme settings: ${getRes.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.errors) {
          errorMsg = errorJson.errors;
        }
      } catch (e) {}
      return new Response(JSON.stringify({ success: false, error: errorMsg }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const getJson = await getRes.json();
    const settingsValue = getJson?.asset?.value;
    if (!settingsValue) {
      return new Response(JSON.stringify({ success: false, error: "Could not retrieve settings_data.json" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const settingsData = JSON.parse(settingsValue);
    if (!settingsData.current) {
      settingsData.current = {};
    }
    if (!settingsData.current.blocks) {
      settingsData.current.blocks = {};
    }

    const blocks = settingsData.current.blocks;
    const targetType = `shopify://apps/${extensionId}/blocks/loyalty_credit_app_embed`;

    // Check if the block already exists
    let blockKey = null;
    for (const key of Object.keys(blocks)) {
      if (blocks[key].type === targetType) {
        blockKey = key;
        break;
      }
    }

    if (blockKey) {
      // Update existing block to be enabled
      blocks[blockKey].disabled = false;
    } else {
      // Add a new block instance
      const newBlockId = `loyalty_credit_app_embed_${Date.now()}`;
      blocks[newBlockId] = {
        type: targetType,
        disabled: false,
        settings: {},
      };
    }

    // 2. Save the modified config/settings_data.json back to the theme
    const putUrl = `https://${shop}/admin/api/${apiVersion}/themes/${themeId}/assets.json`;
    const putRes = await fetch(putUrl, {
      method: "PUT",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        asset: {
          key: "config/settings_data.json",
          value: JSON.stringify(settingsData, null, 2),
        },
      }),
    });

    const putJson = await putRes.json();
    if (putJson?.asset) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      return new Response(JSON.stringify({ success: false, error: "Failed to update theme asset" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Error enabling theme extension:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
