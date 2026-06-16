import { useState, useEffect } from "react";
import { useLoaderData, useFetcher, useNavigate, useRouteError, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { syncMongoStoreSession } from "../db.mongodb.server";
import { getStoreCreditMetrics } from "../services/storeCredit.server";
import { MetricCell } from "../components/MetricCell";
import { useExtensionStatuses } from "../hooks/useExtensionStatuses";

// ─── GraphQL Queries ───────────────────────────────────────────────────────────

const GET_STORE_CURRENCY = `#graphql
  query GetStoreCurrency {
    shop {
      currencyCode
    }
  }
`;

// ─── Helpers ───────────────────────────────────────────────────────────────────

const currencySymbols = {
  INR: "₹",
  USD: "$",
  CAD: "C$",
  AUD: "A$",
  GBP: "£",
  EUR: "€",
  JPY: "¥",
};

function formatCurrency(amount, currencyCode) {
  const symbol = currencySymbols[currencyCode] || currencyCode || "$";
  return `${symbol}${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  await syncMongoStoreSession(session);

  // Ensure Metafield Definitions exist under Shopify Admin Settings -> Custom Data
  try {
    const defMutation = `#graphql
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
          description:
            "Stores loyalty program configurations for Loyalty Store Credit app",
          ownerType: "SHOP",
          access: {
            storefront: "PUBLIC_READ"
          }
        },
      },
    });

    await admin.graphql(defMutation, {
      variables: {
        definition: {
          name: "Loyalty App Active Status",
          namespace: "loyalty_cashback_app",
          key: "app_active",
          type: "single_line_text_field",
          description:
            "Stores active/inactive toggle status for Loyalty Store Credit app",
          ownerType: "SHOP",
          access: {
            storefront: "PUBLIC_READ"
          }
        },
      },
    });

    await admin.graphql(defMutation, {
      variables: {
        definition: {
          name: "Loyalty App URL",
          namespace: "loyalty_cashback_app",
          key: "app_url",
          type: "single_line_text_field",
          description: "Stores the app backend URL",
          ownerType: "SHOP",
          access: {
            storefront: "PUBLIC_READ"
          }
        },
      },
    });

    await admin.graphql(defMutation, {
      variables: {
        definition: {
          name: "Loyalty Widget Pending Msg",
          namespace: "loyalty_cashback_app",
          key: "widget_pending_msg",
          type: "single_line_text_field",
          description: "Pending message for customer cashback",
          ownerType: "SHOP",
          access: {
            storefront: "PUBLIC_READ"
          }
        },
      },
    });

    await admin.graphql(defMutation, {
      variables: {
        definition: {
          name: "Loyalty Widget Completed Msg",
          namespace: "loyalty_cashback_app",
          key: "widget_completed_msg",
          type: "single_line_text_field",
          description: "Completed message for customer cashback",
          ownerType: "SHOP",
          access: {
            storefront: "PUBLIC_READ"
          }
        },
      },
    });

    await admin.graphql(defMutation, {
      variables: {
        definition: {
          name: "Loyalty Translations",
          namespace: "loyalty_cashback_app",
          key: "translations",
          type: "json",
          description: "All translation data for loyalty widgets",
          ownerType: "SHOP",
          access: {
            storefront: "PUBLIC_READ"
          }
        },
      },
    });
  } catch (err) {
    // Ignore if definitions already exist
  }

  // Fetch app active status, programs, and widgets added status
  const query = `#graphql
    query GetIndexData {
      shop {
        id
        app_active: metafield(namespace: "loyalty_cashback_app", key: "app_active") {
          value
        }
        programs: metafield(namespace: "loyalty_cashback_app", key: "programs") {
          value
        }
        widgets_added: metafield(namespace: "loyalty_cashback_app", key: "setup_guide_widgets_added") {
          value
        }
        setup_guide_activated: metafield(namespace: "loyalty_cashback_app", key: "setup_guide_activated") {
          value
        }
        customerAccountsV2 {
          customerAccountsVersion
        }
      }
    }
  `;

  const response = await admin.graphql(query);
  const data = await response.json();
  const shop = data?.data?.shop;

  const shopId = shop?.id;

  // Sync app_url metafield value on the shop to keep it updated with current tunnel/host
  const appUrl = process.env.SHOPIFY_APP_URL;
  if (appUrl && shopId) {
    try {
      const setMetafieldMutation = `#graphql
        mutation SetMetafield($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            userErrors {
              message
            }
          }
        }
      `;
      await admin.graphql(setMetafieldMutation, {
        variables: {
          metafields: [
            {
              ownerId: shopId,
              namespace: "loyalty_cashback_app",
              key: "app_url",
              type: "single_line_text_field",
              value: appUrl,
            },
          ],
        },
      });
      console.log("✅ Sync app_url metafield value on shop successfully:", appUrl);
    } catch (err) {
      console.error("❌ Failed to set app_url metafield value on shop:", err);
    }
  }

  const shopSubdomain = session.shop.split(".")[0];
  const isActive = shop?.app_active?.value !== "false";

  let hasPrograms = false;
  if (shop?.programs?.value) {
    try {
      const parsed = JSON.parse(shop.programs.value);
      hasPrograms = Array.isArray(parsed) && parsed.length > 0;
    } catch (e) {
      // Ignore
    }
  }

  const widgetsAdded = shop?.widgets_added?.value === "true";
  const setupGuideActivated = shop?.setup_guide_activated?.value === "true";
  const isNewCustomerAccounts = shop?.customerAccountsV2?.customerAccountsVersion === "NEW_CUSTOMER_ACCOUNTS";

  // Compute last 7 days date range (matching Analytics page default)
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let currencyCode = "USD";
  try {
    const shopRes = await admin.graphql(GET_STORE_CURRENCY);
    const shopData = await shopRes.json();
    currencyCode = shopData?.data?.shop?.currencyCode || "USD";
  } catch (err) {
    console.error("Error fetching shop currency:", err);
  }

  const metrics = await getStoreCreditMetrics(admin, session.shop, start, end, currencyCode);

  return {
    isActive,
    shopId,
    shopSubdomain,
    hasPrograms,
    widgetsAdded,
    setupGuideActivated,
    isNewCustomerAccounts,
    todayPerformance: {
      issuedCredit: metrics.issuedCredit,
      totalDistributedCustomers: metrics.totalDistributedCustomers,
      totalCustomersRedeem: metrics.totalCustomersRedeem,
      currencyCode,
    }
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const payload = await request.json();
  const { actionType, shopId, value, key } = payload;

  const mutation = `#graphql
    mutation SetMetafield($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors {
          message
        }
      }
    }
  `;

  if (actionType === "toggleActive") {
    await admin.graphql(mutation, {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: "loyalty_cashback_app",
            key: "app_active",
            type: "single_line_text_field",
            value: String(value),
          },
        ],
      },
    });
    return { success: true, isActive: value };
  }

  if (actionType === "updateStep") {
    await admin.graphql(mutation, {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: "loyalty_cashback_app",
            key: key,
            type: "single_line_text_field",
            value: String(value),
          },
        ],
      },
    });
    return { success: true };
  }

  return { success: false };
};

