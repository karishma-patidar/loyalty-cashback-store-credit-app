/* eslint-disable react/prop-types */
export function PromotionSettings({
  msgProduct,
  setMsgProduct,
  msgCart,
  setMsgCart,
  showCartDrawerPoints,
  setShowCartDrawerPoints,
}) {
  return (
    <>
      <s-section>
        <s-stack gap="base">
          <s-box padding="4">
            <s-heading variant="headingSm">Promotion settings</s-heading>
          </s-box>
          <s-box padding="5">
            <s-stack direction="block" gap="base">
              <s-stack direction="block" gap="tight">
                <s-text variant="bold" color="subdued">
                  Promotion message on product page
                </s-text>
                <s-box>
                  <s-text-field
                    multiline={4}
                    value={msgProduct}
                    onInput={(e) => setMsgProduct(e.target.value)}
                  />
                </s-box>
              </s-stack>
              <s-stack direction="block" gap="tight">
                <s-text variant="bold" color="subdued">
                  Promotion message on cart page
                </s-text>
                <s-box>
                  <s-text-field
                    multiline={4}
                    value={msgCart}
                    onInput={(e) => setMsgCart(e.target.value)}
                  />
                </s-box>
              </s-stack>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      {/* Cart Drawer Visibility */}
      <s-section>
        <s-box padding="5">
          <s-checkbox
            label="Show Cart Drawer Points"
            checked={showCartDrawerPoints}
            onInput={(e) => setShowCartDrawerPoints(e.target.checked)}
          />
        </s-box>
      </s-section>
    </>
  );
}
