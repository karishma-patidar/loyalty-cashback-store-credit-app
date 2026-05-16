import { useState } from "react";
import { useNavigate, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  return {
    shop: session.shop,
    extensionId:
      process.env.SHOPIFY_THEME_APP_EXTENSION_ID ||
      "65b30aae-2fc0-9b48-3e28-e6bf3e801b92f9c75ad7",
  };
}

const WIDGETS = [
  {
    id: "product-promo",
    title: "Cashback - Product promotion",
    category: "Cashback",
    placement: "Product Page",
    badgeTone: "info",
    description:
      "Show available store credit offers directly on the product page to encourage customers to add items to cart.",
    templateTarget: "product",
    blockHandle: "credit_block",
    previewSvg: (
      <img
        src="https://cdn.getkoin.io/portal/widget-product-promotion.png"
        alt="Product promotion widget preview"
        className="w-full h-full object-contain"
      />
    ),
  },
  {
    id: "cart-promo",
    title: "Cashback - Cart promotion",
    category: "Cashback",
    placement: "Cart Page",
    badgeTone: "info",
    description:
      "Remind customers of the store credit they will earn to boost checkout motivation and increase conversions.",
    templateTarget: "cart",
    blockHandle: "credit_block",
    previewSvg: (
      <img
        src="https://cdn.getkoin.io/portal/widget-product-promotion.png"
        alt="Cart promotion widget preview"
        className="w-full h-full object-contain"
      />
    ),
  },
  {
    id: "notification-banner",
    title: "Cashback - Notification banner",
    category: "Cashback",
    placement: "Order status page",
    badgeTone: "info",
    description:
      "Display a cashback notification banner to let buyers track the status of issued store credit.",
    templateTarget: "index",
    blockHandle: "loyalty_credit_app_embed",
    previewSvg: (
      <img
        src="https://cdn.getkoin.io/portal/widget-product-promotion.png"
        alt="Notification banner preview"
        className="w-full h-full object-contain"
      />
    ),
  },
  {
    id: "credit-history",
    title: "Store credit history",
    category: "Custom Program",
    placement: "Profile Page",
    badgeTone: "info",
    description:
      "Display store credit history to let customers track credit balance and transactions.",
    templateTarget: "customers/account",
    blockHandle: "credit_block",
    previewSvg: (
      <img
        src="https://cdn.getkoin.io/portal/widget-product-promotion.png"
        alt="Credit history preview"
        className="w-full h-full object-contain"
      />
    ),
  },
  {
    id: "custom-program-promo",
    title: "Custom program promotion",
    category: "Custom Program",
    placement: "Pre-checkout Pages",
    badgeTone: "info",
    description:
      "Promote your custom programs across any pre-checkout page to capture customer attention and drive engagement.",
    templateTarget: "collection",
    blockHandle: "credit_block",
    previewSvg: (
      <img
        src="https://cdn.getkoin.io/portal/widget-product-promotion.png"
        alt="Custom program promotion preview"
        className="w-full h-full object-contain"
      />
    ),
  },
  {
    id: "checkout-widget",
    title: "Checkout widget",
    category: "Cashback",
    placement: "Checkout Page",
    badgeTone: "info",
    description:
      "Show campaign promotion message and store credit balance on the checkout page to drive engagement and repeat purchases.",
    templateTarget: "checkout",
    blockHandle: "credit_block",
    previewSvg: (
      <img
        src="https://cdn.getkoin.io/portal/widget-product-promotion.png"
        alt="Checkout widget preview"
        className="w-full h-full object-contain"
      />
    ),
  },
];

export default function WidgetSettings() {
  const { shop, extensionId } = useLoaderData();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    { id: 0, label: "All (6)" },
    { id: 1, label: "Cashback (4)" },
    { id: 2, label: "Custom Program (2)" },
  ];

  const filteredWidgets = WIDGETS.filter((w) => {
    if (selectedTab === 1) return w.category === "Cashback";
    if (selectedTab === 2) return w.category === "Custom Program";
    return true;
  });

  const shopSubdomain = shop ? shop.split(".")[0] : "";

  const handleSetup = (widget) => {
    const targetQuery =
      widget.blockHandle === "credit_block" ? "&target=mainSection" : "";
    const editorUrl = `https://admin.shopify.com/store/${shopSubdomain}/themes/current/editor?template=${widget.templateTarget}&addAppBlockId=${extensionId}/${widget.blockHandle}${targetQuery}`;
    window.open(editorUrl, "_blank");
    shopify.toast.show(
      `Opening Shopify Theme Editor for ${widget.placement}...`,
    );
  };

  return (
    <s-box background="subdued" className="min-h-screen pb-12">
      <s-page>
        <s-box className="max-w-[1200px] mx-auto pt-6">
          {/* Header Row */}
          <s-stack direction="inline" alignment="center" className="mb-6">
            <s-button
              variant="tertiary"
              icon="chevron-left"
              onClick={() => navigate("/app/promotion_widgets")}
              className="mr-2"
            />
            <s-heading variant="headingLg" className="text-[24px] font-bold">
              Widget settings
            </s-heading>
          </s-stack>

          {/* Subheader and Segmented Control */}
          <s-stack gap="base">
            <s-stack
              direction="inline"
              justifyContent="space-between"
              alignment="center"
              className="mb-6"
            >
              <s-heading
                variant="headingMd"
                className="text-[18px] font-bold text-gray-800"
              >
                Configure and embed widgets
              </s-heading>

              <s-stack
                direction="inline"
                gap="tight"
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

            {/* Widgets Grid */}
            <s-grid
              gridTemplateColumns="repeat(3, 1fr)"
              gap="base"
              className="gap-6"
            >
              {filteredWidgets.map((widget) => (
                <s-box
                  key={widget.id}
                  background="surface"
                  borderWidth="base"
                  borderRadius="base"
                  className="shadow-sm border-gray-200 overflow-hidden flex flex-col justify-between"
                >
                  {/* Header Mockup Illustration */}
                  <s-box className="w-full bg-[#F4F6F8] border-b border-gray-200 aspect-video flex items-center justify-center p-4">
                    {widget.previewSvg}
                  </s-box>

                  {/* Content Body */}
                  <s-box
                    padding="4"
                    className="flex flex-col flex-1 justify-between gap-4"
                  >
                    <s-stack gap="base" className="flex-col">
                      <s-heading
                        variant="headingMd"
                        className="text-[16px] font-bold text-gray-900"
                      >
                        {widget.title}
                      </s-heading>
                      <s-box>
                        <s-badge tone={widget.badgeTone}>
                          {widget.placement}
                        </s-badge>
                      </s-box>
                      <s-paragraph
                        color="subdued"
                        className="text-[13px] leading-relaxed mt-1"
                      >
                        {widget.description}
                      </s-paragraph>
                    </s-stack>

                    <s-box className="pt-2 border-t border-gray-100">
                      <s-button
                        variant="primary"
                        onClick={() => handleSetup(widget)}
                      >
                        Set up
                      </s-button>
                    </s-box>
                  </s-box>
                </s-box>
              ))}
            </s-grid>
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