export default function Index() {
  const loaderData = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const shopify = useAppBridge();

  const isFetching = navigation.state === "loading";
  const [visible, setVisible] = useState({ calloutCard: true });

  const [openStep, setOpenStep] = useState(1); // default to step 1 ("Activate store credit") expanded
  const [isGuideCollapsed, setIsGuideCollapsed] = useState(false);

  const isActive = fetcher.formData && fetcher.formData.get("actionType") === "toggleActive"
    ? fetcher.formData.get("value") === "true"
    : loaderData?.isActive !== false;

  const shopId = loaderData?.shopId;
  const shopSubdomain = loaderData?.shopSubdomain;
  const hasPrograms = loaderData?.hasPrograms;

  const todayPerformance = loaderData?.todayPerformance || {
    issuedCredit: 0,
    totalDistributedCustomers: 0,
    totalCustomersRedeem: 0,
    currencyCode: "USD"
  };

  // Track checklist step checkbox checked state dynamically
  const widgetsAdded = fetcher.formData && fetcher.formData.get("key") === "setup_guide_widgets_added"
    ? fetcher.formData.get("value") === "true"
    : loaderData?.widgetsAdded || false;

  const setupGuideActivated = fetcher.formData && fetcher.formData.get("key") === "setup_guide_activated"
    ? fetcher.formData.get("value") === "true"
    : loaderData?.setupGuideActivated || false;

  const handleToggleActive = () => {
    fetcher.submit(
      { actionType: "toggleActive", value: !isActive, shopId },
      { method: "POST", encType: "application/json" },
    );
  };

  const handleStepCheckboxToggle = (stepId, isChecked) => {
    if (stepId === 1) {
      fetcher.submit(
        { actionType: "updateStep", key: "setup_guide_activated", value: isChecked, shopId },
        { method: "POST", encType: "application/json" },
      );
    } else if (stepId === 2) {
      // Step 2 is program configuration, dynamically determined by hasPrograms
    } else if (stepId === 3) {
      fetcher.submit(
        { actionType: "updateStep", key: "setup_guide_widgets_added", value: isChecked, shopId },
        { method: "POST", encType: "application/json" },
      );
    }
  };

  const isNewCustomerAccounts = loaderData?.isNewCustomerAccounts || false;
  const themeAppExtensionExists = useExtensionStatuses(isNewCustomerAccounts);

  // Check if there is any active widget block (excluding loyalty_credit_app_embed)
  const isAnyWidgetActive = themeAppExtensionExists.themeActivations?.some(
    (act) => act.handle !== "loyalty_credit_app_embed" && act.status === "active" && (!act.activations || act.activations.length > 0)
  ) || false;

  useEffect(() => {
    if (!themeAppExtensionExists.loaded) return;

    if (isAnyWidgetActive && !widgetsAdded) {
      handleStepCheckboxToggle(3, true);
    } else if (!isAnyWidgetActive && widgetsAdded) {
      handleStepCheckboxToggle(3, false);
    }
  }, [themeAppExtensionExists.loaded, isAnyWidgetActive, widgetsAdded]);

  const step1Done = setupGuideActivated;
  const step2Done = hasPrograms;
  const step3Done = themeAppExtensionExists.loaded ? isAnyWidgetActive : widgetsAdded;

  const completedCount =
    (step1Done ? 1 : 0) +
    (step2Done ? 1 : 0) +
    (step3Done ? 1 : 0);

  const steps = [
    {
      id: 1,
      title: "Activate store credit",
      content: "Store credit is activated on your store by default. You can manage whether to display store credit as a payment method from the Customer accounts settings of your Shopify admin.",
      buttonLabel: "View instruction",
      buttonHref: `https://help.shopify.com/en/manual/customers/store-credit`,
      isExternal: true,
      done: step1Done,
    },
    {
      id: 2,
      title: "Create programs",
      content: "Set up your program with store credit to engage customers. Customize details like credit amount and conditions to fit your store's loyalty goals.",
      buttonLabel: "Create program",
      buttonHref: "/app/programs",
      isExternal: false,
      done: step2Done,
    },
    {
      id: 3,
      title: "Display promotion widgets",
      content: "Display the promotion widgets to boost visibility and engagement of store credit programs.",
      buttonLabel: "Set up widgets",
      buttonHref: "/app/settings",
      isExternal: false,
      done: step3Done,
    },
  ];

  const handleButtonClick = (step) => {
    if (step.id === 1 && !setupGuideActivated) {
      handleStepCheckboxToggle(1, true);
    }
    if (step.id === 3 && !widgetsAdded) {
      handleStepCheckboxToggle(3, true);
    }
    if (step.isExternal) {
      window.open(step.buttonHref, "_blank");
    } else {
      navigate(step.buttonHref);
    }
  };

  return (
    <s-page>
      <s-box className="max-w-[800px] mx-auto px-4 py-6">
        <s-stack gap="base">
          {/* Page Header */}
          <s-stack direction="inline" justifyContent="space-between" alignment="center" style={{ marginBottom: "8px" }}>
            <s-heading variant="headingLg">
              Dashboard
            </s-heading>
            <s-button variant="tertiary" icon="cheatsheet" accessibilityLabel="Documentation" />
          </s-stack>


          {/* App Status Toggle Card */}
          <s-section padding="base" background="surface" border="base" borderRadius="base">
            <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="base">
              <s-stack direction="inline" gap="base" alignment="center">
                <s-text >Loyalty Cashback Store Credit</s-text>
                {isActive ? (
                  <s-badge tone="success">Active</s-badge>
                ) : (
                  <s-badge tone="subdued">Inactive</s-badge>
                )}
              </s-stack>
              <s-button
                variant={isActive ? "secondary" : "primary"}
                onClick={handleToggleActive}
                loading={fetcher.state === "submitting" ? "true" : undefined}
              >
                {isActive ? "Deactivate" : "Activate"}
              </s-button>
            </s-grid>
            <s-box >
              <s-paragraph color="subdued">
                {isActive
                  ? "The app is currently running. Your programs are active and store credit is being distributed."
                  : "Deactivating the app to pause all active programs. Your settings and data will remain saved, but no programs will run until you reactivate."}
              </s-paragraph>
            </s-box>
          </s-section>

          {/* Setup Guide Card */}
          <s-section padding="base" background="surface" border="base" borderRadius="base">
            <s-stack gap="base" >
              {/* Setup Guide Header */}
              <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="base">
                <s-heading variant="headingMd" style={{ fontWeight: "700", color: "#111827" }}>
                  Setup guide
                </s-heading>
                <s-button
                  variant="tertiary"
                  icon={isGuideCollapsed ? "chevron-down" : "chevron-up"}
                  onClick={() => setIsGuideCollapsed(!isGuideCollapsed)}
                  accessibilityLabel="Toggle setup guide"
                />
              </s-grid>

              <div style={{
                display: "grid",
                gridTemplateRows: !isGuideCollapsed ? "1fr" : "0fr",
                transition: "grid-template-rows 250ms cubic-bezier(0.4, 0, 0.2, 1), opacity 250ms cubic-bezier(0.4, 0, 0.2, 1)",
                opacity: !isGuideCollapsed ? 1 : 0,
                overflow: "hidden"
              }}>
                <div style={{ minHeight: 0 }}>
                  <s-stack gap="base" style={{ paddingTop: "12px" }}>
                    {/* Progress Bar & Status Text */}

                    <s-stack direction="inline" gap="base" alignItems="center" >
                      <s-box border="base" borderRadius="base" paddingInline="small">
                        {completedCount} / 3 completed
                      </s-box>
                      <div style={{ width: "120px", height: "8px", backgroundColor: "#e1e3e5", borderRadius: "4px", overflow: "hidden", display: "inline-block" }}>
                        <div style={{ width: `${(completedCount / 3) * 100}%`, height: "100%", backgroundColor: "#146b2dff", borderRadius: "4px", transition: "width 0.3s ease" }} />
                      </div>

                    </s-stack>

                    {/* Steps list */}
                    <s-box border="base" borderRadius="base" paddingInline="base">
                      {steps.map((step, idx) => {
                        const isExpanded = openStep === step.id;
                        return (
                          <s-box key={step.id} >
                            {idx > 0 && <s-divider />}
                            <s-box paddingBlockStart="small" paddingBlockEnd="small">
                              <div
                                onClick={(e) => {
                                  if (e.target.closest("button")) {
                                    return;
                                  }
                                  setOpenStep(isExpanded ? null : step.id);
                                }}
                              >
                                <s-grid gridTemplateColumns="auto 1fr auto" gap="base" alignItems="center">
                                  {/* Left: Status Circle */}
                                  {step.done ? (
                                    <s-icon type="check-circle-filled" tone="success" />
                                  ) : (
                                    <s-icon type="circle-dashed" />
                                  )}

                                  {/* Middle: Step Title */}
                                  <s-text>
                                    {step.title}
                                  </s-text>

                                  {/* Right: Accordion Arrow Button */}
                                  <s-button
                                    accessibilityLabel={`Toggle step ${step.id} details`}
                                    variant="tertiary"
                                    icon={isExpanded ? "chevron-up" : "chevron-down"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenStep(isExpanded ? null : step.id);
                                    }}
                                  />
                                </s-grid>
                              </div>
                              <div style={{
                                display: "grid",
                                gridTemplateRows: isExpanded ? "1fr" : "0fr",
                                transition: "grid-template-rows 250ms cubic-bezier(0.4, 0, 0.2, 1), opacity 250ms cubic-bezier(0.4, 0, 0.2, 1)",
                                opacity: isExpanded ? 1 : 0,
                                overflow: "hidden"
                              }}>
                                <div style={{ minHeight: 0 }}>
                                  <s-box paddingBlockStart="small" paddingBlockEnd="small" paddingInlineStart="base">
                                    <s-stack gap="base">
                                      <s-paragraph color="subdued">
                                        {step.content}
                                      </s-paragraph>
                                      <s-stack direction="inline" >
                                        <s-button
                                          variant="primary"
                                          onClick={() => handleButtonClick(step)}
                                        >
                                          {step.buttonLabel}
                                        </s-button>
                                      </s-stack>
                                    </s-stack>
                                  </s-box>
                                </div>
                              </div>
                            </s-box>
                          </s-box>
                        );
                      })}
                    </s-box>
                  </s-stack>
                </div>
              </div>
            </s-stack>
          </s-section>


          {/* Last 7 Days Performance Card */}
          <s-section padding="base" background="surface" border="base" borderRadius="base">
            <s-stack gap="base">
              <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="base">
                <s-heading variant="headingMd" style={{ fontWeight: "700", color: "#111827" }}>
                  Last 7 Days Performance
                </s-heading>
                <s-button onClick={() => navigate("/app/analytics")}>
                  View detail
                </s-button>
              </s-grid>

              <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
                {/* Column 1: Total store credits issued */}
                <s-box padding="base" border="base" borderRadius="base" background="surface">
                  <MetricCell
                    id="today-issued"
                    label="Total store credits issued"
                    tooltip="The total value of loyalty cashback credits issued from reward programs and manual adjustments, excluding refunded or debited credits."
                    value={formatCurrency(todayPerformance.issuedCredit, todayPerformance.currencyCode)}
                    loading={isFetching}
                  />
                </s-box>

                {/* Column 2: Total distributed customers */}
                <s-box padding="base" border="base" borderRadius="base" background="surface">
                  <MetricCell
                    id="today-distributed"
                    label="Total distributed customers"
                    tooltip="Number of customers who received cashback credits."
                    value={todayPerformance.totalDistributedCustomers.toString()}
                    loading={isFetching}
                  />
                </s-box>

                {/* Column 3: Total customers redeem credit */}
                <s-box padding="base" border="base" borderRadius="base" background="surface">
                  <MetricCell
                    id="today-redeemed-customers"
                    label="Total customers redeem credit"
                    tooltip="Total customers who redeemed loyalty cashback credits."
                    value={todayPerformance.totalCustomersRedeem.toString()}
                    loading={isFetching}
                  />
                </s-box>
              </s-grid>
            </s-stack>
          </s-section>

          {visible.calloutCard && (
            <s-section>
              <s-grid
                gridTemplateColumns="1fr auto"
                gap="small-400"
                alignItems="start"
              >
                <s-grid
                  gridTemplateColumns="@container (inline-size <= 480px) 1fr, auto auto"
                  gap="base"
                  alignItems="center"
                >
                  <s-grid gap="small-200">
                    <s-heading>Increase visibility with a Promotion Widget</s-heading>
                    <s-paragraph>
                      Set up your Promotion Widget in just a few clicks to show your store credit program directly on your storefront, boost engagement, and increase sales.
                    </s-paragraph>
                    <s-stack direction="inline" gap="small-200">
                      <s-button> Set up Promotion Widget </s-button>
                    </s-stack>
                  </s-grid>
                  <s-stack alignItems="center">
                    <s-box
                      maxInlineSize="200px"
                      borderRadius="base"
                      overflow="hidden"
                    >
                      <s-image
                        src="https://cdn.shopify.com/static/images/polaris/patterns/callout.png"
                        alt="Customize checkout illustration"
                        aspectRatio="1/0.5"
                      />
                    </s-box>
                  </s-stack>
                </s-grid>
                <s-button
                  onClick={() => setVisible({ ...visible, calloutCard: false })}
                  tone="neutral"
                  variant="tertiary"
                  accessibilityLabel="Dismiss card"
                ></s-button>
              </s-grid>
            </s-section>
          )}

        </s-stack>
      </s-box>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
