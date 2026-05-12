import { useState } from "react";
import { Link, useLoaderData, useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  // Fetch app active status from Shopify metafields
  const query = `#graphql
    query GetAppActive {
      shop {
        id
        metafield(namespace: "loyalty_cashback_app", key: "app_active") {
          value
        }
      }
    }
  `;
  
  const response = await admin.graphql(query);
  const data = await response.json();
  const value = data?.data?.shop?.metafield?.value;
  
  // Default to true if not set yet
  const isActive = value !== "false";
  const shopId = data?.data?.shop?.id;

  return { isActive, shopId };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const payload = await request.json();
  const { isActive, shopId } = payload;

  const mutation = `#graphql
    mutation SetAppActive($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors {
          message
        }
      }
    }
  `;

  await admin.graphql(mutation, {
    variables: {
      metafields: [
        {
          ownerId: shopId,
          namespace: "loyalty_cashback_app",
          key: "app_active",
          type: "single_line_text_field",
          value: String(isActive),
        }
      ]
    }
  });

  return { success: true, isActive };
};

export default function Index() {
  const loaderData = useLoaderData();
  const fetcher = useFetcher();
  const [openStep, setOpenStep] = useState(1);

  const isActive = fetcher.formData
    ? fetcher.formData.get("isActive") === "true"
    : loaderData?.isActive !== false;

  const shopId = loaderData?.shopId;

  const handleToggleActive = () => {
    fetcher.submit(
      { isActive: !isActive, shopId },
      { method: "POST", encType: "application/json" }
    );
  };

  const steps = [
    {
      id: 1,
      title: "Activate store credit",
      content:
        "Store credit is activated on your store by default. Manage display settings in your Customer accounts settings.",
      button: "View settings",
      done: true,
    },
    {
      id: 2,
      title: "Create your first program",
      content:
        "Set up a store credit program to start rewarding your customers for their loyalty and purchases.",
      button: (
        <Link
          to="/app/programs/new"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          Create program
        </Link>
      ),
      done: true,
    },
    {
      id: 3,
      title: "Add storefront widgets",
      content:
        "Let customers know they can earn store credit by adding widgets to your product and cart pages.",
      button: "Customize widget",
      done: false,
    },
    {
      id: 4,
      title: "Review analytics",
      content:
        "Track how your programs are performing and see how much store credit has been distributed.",
      button: "View analytics",
      done: false,
    },
  ];

  return (
    <s-page heading="Dashboard">
      <s-stack direction="block" gap="base">
        {/* Status Card */}
        <s-box
          padding="base"
          background="surface"
          borderWidth="base"
          borderRadius="base"
        >
          <s-stack direction="block" gap="tight">
            <div className="flex items-center justify-between">
              <s-stack direction="inline" gap="tight" align="center">
                <span className="font-semibold text-gray-900">
                  Loyalty Cashback Store Credit
                </span>
                {isActive ? (
                  <span className="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Active
                  </span>
                ) : (
                  <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Inactive
                  </span>
                )}
              </s-stack>
              <s-button
                variant="secondary"
                onClick={handleToggleActive}
                loading={fetcher.state === "submitting"}
              >
                {isActive ? "Deactivate" : "Activate"}
              </s-button>
            </div>
            <p className="text-sm text-gray-500">
              {isActive
                ? "The app is currently running. Your programs are active and store credit is being distributed."
                : "The app is currently paused. No store credit will be distributed until you reactivate."}
            </p>
          </s-stack>
        </s-box>

        {/* Setup Guide */}
        <s-box
          padding="base"
          background="surface"
          borderWidth="base"
          borderRadius="base"
        >
          <s-stack direction="block" gap="base">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Setup Guide
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Complete these steps to get your loyalty program up and running.
              </p>
            </div>

            <s-stack direction="block" gap="tight">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className="border-t border-gray-100 first:border-0"
                >
                  <button
                    className="w-full py-3 flex items-center gap-3 text-left hover:bg-gray-50/50 transition-colors"
                    onClick={() =>
                      setOpenStep(openStep === step.id ? null : step.id)
                    }
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${step.done ? "bg-black border-black text-white" : "border-gray-300"}`}
                    >
                      {step.done && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span
                      className={`text-sm font-medium ${openStep === step.id ? "text-black" : "text-gray-600"}`}
                    >
                      {step.title}
                    </span>
                  </button>

                  {openStep === step.id && (
                    <div className="pb-4 pl-8">
                      <s-box
                        padding="base"
                        background="subdued"
                        borderRadius="base"
                      >
                        <s-stack direction="block" gap="base">
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {step.content}
                          </p>
                          <s-button variant="primary">{step.button}</s-button>
                        </s-stack>
                      </s-box>
                    </div>
                  )}
                </div>
              ))}
            </s-stack>
          </s-stack>
        </s-box>

        {/* Analytics & Widget Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Performance */}
          <s-box
            padding="base"
            background="surface"
            borderWidth="base"
            borderRadius="base"
          >
            <s-stack direction="block" gap="base">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-900">
                  Performance
                </h3>
                <s-button variant="tertiary">View Report</s-button>
              </div>
              <s-stack direction="inline" gap="base">
                <div className="flex-1 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Credits Issued
                  </p>
                  <p className="text-xl font-black text-gray-900">$0.00</p>
                </div>
                <div className="flex-1 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Total Orders
                  </p>
                  <p className="text-xl font-black text-gray-900">0</p>
                </div>
              </s-stack>
            </s-stack>
          </s-box>

          {/* Promotion Widget */}
          <s-box
            padding="base"
            background="surface"
            borderWidth="base"
            borderRadius="base"
          >
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Promotion Widget
                </h3>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  Encourage customers to join your loyalty program by showing a
                  promotion widget on your storefront.
                </p>
                <s-button variant="secondary">Set up widget</s-button>
              </div>
              <div className="w-20 h-20 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              </div>
            </div>
          </s-box>
        </div>
      </s-stack>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
