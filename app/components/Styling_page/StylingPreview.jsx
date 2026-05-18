import React from "react";

export function StylingPreview({
  previewPage,
  bgColor,
  textColor,
  renderBannerIcon,
  hideWatermark,
}) {
  return (
    <div
      style={{
        minHeight: "380px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
      }}
    >
      {/* CART PAGE PREVIEW */}
      {previewPage === "cart" && (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            fontFamily: "inherit",
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

          <s-box>
            <s-divider />
          </s-box>

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

          <s-box>
            <s-divider />
          </s-box>

          <s-box>
            <s-stack direction="block" gap="tight" alignment="end">
              <s-stack direction="inline" alignment="center" gap="base">
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
              transition: "all 0.2s ease-in-out",
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
                <strong style={{ fontWeight: "800", color: "inherit" }}>
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
        </div>
      )}

      {/* PRODUCT PAGE PREVIEW */}
      {previewPage === "product" && (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            fontFamily: "inherit",
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
              transition: "all 0.2s ease-in-out",
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
                <strong style={{ fontWeight: "800", color: "inherit" }}>
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
        </div>
      )}
    </div>
  );
}

export default StylingPreview;
