import { useState, useCallback } from "react";
import { useLoaderData, useRouteError } from "react-router";
import { Page, Tabs } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import WidgetsTab from "../components/settings/WidgetsTab";
import StylingTab from "../components/settings/StylingTab";
import TranslationTab from "../components/settings/TranslationTab";
import { getShopPrograms } from "../services/graphql.server";

// ─── GraphQL Queries ───────────────────────────────────────────────────────────

const GET_PROMOTION_WIDGETS_DATA = `#graphql
  query GetPromotionWidgetsData {
    shop {
      id
      primaryDomain {
        host
      }
      customerAccountsV2 {
        customerAccountsVersion
      }
      # Styling metafields
      bg_color: metafield(namespace: "loyalty_cashback_app", key: "widget_bg_color") { value }
      text_color: metafield(namespace: "loyalty_cashback_app", key: "widget_text_color") { value }
      credit_icon: metafield(namespace: "loyalty_cashback_app", key: "widget_credit_icon") { value }
      hide_watermark: metafield(namespace: "loyalty_cashback_app", key: "hide_watermark") { value }
      # Translation metafields
      widget_pending_msg: metafield(namespace: "loyalty_cashback_app", key: "widget_pending_msg") { value }
      widget_completed_msg: metafield(namespace: "loyalty_cashback_app", key: "widget_completed_msg") { value }
      widget_history_title: metafield(namespace: "loyalty_cashback_app", key: "widget_history_title") { value }
      widget_all_transactions: metafield(namespace: "loyalty_cashback_app", key: "widget_all_transactions") { value }
      widget_received_label: metafield(namespace: "loyalty_cashback_app", key: "widget_received_label") { value }
      widget_used_label: metafield(namespace: "loyalty_cashback_app", key: "widget_used_label") { value }
      widget_load_more: metafield(namespace: "loyalty_cashback_app", key: "widget_load_more") { value }
      widget_empty_transaction: metafield(namespace: "loyalty_cashback_app", key: "widget_empty_transaction") { value }
      widget_expires_on: metafield(namespace: "loyalty_cashback_app", key: "widget_expires_on") { value }
      widget_available_credit: metafield(namespace: "loyalty_cashback_app", key: "widget_available_credit") { value }
      widget_currency_label: metafield(namespace: "loyalty_cashback_app", key: "widget_currency_label") { value }
      widget_empty_balance: metafield(namespace: "loyalty_cashback_app", key: "widget_empty_balance") { value }
      widget_expired_balance: metafield(namespace: "loyalty_cashback_app", key: "widget_expired_balance") { value }
      widget_promotion_msg: metafield(namespace: "loyalty_cashback_app", key: "widget_promotion_msg") { value }
      widget_expired_msg: metafield(namespace: "loyalty_cashback_app", key: "widget_expired_msg") { value }
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

// ─── Loader & Action ───────────────────────────────────────────────────────────

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);

  const response = await admin.graphql(GET_PROMOTION_WIDGETS_DATA);
  const data = await response.json();
  const shop = data?.data?.shop;

  const isNewCustomerAccounts = shop?.customerAccountsV2?.customerAccountsVersion === "NEW_CUSTOMER_ACCOUNTS";

  let activeProgram = null;
  try {
    const { programs } = await getShopPrograms(admin);
    activeProgram = programs.find((p) => p.status === "Active") || null;
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
    // Translation values
    widget_pending_msg: shop?.widget_pending_msg?.value || "Thank you for your purchase! 🎉 You'll earn {loyalty_credit_amount} once your order is fulfilled. Use it on your next purchase to save more!",
    widget_completed_msg: shop?.widget_completed_msg?.value || "🎁 You've earned {loyalty_credit_amount} for your recent order. Use it on your next purchase to save more!",
    widget_history_title: shop?.widget_history_title?.value || "Credit Rewards",
    widget_all_transactions: shop?.widget_all_transactions?.value || "All Transactions",
    widget_received_label: shop?.widget_received_label?.value || "Received",
    widget_used_label: shop?.widget_used_label?.value || "Used",
    widget_load_more: shop?.widget_load_more?.value || "Load More",
    widget_empty_transaction: shop?.widget_empty_transaction?.value || "No transactions found.",
    widget_expires_on: shop?.widget_expires_on?.value || "Expires on {expired_date}",
    widget_available_credit: shop?.widget_available_credit?.value || "Available Store Credits",
    widget_currency_label: shop?.widget_currency_label?.value || "Currency",
    widget_empty_balance: shop?.widget_empty_balance?.value || "No store credit found.",
    widget_expired_balance: shop?.widget_expired_balance?.value || "{expired_amount} will be expired soon",
    widget_promotion_msg: shop?.widget_promotion_msg?.value || "You have {balance} store credit. Apply it now!",
    widget_expired_msg: shop?.widget_expired_msg?.value || "{expired_amount} will be expired soon.",
    // Active program config
    activeProgram,
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
    const { fields } = payload;
    const metafields = Object.entries(fields).map(([key, value]) => ({
      ownerId: shopId,
      namespace: "loyalty_cashback_app",
      key,
      type: "single_line_text_field",
      value: String(value),
    }));

    const response = await admin.graphql(SET_METAFIELDS_MUTATION, {
      variables: { metafields },
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
