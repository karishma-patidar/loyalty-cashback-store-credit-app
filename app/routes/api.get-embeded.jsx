import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  let themeId = url.searchParams.get("theme_id");

  try {
    const { admin, session } = await authenticate.admin(request);

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
        console.error("Error resolving theme ID in get-embeded:", error);
      }
    }

    if (!themeId || themeId === "current") {
      return new Response(JSON.stringify({ data: { embed_status_disabled: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Fetch theme asset config/settings_data.json
    const shop = session.shop;
    const accessToken = session.accessToken;
    const apiVersion = "2026-01";

    const fetchUrl = `https://${shop}/admin/api/${apiVersion}/themes/${themeId}/assets.json?asset[key]=config/settings_data.json`;
    const res = await fetch(fetchUrl, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      let errorMsg = `Failed to fetch theme settings: ${res.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.errors) {
          errorMsg = errorJson.errors;
        }
      } catch (e) {}
      return new Response(JSON.stringify({ data: { embed_status_disabled: true, error: errorMsg } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const assetJson = await res.json();
    const settingsValue = assetJson?.asset?.value;
    if (!settingsValue) {
      return new Response(JSON.stringify({ data: { embed_status_disabled: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const settingsData = JSON.parse(settingsValue);
    const blocks = settingsData?.current?.blocks || {};
    
    // Check if loyalty_credit_app_embed is present and active
    let embedEnabled = false;
    for (const key of Object.keys(blocks)) {
      const block = blocks[key];
      if (block.type && block.type.includes("loyalty_credit_app_embed")) {
        if (block.disabled === false || block.disabled === undefined) {
          embedEnabled = true;
          break;
        }
      }
    }

    return new Response(JSON.stringify({ data: { embed_status_disabled: !embedEnabled } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error checking theme embed status:", error);
    return new Response(JSON.stringify({ data: { embed_status_disabled: true, error: error.message } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};
