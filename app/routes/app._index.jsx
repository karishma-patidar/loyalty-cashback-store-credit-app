import { useState } from "react";
import { Link, useLoaderData, useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { syncMongoStoreSession } from "../db.mongodb.server";

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
        },
      ],
    },
  });

  return { success: true, isActive };
};

export default function Index() {
  const loaderData = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const [openStep, setOpenStep] = useState(1);
  const [mongoLoading, setMongoLoading] = useState(false);

  const isActive = fetcher.formData
    ? fetcher.formData.get("isActive") === "true"
    : loaderData?.isActive !== false;

  const shopId = loaderData?.shopId;

  const handleToggleActive = () => {
    fetcher.submit(
      { isActive: !isActive, shopId },
      { method: "POST", encType: "application/json" },
    );
  };

  const testMongoDB = async () => {
    setMongoLoading(true);
    try {
      const response = await fetch("/api/hello");
      const data = await response.json();
      if (response.ok && data.database?.connected) {
        shopify.toast.show(
          `Database Connected! Database: ${data.database.name}`,
        );
      } else {
        shopify.toast.show(data.message || "Failed to connect to MongoDB", {
          isError: true,
        });
      }
    } catch (err) {
      shopify.toast.show(err.message || "Error testing MongoDB", {
        isError: true,
      });
    } finally {
      setMongoLoading(false);
    }
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

      <s-section>
        <s-stack direction="inline" gap="base" justifyContent="space-between" alignment="center">
          <s-stack direction="inline" gap="base">
            <s-heading>Loyalty Cashback Store Credit</s-heading>
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
            variant={isActive ? "primary" : "critical"}
            tone={isActive ? "critical" : "primary"}
            onClick={handleToggleActive}
            loading={fetcher.state === "submitting"}
          >
            {isActive ? "Deactivate" : "Activate"}
          </s-button>
        </s-stack>
        <s-paragraph>
          {isActive
            ? "The app is currently running. Your programs are active and store credit is being distributed."
            : "The app is currently paused. No store credit will be distributed until you reactivate."}</s-paragraph>
      </s-section>

      <s-section direction="block" gap="base">

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


      </s-section>

    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
