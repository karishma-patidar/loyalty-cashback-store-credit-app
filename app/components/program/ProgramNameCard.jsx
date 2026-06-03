import React from "react";

export function ProgramNameCard({ name, setName }) {
  return (
    <s-section>
      <s-stack gap="base">
        <s-box padding="4">
          <s-heading variant="headingSm">Program name</s-heading>
        </s-box>
        <s-box padding="5" paddingBlockStart="0">
          <s-text-field
            type="text"
            value={name}
            onInput={(e) => setName(e.target.value)}
            placeholder="e.g. Cashback on every purchase"
          />
        </s-box>
      </s-stack>
    </s-section>
  );
}
