/* eslint-disable react/prop-types */

const ICONS = {
  icon1: (color = "#F59E0B") => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill={color} />
      <path d="M12 7l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6L12 7z" fill="#FFF" />
    </svg>
  ),
  icon2: (color = "#F59E0B") => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill={color} />
      <text x="12" y="16.5" fill="#FFF" fontSize="13" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">$</text>
    </svg>
  ),
  icon3: (color = "#F59E0B") => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill={color} />
      <circle cx="12" cy="12" r="6" stroke="#FFF" strokeWidth="2" fill="none" />
    </svg>
  ),
  icon4: (color = "#F59E0B") => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="6" width="16" height="12" rx="2" stroke={color} strokeWidth="2.5" fill="none" />
      <circle cx="16" cy="12" r="2" fill={color} />
    </svg>
  )
};

export function calculateDisplayAmount(programOrAmount, amountType, maxAmount) {
  let amount = programOrAmount;
  let type = amountType;
  let max = maxAmount;

  if (programOrAmount && typeof programOrAmount === "object") {
    amount = programOrAmount.amount;
    type = programOrAmount.amountType;
    max = programOrAmount.maxAmount;
  }

  const calculatedAmount = ((parseFloat(amount) || 0) / 100) * 25.0;
  const maxCap = parseFloat(max);
  return type === "Fixed amount"
    ? (parseFloat(amount) || 0).toFixed(2)
    : (!isNaN(maxCap) && calculatedAmount > maxCap
      ? maxCap
      : calculatedAmount
    ).toFixed(2);
}

