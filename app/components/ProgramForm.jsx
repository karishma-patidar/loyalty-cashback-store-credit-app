import PropTypes from "prop-types";
import { ProgramNameCard } from "./program/ProgramNameCard.jsx";
import { ProgramTypeCard } from "./program/ProgramTypeCard.jsx";
import { ProgramSettingsCard } from "./program/ProgramSettingsCard.jsx";

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
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", width: "100%", boxSizing: "border-box" }}>
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

    </div>
  );
}

ProgramForm.propTypes = {
  name: PropTypes.string.isRequired,
  setName: PropTypes.func.isRequired,
  programType: PropTypes.string.isRequired,
  setProgramType: PropTypes.func.isRequired,
  amountType: PropTypes.string.isRequired,
  setAmountType: PropTypes.func.isRequired,
  amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  setAmount: PropTypes.func.isRequired,
  maxAmount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  setMaxAmount: PropTypes.func.isRequired,
};
