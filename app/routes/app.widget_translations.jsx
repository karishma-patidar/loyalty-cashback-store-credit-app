import { useState, useEffect, useCallback, useRef } from "react";
import {
  useNavigate,
  useLoaderData,
  useFetcher,
  useRouteError,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { Page } from "@shopify/polaris";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  const query = `#graphql
    query GetTranslationMetafields {
      shop {
        id
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

  const response = await admin.graphql(query);
  const data = await response.json();
  const shop = data?.data?.shop;

  return {
    shopId: shop?.id,
    widget_pending_msg:
      shop?.widget_pending_msg?.value ||
      "Thank you for your purchase! 🎉 You'll earn {koin_amount} once your order is fulfilled. Use it on your next purchase to save more!",
    widget_completed_msg:
      shop?.widget_completed_msg?.value ||
      "🎁 You've earned {koin_amount} for your recent order. Use it on your next purchase to save more!",
    widget_history_title: shop?.widget_history_title?.value || "Credit Rewards",
    widget_all_transactions:
      shop?.widget_all_transactions?.value || "All Transactions",
    widget_received_label: shop?.widget_received_label?.value || "Received",
    widget_used_label: shop?.widget_used_label?.value || "Used",
    widget_load_more: shop?.widget_load_more?.value || "Load More",
    widget_empty_transaction:
      shop?.widget_empty_transaction?.value || "No transactions found.",
    widget_expires_on:
      shop?.widget_expires_on?.value || "Expires on {expired_date}",
    widget_available_credit:
      shop?.widget_available_credit?.value || "Available Store Credits",
    widget_currency_label: shop?.widget_currency_label?.value || "Currency",
    widget_empty_balance:
      shop?.widget_empty_balance?.value || "No store credit found.",
    widget_expired_balance:
      shop?.widget_expired_balance?.value ||
      "{expired_amount} will be expired soon",
    widget_promotion_msg:
      shop?.widget_promotion_msg?.value ||
      "You have {balance} store credit. Apply it now!",
    widget_expired_msg:
      shop?.widget_expired_msg?.value ||
      "{expired_amount} will be expired soon.",
  };
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const payload = await request.json();
  const { shopId, ...fields } = payload;

  const mutation = `#graphql
    mutation SetTranslationMetafields($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors {
          message
        }
      }
    }
  `;

  const metafields = Object.entries(fields).map(([key, value]) => ({
    ownerId: shopId,
    namespace: "loyalty_cashback_app",
    key,
    type: "single_line_text_field",
    value: String(value),
  }));

  const response = await admin.graphql(mutation, {
    variables: { metafields },
  });

  const data = await response.json();
  const userErrors = data?.data?.metafieldsSet?.userErrors;

  if (userErrors && userErrors.length > 0) {
    return { success: false, errors: userErrors };
  }

  return { success: true };
}

export default function WidgetTranslations() {
  const navigate = useNavigate();
  const loaderData = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [selectedTab, setSelectedTab] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formState, setFormState] = useState({
    widget_pending_msg: loaderData.widget_pending_msg,
    widget_completed_msg: loaderData.widget_completed_msg,
    widget_history_title: loaderData.widget_history_title,
    widget_all_transactions: loaderData.widget_all_transactions,
    widget_received_label: loaderData.widget_received_label,
    widget_used_label: loaderData.widget_used_label,
    widget_load_more: loaderData.widget_load_more,
    widget_empty_transaction: loaderData.widget_empty_transaction,
    widget_expires_on: loaderData.widget_expires_on,
    widget_available_credit: loaderData.widget_available_credit,
    widget_currency_label: loaderData.widget_currency_label,
    widget_empty_balance: loaderData.widget_empty_balance,
    widget_expired_balance: loaderData.widget_expired_balance,
    widget_promotion_msg: loaderData.widget_promotion_msg,
    widget_expired_msg: loaderData.widget_expired_msg,
  });

  const [initialFormState, setInitialFormState] = useState(
    JSON.stringify({
      widget_pending_msg: loaderData.widget_pending_msg,
      widget_completed_msg: loaderData.widget_completed_msg,
      widget_history_title: loaderData.widget_history_title,
      widget_all_transactions: loaderData.widget_all_transactions,
      widget_received_label: loaderData.widget_received_label,
      widget_used_label: loaderData.widget_used_label,
      widget_load_more: loaderData.widget_load_more,
      widget_empty_transaction: loaderData.widget_empty_transaction,
      widget_expires_on: loaderData.widget_expires_on,
      widget_available_credit: loaderData.widget_available_credit,
      widget_currency_label: loaderData.widget_currency_label,
      widget_empty_balance: loaderData.widget_empty_balance,
      widget_expired_balance: loaderData.widget_expired_balance,
      widget_promotion_msg: loaderData.widget_promotion_msg,
      widget_expired_msg: loaderData.widget_expired_msg,
    }),
  );

  const isDirty = JSON.stringify(formState) !== initialFormState;

  useEffect(() => {
    if (isDirty) {
      shopify.saveBar.show("translations-save-bar");
    } else {
      shopify.saveBar.hide("translations-save-bar");
    }
  }, [isDirty, shopify]);

  const currentFormStateRef = useRef(JSON.stringify(formState));
  useEffect(() => {
    currentFormStateRef.current = JSON.stringify(formState);
  }, [formState]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      setIsSubmitting(false);
      if (fetcher.data.success) {
        shopify.toast.show("Translations updated!");
        setInitialFormState(currentFormStateRef.current);
      } else {
        shopify.toast.show(
          fetcher.data.errors?.[0]?.message || "Error saving translations",
          { isError: true },
        );
      }
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const handleFieldChange = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = useCallback(() => {
    setIsSubmitting(true);
    fetcher.submit(
      {
        shopId: loaderData.shopId,
        ...formState,
      },
      { method: "POST", encType: "application/json" },
    );
  }, [fetcher, loaderData.shopId, formState]);

  const handleDiscard = useCallback(() => {
    const initial = JSON.parse(initialFormState);
    setFormState(initial);
  }, [initialFormState]);

  const tabs = [
    { id: 0, label: "Customer account" },
    { id: 1, label: "Checkout extension" },
  ];

  return (
    <s-box className="min-h-screen pb-12">
      <s-page>
        <s-box className="max-w-[800px] mx-auto pt-6">
          <s-stack gap="base" direction="block">
            {/* Header Row */}
            <s-stack
              direction="inline"
              justifyContent="space-between"
              alignment="center"
            >
              <s-stack direction="inline" alignment="center">
                <s-button
                  variant="tertiary"
                  icon="arrow-left"
                  onClick={() => {
                    if (isDirty) handleDiscard();
                    navigate("/app/promotion_widgets");
                  }}
                  className="mr-2"
                />
                <s-heading
                  variant="headingLg"
                  className="text-[24px] font-bold"
                >
                  Default Text
                </s-heading>
              </s-stack>

              {/* Segmented Tab Controls */}
              <s-stack
                direction="inline"
                gap="base"
                className="bg-[#F4F6F8] p-1 rounded-lg border border-[#E4E8EC]"
              >
                {tabs.map((tab) => (
                  <s-button
                    key={tab.id}
                    variant={selectedTab === tab.id ? "secondary" : "tertiary"}
                    onClick={() => setSelectedTab(tab.id)}
                    className={
                      selectedTab === tab.id
                        ? "font-bold text-black"
                        : "text-gray-500"
                    }
                  >
                    {tab.label}
                  </s-button>
                ))}
              </s-stack>
            </s-stack>

            <ui-save-bar
              id="translations-save-bar"
              open={isDirty ? "true" : undefined}
            >
              <button
                variant="primary"
                onClick={handleSave}
                loading={isSubmitting ? "true" : undefined}
                disabled={isSubmitting}
              >
                Save
              </button>
              <button onClick={handleDiscard} disabled={isSubmitting}>
                Discard
              </button>
            </ui-save-bar>

            {/* CUSTOMER ACCOUNT TAB */}
            {selectedTab === 0 && (
              <s-stack direction="block" gap="base">
                {/* Cashback Notification Section */}
                <s-section>
                  <s-box padding="5">
                    <s-stack direction="block" gap="base">
                      <s-heading
                        variant="headingSm"
                        className="font-bold text-[16px] text-gray-800"
                      >
                        Cashback notification
                      </s-heading>

                      <s-stack direction="block" gap="tight">
                        <s-text color="subdued" variant="bold">
                          Pending message
                        </s-text>
                        <s-text-field
                          type="text"
                          value={formState.widget_pending_msg}
                          onInput={(e) =>
                            handleFieldChange(
                              "widget_pending_msg",
                              e.target.value,
                            )
                          }
                        />
                      </s-stack>

                      <s-stack direction="block" gap="tight">
                        <s-text color="subdued" variant="bold">
                          Completed message
                        </s-text>
                        <s-text-field
                          type="text"
                          value={formState.widget_completed_msg}
                          onInput={(e) =>
                            handleFieldChange(
                              "widget_completed_msg",
                              e.target.value,
                            )
                          }
                        />
                      </s-stack>
                    </s-stack>
                  </s-box>
                </s-section>

                {/* Store Credit History Section */}
                <s-section>
                  <s-box padding="5">
                    <s-stack direction="block" gap="base">
                      <s-heading
                        variant="headingSm"
                        className="font-bold text-[16px] text-gray-800"
                      >
                        Store credit history
                      </s-heading>

                      <s-stack direction="block" gap="tight">
                        <s-text color="subdued" variant="bold">
                          Store credit history table title
                        </s-text>
                        <s-text-field
                          type="text"
                          value={formState.widget_history_title}
                          onInput={(e) =>
                            handleFieldChange(
                              "widget_history_title",
                              e.target.value,
                            )
                          }
                        />
                      </s-stack>

                      <s-stack direction="block" gap="tight">
                        <s-text color="subdued" variant="bold">
                          All transactions label
                        </s-text>
                        <s-text-field
                          type="text"
                          value={formState.widget_all_transactions}
                          onInput={(e) =>
                            handleFieldChange(
                              "widget_all_transactions",
                              e.target.value,
                            )
                          }
                        />
                      </s-stack>

                      <s-stack direction="block" gap="tight">
                        <s-text color="subdued" variant="bold">
                          Received transaction label
                        </s-text>
                        <s-text-field
                          type="text"
                          value={formState.widget_received_label}
                          onInput={(e) =>
                            handleFieldChange(
                              "widget_received_label",
                              e.target.value,
                            )
                          }
                        />
                      </s-stack>

                      <s-stack direction="block" gap="tight">
                        <s-text color="subdued" variant="bold">
                          Used transaction label
                        </s-text>
                        <s-text-field
                          type="text"
                          value={formState.widget_used_label}
                          onInput={(e) =>
                            handleFieldChange(
                              "widget_used_label",
                              e.target.value,
                            )
                          }
                        />
                      </s-stack>

                      <s-stack direction="block" gap="tight">
                        <s-text color="subdued" variant="bold">
                          Load more label
                        </s-text>
                        <s-text-field
                          type="text"
                          value={formState.widget_load_more}
                          onInput={(e) =>
                            handleFieldChange(
                              "widget_load_more",
                              e.target.value,
                            )
                          }
                        />
                      </s-stack>

                      <s-stack direction="block" gap="tight">
                        <s-text color="subdued" variant="bold">
                          Empty transaction label
                        </s-text>
                        <s-text-field
                          type="text"
                          value={formState.widget_empty_transaction}
                          onInput={(e) =>
                            handleFieldChange(
                              "widget_empty_transaction",
                              e.target.value,
                            )
                          }
                        />
                      </s-stack>

                      <s-stack direction="block" gap="tight">
                        <s-text color="subdued" variant="bold">
                          Expires on label
                        </s-text>
                        <s-text-field
                          type="text"
                          value={formState.widget_expires_on}
                          onInput={(e) =>
                            handleFieldChange(
                              "widget_expires_on",
                              e.target.value,
                            )
                          }
                        />
                      </s-stack>

                      <s-stack direction="block" gap="tight">
                        <s-text color="subdued" variant="bold">
                          Available store credit label
                        </s-text>
                        <s-text-field
                          type="text"
                          value={formState.widget_available_credit}
                          onInput={(e) =>
                            handleFieldChange(
                              "widget_available_credit",
                              e.target.value,
                            )
                          }
                        />
                      </s-stack>

                      <s-stack direction="block" gap="tight">
                        <s-text color="subdued" variant="bold">
                          Currency label
                        </s-text>
                        <s-text-field
                          type="text"
                          value={formState.widget_currency_label}
                          onInput={(e) =>
                            handleFieldChange(
                              "widget_currency_label",
                              e.target.value,
                            )
                          }
                        />
                      </s-stack>

                      <s-stack direction="block" gap="tight">
                        <s-text color="subdued" variant="bold">
                          Empty balance label
                        </s-text>
                        <s-text-field
                          type="text"
                          value={formState.widget_empty_balance}
                          onInput={(e) =>
                            handleFieldChange(
                              "widget_empty_balance",
                              e.target.value,
                            )
                          }
                        />
                      </s-stack>

                      <s-stack direction="block" gap="tight">
                        <s-text color="subdued" variant="bold">
                          Expired balance label
                        </s-text>
                        <s-text-field
                          type="text"
                          value={formState.widget_expired_balance}
                          onInput={(e) =>
                            handleFieldChange(
                              "widget_expired_balance",
                              e.target.value,
                            )
                          }
                        />
                      </s-stack>
                    </s-stack>
                  </s-box>
                </s-section>
              </s-stack>
            )}

            {/* CHECKOUT EXTENSION TAB */}
            {selectedTab === 1 && (
              <s-stack direction="block" gap="base">
                {/* Balance Widget Section */}
                <s-section>
                  <s-box padding="5">
                    <s-stack direction="block" gap="base">
                      <s-heading
                        variant="headingSm"
                        className="font-bold text-[16px] text-gray-800"
                      >
                        Balance widget
                      </s-heading>

                      <s-stack direction="block" gap="tight">
                        <s-text color="subdued" variant="bold">
                          Promotion message
                        </s-text>
                        <s-text-field
                          type="text"
                          value={formState.widget_promotion_msg}
                          onInput={(e) =>
                            handleFieldChange(
                              "widget_promotion_msg",
                              e.target.value,
                            )
                          }
                        />
                      </s-stack>

                      <s-stack direction="block" gap="tight">
                        <s-text color="subdued" variant="bold">
                          Expired message
                        </s-text>
                        <s-text-field
                          type="text"
                          value={formState.widget_expired_msg}
                          onInput={(e) =>
                            handleFieldChange(
                              "widget_expired_msg",
                              e.target.value,
                            )
                          }
                        />
                      </s-stack>
                    </s-stack>
                  </s-box>
                </s-section>
              </s-stack>
            )}
          </s-stack>
        </s-box>
      </s-page>
    </s-box>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
