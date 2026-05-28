import { useState } from "react";
import { useLoaderData, useFetcher, useNavigate, useRouteError, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { syncMongoStoreSession } from "../db.mongodb.server";
import { getStoreCreditMetrics } from "../services/storeCredit.server";
import { MetricCell } from "../components/MetricCell";

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
        },
      },
    });
  } catch (err) {
    // Ignore if definitions already exist
  }

  // Fetch app active status, programs, widgets added, and styling completed status
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
        styling_completed: metafield(namespace: "loyalty_cashback_app", key: "setup_guide_styling_completed") {
          value
        }
      }
    }
  `;

  const response = await admin.graphql(query);
  const data = await response.json();
  const shop = data?.data?.shop;

  const shopId = shop?.id;
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
  const stylingCompleted = shop?.styling_completed?.value === "true";

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
    stylingCompleted,
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

  const [openStep, setOpenStep] = useState(3); // default to step 3 ("Add widgets") expanded
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

  const stylingCompleted = fetcher.formData && fetcher.formData.get("key") === "setup_guide_styling_completed"
    ? fetcher.formData.get("value") === "true"
    : loaderData?.stylingCompleted || false;

  const handleToggleActive = () => {
    fetcher.submit(
      { actionType: "toggleActive", value: !isActive, shopId },
      { method: "POST", encType: "application/json" },
    );
  };

  const handleStepCheckboxToggle = (stepId, isChecked) => {
    if (stepId === 1) {
      fetcher.submit(
        { actionType: "toggleActive", value: isChecked, shopId },
        { method: "POST", encType: "application/json" },
      );
    } else if (stepId === 2) {
      // Step 2 is program configuration. It's dynamically determined by hasPrograms,
      // but we support toggling it to store local metafield states just in case.
    } else if (stepId === 3) {
      fetcher.submit(
        { actionType: "updateStep", key: "setup_guide_widgets_added", value: isChecked, shopId },
        { method: "POST", encType: "application/json" },
      );
    } else if (stepId === 4) {
      fetcher.submit(
        { actionType: "updateStep", key: "setup_guide_styling_completed", value: isChecked, shopId },
        { method: "POST", encType: "application/json" },
      );
    }
  };

  const step1Done = isActive;
  const step2Done = hasPrograms;
  const step3Done = widgetsAdded;
  const step4Done = stylingCompleted;

  const completedCount =
    (step1Done ? 1 : 0) +
    (step2Done ? 1 : 0) +
    (step3Done ? 1 : 0) +
    (step4Done ? 1 : 0);

  const steps = [
    {
      id: 1,
      title: "Activate store credit",
      content: "Enable store credit in Shopify so customers can start earning and redeeming credits.",
      buttonLabel: "View settings",
      buttonHref: `https://admin.shopify.com/store/${shopSubdomain}/settings/customer-accounts`,
      isExternal: true,
      done: step1Done,
    },
    {
      id: 2,
      title: "Create program",
      content: "Configure a store credit program with rules and conditions. Once this step is completed, the program becomes active.",
      buttonLabel: "Create program",
      buttonHref: "/app/programs/new",
      isExternal: false,
      done: step2Done,
    },
    {
      id: 3,
      title: "Add widgets",
      content: "Insert promotional widgets into the storefront to display credit offers and customer messages. Mark this step as completed once widgets are added.",
      buttonLabel: "Customize widget",
      buttonHref: "/app/promotion_widgets",
      isExternal: false,
      done: step3Done,
    },
    {
      id: 4,
      title: "Apply styling changes",
      content: "Customize widget design and tone to match your brand. Mark this step as completed once styling is finalized.",
      buttonLabel: "Customize style",
      buttonHref: "/app/widget_styling",
      isExternal: false,
      done: step4Done,
    },
  ];

  const handleButtonClick = (step) => {
    // Automatically check the corresponding step when clicked to provide a smooth user flow!
    if (step.id === 3 && !widgetsAdded) {
      handleStepCheckboxToggle(3, true);
    } else if (step.id === 4 && !stylingCompleted) {
      handleStepCheckboxToggle(4, true);
    }

    if (step.isExternal) {
      window.open(step.buttonHref, "_blank");
    } else {
      navigate(step.buttonHref);
    }
  };

  return (
    <s-page>
      <style>{`
        /* Custom rounded checkbox container */
        .custom-checkbox-container {
          display: inline-flex;
          align-items: center;
          position: relative;
          cursor: pointer;
          user-select: none;
        }

        /* Hide the default checkbox */
        .custom-checkbox-container input {
          position: absolute;
          opacity: 0;
          cursor: pointer;
          height: 0;
          width: 0;
        }

        /* Create a custom checkbox checkmark circle */
        .custom-checkbox-checkmark {
          height: 20px;
          width: 20px;
          background-color: #fff;
          border: 2px solid #8c9196;
          border-radius: 50%; /* This makes it round */
          margin-right: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s, border-color 0.15s;
          flex-shrink: 0;
        }

        /* Hover border color */
        .custom-checkbox-container:hover input:not(:checked) ~ .custom-checkbox-checkmark {
          border-color: #303030;
        }

        /* Checked state - black background */
        .custom-checkbox-container input:checked ~ .custom-checkbox-checkmark {
          background-color: #303030;
          border-color: #303030;
        }

        /* Checkmark icon (hidden when unchecked) */
        .custom-checkbox-checkmark::after {
          content: "";
          display: none;
          width: 5px;
          height: 9px;
          border: solid white;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
          margin-bottom: 2.5px;
        }

        /* Show the checkmark when checked */
        .custom-checkbox-container input:checked ~ .custom-checkbox-checkmark::after {
          display: block;
        }

        /* Label text styling */
        .custom-checkbox-label {
          font-size: 14px;
          font-weight: 600;
          color: #303030;
        }
      `}</style>
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
                <s-text style={{ fontSize: "16px", fontWeight: "600", color: "#111827" }}>Loyalty Cashback Store Credit</s-text>
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
            <s-box paddingBlockStart="small">
              <s-paragraph color="subdued">
                {isActive
                  ? "The app is currently running. Your programs are active and store credit is being distributed."
                  : "Deactivating the app to pause all active programs. Your settings and data will remain saved, but no programs will run until you reactivate."}
              </s-paragraph>
            </s-box>
          </s-section>

          {/* Setup Guide Card */}
          <s-section padding="base" background="surface" border="base" borderRadius="base">
            <s-stack gap="base">
              {/* Setup Guide Header */}
              <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="base">
                <s-heading variant="headingMd" style={{ fontWeight: "700", color: "#111827" }}>
                  Setup guide
                </s-heading>
                <s-stack direction="inline" gap="tight">
                  <s-button variant="tertiary" icon="horizontal-dots" accessibilityLabel="More options" />
                  <s-button
                    variant="tertiary"
                    icon={isGuideCollapsed ? "chevron-down" : "chevron-up"}
                    onClick={() => setIsGuideCollapsed(!isGuideCollapsed)}
                    accessibilityLabel="Toggle setup guide"
                  />
                </s-stack>
              </s-grid>

              {!isGuideCollapsed && (
                <s-stack gap="base">
                  <s-paragraph color="subdued">
                    Use this personalized guide to set up a store credit program and start acquiring and retaining more customers.
                  </s-paragraph>

                  {/* Progress Badge */}
                  <s-box>
                    <s-badge tone="info">
                      {completedCount} / 4 completed
                    </s-badge>
                  </s-box>

                  {/* Steps list */}
                  <s-box border="base" borderRadius="base">
                    {steps.map((step, idx) => {
                      const isExpanded = openStep === step.id;
                      return (
                        <s-box key={step.id}>
                          {idx > 0 && <s-divider />}
                          <s-box padding="small">
                            <div
                              onClick={(e) => {
                                // If click is inside checkbox container, do not toggle expansion!
                                if (e.target.closest(".custom-checkbox-container")) {
                                  return;
                                }
                                setOpenStep(isExpanded ? null : step.id);
                              }}
                              style={{ cursor: "pointer" }}
                            >
                              <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
                                <label className="custom-checkbox-container">
                                  <input
                                    type="checkbox"
                                    checked={step.done}
                                    onChange={(e) => handleStepCheckboxToggle(step.id, e.target.checked)}
                                  />
                                  <span className="custom-checkbox-checkmark"></span>
                                  <span className="custom-checkbox-label">{step.title}</span>
                                </label>
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
                            {isExpanded && (
                              <s-box padding="small" paddingBlockStart="none">
                                <s-box padding="base" background="subdued" borderRadius="base">
                                  <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
                                    <s-grid gap="small-200">
                                      <s-paragraph color="subdued" style={{ fontSize: "13px", lineHeight: "1.5", marginBottom: "8px" }}>
                                        {step.content}
                                      </s-paragraph>
                                      <s-stack direction="inline">
                                        <s-button
                                          variant="primary"
                                          onClick={() => handleButtonClick(step)}
                                        >
                                          {step.buttonLabel}
                                        </s-button>
                                      </s-stack>
                                    </s-grid>
                                  </s-grid>
                                </s-box>
                              </s-box>
                            )}
                          </s-box>
                        </s-box>
                      );
                    })}
                  </s-box>
                </s-stack>
              )}
            </s-stack>
          </s-section>

          {/* Last 7 Days Performance Card */}
          <s-section padding="base" background="surface" border="base" borderRadius="base">
            <s-stack gap="base">
              <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="base">
                <s-heading variant="headingMd" style={{ fontWeight: "700", color: "#111827" }}>
                  Last 7 Days Performance
                </s-heading>
                <s-button variant="tertiary" onClick={() => navigate("/app/analytics")}>
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
