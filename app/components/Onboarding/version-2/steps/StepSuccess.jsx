// import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { BlockStack, InlineStack, SkeletonBodyText, SkeletonDisplayText, SkeletonThumbnail } from "@shopify/polaris";

export default function StepSuccess({
  data,
  updateData,
  resetOnboarding,
  nextStep,
  prevStep,
  setCustloOnboarding, custloOnboarding,
  ownerName, ownerEmail, storeUrl, historyStack
}) {
  const [loading, setLoading] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  // const navigate = useNavigate();

  // Styles from custlo_onboarding_wireframes.html
  const styles = `
    /* Preview Container */
    .preview-container {
        background: var(--gray-100);
        border-radius: 12px;
        padding: 16px;
        margin: 24px 0;
    }

    .preview-inner {
        background: white;
        border-radius: 8px;
        padding: 20px;
        border: 2px solid var(--gray-200);
    }
    h3.succes_preview_title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 15px;
    text-align: center;
}
  `;

  const postApiCall = async (endpoint, payload) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  };

  useEffect(() => {
    setTimeout(() => {
      setShowSkeleton(false);
    }, 2000);
  }, [])

  const handleGoToDashboard = async () => {
    setLoading(true);
    const {
      developerName,
      developerEmail,
      developerCompany,
      developerIntent,
      ...restData
    } = data;

    const developerObject =
      data?.setupRole === "developer"
        ? {
          developerName,
          developerEmail,
          developerCompany,
          developerIntent,
        }
        : {};

    const payload = {
      developerEmail,
      ownerEmail: ownerEmail || "unknown",
      developerName,
      name: ownerName || "unknown",
      storeUrl:
        storeUrl ||
        (window.shopify?.config?.shop
          ? `${window.shopify.config.shop}`
          : ""),
      type: data.accountType,
      intent: developerIntent,
      themeEnabled: data.themeEnabled,
      onboardingComplete: true,
    };

    const onboardingState = {
      ...restData,
      ...payload,
      developerObject, // 👈 added here
      historyStack,
      onboardingComplete: true,
      lastUpdated: new Date().toISOString(),
    };

    const singletonPayload = {
      onboarding: {
        ...restData, // 👈 no direct developer fields
        developerObject, // 👈 only here
        historyStack,
        onboardingComplete: true,
        lastUpdated: new Date().toISOString(),
      },
      shop: window.shopify?.config?.shop,
    };

    try {
      postApiCall("/api/update-onboarding", onboardingState);
      postApiCall("/api/update-onboarding-dbshopinfo", singletonPayload);
      await postApiCall("/api/update-brevo-contact", payload);
    } catch (e) {
      console.error("Error saving onboarding state", e);
    }

    if (setCustloOnboarding) setCustloOnboarding(true);
    setLoading(false);
    localStorage.removeItem("custlo_onboarding_state");
    // navigate("/", { replace: true });
  };

  if (showSkeleton) {
    return (
      <>
        <BlockStack gap="500" >
          <SkeletonDisplayText />
          <SkeletonBodyText />
          <SkeletonThumbnail size="large" />
          <SkeletonBodyText />
          <SkeletonDisplayText />
          <SkeletonBodyText />
        </BlockStack>
      </>
    )
  }

  return (
    <div className="step-container">
      <style>{styles}</style>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '28px' }}>🎉</div>
        <h3 className="mock-title">You're All Set!</h3>
        <p className="mock-subtitle">
          Custlo is now active on your store. Preview of customer account page will look as shown below::
        </p>
      </div>
      <div className="preview-container">
        {/* <h3 className="succes_preview_title">[Preview of Customer Account Page]</h3> */}
        {/* <div className="preview-inner"> */}
        <div style={{ textAlign: 'center' }}>
          <img
            src="https://mandasa1.b-cdn.net/CustLo/Onboarding/custlo%20onboarding%20preview%20image.png"
            alt="Dashboard Preview"
            style={{ maxWidth: '100%' }}
          />
          {/* </div> */}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '24px' }}>
        <button
          className="btn btn-secondary"
          onClick={() => {
            const shop = window.shopify?.config?.shop || storeUrl;
            const url = shop
              ? `https://${shop}/apps/customerdashboard`
              : storeUrl;
            if (url) window.open(url, "_blank");
          }}
        >
          👁️ View Live on Store
        </button>
        <button
          className="btn btn-primary"
          onClick={handleGoToDashboard}
          disabled={loading}
          style={{ minWidth: '160px' }}
        >
          {loading ? "Loading..." : "Go to Dashboard →"}
        </button>
      </div>

      <div className="info-box success" style={{ marginTop: '32px' }}>
        <span className="icon">📧</span>
        <div className="content">
          <strong>Check your email!</strong>
          <p>We've sent you a welcome guide with tips to get the most out of Custlo.</p>
        </div>
      </div>

      {/* <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <button 
                style={{ background: 'transparent', border: 'none', color: 'var(--gray-500)', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={prevStep}
            >
                Back
            </button>
        </div> */}

    </div>
  );
}
