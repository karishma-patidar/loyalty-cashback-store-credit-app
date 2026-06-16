import { useState, useCallback } from "react";
import { useLoaderData, useRouteError } from "react-router";
import { Page, Tabs } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import WidgetsTab from "../components/settings/WidgetsTab";
import StylingTab from "../components/settings/StylingTab";
import TranslationTab from "../components/settings/TranslationTab";


// ─── GraphQL Queries ───────────────────────────────────────────────────────────

const getPromotionWidgetsDataQuery = () => `#graphql
  query GetPromotionWidgetsData {
    shopLocales {
      locale
      name
      primary
      published
    }
    shop {
      id
      primaryDomain {
        host
      }
      customerAccountsV2 {
        customerAccountsVersion
      }
      # Styling metafields (always base namespace)
      bg_color: metafield(namespace: "loyalty_cashback_app", key: "widget_bg_color") { value }
      text_color: metafield(namespace: "loyalty_cashback_app", key: "widget_text_color") { value }
      credit_icon: metafield(namespace: "loyalty_cashback_app", key: "widget_credit_icon") { value }
      hide_watermark: metafield(namespace: "loyalty_cashback_app", key: "hide_watermark") { value }
      # Single translations metafield
      translations: metafield(namespace: "loyalty_cashback_app", key: "translations") { value }
    }
  }
`;

const SET_METAFIELDS_MUTATION = `#graphql
  mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors {
        message
      }
    }
  }
`;

const DELETE_METAFIELDS_MUTATION = `#graphql
  mutation DeleteMetafields($metafields: [MetafieldIdentifierInput!]!) {
    metafieldsDelete(metafields: $metafields) {
      userErrors {
        message
      }
    }
  }
`;

