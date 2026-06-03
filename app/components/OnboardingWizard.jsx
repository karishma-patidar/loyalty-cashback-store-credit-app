import React, { useState } from "react";
import { ProgramForm } from "./ProgramForm";
import { PreviewSection } from "./styling/PreviewSection.jsx";
import { StylingForm } from "./styling/StylingForm.jsx";

// --- Progress Bar Component ---
function WizardProgress({ current, total }) {
  const steps = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div style={{ width: "100%", boxSizing: "border-box" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          maxWidth: "100%",
          margin: "0 auto 32px auto",
          padding: "0 16px",
          boxSizing: "border-box",
        }}
      >
        {steps.map((step, index) => {
          const isCompleted = step < current;
          const isActive = step === current;

          // Step Circle Style
          let circleStyle = {
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            fontWeight: "600",
            border: "2px solid #e5e7eb",
            backgroundColor: "#f3f4f6",
            color: "#9ca3af",
            flexShrink: 0,
            transition: "all 0.3s ease",
          };

          if (isActive) {
            circleStyle = {
              ...circleStyle,
              border: "2px solid #2c6ecb",
              backgroundColor: "#2c6ecb",
              color: "#ffffff",
              boxShadow: "0 0 0 4px rgba(44, 110, 203, 0.15)",
            };
          } else if (isCompleted) {
            circleStyle = {
              ...circleStyle,
              border: "2px solid #10b981",
              backgroundColor: "#10b981",
              color: "#ffffff",
            };
          }

          // Connecting Line Style
          let lineStyle = {
            flex: 1,
            height: "2px",
            backgroundColor: "#e5e7eb",
            transition: "all 0.3s ease",
            margin: "0 8px",
          };

          if (step < current) {
            lineStyle.backgroundColor = "#10b981";
          }

          return (
            <React.Fragment key={step}>
              {/* Step Circle */}
              <div style={circleStyle}>
                <span>{isCompleted ? "✓" : step}</span>
              </div>

              {/* Connecting Line */}
              {index < steps.length - 1 && <div style={lineStyle} />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// --- Step Components ---

function StepOne() {
  const [hoveredCard, setHoveredCard] = useState(null);

  const cardBaseStyle = {
    backgroundColor: "#f0fdf4",
    borderRadius: "12px",
    padding: "16px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    minHeight: "80px",
    textAlign: "left",
    border: "1px solid #dcfce7",
    boxSizing: "border-box",
  };

  const getCardStyle = (index) => {
    if (hoveredCard === index) {
      return {
        ...cardBaseStyle,
        backgroundColor: "#e6f7ed",
        transform: "translateY(-1px)",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
      };
    }
    return cardBaseStyle;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", textAlign: "center", boxSizing: "border-box", width: "100%" }}>
      {/* Hero Header & Title */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
          {/* Gold Coin Icon */}
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: "#d97706",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: "18px",
              border: "2px solid #f59e0b",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            }}
          >
            $
          </div>
          <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#111827", margin: 0, letterSpacing: "-0.025em" }}>
            Welcome to Loyalty Cashback Store Credit!
          </h2>
        </div>
        <p style={{ fontSize: "14px", color: "#4b5563", maxWidth: "550px", margin: "8px auto 0 auto", lineHeight: "1.6" }}>
          Let's set up your store credit program to reward customers and boost repeat purchases right away!
        </p>
      </div>

      {/* Feature Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {/* Card 1: Cashback */}
        <div
          style={getCardStyle(1)}
          onMouseEnter={() => setHoveredCard(1)}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "8px",
              backgroundColor: "#ffffff",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              flexShrink: 0,
            }}
          >
            🪙
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h3 style={{ fontWeight: "bold", fontSize: "14px", color: "#111827", margin: 0 }}>
              Cashback on every purchase
            </h3>
            <p style={{ fontSize: "12px", color: "#4b5563", margin: 0, fontWeight: "500" }}>
              Reward customers per item or per order
            </p>
          </div>
        </div>

        {/* Card 2: Expiry */}
        <div
          style={getCardStyle(2)}
          onMouseEnter={() => setHoveredCard(2)}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "8px",
              backgroundColor: "#ffffff",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              flexShrink: 0,
            }}
          >
            ⏱️
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h3 style={{ fontWeight: "bold", fontSize: "14px", color: "#111827", margin: 0 }}>
              Credit expiry control
            </h3>
            <p style={{ fontSize: "12px", color: "#4b5563", margin: 0, fontWeight: "500" }}>
              Set expiry to create urgency
            </p>
          </div>
        </div>

        {/* Card 3: Custom Branding */}
        <div
          style={getCardStyle(3)}
          onMouseEnter={() => setHoveredCard(3)}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "8px",
              backgroundColor: "#ffffff",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              flexShrink: 0,
            }}
          >
            🎨
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h3 style={{ fontWeight: "bold", fontSize: "14px", color: "#111827", margin: 0 }}>
              Custom branding
            </h3>
            <p style={{ fontSize: "12px", color: "#4b5563", margin: 0, fontWeight: "500" }}>
              Match colors to your store design
            </p>
          </div>
        </div>

        {/* Card 4: Analytics */}
        <div
          style={getCardStyle(4)}
          onMouseEnter={() => setHoveredCard(4)}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "8px",
              backgroundColor: "#ffffff",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              flexShrink: 0,
            }}
          >
            📊
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h3 style={{ fontWeight: "bold", fontSize: "14px", color: "#111827", margin: 0 }}>
              Analytics & insights
            </h3>
            <p style={{ fontSize: "12px", color: "#4b5563", margin: 0, fontWeight: "500" }}>
              Track issued, redeemed & AOV
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepTwo(props) {
  const calculatedAmount = ((parseFloat(props.amount) || 0) / 100) * 25.0;
  const maxCap = parseFloat(props.maxAmount);
  const displayAmount =
    props.amountType === "Fixed amount"
      ? (parseFloat(props.amount) || 0).toFixed(2)
      : (!isNaN(maxCap) && calculatedAmount > maxCap
        ? maxCap
        : calculatedAmount
      ).toFixed(2);

  return (
    <div style={{ padding: "16px 0", textAlign: "center", boxSizing: "border-box", width: "100%" }}>
      {/* Centered Header & Title */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
          {/* Percentage Icon */}
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: "16px",
              border: "2px solid #60a5fa",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            }}
          >
            %
          </div>
          <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#111827", margin: 0, letterSpacing: "-0.025em" }}>
            Create your first cashback offer
          </h2>
        </div>
        <p style={{ fontSize: "14px", color: "#4b5563", maxWidth: "550px", margin: "8px auto 0 auto", lineHeight: "1.6" }}>
          🎉 Choose how you want to reward customers — per order or per product.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "24px", alignItems: "start", textAlign: "left", boxSizing: "border-box", width: "100%" }}>
        <div style={{ boxSizing: "border-box" }}>
          <ProgramForm {...props} />
        </div>
        <div style={{ position: "sticky", top: "20px", boxSizing: "border-box" }}>
          <PreviewSection
            previewPage={props.previewPage}
            setPreviewPage={props.setPreviewPage}
            eligibility={props.eligibility}
            displayAmount={displayAmount}
            bgColor={props.bgColor}
            textColor={props.textColor}
            creditIcon={props.creditIcon}
            hideWatermark={props.hideWatermark}
          />
        </div>
      </div>
    </div>
  );
}

