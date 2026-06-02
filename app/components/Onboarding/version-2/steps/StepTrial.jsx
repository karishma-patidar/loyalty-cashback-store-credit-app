import { BlockStack, SkeletonBodyText, SkeletonDisplayText } from "@shopify/polaris";
import { useState, useEffect } from "react";

export default function StepTrial({
  data,
  updateData,
  nextStep,
  prevStep,
  shopifyPlanName,
  activeSubscription,
  classic,
  isDevStore
}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [shopName, setShopName] = useState("loyalty-store-credit");

  const PLAN_DETAILS = {
    Basic: { label: "Basic", price: "$8 USD / month", priceNumber: 8 },
    Grow: { label: "Grow", price: "$15 USD / month", priceNumber: 15 },
    Advanced: { label: "Advanced", price: "$30 USD / month", priceNumber: 30 },
    Plus: { label: "Plus", price: "$45 USD / month", priceNumber: 45 },
  };

  // ✅ If dev store, use free plan — otherwise resolve from shopifyPlanName
  const selectedPlan = isDevStore
    ? { label: "Development", price: "Free Forever", priceNumber: 0 }
    : PLAN_DETAILS[shopifyPlanName];

  console.log("selectedPlan ::", selectedPlan);
  console.log("isDevStore ::", isDevStore);


  const planData = activeSubscription?.length > 0 ? activeSubscription[0] : { name: "" };
  const subscriptionActivation = activeSubscription?.length > 0;

  const PlanPageFeaturesLagacy = [
    "Full access to all features",
    "Seamless integration with your store",
    // "Priority support during trial",
    "Cancel anytime - just uninstall the app",
  ];

  useEffect(() => {
    setOptions(PlanPageFeaturesLagacy);
  }, [classic?.customerAccountsVersion]);

  useEffect(() => {
    setTimeout(() => {
      setShowSkeleton(false);
    }, 4000);
  }, []);

  const handleSubscribe = async () => {
    setLoading(true);

    // ✅ isDevStore → skip payment, go directly to next step
    if (isDevStore) {
      setTimeout(() => {
        updateData({ trialStarted: true });
        nextStep();
      }, 1000);
      return;
    }

    // Non-dev store → trigger payment
    await postPayment(selectedPlan.label, selectedPlan.priceNumber);
  };

  const handleActivePlan = () => {
    setLoading(true);
    setTimeout(() => {
      updateData({ trialStarted: true, activeSubscription: activeSubscription[0] });
      nextStep();
    }, 1000);
  };

  const postPayment = async (name, price) => {
    try {
      const returnurl = await fetch("/api/graphql-billing", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, test: false, price }),
      });
      const url = await returnurl.json();
      if (url.status == 200) {
        updateData({ trialStarted: true });
        nextStep();
        setLoading(false);
        window.open(
          `https://admin.shopify.com/store/${shopName}/apps/custlo-testing`,
          "_top"
        );
      } else if (url.data) {
        window.open(url.data, "_top");
      }
    } catch (e) {
      console.error("Payment Error", e);
      setLoading(false);
    }
  };

  if (showSkeleton) {
    return (
      <BlockStack gap="500">
        <SkeletonDisplayText />
        <SkeletonBodyText />
        <SkeletonDisplayText />
        <SkeletonBodyText />
        <SkeletonDisplayText />
        <SkeletonBodyText />
      </BlockStack>
    );
  }

  return (
    <div className="step-container">

      {/* Header */}
      {subscriptionActivation ? (
        <h1 className="mock-title">🎁 Congrats! Your plan is active</h1>
      ) : isDevStore ? (
        <h1 className="mock-title">Development Store — Free Access</h1>
      ) : (
        <h1 className="mock-title">🎁 Start Your 14-Day Free Trial</h1>
      )}

      <p className="mock-subtitle">
        {isDevStore
          ? "You're on a development store. All features are available for free."
          : "Full access to all features. No credit card required. Cancel anytime."}
      </p>

      {/* Pricing Box */}
      <div className="pricing-box">
        <div className="pricing-emoji">{isDevStore ? "🛠️" : "🎉"}</div>

        {subscriptionActivation ? (
          <>
            <div className="pricing-text" style={{ color: "var(--success)" }}>
              Active Plan: {planData?.name || shopifyPlanName}
            </div>
            <p className="pricing-subtext">
              You are currently subscribed to the <strong>{planData?.name}</strong> plan.
            </p>
          </>
        ) : isDevStore ? (
          <>
            <div className="pricing-text" style={{ color: "var(--success)" }}>
              FREE FOREVER
            </div>
            <p className="pricing-subtext">
              Development stores get full access at no cost.
            </p>
          </>
        ) : (
          <>
            <div className="pricing-text">14 DAYS FREE</div>
            <p className="pricing-subtext">
              Then {selectedPlan?.price} based on your Shopify plan ({selectedPlan?.label})
            </p>
          </>
        )}
      </div>

      {/* Features List */}
      <ul className="feature-list">
        {options.map((feature, index) => (
          <li key={index}>
            <span className="check">✓</span>
            {feature}
          </li>
        ))}
      </ul>

      {/* Action Button */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: "32px" }}>
        {subscriptionActivation ? (
          <button
            className="btn btn-primary btn-large"
            onClick={handleActivePlan}
            disabled={loading}
          >
            {loading ? "Processing..." : "Continue →"}
          </button>
        ) : (
          <button
            className="btn btn-primary btn-large"
            onClick={handleSubscribe}
            disabled={loading}
          >
            {/* ✅ Button label changes based on store type */}
            {loading ? "Processing..." : isDevStore ? "Activate Free Access →" : "Start Free Trial →"}
          </button>
        )}
      </div>

      {/* Back Button */}
      <div style={{ marginTop: "24px", textAlign: "left" }}>
        <button className="btn btn-ghost" disabled={loading} onClick={prevStep}>
          ← Back
        </button>
      </div>

    </div>
  );
}