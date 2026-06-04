import React, { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { ProgramForm } from "./ProgramForm";
import { PreviewSection, calculateDisplayAmount } from "./styling/PreviewSection.jsx";
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
          // padding: "0 16px",
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
            backgroundColor: "#E5E7EB",
            color: "#6B7280",
            flexShrink: 0,
            transition: "all 0.3s ease",
          };

          if (isActive) {
            circleStyle = {
              ...circleStyle,
              border: "2px solid #2D7FF9",
              backgroundColor: "#2D7FF9",
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
            height: "2.4px",
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
  const cardBaseStyle = {
    backgroundColor: "#ECFDF5",
    borderRadius: "8px",
    padding: "12px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    textAlign: "left",
    boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", textAlign: "center", boxSizing: "border-box", width: "100%" }}>
      {/* Hero Header & Title */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#111827", margin: 0 }}>
            👋 Welcome to Loyalty Cashback Store Credit!
          </h2>
        </div>
        <p style={{ fontSize: "15px", color: "#6b7280", letterSpacing: "0.2px", maxWidth: "550px", margin: "8px auto 0 auto" }}>
          Let's set up your store credit program to reward customers and boost repeat purchases right away!
        </p>
      </div>

      {/* Feature Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {/* Card 1: Cashback */}
        <div style={cardBaseStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
              flexShrink: 0,
            }}
          >
            💰
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            <h3 style={{ fontWeight: "bold", fontSize: ".9rem", color: "#111827", margin: 0 }}>
              Cashback on every purchase
            </h3>
            <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, fontWeight: "500" }}>
              Reward customers per item or per order
            </p>
          </div>
        </div>

        {/* Card 2: Expiry */}
        <div style={cardBaseStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
              flexShrink: 0,
            }}
          >
            ⏳
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h3 style={{ fontWeight: "bold", fontSize: ".9rem", color: "#111827", margin: 0 }}>
              Smart Credit Expiry Control
            </h3>
            <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, fontWeight: "500" }}>
              Set credit expiry to drive faster redemptions
            </p>
          </div>
        </div>

        {/* Card 3: Custom Branding */}
        <div style={cardBaseStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
              flexShrink: 0,
            }}
          >
            🎨
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h3 style={{ fontWeight: "bold", fontSize: ".9rem", color: "#111827", margin: 0 }}>
              Custom Branding Experience
            </h3>
            <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, fontWeight: "500" }}>
              Match colors to your store design
            </p>
          </div>
        </div>

        {/* Card 4: Analytics */}
        <div style={cardBaseStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
              flexShrink: 0,
            }}
          >
            📊
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h3 style={{ fontWeight: "bold", fontSize: ".9rem", color: "#111827", margin: 0 }}>
              Advanced Analytics & Insights
            </h3>
            <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, fontWeight: "500" }}>
              Track issued, redemptions, customer engagement & AOV
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepTwo(props) {
  const displayAmount = calculateDisplayAmount(props.amount, props.amountType, props.maxAmount);

  return (
    <div style={{ textAlign: "center", boxSizing: "border-box", width: "100%" }}>
      {/* Centered Header & Title */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>

          <h2 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#111827", margin: 0 }}>
            💰 Create Your First Cashback Program
          </h2>
        </div>
        <p style={{ fontSize: "15px", color: "#6b7280", letterSpacing: "0.2px", maxWidth: "550px", margin: "8px auto 0 auto" }}>
          Reward customers on every purchase and encourage repeat orders with a customized cashback program.
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
            msgProduct={props.msgProduct}
            msgCart={props.msgCart}
          />
        </div>
      </div>
    </div>
  );
}

function StepThree(props) {
  const displayAmount = calculateDisplayAmount(props.amount, props.amountType, props.maxAmount);

  return (
    <div style={{ textAlign: "center", boxSizing: "border-box", width: "100%" }}>
      {/* Centered Header & Title */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>

          <h2 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#111827", margin: 0 }}>
            🎨 Brand your widget style
          </h2>
        </div>
        <p style={{ fontSize: "15px", color: "#6b7280", letterSpacing: "0.2px", maxWidth: "550px", margin: "8px auto 0 auto" }}>
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
            displayAmount={displayAmount}
            bgColor={props.bgColor}
            textColor={props.textColor}
            creditIcon={props.creditIcon === "custom" && props.customIconSrc ? props.customIconSrc : props.creditIcon}
            hideWatermark={props.hideWatermark}
            msgProduct={props.msgProduct}
            msgCart={props.msgCart}
          />
        </div>
      </div>
    </div>
  );
}

function StepFour({ themeId, themeEditorUrl, isVerified, setIsVerified }) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Reusable embed status check
  const checkEmbedStatus = async (tid) => {
    try {
      const res = await fetch("/api/get-embeded?theme_id=" + tid);
      const content = await res.json();

      if (content?.data?.error) {
        setErrorMsg(content.data.error);
        setIsVerifying(false);
        return false;
      }

      const embedDisabled = content?.data?.embed_status_disabled;

      if (!embedDisabled) {
        setIsVerified(true);
        setIsVerifying(false);
        setErrorMsg("");
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error checking theme status:", err);
      // Log error but do not stop verification on transient network errors
      return false;
    }
  };

  // Poll in background when verifying
  useEffect(() => {
    let intervalId;
    let timeoutId;
    if (isVerifying && !isVerified) {
      // Start background polling check
      intervalId = setInterval(() => {
        checkEmbedStatus(themeId);
      }, 2500);

      // Add a 3-minute timeout for verification
      timeoutId = setTimeout(() => {
        setIsVerifying(false);
        setErrorMsg("Verification timed out. Please ensure you have enabled the extension in the Theme Customizer and clicked Save.");
      }, 180000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isVerifying, isVerified, themeId]);

  // Auto-check on load (background check)
  useEffect(() => {
    if (themeId && !isVerified) {
      checkEmbedStatus(themeId);
    }
  }, [themeId]);

  const handleEnableClick = async () => {
    setIsVerifying(true);
    setErrorMsg("");
    window.open(themeEditorUrl, "_blank", "noopener,noreferrer");

    try {
      const res = await fetch("/api/enable-theme-extension", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ themeId }),
      });
      const data = await res.json();
      if (!data.success) {
        // Log the error but do not stop verifying/polling
        console.warn("Failed to automatically enable theme extension, continuing with manual verification polling:", data.error);
      }
    } catch (err) {
      // Log the error but do not stop verifying/polling
      console.warn("Error calling enable-theme-extension API, continuing with manual verification polling:", err);
    }
  };



  if (isVerified) {
    return (
      <div style={{ boxSizing: "border-box", width: "100%", fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif' }}>
        {/* Centered Header & Title */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginBottom: "32px", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#111827", margin: 0 }}>
              ⚡ Theme Extension Enabled
            </h2>
          </div>
          <p style={{ fontSize: "15px", color: "#6b7280", letterSpacing: "0.2px", margin: "4px 0 0 0", fontWeight: "400" }}>
            Great news! Loyalty Cashback is now active on your theme.
          </p>
        </div>

        {/* Green Success Alert Box */}
        <div
          style={{
            maxWidth: "750px",
            margin: "0 auto",
            backgroundColor: "#e6f4ea",
            border: "1px solid #cbf2d6",
            borderRadius: "8px",
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            textAlign: "left",
          }}
        >
          {/* Checkmark Circle */}
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              backgroundColor: "#10b981",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: "18px",
              flexShrink: 0,
            }}
          >
            ✓
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <strong style={{ fontSize: "16px", color: "#0f5132", fontWeight: "700" }}>
              Setup Successful
            </strong>
            <span style={{ fontSize: "14px", color: "#0f5132", fontWeight: "500" }}>
              App embed successfully detected! You're ready to proceed to the final step.
            </span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ boxSizing: "border-box", width: "100%", fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif' }}>

      {/* Centered Header & Title */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginBottom: "24px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          <span style={{ fontSize: "28px", color: "#f59e0b" }}>⚡</span>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#111827", margin: 0 }}>
            One Last Step - Activate Loyalty Cashback
          </h2>
        </div>
        <p style={{ fontSize: "15px", color: "#6b7280", letterSpacing: "0.2px", margin: "4px 0 0 0", fontWeight: "400" }}>
          This is required for Loyalty Cashback to appear on your store.
        </p>
      </div>

      {/* Error Alert Box if failed */}
      {errorMsg && (
        <div
          style={{
            maxWidth: "750px",
            margin: "0 auto 24px auto",
            backgroundColor: "#fef2f2",
            border: "1px solid #fee2e2",
            borderRadius: "8px",
            padding: "16px 20px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            textAlign: "left",
          }}
        >
          <span style={{ fontSize: "20px", color: "#dc2626", marginTop: "2px", flexShrink: 0 }}>❌</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <strong style={{ fontSize: "15px", color: "#991b1b", fontWeight: "700" }}>
              Enablement Failed
            </strong>
            <span style={{ fontSize: "14px", color: "#b91c1c", fontWeight: "500" }}>
              {errorMsg}
            </span>
          </div>
        </div>
      )}

      {/* Important Yellow Alert Box */}
      <div
        style={{
          maxWidth: "750px",
          margin: "0 auto 24px auto",
          backgroundColor: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: "8px",
          padding: "16px 20px",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: "20px", color: "#d97706", marginTop: "2px", flexShrink: 0 }}>⚠️</span>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <strong style={{ fontSize: "15px", color: "#92400e", fontWeight: "700" }}>
            Important: Don't skip this step!
          </strong>
          <span style={{ fontSize: "14px", color: "#b45309", fontWeight: "500" }}>
            Loyalty Cashback won't work until you enable it in your theme. This only takes 10 seconds.
          </span>
        </div>
      </div>

      {/* Grey Instructions Box */}
      <div
        style={{
          maxWidth: "740px",
          margin: "0 auto 28px auto",
          backgroundColor: "#f9fafb",
          border: "1px solid #f3f4f6",
          borderRadius: "8px",
          padding: "24px",
          textAlign: "left",
        }}
      >
        <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#111827", margin: "0 0 12px 0" }}>
          How to enable:
        </h3>
        <ol style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "10px", color: "#374151", fontSize: "14px", lineHeight: "1.5" }}>
          <li>
            Click the <strong style={{ color: "#111827" }}>"Enable in Theme"</strong> button below
          </li>
          <li>
            Click <strong style={{ color: "#111827" }}>Save</strong> in the top right
          </li>
        </ol>
      </div>

      {/* Primary CTA Button */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: "32px" }}>
        <button
          onClick={handleEnableClick}
          disabled={isVerifying}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            backgroundColor: "#111827",
            color: "#ffffff",
            borderRadius: "6px",
            padding: "14px 48px",
            fontWeight: "700",
            fontSize: "16px",
            border: "none",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            transition: "all 0.2s ease",
            cursor: isVerifying ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (!isVerifying) {
              e.currentTarget.style.backgroundColor = "#1f2937";
              e.currentTarget.style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isVerifying) {
              e.currentTarget.style.backgroundColor = "#111827";
              e.currentTarget.style.transform = "translateY(0)";
            }
          }}
        >
          {isVerifying ? (
            <span>Verifying...</span>
          ) : (
            <>
              <span style={{ color: "#f59e0b" }}>⚡</span>
              <span>Enable in Theme</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function StepFive() {
  return (
    <div style={{ boxSizing: "border-box", width: "100%" }}>
      <div
        style={{
          backgroundColor: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "12px",
          padding: "48px 32px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          maxWidth: "800px",
          margin: "0 auto",
        }}
      >
        {/* Checkmark circle */}
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            backgroundColor: "#10b981",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            fontSize: "24px",
            boxShadow: "0 4px 6px -1px rgba(16, 185, 129, 0.15)",
          }}
        >
          ✓
        </div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#111827", margin: 0 }}>
          You're all set! 🎉
        </h2>
        <p style={{ fontSize: "15px", color: "#6b7280", letterSpacing: "0.2px", margin: 0 }}>
          Loyalty cashback store credit is active on your store.
        </p>
      </div>
    </div>
  );
}

// --- Main Standalone Onboarding Component ---
export default function OnboardingWizard({
  shop = "",
  themeId = "current",
  apiKey = "4639e8c9e33fe4badd965e769d8b46da",
  bgColor = "#cfb84a",
  textColor = "#000000",
  creditIcon = "icon2",
  hideWatermark = false,
  shopId = null,
  initialProgram = null,
  isExtensionEnabled = false,
}) {

  const [currentStep, setCurrentStep] = useState(1);
  const [hoveredBack, setHoveredBack] = useState(false);
  const [hoveredContinue, setHoveredContinue] = useState(false);
  const [isStepFourVerified, setIsStepFourVerified] = useState(isExtensionEnabled);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    setIsStepFourVerified(isExtensionEnabled);
  }, [isExtensionEnabled]);
  const TOTAL_STEPS = 5;

  const shopName = shop
    .replace(/^https?:\/\//, "")
    .split("/")
    .filter(Boolean)
    .pop()
    .replace(".myshopify.com", "");

  const cleanShop = shop ? shop.replace(/^https?:\/\//, "") : "";
  const customizeEmailUrl = `https://admin.shopify.com/store/${shopName}/email_templates/store_credit_issued/preview`;
  const themeEditorUrl = `https://${cleanShop}/admin/themes/${themeId}/editor?context=apps&activateAppId=${apiKey}/loyalty_credit_app_embed`;

  // --- Program State for Step 2 ---
  const [name, setName] = useState(initialProgram?.name || "Cashback on every purchase");
  const [programType, setProgramType] = useState(initialProgram?.programType || "order");
  const [amountType, setAmountType] = useState(initialProgram?.amountType || "Fixed amount");
  const [amount, setAmount] = useState(initialProgram?.amount || "15");
  const [maxAmount, setMaxAmount] = useState(initialProgram?.maxAmount || "");
  const [enableExpiration, setEnableExpiration] = useState(initialProgram?.enableExpiration ?? true);
  const [expirationType, setExpirationType] = useState(initialProgram?.expirationType || "duration");
  const [expirationDays, setExpirationDays] = useState(initialProgram?.expirationDays || "15");
  const [expirationDate, setExpirationDate] = useState(initialProgram?.expirationDate || "2026-06-30");
  const [enableDelay, setEnableDelay] = useState(initialProgram?.enableDelay ?? false);
  const [delayDays, setDelayDays] = useState(initialProgram?.delayDays || "7");
  const [channels, setChannels] = useState(initialProgram?.channels || { online: true, pos: false, draft: false });
  const [eligibility, setEligibility] = useState(initialProgram?.eligibility || { d2c: true, b2b: false });
  const [startDate, setStartDate] = useState(initialProgram?.startDate || "2026-04-24");
  const [startTime, setStartTime] = useState(initialProgram?.startTime || "02:41");
  const [enableEndDate, setEnableEndDate] = useState(initialProgram?.enableEndDate ?? false);
  const [endDate, setEndDate] = useState(initialProgram?.endDate || "2026-06-30");
  const [endTime, setEndTime] = useState(initialProgram?.endTime || "06:35");
  const [showCartDrawerPoints, setShowCartDrawerPoints] = useState(initialProgram?.showCartDrawerPoints ?? true);
  const [msgCart, setMsgCart] = useState(initialProgram?.msgCart || "You will get <strong>{loyalty_credit_amount}</strong> store credit after this purchase.");
  const [msgProduct, setMsgProduct] = useState(initialProgram?.msgProduct || "Receive {loyalty_credit_amount} store credit when purchasing each item.");
  const [notifyEmail, setNotifyEmail] = useState(initialProgram?.notifyEmail ?? false);
  const [previewPage, setPreviewPage] = useState("product");

  // Sync previewPage with programType selection
  useEffect(() => {
    if (programType === "order") {
      setPreviewPage("cart");
    } else if (programType === "product") {
      setPreviewPage("product");
    }
  }, [programType]);

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

  // Fetcher and save handlers
  const fetcher = useFetcher();
  const [saveError, setSaveError] = useState("");

  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.success) {
        setSaveError("");
        if (fetcher.data.completed) {
          window.location.href = "/app" + window.location.search;
        }
      } else {
        const errMsg = fetcher.data.error || "Failed to save settings.";
        shopify.toast.show(errMsg, { isError: true });
        setSaveError(errMsg);
        setIsCompleting(false);
      }
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const handleContinueClick = () => {
    if (currentStep === 2) {
      setSaveError("");

      const programData = {
        id: initialProgram?.id || String(Date.now()),
        name,
        programType,
        amount,
        amountType,
        maxAmount,
        enableEndDate,
        endDate,
        endTime,
        status: initialProgram?.status || "Active",
        enableExpiration,
        expirationType,
        expirationDays,
        expirationDate,
        enableDelay,
        delayDays,
        channels,
        eligibility,
        msgCart,
        msgProduct,
        notifyEmail,
        startDate,
        startTime,
        showCartDrawerPoints,
        issued: initialProgram?.issued || "0 INR",
        budget: initialProgram?.budget || "Unlimited",
      };

      fetcher.submit(
        {
          actionType: "saveProgram",
          programData: JSON.stringify(programData),
        },
        { method: "POST", encType: "application/json" }
      );
      handleNext();
    } else if (currentStep === 3) {
      setSaveError("");

      fetcher.submit(
        {
          actionType: "saveStyling",
          shopId,
          bgColor: bgColorState,
          textColor: textColorState,
          creditIcon: creditIconState === "custom" && customIconSrc ? customIconSrc : creditIconState,
          hideWatermark: hideWatermarkState,
        },
        { method: "POST", encType: "application/json" }
      );
      handleNext();
    } else {
      handleNext();
    }
  };

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
    setIsCompleting(true);
    fetcher.submit(
      {
        actionType: "completeOnboarding",
      },
      { method: "POST", encType: "application/json" }
    );
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
            msgProduct={msgProduct}
            msgCart={msgCart}
            amount={amount}
            amountType={amountType}
            maxAmount={maxAmount}
          />
        );
      case 4:
        return (
          <StepFour
            themeId={themeId}
            themeEditorUrl={themeEditorUrl}
            isVerified={isStepFourVerified}
            setIsVerified={setIsStepFourVerified}
          />
        );
      case 5:
        return <StepFive />;
      default:
        return <StepOne />;
    }
  };

  // Button style definitions
  const buttonBackStyle = {
    backgroundColor: "transparent",
    border: "none",
    color: "#6b7280",
    textDecoration: hoveredBack ? "underline" : "none",
    padding: "10px 0",
    fontWeight: "600",
    fontSize: ".95rem",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    outline: "none",
  };

  const buttonContinueStyle = {
    backgroundColor: hoveredContinue ? "#374151" : "#111827",
    border: hoveredContinue ? "1px solid #374151" : "1px solid #111827",
    color: "#ffffff",
    borderRadius: "8px",
    padding: "10px 24px",
    fontWeight: "600",
    fontSize: "14px",
    cursor: "pointer",
    transition: "background-color 0.2s, border-color 0.2s",
    outline: "none",
  };

  return (
    <s-page>
      <style>{`
        @keyframes onboarding-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          minHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          color: "#111827",
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          padding: "32px 0",
          boxSizing: "border-box",
          width: "100%"
        }}
      >
        <div style={{ textAlign: "left", alignSelf: "flex-start", marginBottom: "24px", width: "100%", boxSizing: "border-box" }}>
          <h1 style={{ fontSize: "20px", fontWeight: "700", color: "#111827", margin: "0 0 8px 0", letterSpacing: "-0.025em" }}>
            Welcome to Loyalty Cashback Store Credit
          </h1>
          <p style={{ fontSize: "15px", color: "#6b7280", letterSpacing: "0.2px", margin: 0 }}>
            Let's get your loyalty cashback program set up
          </p>
        </div>

        <div
          style={{
            width: "100%",
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #e5e7eb",
            padding: "25px",
            display: "flex",
            flexDirection: "column",
            gap: "15px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.025)",
            boxSizing: "border-box",
          }}
        >
          {/* Progress Stepper Section */}
          <WizardProgress current={currentStep} total={TOTAL_STEPS} />

          {/* Main Content Section */}
          <div style={{ display: "flex", flexDirection: "column", justifySelf: "center", justifyContent: "center", boxSizing: "border-box", width: "100%" }}>
            {renderStepContent()}
          </div>

          {/* Save Error Box */}
          {saveError && (
            <div
              style={{
                width: "100%",
                backgroundColor: "#fef2f2",
                border: "1px solid #fee2e2",
                borderRadius: "8px",
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                textAlign: "left",
                boxSizing: "border-box",
              }}
            >
              <span style={{ fontSize: "16px", color: "#dc2626", flexShrink: 0 }}>❌</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <strong style={{ fontSize: "14px", color: "#991b1b", fontWeight: "700" }}>
                  Save Failed
                </strong>
                <span style={{ fontSize: "13px", color: "#b91c1c", fontWeight: "500" }}>
                  {saveError}
                </span>
              </div>
            </div>
          )}



          {/* Shared Navigation Buttons container */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box", marginTop: "15px" }}>
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
                (currentStep !== 4 || isStepFourVerified) && (
                  <button
                    style={buttonContinueStyle}
                    onMouseEnter={() => setHoveredContinue(true)}
                    onMouseLeave={() => setHoveredContinue(false)}
                    onClick={handleContinueClick}
                  >
                    Continue →
                  </button>
                )
              ) : (
                <button
                  style={buttonContinueStyle}
                  onMouseEnter={() => setHoveredContinue(true)}
                  onMouseLeave={() => setHoveredContinue(false)}
                  onClick={handleComplete}
                  disabled={isCompleting}
                >
                  {isCompleting ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                      <svg
                        style={{
                          animation: "onboarding-spin 1s linear infinite",
                          width: "16px",
                          height: "16px",
                          color: "#ffffff"
                        }}
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeDasharray="32"
                          strokeLinecap="round"
                          fill="none"
                        />
                      </svg>
                      <span>Loading...</span>
                    </span>
                  ) : (
                    "Go to Dashboard →"
                  )}
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