// ─── Loader & Action ───────────────────────────────────────────────────────────

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale");
  const actionParam = url.searchParams.get("action");

  const response = await admin.graphql(getPromotionWidgetsDataQuery());
  const data = await response.json();
  const shop = data?.data?.shop;
  const shopLocales = data?.data?.shopLocales || [];

  const primaryLocale = shopLocales.find((l) => l.primary)?.locale || "en";
  const activeLocale = locale || primaryLocale;

  let translationsObj = {};
  try {
    if (shop?.translations?.value) {
      translationsObj = JSON.parse(shop.translations.value);
    }
  } catch (err) {
    console.error("Error parsing translations metafield:", err);
  }

  const defaultEnglish = {
    widget_pending_msg: "Thank you for your purchase! 🎉 You'll earn {loyalty_credit_amount} once your order is fulfilled. Use it on your next purchase to save more!",
    widget_completed_msg: "🎁 You've earned {loyalty_credit_amount} for your recent order. Use it on your next purchase to save more!",
    widget_history_title: "Credit Rewards",
    widget_all_transactions: "All Transactions",
    widget_received_label: "Received",
    widget_used_label: "Used",
    widget_load_more: "Load More",
    widget_empty_transaction: "No transactions found.",
    widget_expires_on: "Expires on {expired_date}",
    widget_available_credit: "Available Store Credits",
    widget_currency_label: "Currency",
    widget_empty_balance: "No store credit found.",
    widget_expired_balance: "{expired_amount} will be expired soon",
    widget_promotion_msg: "You have {balance} store credit. Apply it now!",
    widget_expired_msg: "{expired_amount} will be expired soon.",
    cashback_msg_product: "",
    cashback_msg_cart: "",
    cashback_msg_checkout: "",
    custom_msg_description: "",
  };

  const getTranslationVal = (key) => {
    if (translationsObj[activeLocale]?.[key] !== undefined && translationsObj[activeLocale]?.[key] !== "") {
      return translationsObj[activeLocale][key];
    }
    if (translationsObj[primaryLocale]?.[key] !== undefined && translationsObj[primaryLocale]?.[key] !== "") {
      return translationsObj[primaryLocale][key];
    }
    return defaultEnglish[key] || "";
  };

  const resolvedTranslations = {};
  Object.keys(defaultEnglish).forEach((key) => {
    resolvedTranslations[key] = getTranslationVal(key);
  });

  // If this is a specific fetch for translations only, we return just that
  if (actionParam === "fetchTranslations") {
    return resolvedTranslations;
  }

  const isNewCustomerAccounts = shop?.customerAccountsV2?.customerAccountsVersion === "NEW_CUSTOMER_ACCOUNTS";

  let activeProgram = null;
  let activeCashbackProgram = null;
  let activeCustomProgram = null;
  try {
    const { getShopPrograms } = await import("../services/storeCredit.server");
    const { programs } = await getShopPrograms(admin);
    activeProgram = programs.find((p) => p.status === "Active") || null;
    activeCashbackProgram = programs.find((p) => p.status === "Active" && p.programType !== "custom") || null;
    activeCustomProgram = programs.find((p) => p.status === "Active" && p.programType === "custom") || null;
  } catch (err) {
    console.error("Error loading programs in settings loader:", err);
  }

  return {
    shop: session.shop,
    shopId: shop?.id,
    isNewCustomerAccounts,
    extensionId: process.env.SHOPIFY_THEME_APP_EXTENSION_ID || "65b30aae-2fc0-9b48-3e28-e6bf3e801b92f9c75ad7",
    // Styling values
    bgColor: shop?.bg_color?.value || "#cfb84a",
    textColor: shop?.text_color?.value || "#000000",
    creditIcon: shop?.credit_icon?.value || "icon2",
    hideWatermark: shop?.hide_watermark?.value === "true",
    // Consolidated Translation values
    ...resolvedTranslations,
    // Active program config
    activeProgram,
    activeCashbackProgram,
    activeCustomProgram,
    shopLocales,
    primaryLocale,
  };
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const payload = await request.json();
  const { actionType, shopId } = payload;

  if (actionType === "saveStyling") {
    const { bgColor, textColor, creditIcon, hideWatermark } = payload;
    const response = await admin.graphql(SET_METAFIELDS_MUTATION, {
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
      return { success: false, errors: userErrors };
    }
    return { success: true };
  }

  if (actionType === "saveTranslations") {
    const { fields, locale } = payload;

    const shopQuery = `#graphql
      query GetTranslations {
        shopLocales {
          locale
          primary
        }
        shop {
          translations: metafield(namespace: "loyalty_cashback_app", key: "translations") {
            value
          }
        }
      }
    `;
    const shopRes = await admin.graphql(shopQuery);
    const shopData = await shopRes.json();
    const existingTranslationsVal = shopData?.data?.shop?.translations?.value;
    const shopLocales = shopData?.data?.shopLocales || [];
    const primaryLocale = shopLocales.find((l) => l.primary)?.locale || "en";

    let translationsObj = {};
    if (existingTranslationsVal) {
      try {
        translationsObj = JSON.parse(existingTranslationsVal);
      } catch (err) {
        console.error("Error parsing existing translations in saveTranslations action:", err);
      }
    }

    const activeLocale = locale || primaryLocale;
    translationsObj[activeLocale] = fields;
    translationsObj._defaultLocale = primaryLocale;

    const response = await admin.graphql(SET_METAFIELDS_MUTATION, {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: "loyalty_cashback_app",
            key: "translations",
            type: "json",
            value: JSON.stringify(translationsObj),
          },
        ],
      },
    });

    const data = await response.json();
    const userErrors = data?.data?.metafieldsSet?.userErrors;
    if (userErrors && userErrors.length > 0) {
      return { success: false, errors: userErrors };
    }
    return { success: true };
  }

  return { success: false, error: "Invalid action" };
}

// ─── React Router View ──────────────────────────────────────────────────────────

export default function Settings() {
  const loaderData = useLoaderData();
  const [selectedTab, setSelectedTab] = useState(0);

  const handleTabChange = useCallback(
    (selectedTabIndex) => setSelectedTab(selectedTabIndex),
    []
  );

  const tabs = [
    {
      id: "widgets",
      content: "Widgets",
      panelID: "widgets-panel",
    },
    {
      id: "styling",
      content: "Styling",
      panelID: "styling-panel",
    },
    {
      id: "translation",
      content: "Translation",
      panelID: "translation-panel",
    },
  ];

  return (
    <Page title="Settings">
      <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
        <div style={{ marginTop: "24px" }}>
          {/* Main Content Areas persistent to keep states */}
          <div style={{ display: selectedTab === 0 ? "block" : "none" }}>
            <WidgetsTab loaderData={loaderData} />
          </div>
          <div style={{ display: selectedTab === 1 ? "block" : "none" }}>
            <StylingTab loaderData={loaderData} />
          </div>
          <div style={{ display: selectedTab === 2 ? "block" : "none" }}>
            <TranslationTab loaderData={loaderData} />
          </div>
        </div>
      </Tabs>
    </Page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
