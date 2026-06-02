import { BlockStack, Box, SkeletonBodyText, SkeletonDisplayText, Text } from "@shopify/polaris";
import { useState, useEffect } from "react";

export default function StepFeatures({
  data,
  updateData,
  nextStep,
  prevStep,
  classic,
}) {
  const [options, setOptions] = useState([]);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const isClassic = classic?.customerAccountsVersion === "CLASSIC";
  const [shopName, setShopName] = useState("loyalty-store-credit");


  // options setup
  useEffect(() => {

    if (classic?.customerAccountsVersion === "CLASSIC") {
      setOptions([
        {
          key: "option2",
          icon: "👤",
          title: "Customer Portal",
          description: "Beautiful account pages",
        },
        {
          key: "option6",
          icon: "🚚",
          title: "AI-Powered Customer Assistant",
          description: "Let AI handle customer questions 24/7",
        },
        {
          key: "option5",
          icon: "🛒",
          title: "Increase order value",
          description: "Post-Purchase Upsells",
        },
        {
          key: "option8",
          icon: "🏆",
          title: "Recently & Top Ordered Products",
          description: "Smart recommendations",
        },
        {
          key: "option10",
          icon: "📋",
          title: "Custom Signup Page",
          description: "Branded registration",
        },
        {
          key: "option7",
          icon: "📝",
          title: "Form Builder",
          description: "Collect custom data",
        },
        {
          key: "option9",
          icon: "🌐",
          title: "Multilanguage",
          description: "Translate your customer portal into any language",
        },
        {
          key: "option22",
          icon: "🧩",
          title: "40+ Apps Integrations",
          description: "Connect your favorite tools and apps seamlessly",
        },
      ]);
    } else {
      setOptions([
        {
          key: "option2",
          icon: "👤",
          title: "Customer Portal",
          description: "Beautiful account pages",
        },
        {
          key: "option6",
          icon: "🚚",
          title: "AI-Powered Customer Assistant",
          description: "Let AI handle customer questions 24/7",
        },
        {
          key: "option4",
          icon: "💰",
          title: "Cashback & Store Credits",
          description: "Reward customers automatically",
        },
        {
          key: "option5",
          icon: "🛒",
          title: "Increase order value",
          description: "Post-Purchase Upsells",
        },
        {
          key: "option3",
          icon: "✏️",
          title: "Order Editing",
          description: "Let customers modify orders",
        },
        {
          key: "option1",
          icon: "📝",
          title: "Customer profile fields",
          description: "collect more info about customers",
        },
        {
          key: "option7",
          icon: "📝",
          title: "Form Builder",
          description: "Collect custom data",
        },
        {
          key: "option9",
          icon: "🌐",
          title: "Multilanguage",
          description: "Translate your customer portal into any language",
        },
        {
          key: "option22",
          icon: "🧩",
          title: "40+ Apps Integrations",
          description: "Connect your favorite tools and apps seamlessly",
        },
        {
          key: "option8",
          icon: "🏆",
          title: "Recently & Top Ordered Products",
          description: "Smart recommendations",
        },
      ]);
    }
  }, [classic?.customerAccountsVersion]);

  const handleNextClick = () => {
    nextStep();
  };

  useEffect(() => {
    setTimeout(() => {
      setShowSkeleton(false);
    }, 2000);
  }, [])

  if (showSkeleton) {
    return (
      <>
        <BlockStack gap="500" >
          <SkeletonDisplayText />
          <SkeletonBodyText />
          <SkeletonDisplayText />
          <SkeletonBodyText />
          <SkeletonDisplayText />
          <SkeletonBodyText />
        </BlockStack>
      </>
    )
  }

  return (
    <div className="step-container">
      <h1 className="mock-title">🚀 Here's what you can do with Custlo</h1>
      <p className="mock-subtitle">
        All these features are available for your {isClassic ? "Legacy" : "New"} Customer Accounts store.
      </p>

      <div className="features-grid">
        {options.map((option) => (
          <div
            key={option.key}
            className={`feature-card ${isClassic ? 'legacy' : 'nca'}`}
          >
            <div className="feature-icon">{option.icon}</div>
            <div className="feature-text">
              <strong>{option.title}</strong>
              <p>{option.description}</p>
            </div>
          </div>
        ))}
      </div>

      {isClassic && (
        <div className="info-box warning" style={{ marginTop: '16px' }}>
          <span className="icon">🔓</span>
          <div className="content">
            <strong>Unlock More Features</strong>
            <p>
              Cashback, Post-Purchase Upsells, and Order Editing are available
              with New Customer Accounts.{" "}
              <a
                href={`https://admin.shopify.com/store/${shopName}/settings/customer_accounts`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--primary)', textDecoration: 'none' }}
              >
                Upgrade guide →
              </a>
            </p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
        <button className="btn btn-ghost" onClick={prevStep}>← Back</button>
        <button className="btn btn-primary" onClick={handleNextClick}>Start Free Trial →</button>
      </div>

    </div>
  );
}
