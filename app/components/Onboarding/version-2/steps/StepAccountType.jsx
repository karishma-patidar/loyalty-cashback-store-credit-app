import { BlockStack, SkeletonBodyText, SkeletonDisplayText } from "@shopify/polaris";
import { useState, useEffect } from "react";

export default function StepAccountType({
  data,
  updateData,
  nextStep,
  prevStep,
  isFirst,
  classic, // Add classic prop
}) {
  const [accountType, setAccountType] = useState(data.accountType);
  const [isDetecting, setIsDetecting] = useState(false);
  const [shopName, setShopName] = useState("loyalty-store-credit");

  // Auto-detect account type on mount
  useEffect(() => {
    if (!data.accountType) {
      detectAccountType();
    }
  }, []);

  const detectAccountType = () => {
    setIsDetecting(true);
    setTimeout(() => {
      let type = "new_customer_accounts";
      if (classic?.customerAccountsVersion === "CLASSIC") {
        type = "legacy_accounts";
      }
      setAccountType(type);
      updateData({ accountType: type });
      setIsDetecting(false);
    }, 1000);
  };

  useEffect(() => {
    let type = "new_customer_accounts";
    if (classic?.customerAccountsVersion === "CLASSIC") {
      type = "legacy_accounts";
    }
    setAccountType(type);
  }, [classic]);

  return (
    <div className="step-container">
      {/* Logic to show detection state vs result */}
      {isDetecting ? (
        <div>
          <BlockStack gap="500" >
            <SkeletonDisplayText />
            <SkeletonBodyText />
            <SkeletonBodyText />
          </BlockStack>
        </div>
      ) : accountType === "new_customer_accounts" ? (
        // --- SCREEN 2.0: NEW CUSTOMER ACCOUNTS ---
        <>
          <div className="detection-badge nca">
            ✓ Detected: New Customer Accounts
          </div>

          <h3 className="mock-title">🎉 Great news!</h3>
          <p className="mock-subtitle">Your store uses Shopify's New Customer Accounts.</p>

          <div className="info-box success">
            <span className="icon">✨</span>
            <div className="content">
              <strong>Premium Features Available</strong>
              <p>Cashback & Store Credits, Post-Purchase Upsells, Order Editing, and more are all available for your store.</p>
            </div>
          </div>

          <div className="highlight-box">
            <h5>What are New Customer Accounts?</h5>
            <p>Shopify's modern account system with passwordless login (OTP), built-in returns, and enhanced customization. This has been the default for new stores since 2024.</p>
          </div>
        </>
      ) : (
        // --- SCREEN 2.1: LEGACY ACCOUNTS ---
        <>
          <div className="detection-badge legacy">
            ✓ Detected: Legacy Customer Accounts
          </div>

          <h3 className="mock-title">👍 You're all set!</h3>
          <p className="mock-subtitle">Your store uses Legacy Customer Accounts. Custlo has powerful features designed just for you.</p>

          <div className="info-box">
            <span className="icon">ℹ️</span>
            <div className="content">
              <strong>Legacy Account Features</strong>
              <p>Custom Signup Page, Top Ordered Products, Recently Viewed Products, and our complete Customer Portal customization.</p>
            </div>
          </div>

          <div className="info-box warning">
            <span className="icon">💡</span>
            <div className="content">
              <strong>Want Cashback & Post-Purchase Upsells?</strong>
              <p>
                These premium features are available with New Customer Accounts.{" "}
                <a
                  href={`https://admin.shopify.com/store/${shopName}/settings/customer_accounts`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', textDecoration: 'none' }}
                >
                  Learn how to upgrade →
                </a>
              </p>
            </div>
          </div>
        </>
      )}

      {/* Navigation - Same for both states */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
        <button className="btn btn-ghost" onClick={prevStep}>← Back</button>
        <button
          className="btn btn-primary"
          onClick={nextStep}
          disabled={!accountType || isDetecting}
        >
          {isDetecting ? 'Detecting...' : 'Continue →'}
        </button>
      </div>
    </div>
  );
}
