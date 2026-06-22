/* eslint-disable react/prop-types */
import { useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useExtensionStatuses } from "../../hooks/useExtensionStatuses";

const WIDGETS = [
  {
    id: "product-promo",
    title: "Cashback - Product promotion",
    category: "Cashback",
    placement: "Product Page",
    badgeTone: "info",
    description: "Show available store credit offers directly on the product page to encourage customers to add items to cart.",
    templateTarget: "product",
    blockHandle: "credit_block",
    previewSvg: (
      <img src="https://cdn.getkoin.io/portal/widget-product-promotion.png" alt="Product promotion widget preview" className="w-full h-full object-contain" />
    ),
  },
  {
    id: "cart-promo",
    title: "Cashback - Cart promotion",
    category: "Cashback",
    placement: "Cart Page",
    badgeTone: "info",
    description: "Remind customers of the store credit they will earn to boost checkout motivation and increase conversions.",
    templateTarget: "cart",
    blockHandle: "credit_block",
    previewSvg: (
      <img src="https://cdn.getkoin.io/portal/widget-cart-promotion.png" alt="Cart promotion widget preview" className="w-full h-full object-contain" />
    ),
  },
  {
    id: "notification-banner",
    title: "Cashback Notification",
    category: "Cashback",
    placement: "Order status page",
    badgeTone: "info",
    description: "Display a cashback notification banner to let buyers track the status of issued store credit.",
    templateTarget: "checkout",
    blockHandle: "cashback_notification",
    previewSvg: (
      <img src="https://cdn.getkoin.io/portal/widget-cart-promotion.png" alt="Notification banner preview" className="w-full h-full object-contain" />
    ),
  },
  {
    id: "credit-history",
    title: "Store credit history",
    category: "Cashback",
    placement: "Profile Page",
    badgeTone: "info",
    description: "Display store credit history to let customers track credit balance and transactions.",
    templateTarget: "customers/account",
    blockHandle: "credit_block",
    previewSvg: (
      <img src="https://cdn.getkoin.io/portal/widget-credit-history.png" alt="Credit history preview" className="w-full h-full object-contain" />
    ),
  },
  {
    id: "checkout-widget",
    title: "Checkout widget",
    category: "Custom Program",
    placement: "Checkout Page",
    badgeTone: "info",
    description: "Show campaign promotion message and store credit balance on the checkout page to drive engagement and repeat purchases.",
    templateTarget: "checkout",
    blockHandle: "credit_block",
    previewSvg: (
      <img src="https://cdn.getkoin.io/portal/widget-checkout-promotion.png" alt="Checkout widget preview" className="w-full h-full object-contain" />
    ),
  },
];