function StepThree(props) {
  return (
    <div style={{ padding: "16px 0", textAlign: "center", boxSizing: "border-box", width: "100%" }}>
      {/* Centered Header & Title */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
          {/* Palette Icon */}
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: "#db2777",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: "16px",
              border: "2px solid #f472b6",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            }}
          >
            🎨
          </div>
          <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#111827", margin: 0, letterSpacing: "-0.025em" }}>
            Brand your widget style
          </h2>
        </div>
        <p style={{ fontSize: "14px", color: "#4b5563", maxWidth: "550px", margin: "8px auto 0 auto", lineHeight: "1.6" }}>
          Customize widget colors, icons, and text styles to match your storefront branding.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "24px", alignItems: "start", textAlign: "left", boxSizing: "border-box", width: "100%" }}>
        <div style={{ boxSizing: "border-box" }}>
          <StylingForm
            bgColor={props.bgColor}
            setBgColor={props.setBgColor}
            textColor={props.textColor}
            setTextColor={props.setTextColor}
            creditIcon={props.creditIcon}
            setCreditIcon={props.setCreditIcon}
            customIconSrc={props.customIconSrc}
            setCustomIconSrc={props.setCustomIconSrc}
            hideWatermark={props.hideWatermark}
            setHideWatermark={props.setHideWatermark}
          />
        </div>
        <div style={{ position: "sticky", top: "20px", boxSizing: "border-box" }}>
          <PreviewSection
            previewPage={props.previewPage}
            setPreviewPage={props.setPreviewPage}
            eligibility={{ d2c: true, b2b: false }}
            displayAmount="3.75"
            bgColor={props.bgColor}
            textColor={props.textColor}
            creditIcon={props.creditIcon === "custom" && props.customIconSrc ? props.customIconSrc : props.creditIcon}
            hideWatermark={props.hideWatermark}
          />
        </div>
      </div>
    </div>
  );
}