export function PreviewSection({
  previewPage = "product",
  setPreviewPage,
  eligibility = { d2c: true, b2b: false },
  displayAmount = "0.00",
  bgColor = "#cfb84a",
  textColor = "#000000",
  creditIcon = "icon2",
  hideWatermark = false,
  msgProduct = "",
  msgCart = "",
}) {

  const renderBannerIcon = () => {
    if (
      creditIcon !== "icon1" &&
      creditIcon !== "icon2" &&
      creditIcon !== "icon3" &&
      creditIcon !== "icon4"
    ) {
      // It's a custom uploaded image URL
      return (
        <img src={creditIcon} alt="Credit Icon" style={{ width: "32px", height: "32px", objectFit: "contain", flexShrink: 0 }} />
      );
    }
    const iconFn = ICONS[creditIcon] || ICONS.icon2;
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", flexShrink: 0 }}>
        {iconFn("#F59E0B")}
      </div>
    );
  };

  return (
    <s-stack direction="block" gap="base">
      {/* Header row of Preview card */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: "12px", flexWrap: "nowrap", marginBottom: "8px" }}>
        <s-heading variant="headingSm" style={{ margin: 0 }}>Preview section</s-heading>
        <div style={{ width: "100px", flexShrink: 0 }}>
          <s-select
            value={previewPage}
            onInput={(e) => setPreviewPage(e.target.value)}
            style={{ width: "100%" }}
          >
            <s-option value="product">Product</s-option>
            <s-option value="cart">Cart</s-option>
          </s-select>
        </div>
      </div>

      {/* Container for Preview card */}
      <s-section>
        <s-box padding="5" style={{ minHeight: "380px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>

          {/* CART PAGE PREVIEW */}
          {previewPage === "cart" && (
            <s-stack gap="base" style={{ width: "100%", flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
              <s-heading variant="headingXs">Your cart</s-heading>

              {/* Columns */}
              <s-stack direction="inline" alignment="center">
                <s-text color="subdued" variant="bold">Product</s-text>
                <s-box flex="1" />
                <s-text color="subdued" variant="bold">Total</s-text>
              </s-stack>

              <s-divider />

              {/* Product Row */}
              <s-stack direction="inline" gap="base" alignment="center">
                <img
                  src="https://cdn.shopify.com/s/files/1/0963/4349/0932/files/tshirts_100x100.jpg?v=1765864990"
                  alt="Example T-Shirt"
                />
                <s-stack direction="block" gap="none">
                  <s-text variant="bold">Example T-Shirt</s-text>
                  <s-text color="subdued" variant="small">x 1</s-text>
                </s-stack>
                <s-box flex="1" />
                <s-text variant="bold">Rs. 25.00</s-text>
              </s-stack>

              <s-divider />

              <s-box>
                <s-stack direction="block" gap="tight" alignment="end">
                  <s-stack direction="inline" alignment="center" gap="base">
                    <s-heading variant="headingMd">Subtotal:</s-heading>
                    <s-heading variant="headingMd">Rs. 25.00</s-heading>
                  </s-stack>
                  <s-text color="subdued" variant="small" style={{ fontStyle: "italic" }}>
                    Taxes and shipping calculated at checkout
                  </s-text>
                </s-stack>
              </s-box>

              {/* Store Credit Live Banner */}
              {eligibility.d2c && (
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
                    textAlign: "left"
                  }}
                >
                  {renderBannerIcon()}
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: (msgCart || "You will get <strong>{loyalty_credit_amount}</strong> store credit after this purchase.")
                          .replace(/\{loyalty_credit_amount\}/g, `Rs. ${displayAmount}`)
                      }}
                      style={{ margin: 0, fontSize: "13px", fontWeight: "600", lineHeight: "1.4", color: "inherit" }}
                    />
                    {!hideWatermark && (
                      <p style={{ margin: "2px 0 0", fontSize: "10px", opacity: 0.7, lineHeight: "1", color: "inherit" }}>
                        Powered by <span style={{ textDecoration: "underline" }}>Getloyalty.io</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Checkout Button */}
              <s-box paddingBlockStart="4" style={{ width: "100%" }}>
                <button
                  type="button"
                  style={{
                    width: "100%",
                    backgroundColor: "#1a1a1a",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 16px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "block",
                    boxSizing: "border-box",
                    textAlign: "center"
                  }}
                >
                  Checkout
                </button>
              </s-box>
            </s-stack>
          )}

          {/* PRODUCT PAGE PREVIEW */}
          {previewPage === "product" && (
            <s-stack gap="base" style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
              <img
                src="https://cdn.shopify.com/s/files/1/0963/4349/0932/files/tshirts_100x100.jpg?v=1765864990"
                alt="Example T-Shirt"
              />

              <s-stack direction="block" gap="none">
                <s-heading variant="headingMd">Example T-Shirt</s-heading>
                <s-text color="subdued" variant="bold">Rs. 25.00</s-text>
              </s-stack>

              {/* Store Credit Live Banner */}
              {eligibility.d2c && (
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
                    textAlign: "left"
                  }}
                >
                  {renderBannerIcon()}
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: (msgProduct || "Receive <strong>{loyalty_credit_amount}</strong> store credit when purchasing each item.")
                          .replace(/\{loyalty_credit_amount\}/g, `Rs. ${displayAmount}`)
                      }}
                      style={{ margin: 0, fontSize: "13px", fontWeight: "600", lineHeight: "1.4", color: "inherit" }}
                    />
                    {!hideWatermark && (
                      <p style={{ margin: "2px 0 0", fontSize: "10px", opacity: 0.7, lineHeight: "1", color: "inherit" }}>
                        Powered by <span style={{ textDecoration: "underline" }}>Getloyalty.io</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Add to cart Button */}
              <s-box paddingBlockStart="4" style={{ width: "100%" }}>
                <button
                  type="button"
                  style={{
                    width: "100%",
                    backgroundColor: "#1a1a1a",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 16px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "block",
                    boxSizing: "border-box",
                    textAlign: "center"
                  }}
                >
                  Add to cart
                </button>
              </s-box>
            </s-stack>
          )}

        </s-box>
      </s-section>
    </s-stack>
  );
}