export default function WidgetsTab({ loaderData }) {
  const { shop, isNewCustomerAccounts } = loaderData;
  const [selectedCategoryTab, setSelectedCategoryTab] = useState(0);
  const themeAppExtensionExists = useExtensionStatuses(isNewCustomerAccounts);
  const shopify = useAppBridge();

  const getWidgetStatus = (widget) => {
    if (widget.id === "checkout-widget") {
      return themeAppExtensionExists.hasCreditBalanceUI ? "active" : null;
    }
    if (widget.id === "credit-history" && isNewCustomerAccounts) {
      return themeAppExtensionExists.hasCreditHistoryUI ? "active" : null;
    }
    if (widget.id === "notification-banner") {
      if (themeAppExtensionExists.hasCashbackNotificationUI) return "active";
      return themeAppExtensionExists.cashbackOffer;
    }

    const blockActivation = themeAppExtensionExists.themeActivations?.find(
      (act) => act.handle === "custom-from" || act.handle === "credit_block" || act.handle === "loyalty_credit_app_embed"
    );

    if (!blockActivation) return null;
    if (blockActivation.status !== "active") return null;

    const isPlacedOnTemplate = blockActivation.activations?.some((placement) => {
      const targetStr = (placement.target || "").toLowerCase();
      const queryStr = widget.templateTarget.toLowerCase().replace("/", "-");
      const queryStrRaw = widget.templateTarget.toLowerCase();
      return targetStr.includes(queryStr) || targetStr.includes(queryStrRaw);
    });

    return isPlacedOnTemplate ? "active" : null;
  };

  const categoryTabs = [
    { id: 0, label: `All (${WIDGETS.length})` },
    { id: 1, label: `Cashback (${WIDGETS.filter(w => w.category === "Cashback").length})` },
    { id: 2, label: `Custom Program (${WIDGETS.filter(w => w.category === "Custom Program").length})` },
  ];

  const filteredWidgets = WIDGETS.filter((w) => {
    if (selectedCategoryTab === 1) return w.category === "Cashback";
    if (selectedCategoryTab === 2) return w.category === "Custom Program";
    return true;
  });


  const handleSetup = (widget) => {
    const status = getWidgetStatus(widget);
    if (status === "active") {
      return;
    }

    const cleanShop = shop ? shop.replace(/^https?:\/\//, "") : "";

    if (widget.id === "notification-banner") {
      const editorUrl = `https://${cleanShop}/admin/settings/checkout/editor?page=order-status&addAppBlockId=4639e8c9e33fe4badd965e769d8b46da/cashback_notification`;
      window.open(editorUrl, "_blank", "noopener,noreferrer");
      shopify.toast.show("Opening Checkout Customization Editor...");
      return;
    }

    if (widget.id === "checkout-widget") {
      const editorUrl = `https://${cleanShop}/admin/settings/checkout/editor?page=checkout&addAppBlockId=4639e8c9e33fe4badd965e769d8b46da/store-credit-balance`;
      window.open(editorUrl, "_blank", "noopener,noreferrer");
      shopify.toast.show("Opening Checkout Customization Editor...");
      return;
    }

    if (widget.id === "credit-history" && isNewCustomerAccounts) {
      const editorUrl = `https://${cleanShop}/admin/settings/checkout/editor?page=profile&addAppBlockId=4639e8c9e33fe4badd965e769d8b46da/store-credit-history`;
      window.open(editorUrl, "_blank", "noopener,noreferrer");
      shopify.toast.show("Opening Checkout Customization Editor...");
      return;
    }

    const editorUrl = `https://${cleanShop}/admin/themes/current/editor?template=${widget.templateTarget}&addAppBlockId=4639e8c9e33fe4badd965e769d8b46da/${widget.blockHandle}&target=mainSection`;
    window.open(editorUrl, "_blank", "noopener,noreferrer");
    shopify.toast.show(`Opening Shopify Theme Editor for ${widget.placement}...`);
  };

  return (
    <s-box>
      <s-box className="max-w-[1200px] mx-auto">
        <s-stack gap="base">
          <s-stack direction="inline" justifyContent="end" alignment="end">
            <s-stack direction="inline" gap="small">
              {categoryTabs.map((tab) => (
                <s-button
                  key={tab.id}
                  variant={selectedCategoryTab === tab.id ? "secondary" : "tertiary"}
                  onClick={() => setSelectedCategoryTab(tab.id)}
                  className={selectedCategoryTab === tab.id ? "font-bold text-black" : "text-gray-500"}
                >
                  {tab.label}
                </s-button>
              ))}
            </s-stack>
          </s-stack>

          <s-stack gap="base">
            <s-grid gridTemplateColumns="repeat(3, 1fr)" gap="base" className="gap-6">
              {filteredWidgets.map((widget) => (
                <s-stack
                  gap="base"
                  key={widget.id}
                  background="surface"
                  className="shadow-sm overflow-hidden flex flex-col justify-between p-4 rounded-xl bg-white"
                >
                  <s-stack className="w-full bg-[#F4F6F8] aspect-video flex items-center justify-center p-4">
                    {widget.previewSvg}
                  </s-stack>

                  <s-stack padding="4" gap="base" className="flex flex-col flex-1 justify-between gap-4">
                    <s-stack gap="base" className="flex-col">
                      <s-heading variant="headingMd" className="text-[16px] font-bold text-gray-900">
                        {widget.title}
                      </s-heading>
                      <s-box>
                        <s-badge tone={widget.badgeTone}>
                          {widget.placement}
                        </s-badge>
                      </s-box>
                      <s-paragraph color="subdued" className="text-[13px] leading-relaxed mt-1">
                        {widget.description}
                      </s-paragraph>
                    </s-stack>

                    <s-stack>
                      {(() => {
                        const status = getWidgetStatus(widget);
                        const isActive = status === "active";
                        return (
                          <s-button
                            variant={isActive ? "secondary" : "primary"}
                            disabled={isActive ? "true" : undefined}
                            onClick={() => handleSetup(widget)}
                          >
                            Setup
                          </s-button>
                        );
                      })()}
                    </s-stack>
                  </s-stack>
                </s-stack>
              ))}
            </s-grid>
          </s-stack>
        </s-stack>
      </s-box>
    </s-box>
  );
}
