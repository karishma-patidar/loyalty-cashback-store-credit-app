/* eslint-disable react/prop-types */
import { ButtonGroup, Button } from "@shopify/polaris";

export function ProgramSettingsCard({
  programType,
  setProgramType,
  amountType,
  setAmountType,
  amount,
  setAmount,
  maxAmount,
  setMaxAmount,
}) {
  const term = programType === "order" ? "order" : "item";

  return (
    <>
      {/* Program Type */}
      <s-section gap="base">
        <s-stack gap="base">
          <s-box padding="4">
            <s-heading variant="headingSm">Program type</s-heading>
          </s-box>
          <s-stack padding="5" gap="base">
            <ButtonGroup variant="segmented">
              <Button
                pressed={programType === "order"}
                onClick={() => setProgramType("order")}
              >
                Cashback by order
              </Button>
              <Button
                pressed={programType === "product"}
                onClick={() => setProgramType("product")}
              >
                Cashback by product
              </Button>
            </ButtonGroup>
            <s-box paddingBlockStart="4">
              <s-paragraph color="subdued">
                To avoid overuse or overlap, only one type of program can be
                active at a time: by order or by product.
              </s-paragraph>
            </s-box>
          </s-stack>
        </s-stack>
      </s-section>

      {/* Program Settings */}
      <s-section>
        <s-stack gap="small" >
          <s-box padding="4">
            <s-heading variant="headingSm">Program settings</s-heading>
          </s-box>
          <s-stack gap="base">
            <s-box padding="2">
              <s-stack gap="base">
                <s-box>
                  <s-stack direction="inline" gap="base" alignment="center">
                    <s-text color="subdued">
                      Amount of store credit buyers receive PER{" "}
                      {term.toUpperCase()}
                    </s-text>
                  </s-stack>
                </s-box>
                <s-box>
                  <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                    <s-select
                      value={amountType}
                      onInput={(e) => setAmountType(e.target.value)}
                    >
                      <s-option value="Fixed amount" selected={amountType === "Fixed amount" ? "true" : undefined}>Fixed amount</s-option>
                      <s-option value="Percentage" selected={amountType === "Percentage" ? "true" : undefined}>Percentage</s-option>
                    </s-select>

                    <s-text-field
                      type="number"
                      value={amount}
                      onInput={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      suffix={"INR/" + term}
                    />
                  </s-grid>
                </s-box>
                <s-box paddingBlockStart="4">
                  <s-paragraph color="subdued">
                    To comply with Shopify regulations, the store credit does
                    not exceed $15,000 USD/customer
                  </s-paragraph>
                </s-box>
              </s-stack>
            </s-box>
            <s-box>
              {amountType === "Percentage" && programType !== "product" && (
                <s-box padding="5" paddingBlockStart="0">
                  <s-stack direction="block" gap="tight">
                    <s-text color="subdued" variant="bold">
                      Maximum store credit buyers receive PER{" "}
                      {term.toUpperCase()}
                    </s-text>
                    <s-text-field
                      type="number"
                      value={maxAmount}
                      onInput={(e) => setMaxAmount(e.target.value)}
                      suffix={"INR / " + term}
                    />
                    <s-text color="subdued" variant="bodySm">
                      Leave blank for unlimited
                    </s-text>
                  </s-stack>
                </s-box>
              )}
            </s-box>
          </s-stack>
        </s-stack>
      </s-section>
    </>
  );
}
