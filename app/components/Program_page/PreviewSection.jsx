/* eslint-disable react/prop-types */

export function PreviewSection({
  previewPage,
  setPreviewPage,
  eligibility,
  displayAmount,
  handleSave,
  isSubmitting,
  editId,
}) {
  return (
    <s-box style={{ position: "sticky", top: "20px" }}>
      <s-stack gap="base">
        <s-stack direction="inline" alignment="center" gap="base">
          <s-heading variant="headingSm">Preview section</s-heading>
          <s-box flex="1" />
          <s-select
            value={previewPage}
            onInput={(e) => setPreviewPage(e.target.value)}
          >
            <s-option value="cart">Page: Cart</s-option>
            <s-option value="product">Page: Product</s-option>
          </s-select>
        </s-stack>

        <s-section>
          <s-box padding="5">
            {previewPage === "cart" ? (
              <s-stack gap="base">
                <s-heading variant="headingXs">Your Cart</s-heading>
                <s-box paddingBlockStart="4" paddingBlockEnd="2">
                  <s-stack direction="inline" alignment="center" gap="base">
                    <s-text color="subdued" variant="bold">
                      Product
                    </s-text>
                    <s-box flex="1" />
                    <s-text color="subdued" variant="bold">
                      Total
                    </s-text>
                  </s-stack>
                </s-box>
                <s-divider />
                <s-box paddingBlock="4">
                  <s-stack direction="inline" gap="base" alignment="center">
                    <img
                      src="https://cdn.shopify.com/s/files/1/0963/4349/0932/files/tshirts_100x100.jpg?v=1765864990"
                      alt="Product"
                      style={{
                        width: "50px",
                        height: "50px",
                        objectFit: "cover",
                        borderRadius: "4px",
                      }}
                    />
                    <s-stack direction="block" gap="tight">
                      <s-text variant="bold">Example T-Shirt</s-text>
                      <s-text color="subdued">x 1</s-text>
                    </s-stack>
                    <s-box flex="1" />
                    <s-text variant="bold">Rs. 25.00</s-text>
                  </s-stack>
                </s-box>
                <s-divider />
                <s-box paddingBlock="4">
                  <s-stack direction="block" gap="tight" alignment="end">
                    <s-stack direction="inline" alignment="center" gap="base">
                      <s-heading variant="headingMd">Subtotal:</s-heading>
                      <s-heading variant="headingMd">Rs. 25.00</s-heading>
                    </s-stack>
                    <s-text color="subdued" variant="small">
                      Taxes and shipping calculated at checkout
                    </s-text>
                  </s-stack>
                </s-box>

                {/* YELLOW CALLOUT BOX */}
                {eligibility.d2c && (
                  <s-box
                    background="#FEFCE8"
                    padding="4"
                    borderRadius="base"
                    borderWidth="base"
                    borderColor="#FEF08A"
                  >
                    <s-stack direction="inline" gap="tight" alignment="start">
                      <s-icon type="star" size="small" color="warning" />
                      <s-stack direction="block" gap="none">
                        <s-paragraph variant="bold">
                          You will get{" "}
                          <s-text variant="bold">Rs. {displayAmount}</s-text>{" "}
                          store credit after this purchase.
                        </s-paragraph>
                        <s-text variant="small" color="subdued">
                          Powered by Loyalty Credit
                        </s-text>
                      </s-stack>
                    </s-stack>
                  </s-box>
                )}

                <s-box paddingBlockStart="5">
                  <s-button variant="primary" block>
                    Checkout
                  </s-button>
                </s-box>
              </s-stack>
            ) : (
              <s-stack gap="base">
                <img
                  src="https://cdn.shopify.com/s/files/1/0963/4349/0932/files/tshirts_100x100.jpg?v=1765864990"
                  alt="Product"
                  style={{
                    width: "100%",
                    height: "180px",
                    objectFit: "cover",
                    borderRadius: "4px",
                  }}
                />
                <s-box paddingBlockStart="5" paddingBlockEnd="3">
                  <s-heading variant="headingMd">Example T-Shirt</s-heading>
                  <s-text variant="bold" color="subdued">
                    Rs. 25.00
                  </s-text>
                </s-box>

                {/* YELLOW CALLOUT BOX */}
                {eligibility.d2c && (
                  <s-box
                    background="#FEFCE8"
                    padding="4"
                    borderRadius="base"
                    borderWidth="base"
                    borderColor="#FEF08A"
                  >
                    <s-stack direction="inline" gap="tight" alignment="start">
                      <s-icon type="star" size="small" color="warning" />
                      <s-stack direction="block" gap="none">
                        <s-paragraph variant="bold">
                          Receive{" "}
                          <s-text variant="bold">Rs. {displayAmount}</s-text>{" "}
                          store credit when purchasing each item.
                        </s-paragraph>
                        <s-text variant="small" color="subdued">
                          Powered by Loyalty Credit
                        </s-text>
                      </s-stack>
                    </s-stack>
                  </s-box>
                )}

                <s-box paddingBlockStart="5">
                  <s-button variant="primary" block>
                    Add to cart
                  </s-button>
                </s-box>
              </s-stack>
            )}
          </s-box>
        </s-section>

        <s-box paddingBlockStart="2">
          <s-button
            variant="primary"
            block
            onClick={handleSave}
            loading={isSubmitting ? "true" : undefined}
            disabled={isSubmitting}
          >
            {editId ? "Save" : "Save"}
          </s-button>
        </s-box>
      </s-stack>
    </s-box>
  );
}
