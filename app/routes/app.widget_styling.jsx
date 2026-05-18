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
  const { admin, session } = await authenticate.admin(request);

  const query = `#graphql
    query GetStylingMetafields {
      shop {
        id
        bg_color: metafield(namespace: "loyalty_cashback_app", key: "widget_bg_color") {
          value
        }
        text_color: metafield(namespace: "loyalty_cashback_app", key: "widget_text_color") {
          value
        }
        credit_icon: metafield(namespace: "loyalty_cashback_app", key: "widget_credit_icon") {
          value
        }
        hide_watermark: metafield(namespace: "loyalty_cashback_app", key: "hide_watermark") {
          value
        }
      }
    }
  `;

  const response = await admin.graphql(query);
  const data = await response.json();
  const shop = data?.data?.shop;

  return {
    shopId: shop?.id,
    bgColor: shop?.bg_color?.value || "#cfb84a",
    textColor: shop?.text_color?.value || "#000000",
    creditIcon: shop?.credit_icon?.value || "icon2",
    hideWatermark: shop?.hide_watermark?.value === "true",
  };
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const payload = await request.json();
  const { shopId, bgColor, textColor, creditIcon, hideWatermark } = payload;

  const mutation = `#graphql
    mutation SetStylingMetafields($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors {
          message
        }
      }
    }
  `;

  const response = await admin.graphql(mutation, {
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

const ICONS = {
  icon1: (color = "#F59E0B") => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="10" fill={color} />
      <path
        d="M12 7l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6L12 7z"
        fill="#FFF"
      />
    </svg>
  ),
  icon2: (color = "#F59E0B") => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="10" fill={color} />
      <text
        x="12"
        y="16.5"
        fill="#FFF"
        fontSize="13"
        fontWeight="bold"
        textAnchor="middle"
        fontFamily="sans-serif"
      >
        $
      </text>
    </svg>
  ),
  icon3: (color = "#F59E0B") => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="10" fill={color} />
      <circle cx="12" cy="12" r="6" stroke="#FFF" strokeWidth="2" fill="none" />
    </svg>
  ),
  icon4: (color = "#F59E0B") => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="4"
        y="6"
        width="16"
        height="12"
        rx="2"
        stroke={color}
        strokeWidth="2.5"
        fill="none"
      />
      <circle cx="16" cy="12" r="2" fill={color} />
    </svg>
  ),
  icon5: (color = "#9CA3AF") => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="10" fill={color} />
      <polygon
        points="12,7 13.5,10.5 17.5,10.5 14,13 15.5,17 12,14.5 8.5,17 10,13 6.5,10.5 10.5,10.5"
        fill="#FFF"
      />
    </svg>
  ),
};