function StepFour() {
  return (
    <div style={{ padding: "16px 0", textAlign: "center", boxSizing: "border-box", width: "100%" }}>
      {/* Centered Header & Title */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
          {/* Connection Icon */}
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: "#7c3aed",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: "16px",
              border: "2px solid #a78bfa",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            }}
          >
            🔌
          </div>
          <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#111827", margin: 0, letterSpacing: "-0.025em" }}>
            Connect your storefront theme
          </h2>
        </div>
        <p style={{ fontSize: "14px", color: "#4b5563", maxWidth: "550px", margin: "8px auto 0 auto", lineHeight: "1.6" }}>
          Enable the theme app extension in your theme editor to show the widget.
        </p>
      </div>
    </div>
  );
}

function StepFive() {
  return (
    <div style={{ padding: "16px 0", textAlign: "center", boxSizing: "border-box", width: "100%" }}>
      {/* Centered Header & Title */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
          {/* Celebrating Icon */}
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: "#059669",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: "16px",
              border: "2px solid #34d399",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            }}
          >
            🎉
          </div>
          <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#111827", margin: 0, letterSpacing: "-0.025em" }}>
            You're ready to grow!
          </h2>
        </div>
        <p style={{ fontSize: "14px", color: "#4b5563", maxWidth: "550px", margin: "8px auto 0 auto", lineHeight: "1.6" }}>
          Review your configurations and activate the cashback rewards program.
        </p>
      </div>
    </div>
  );
}

