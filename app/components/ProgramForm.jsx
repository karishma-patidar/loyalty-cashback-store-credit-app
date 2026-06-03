import React from "react";
import { ProgramNameCard } from "./program/ProgramNameCard.jsx";
import { ProgramTypeCard } from "./program/ProgramTypeCard.jsx";
import { ProgramSettingsCard } from "./program/ProgramSettingsCard.jsx";
import { CartDrawerVisibilityCard } from "./program/CartDrawerVisibilityCard.jsx";

export function ProgramForm({
  name,
  setName,
  programType,
  setProgramType,
  amountType,
  setAmountType,
  amount,
  setAmount,
  maxAmount,
  setMaxAmount,
  showCartDrawerPoints,
  setShowCartDrawerPoints,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%", boxSizing: "border-box" }}>
      {/* Program Name */}
      <ProgramNameCard name={name} setName={setName} />

      {/* Program Type */}
      <ProgramTypeCard programType={programType} setProgramType={setProgramType} />

      {/* Program Settings */}
      <ProgramSettingsCard
        programType={programType}
        amountType={amountType}
        setAmountType={setAmountType}
        amount={amount}
        setAmount={setAmount}
        maxAmount={maxAmount}
        setMaxAmount={setMaxAmount}
      />

      {/* Cart Drawer Visibility */}
      <CartDrawerVisibilityCard
        showCartDrawerPoints={showCartDrawerPoints}
        setShowCartDrawerPoints={setShowCartDrawerPoints}
      />
    </div>
  );
}
