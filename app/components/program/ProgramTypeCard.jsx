import React from "react";
import { ButtonGroup, Button } from "@shopify/polaris";

export function ProgramTypeCard({ programType, setProgramType }) {
  return (
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
  );
}