// --- Main Standalone Onboarding Component ---
export default function OnboardingWizard({
  shop = "",
  bgColor = "#cfb84a",
  textColor = "#000000",
  creditIcon = "icon2",
  hideWatermark = false,
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [hoveredBack, setHoveredBack] = useState(false);
  const [hoveredContinue, setHoveredContinue] = useState(false);
  const TOTAL_STEPS = 5;

  const shopName = shop.replace(".myshopify.com", "");
  const customizeEmailUrl = `https://admin.shopify.com/store/${shopName}/email_templates/store_credit_issued/preview`;

  // --- Program State for Step 2 ---
  const [name, setName] = useState("Cashback on every purchase");
  const [programType, setProgramType] = useState("order");
  const [amountType, setAmountType] = useState("Fixed amount");
  const [amount, setAmount] = useState("15");
  const [maxAmount, setMaxAmount] = useState("");
  const [enableExpiration, setEnableExpiration] = useState(true);
  const [expirationType, setExpirationType] = useState("duration");
  const [expirationDays, setExpirationDays] = useState("15");
  const [expirationDate, setExpirationDate] = useState("2026-06-30");
  const [enableDelay, setEnableDelay] = useState(false);
  const [delayDays, setDelayDays] = useState("7");
  const [channels, setChannels] = useState({ online: true, pos: false, draft: false });
  const [eligibility, setEligibility] = useState({ d2c: true, b2b: false });
  const [startDate, setStartDate] = useState("2026-04-24");
  const [startTime, setStartTime] = useState("02:41");
  const [enableEndDate, setEnableEndDate] = useState(false);
  const [endDate, setEndDate] = useState("2026-06-30");
  const [endTime, setEndTime] = useState("06:35");
  const [showCartDrawerPoints, setShowCartDrawerPoints] = useState(true);
  const [msgCart, setMsgCart] = useState("You will get <strong>{loyalty_credit_amount}</strong> store credit after this purchase.");
  const [msgProduct, setMsgProduct] = useState("Receive {loyalty_credit_amount} store credit when purchasing each item.");
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [previewPage, setPreviewPage] = useState("product");

  // --- Styling State for Step 3 ---
  const [bgColorState, setBgColorState] = useState(bgColor);
  const [textColorState, setTextColorState] = useState(textColor);
  const [creditIconState, setCreditIconState] = useState(creditIcon);
  const [hideWatermarkState, setHideWatermarkState] = useState(hideWatermark);
  const [customIconSrc, setCustomIconSrc] = useState(
    creditIcon !== "icon1" &&
    creditIcon !== "icon2" &&
    creditIcon !== "icon3" &&
    creditIcon !== "icon4"
      ? creditIcon
      : null
  );

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleComplete = () => {
    console.log("Onboarding completed!");
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <StepOne />;
      case 2:
        return (
          <StepTwo
            name={name}
            setName={setName}
            programType={programType}
            setProgramType={setProgramType}
            amountType={amountType}
            setAmountType={setAmountType}
            amount={amount}
            setAmount={setAmount}
            maxAmount={maxAmount}
            setMaxAmount={setMaxAmount}
            enableExpiration={enableExpiration}
            setEnableExpiration={setEnableExpiration}
            expirationType={expirationType}
            setExpirationType={setExpirationType}
            expirationDays={expirationDays}
            setExpirationDays={setExpirationDays}
            expirationDate={expirationDate}
            setExpirationDate={setExpirationDate}
            enableDelay={enableDelay}
            setEnableDelay={setEnableDelay}
            delayDays={delayDays}
            setDelayDays={setDelayDays}
            channels={channels}
            setChannels={setChannels}
            eligibility={eligibility}
            setEligibility={setEligibility}
            startDate={startDate}
            setStartDate={setStartDate}
            startTime={startTime}
            setStartTime={setStartTime}
            enableEndDate={enableEndDate}
            setEnableEndDate={setEnableEndDate}
            endDate={endDate}
            setEndDate={setEndDate}
            endTime={endTime}
            setEndTime={setEndTime}
            msgCart={msgCart}
            setMsgCart={setMsgCart}
            msgProduct={msgProduct}
            setMsgProduct={setMsgProduct}
            showCartDrawerPoints={showCartDrawerPoints}
            setShowCartDrawerPoints={setShowCartDrawerPoints}
            notifyEmail={notifyEmail}
            setNotifyEmail={setNotifyEmail}
            customizeEmailUrl={customizeEmailUrl}
            bgColor={bgColorState}
            textColor={textColorState}
            creditIcon={creditIconState}
            customIconSrc={customIconSrc}
            hideWatermark={hideWatermarkState}
            previewPage={previewPage}
            setPreviewPage={setPreviewPage}
          />
        );
      case 3:
        return (
          <StepThree
            bgColor={bgColorState}
            setBgColor={setBgColorState}
            textColor={textColorState}
            setTextColor={setTextColorState}
            creditIcon={creditIconState}
            setCreditIcon={setCreditIconState}
            customIconSrc={customIconSrc}
            setCustomIconSrc={setCustomIconSrc}
            hideWatermark={hideWatermarkState}
            setHideWatermark={setHideWatermarkState}
            previewPage={previewPage}
            setPreviewPage={setPreviewPage}
          />
        );
      case 4:
        return <StepFour />;
      case 5:
        return <StepFive />;
      default:
        return <StepOne />;
    }
  };

  // Button style definitions
  const buttonBackStyle = {
    backgroundColor: hoveredBack ? "#f9fafb" : "transparent",
    border: "1px solid #d1d5db",
    color: "#374151",
    borderRadius: "8px",
    padding: "10px 20px",
    fontWeight: "600",
    fontSize: "14px",
    cursor: "pointer",
    transition: "background-color 0.2s, border-color 0.2s",
  };

  const buttonContinueStyle = {
    backgroundColor: hoveredContinue ? "#1f2937" : "#111827",
    border: "1px solid #111827",
    color: "#ffffff",
    borderRadius: "8px",
    padding: "10px 24px",
    fontWeight: "600",
    fontSize: "14px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  };

  return (
    <s-page>
      <div
        style={{
          minHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          color: "#111827",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          padding: "32px 0",
          boxSizing: "border-box",
          width: "100%"
        }}
      >
        <div
          style={{
            width: "100%",
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #e5e7eb",
            padding: "32px",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.025)",
            boxSizing: "border-box",
          }}
        >
          {/* Progress Stepper Section */}
          <WizardProgress current={currentStep} total={TOTAL_STEPS} />

          {/* Main Content Section */}
          <div style={{ minHeight: "300px", display: "flex", flexDirection: "column", justifySelf: "center", justifyContent: "center", boxSizing: "border-box", width: "100%" }}>
            {renderStepContent()}
          </div>

          {/* Bottom Divider */}
          <div style={{ height: "1px", backgroundColor: "#e5e7eb", width: "100%" }} />

          {/* Shared Navigation Buttons container */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box" }}>
            <div>
              {currentStep > 1 && (
                <button
                  style={buttonBackStyle}
                  onMouseEnter={() => setHoveredBack(true)}
                  onMouseLeave={() => setHoveredBack(false)}
                  onClick={handleBack}
                >
                  ← Back
                </button>
              )}
            </div>

            <div>
              {currentStep < TOTAL_STEPS ? (
                <button
                  style={buttonContinueStyle}
                  onMouseEnter={() => setHoveredContinue(true)}
                  onMouseLeave={() => setHoveredContinue(false)}
                  onClick={handleNext}
                >
                  Continue →
                </button>
              ) : (
                <button
                  style={{
                    ...buttonContinueStyle,
                    backgroundColor: hoveredContinue ? "#047857" : "#059669",
                    borderColor: "#047857",
                  }}
                  onMouseEnter={() => setHoveredContinue(true)}
                  onMouseLeave={() => setHoveredContinue(false)}
                  onClick={handleComplete}
                >
                  Complete 🎉
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Centered Footer */}
        <div style={{ textAlign: "center", marginTop: "24px", boxSizing: "border-box" }}>
          <p style={{ fontSize: "12px", color: "#9ca3af", margin: 0 }}>
            © 2026 Loyalty cashback store credit. All rights reserved.
          </p>
        </div>
      </div>
    </s-page>
  );
}