export default function WidgetStyling() {
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const loaderData = useLoaderData();
  const fetcher = useFetcher();

  const [bgColor, setBgColor] = useState(loaderData?.bgColor || "#cfb84a");
  const [textColor, setTextColor] = useState(
    loaderData?.textColor || "#000000",
  );
  const [creditIcon, setCreditIcon] = useState(
    loaderData?.creditIcon || "icon2",
  );
  const [hideWatermark, setHideWatermark] = useState(
    loaderData?.hideWatermark || false,
  );
  const [previewPage, setPreviewPage] = useState("product");
  const [customIconSrc, setCustomIconSrc] = useState(
    loaderData?.creditIcon !== "icon1" &&
      loaderData?.creditIcon !== "icon2" &&
      loaderData?.creditIcon !== "icon3" &&
      loaderData?.creditIcon !== "icon4"
      ? loaderData?.creditIcon
      : null,
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs for custom web component event capturing
  const bgColorFieldRef = useRef(null);
  const textColorFieldRef = useRef(null);

  // Capture background color changes
  useEffect(() => {
    const el = bgColorFieldRef.current;
    if (!el) return;

    const handleColorEvent = (e) => {
      const val = e.target?.value || e.detail?.value;
      if (val) setBgColor(val);
    };

    el.addEventListener("input", handleColorEvent);
    el.addEventListener("change", handleColorEvent);

    return () => {
      el.removeEventListener("input", handleColorEvent);
      el.removeEventListener("change", handleColorEvent);
    };
  }, []);

  // Capture text color changes
  useEffect(() => {
    const el = textColorFieldRef.current;
    if (!el) return;

    const handleColorEvent = (e) => {
      const val = e.target?.value || e.detail?.value;
      if (val) setTextColor(val);
    };

    el.addEventListener("input", handleColorEvent);
    el.addEventListener("change", handleColorEvent);

    return () => {
      el.removeEventListener("input", handleColorEvent);
      el.removeEventListener("change", handleColorEvent);
    };
  }, []);

  // Dirty Form Checking
  const currentFormState = JSON.stringify({
    bgColor,
    textColor,
    creditIcon:
      creditIcon === "custom" && customIconSrc ? customIconSrc : creditIcon,
    hideWatermark,
  });

  const [initialFormState, setInitialFormState] = useState(
    JSON.stringify({
      bgColor: loaderData?.bgColor || "#cfb84a",
      textColor: loaderData?.textColor || "#000000",
      creditIcon: loaderData?.creditIcon || "icon2",
      hideWatermark: loaderData?.hideWatermark || false,
    }),
  );

  const isDirty = currentFormState !== initialFormState;

  useEffect(() => {
    if (isDirty) {
      shopify.saveBar.show("widget-styling-save-bar");
    } else {
      shopify.saveBar.hide("widget-styling-save-bar");
    }
  }, [isDirty, shopify]);

  const currentFormStateRef = useRef(currentFormState);
  useEffect(() => {
    currentFormStateRef.current = currentFormState;
  }, [currentFormState]);

  // Action feedback
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      setIsSubmitting(false);
      if (fetcher.data.success) {
        shopify.toast.show("Program updated!");
        setInitialFormState(currentFormStateRef.current);
      } else {
        shopify.toast.show(
          fetcher.data.errors?.[0]?.message || "Error saving styling",
          { isError: true },
        );
      }
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const handleSave = useCallback(() => {
    setIsSubmitting(true);
    fetcher.submit(
      {
        shopId: loaderData?.shopId,
        bgColor,
        textColor,
        creditIcon:
          creditIcon === "custom" && customIconSrc ? customIconSrc : creditIcon,
        hideWatermark,
      },
      { method: "POST", encType: "application/json" },
    );
  }, [
    fetcher,
    loaderData,
    bgColor,
    textColor,
    creditIcon,
    customIconSrc,
    hideWatermark,
  ]);

  const handleDiscard = useCallback(() => {
    const initial = JSON.parse(initialFormState);
    setBgColor(initial.bgColor);
    setTextColor(initial.textColor);
    if (
      initial.creditIcon === "icon1" ||
      initial.creditIcon === "icon2" ||
      initial.creditIcon === "icon3" ||
      initial.creditIcon === "icon4"
    ) {
      setCreditIcon(initial.creditIcon);
    } else {
      setCreditIcon("custom");
      setCustomIconSrc(initial.creditIcon);
    }
    setHideWatermark(initial.hideWatermark);
  }, [initialFormState]);

  // Render correct icon in banner
  const renderBannerIcon = () => {
    if (creditIcon === "custom" && customIconSrc) {
      return (
        <img
          src={customIconSrc}
          alt="Credit Icon"
          style={{
            width: "32px",
            height: "32px",
            objectFit: "contain",
            flexShrink: 0,
          }}
        />
      );
    }
    const iconFn = ICONS[creditIcon] || ICONS.icon2;
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "36px",
          height: "36px",
          flexShrink: 0,
        }}
      >
        {iconFn("#F59E0B")}
      </div>
    );
  };

  return (
    <Page
      title="Styling"
      backAction={{
        content: "Back",
        onAction: () => {
          if (isDirty) {
            handleDiscard();
          }
          navigate("/app/promotion_widgets");
        },
      }}
    >
      <ui-save-bar
        id="widget-styling-save-bar"
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

      <s-box padding="5">
        <s-grid gridTemplateColumns="2fr 1fr" gap="base" alignItems="start">
          {/* Left Column - Settings Panels */}
          <s-stack direction="block" gap="base">
            {/* Card 1 - Watermark Toggle */}
            <s-section>
              <s-box padding="4">
                <s-checkbox
                  label="Hide watermark"
                  checked={hideWatermark}
                  onInput={(e) => setHideWatermark(e.target.checked)}
                />
              </s-box>
            </s-section>

            {/* Card 2 - Styling Settings */}
            <s-section>
              <s-box padding="5">
                <s-stack direction="block" gap="base">
                  <s-heading variant="headingSm">Styles</s-heading>

                  {/* Background Color Picker */}
                  <s-color-field
                    ref={bgColorFieldRef}
                    label="Background color"
                    value={bgColor}
                  ></s-color-field>

                  {/* Text Primary Color Picker */}
                  <s-color-field
                    ref={textColorFieldRef}
                    label="Text primary color"
                    value={textColor}
                  ></s-color-field>

                  {/* Credit Icon Selection & Upload */}
                  <s-stack direction="block" gap="tight">
                    <s-text color="subdued" variant="bold">
                      Credit icon
                    </s-text>
                    <s-stack direction="inline" gap="base" alignment="center">
                      {/* Icon 1 Select */}
                      <button
                        type="button"
                        onClick={() => setCreditIcon("icon1")}
                        style={{
                          width: "44px",
                          height: "44px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border:
                            creditIcon === "icon1"
                              ? "2px solid #000"
                              : "1px solid #E4E8EC",
                          borderRadius: "8px",
                          backgroundColor: "#FFF",
                          cursor: "pointer",
                        }}
                      >
                        {ICONS.icon1()}
                      </button>

                      {/* Icon 2 Select */}
                      <button
                        type="button"
                        onClick={() => setCreditIcon("icon2")}
                        style={{
                          width: "44px",
                          height: "44px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border:
                            creditIcon === "icon2"
                              ? "2px solid #000"
                              : "1px solid #E4E8EC",
                          borderRadius: "8px",
                          backgroundColor: "#FFF",
                          cursor: "pointer",
                        }}
                      >
                        {ICONS.icon2()}
                      </button>

                      {/* Icon 3 Select */}
                      <button
                        type="button"
                        onClick={() => setCreditIcon("icon3")}
                        style={{
                          width: "44px",
                          height: "44px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border:
                            creditIcon === "icon3"
                              ? "2px solid #000"
                              : "1px solid #E4E8EC",
                          borderRadius: "8px",
                          backgroundColor: "#FFF",
                          cursor: "pointer",
                        }}
                      >
                        {ICONS.icon3()}
                      </button>

                      {/* Icon 4 Select */}
                      <button
                        type="button"
                        onClick={() => setCreditIcon("icon4")}
                        style={{
                          width: "44px",
                          height: "44px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border:
                            creditIcon === "icon4"
                              ? "2px solid #000"
                              : "1px solid #E4E8EC",
                          borderRadius: "8px",
                          backgroundColor: "#FFF",
                          cursor: "pointer",
                        }}
                      >
                        {ICONS.icon4()}
                      </button>

                      {/* Upload File Input Button */}
                      <label
                        style={{
                          width: "88px",
                          height: "44px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          border: "1px dashed #C4CDD5",
                          borderRadius: "8px",
                          backgroundColor: "#FFF",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#454F5B",
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ color: "#637381" }}
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                setCustomIconSrc(event.target?.result);
                                setCreditIcon("custom");
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                          style={{ display: "none" }}
                        />
                      </label>

                      {customIconSrc && (
                        <>
                          <s-text color="subdued">or</s-text>

                          {/* Custom Uploaded Preview Select */}
                          <button
                            type="button"
                            onClick={() => setCreditIcon("custom")}
                            style={{
                              width: "44px",
                              height: "44px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border:
                                creditIcon === "custom"
                                  ? "2px solid #000"
                                  : "1px solid #E4E8EC",
                              borderRadius: "8px",
                              backgroundColor: "#FFF",
                              cursor: "pointer",
                            }}
                          >
                            <img
                              src={customIconSrc}
                              alt="Custom Icon"
                              style={{
                                width: "32px",
                                height: "32px",
                                objectFit: "contain",
                              }}
                            />
                          </button>
                        </>
                      )}
                    </s-stack>
                  </s-stack>
                </s-stack>
              </s-box>
            </s-section>
          </s-stack>

          {/* Right Column - Live Preview Card */}
          <s-stack direction="block" gap="base">
            {/* Header row of Preview card */}
            <s-stack direction="inline" alignment="center">
              <s-heading variant="headingSm">Preview section</s-heading>
              <s-box flex="1" />
              <s-select
                value={previewPage}
                onInput={(e) => setPreviewPage(e.target.value)}
              >
                <s-option value="product">Page: Product</s-option>
                <s-option value="cart">Page: Cart</s-option>
              </s-select>
            </s-stack>

            {/* Container for Preview card */}
            <s-section>
              <s-box
                padding="5"
                style={{
                  minHeight: "380px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                {/* CART PAGE PREVIEW */}
                {previewPage === "cart" && (
                  <s-stack
                    gap="base"
                    style={{
                      width: "100%",
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: "20px",
                    }}
                  >
                    <s-heading variant="headingXs">Your cart</s-heading>

                    {/* Columns */}
                    <s-stack direction="inline" alignment="center">
                      <s-text color="subdued" variant="bold">
                        Product
                      </s-text>
                      <s-box flex="1" />
                      <s-text color="subdued" variant="bold">
                        Total
                      </s-text>
                    </s-stack>

                    <s-divider />

                    {/* Product Row */}
                    <s-stack direction="inline" gap="base" alignment="center">
                      <img
                        src="https://cdn.shopify.com/s/files/1/0963/4349/0932/files/tshirts_100x100.jpg?v=1765864990"
                        alt="Example T-Shirt"
                        style={{
                          width: "48px",
                          height: "48px",
                          objectFit: "cover",
                          borderRadius: "6px",
                          border: "1px solid #E4E8EC",
                        }}
                      />
                      <s-stack direction="block" gap="none">
                        <s-text variant="bold">Example T-Shirt</s-text>
                        <s-text color="subdued" variant="small">
                          x 1
                        </s-text>
                      </s-stack>
                      <s-box flex="1" />
                      <s-text variant="bold">Rs. 25.00</s-text>
                    </s-stack>

                    <s-divider />

                    <s-box>
                      <s-stack direction="block" gap="tight" alignment="end">
                        <s-stack
                          direction="inline"
                          alignment="center"
                          gap="base"
                        >
                          <s-heading variant="headingMd">Subtotal:</s-heading>
                          <s-heading variant="headingMd">Rs. 25.00</s-heading>
                        </s-stack>
                        <s-text
                          color="subdued"
                          variant="small"
                          style={{ fontStyle: "italic" }}
                        >
                          Taxes and shipping calculated at checkout
                        </s-text>
                      </s-stack>
                    </s-box>

                    {/* Store Credit Live Banner */}
                    <div
                      style={{
                        backgroundColor: bgColor,
                        color: textColor,
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid rgba(0,0,0,0.08)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        textAlign: "left",
                      }}
                    >
                      {renderBannerIcon()}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                          flex: 1,
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: "13px",
                            fontWeight: "600",
                            lineHeight: "1.4",
                            color: "inherit",
                          }}
                        >
                          You will get{" "}
                          <strong
                            style={{ fontWeight: "800", color: "inherit" }}
                          >
                            Rs. 3.75
                          </strong>{" "}
                          store credit after this purchase.
                        </p>
                        {!hideWatermark && (
                          <p
                            style={{
                              margin: "2px 0 0",
                              fontSize: "10px",
                              opacity: 0.7,
                              lineHeight: "1",
                              color: "inherit",
                            }}
                          >
                            Powered by{" "}
                            <span style={{ textDecoration: "underline" }}>
                              Getkoin.io
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Checkout Button */}
                    <s-box paddingBlockStart="4" style={{ marginTop: "auto" }}>
                      <s-button variant="primary" block>
                        Checkout
                      </s-button>
                    </s-box>
                  </s-stack>
                )}

                {/* PRODUCT PAGE PREVIEW */}
                {previewPage === "product" && (
                  <s-stack
                    gap="base"
                    style={{
                      width: "100%",
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                    }}
                  >
                    <img
                      src="https://cdn.shopify.com/s/files/1/0963/4349/0932/files/tshirts_100x100.jpg?v=1765864990"
                      alt="Example T-Shirt"
                      style={{
                        width: "100%",
                        height: "176px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        border: "1px solid #E4E8EC",
                      }}
                    />

                    <s-stack direction="block" gap="none">
                      <s-heading variant="headingMd">Example T-Shirt</s-heading>
                      <s-text color="subdued" variant="bold">
                        Rs. 25.00
                      </s-text>
                    </s-stack>

                    {/* Store Credit Live Banner */}
                    <div
                      style={{
                        backgroundColor: bgColor,
                        color: textColor,
                        padding: "16px",
                        borderRadius: "8px",
                        border: "1px solid rgba(0,0,0,0.08)",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        textAlign: "left",
                      }}
                    >
                      {renderBannerIcon()}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                          flex: 1,
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: "13px",
                            fontWeight: "600",
                            lineHeight: "1.4",
                            color: "inherit",
                          }}
                        >
                          Receive{" "}
                          <strong
                            style={{ fontWeight: "800", color: "inherit" }}
                          >
                            Rs. 3.75
                          </strong>{" "}
                          store credit when purchasing each item.
                        </p>
                        {!hideWatermark && (
                          <p
                            style={{
                              margin: "2px 0 0",
                              fontSize: "10px",
                              opacity: 0.7,
                              lineHeight: "1",
                              color: "inherit",
                            }}
                          >
                            Powered by{" "}
                            <span style={{ textDecoration: "underline" }}>
                              Getkoin.io
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Add to cart Button */}
                    <s-box paddingBlockStart="4" style={{ marginTop: "auto" }}>
                      <s-button variant="primary" block>
                        Add to cart
                      </s-button>
                    </s-box>
                  </s-stack>
                )}
              </s-box>
            </s-section>
          </s-stack>
        </s-grid>
      </s-box>
    </Page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
