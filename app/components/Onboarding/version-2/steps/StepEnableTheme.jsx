import { useState, useEffect } from "react";
import { BlockStack, Icon, Image, SkeletonBodyText, SkeletonDisplayText } from "@shopify/polaris";
import { CheckCircleIcon } from "@shopify/polaris-icons";
// import AdminModel from '../../../../components/AdminModel';

export default function StepEnableTheme({
  data,
  updateData,
  nextStep,
  prevStep,
  themes,
}) {
  const [isEnabling, setIsEnabling] = useState(false);
  const [redirectStatus, setRedirectStatus] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showSetupVide, setShowSetupVideo] = useState(false);
  const [shopName, setShopName] = useState("loyalty-store-credit");

  const styles = `


    /* Instructions Box */
    .instructions-box {
        background: var(--gray-50);
        border-radius: 12px;
        padding: 18px;
        margin: 24px 0;
    }

    .instructions-box h4 {
        margin-bottom: 16px;
        font-weight: 600;
        font-size: 1rem;
    }

    .instructions-box ol {
        line-height: 2;
        color: var(--gray-800);
    }

    .help-text {
        text-align: center;
        margin-top: 16px;
        color: var(--gray-400);
        font-size: 0.85rem;
    }

    .help-text a {
        color: var(--primary);
        text-decoration: underline;
        cursor: pointer;
    }
  `;

  useEffect(() => {
    setTimeout(() => {
      setShowSkeleton(false);
    }, 3000);
  }, [])

  // ✅ reusable embed status check
  const checkEmbedStatus = async (themeId) => {
    try {
      const res = await fetch("/api/get-embeded?theme_id=" + themeId);
      const content = await res.json();
      // TODO: replace with real API response if needed, keeping logic intact
      const embedDisabled = content?.data?.embed_status_disabled;
      // const embedDisabled = false;

      if (!embedDisabled) {
        setRedirectStatus(true);
        setIsEnabling(false);
        updateData({ themeEnabled: true });
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error checking theme status", err);
      return false;
    }
  };

  // ✅ AUTO CHECK ON LOAD (background me)
  useEffect(() => {
    const mainActive1 = themes?.find((t) => t.role === "main");
    if (mainActive1?.id) {
      checkEmbedStatus(mainActive1.id);
    }
  }, [themes]);

  const handleSupport = () => {
    FrontChat("show");
  };

  const handleSetupVideo = () => {
    setShowSetupVideo(!showSetupVide)
  }

  // ✅ button click flow (polling same as before)
  const handleEnableTheme = async () => {
    setIsEnabling(true);
    let openedOnce = false;
    const mainActive1 = themes?.find((t) => t.role === "main");
    const pollThemeStatus = async () => {
      // open theme editor once
      if (!openedOnce) {
        openedOnce = true;
        window.open(
          `https://admin.shopify.com/store/${shopName}/themes/${mainActive1?.id}/editor?context=apps&activateAppId=f81081fd-cd04-43ee-897a-18ef0e5d9b04/app-embed&previewPath=account`,
          // `https://admin.shopify.com/store/${shopName}/themes/${mainActive1?.id}/editor?context=apps&activateAppId=019afe07-ff5b-70f6-a6a0-5f5d79a9a9fb/app-embed&previewPath=account`,
          "_blank",
        );
      }
      const enabled = await checkEmbedStatus(mainActive1?.id);
      if (!enabled) {
        setTimeout(pollThemeStatus, 1000);
      }
    };

    pollThemeStatus();
  };

  const handleContinue = () => {
    if (redirectStatus) {
      nextStep();
    }
  };


  if (showSkeleton) {
    return (
      <>
        <BlockStack gap="500" >
          <SkeletonDisplayText />
          <SkeletonBodyText />
          <SkeletonDisplayText />
          <SkeletonBodyText />

        </BlockStack>
      </>
    )
  }

  // ✅ SUCCESS UI (Styled to match new design)
  if (redirectStatus) {
    return (
      <div className="step-container">
        {/* <AdminModel
          modalOpen={showSetupVide}
          setModalOpen={setShowSetupVideo}
          title="Theme Extension Setup Guide"
          size="large"
          modelContent={<>
            <Image src="https://mandasa1.b-cdn.net/CustLo/Onboarding/Theme-Extension-Enabled02_1.gif" width="100%" height="100%" />
          </>}
        /> */}

        <style>{styles}</style>
        <h1 className="mock-title">⚡ Theme Extension Enabled</h1>
        <p className="mock-subtitle">
          Great news! Custlo is now active on your theme.
        </p>

        <div className="info-box success">
          <span className="icon">
            {/* Can use Polaris Icon inside custom div if wanted, or just Unicode check */}
            <div style={{ color: 'var(--success)', display: 'flex' }}>
              <Icon source={CheckCircleIcon} tone="success" />
            </div>
          </span>
          <div className="content">
            <strong>Setup Successful</strong>
            <p>App embed successfully detected! You're ready to proceed to the final step.</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
          <button
            className="btn btn-ghost"
            onClick={prevStep}
            disabled={isEnabling}
          >
            ← Back
          </button>
          <button
            className="btn btn-primary"
            onClick={handleContinue}
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // ✅ DEFAULT UI (Screen 5.0)
  return (
    <div className="step-container">
      <style>{styles}</style>
      <AdminModel
        modalOpen={showSetupVide}
        setModalOpen={setShowSetupVideo}
        title="Theme Extension Setup Guide"
        size="large"
        modelContent={<>
          <Image src="https://mandasa1.b-cdn.net/CustLo/Onboarding/Theme-Extension-Enabled02_1.gif" width="100%" height="100%" />
        </>}
      />

      <h1 className="mock-title">⚡ One Last Step - Activate Custlo</h1>
      <p className="mock-subtitle">This is required for Custlo to appear on your store.</p>

      <div className="info-box warning">
        <span className="icon">⚠️</span>
        <div className="content">
          <strong>Important: Don't skip this step!</strong>
          <p>Custlo won't work until you enable it in your theme. This only takes 10 seconds.</p>
        </div>
      </div>

      <div className="instructions-box">
        <h4>How to enable:</h4>
        <ol style={{ padding: "15px", paddingTop: "0" }}>
          <li>Click the <strong>"Enable in Theme"</strong> button below</li>
          {/* <li>Find <strong>"Custlo: Customer Dashboard Pro"</strong> in the list</li> */}
          {/* <li>Toggle it <strong>ON</strong> ✅</li> */}
          <li>Click <strong>Save</strong> in the top right</li>
        </ol>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
        <button
          className="btn btn-primary btn-large"
          style={{ fontSize: '1.1rem', padding: '16px 48px' }}
          onClick={handleEnableTheme}
          disabled={isEnabling}
        >
          {isEnabling ? "Verifying..." : "⚡ Enable in Theme"}
        </button>
      </div>

      <p className="help-text">
        Having trouble? <a href="#" onClick={handleSetupVideo}>Watch 10-second video guide</a> or <a href="#" onClick={handleSupport}>contact support</a>
      </p>

      <div style={{ marginTop: '24px' }}>
        <button
          className="btn btn-ghost"
          onClick={prevStep}
          disabled={isEnabling}
        >
          ← Back
        </button>
      </div>

    </div>
  );
}
