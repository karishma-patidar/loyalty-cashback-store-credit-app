/* global process */
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import OnboardingWizard from "../components/OnboardingWizard";
import { getShopPrograms, setShopPrograms, getShopStyling, setShopStyling } from "../services/graphql.server";
import { updateAppSettings } from "../db.mongodb.server";

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);

  // Query themes to find the main/active theme
  let themeId = "current";
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
    console.error("Error fetching active theme ID:", error);
  }

  // Get Shop Programs and Shop ID
  let shopId = null;
  let initialProgram = null;
  try {
    const res = await getShopPrograms(admin);
    shopId = res.shopId;
    if (res.programs && res.programs.length > 0) {
      initialProgram = res.programs[0];
    }
  } catch (error) {
    console.error("Error fetching shop programs in onboarding:", error);
  }

  // Get Styling settings from metafields to load them during onboarding
  let bgColor = "#cfb84a";
  let textColor = "#000000";
  let creditIcon = "icon2";
  let hideWatermark = false;

  try {
    const styling = await getShopStyling(admin);
    bgColor = styling.bgColor;
    textColor = styling.textColor;
    creditIcon = styling.creditIcon;
    hideWatermark = styling.hideWatermark;
  } catch (err) {
    console.error("Error loading styling in onboarding loader:", err);
  }

  let isExtensionEnabled = false;
  if (themeId && themeId !== "current") {
    try {
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
      if (res.ok) {
        const assetJson = await res.json();
        const settingsValue = assetJson?.asset?.value;
        if (settingsValue) {
          const settingsData = JSON.parse(settingsValue);
          const blocks = settingsData?.current?.blocks || {};
          for (const key of Object.keys(blocks)) {
            const block = blocks[key];
            if (block.type && block.type.includes("loyalty_credit_app_embed")) {
              if (block.disabled === false || block.disabled === undefined) {
                isExtensionEnabled = true;
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error checking theme embed status in onboarding loader:", error);
    }
  }

  return {
    shop: session.shop,
    themeId,
    apiKey: process.env.SHOPIFY_API_KEY || "4639e8c9e33fe4badd965e769d8b46da",
    shopId,
    initialProgram,
    bgColor,
    textColor,
    creditIcon,
    hideWatermark,
    isExtensionEnabled,
  };
}

export async function action({ request }) {
  try {
    const { admin, session } = await authenticate.admin(request);
    const payload = await request.json();
    const { actionType } = payload;

    if (actionType === "completeOnboarding") {
      await updateAppSettings(session.shop, { onboardingCompleted: true });
      return Response.json({ success: true, completed: true });
    }

    if (actionType === "saveProgram") {
      let programData = payload.programData;
      if (typeof programData === "string") {
        programData = JSON.parse(programData);
      }

      const { shopId, programs } = await getShopPrograms(admin);

      let updatedPrograms = [];
      if (programs.length > 0) {
        programData.id = programs[0].id;
        updatedPrograms = [programData];
      } else {
        updatedPrograms = [programData];
      }

      await setShopPrograms(admin, shopId, updatedPrograms);
      return Response.json({ success: true, id: programData.id });
    }

    if (actionType === "saveStyling") {
      const { shopId, bgColor, textColor, creditIcon, hideWatermark } = payload;
      await setShopStyling(admin, shopId, { bgColor, textColor, creditIcon, hideWatermark });
      return Response.json({ success: true });
    }

    return Response.json({ success: false, error: "Invalid action" });
  } catch (error) {
    console.error("Onboarding action error:", error);
    return Response.json({ success: false, error: error.message });
  }
}

export default function OnboardingRoute() {
  const {
    shop,
    themeId,
    apiKey,
    shopId,
    initialProgram,
    bgColor,
    textColor,
    creditIcon,
    hideWatermark,
    isExtensionEnabled,
  } = useLoaderData();

  return (
    <OnboardingWizard
      shop={shop}
      themeId={themeId}
      apiKey={apiKey}
      shopId={shopId}
      initialProgram={initialProgram}
      bgColor={bgColor}
      textColor={textColor}
      creditIcon={creditIcon}
      hideWatermark={hideWatermark}
      isExtensionEnabled={isExtensionEnabled}
    />
  );
}