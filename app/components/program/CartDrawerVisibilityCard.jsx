import React from "react";

export function CartDrawerVisibilityCard({
  showCartDrawerPoints,
  setShowCartDrawerPoints,
}) {
  return (
    <s-section>
      <s-box padding="5">
        <s-checkbox
          label="Show Cart Drawer Points"
          checked={showCartDrawerPoints}
          onInput={(e) => setShowCartDrawerPoints(e.target.checked)}
        />
      </s-box>
    </s-section>
  );
}
