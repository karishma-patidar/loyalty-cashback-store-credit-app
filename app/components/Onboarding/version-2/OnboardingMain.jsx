import React, { useState, useEffect, useCallback, useRef } from "react";
import { Page, Layout, Card } from "@shopify/polaris";
import { onboardingSteps } from "./OnboardingEngine";
import OnboardingProgress from "./OnboardingProgress";
import { PostApi } from "../../../controller/Controller"; // Assuming relative path is correct based on original file

const STORAGE_KEY = "custlo_onboarding_state";

export default function OnboardingMain(props) {
  const {
    classic,
    shopifyPlanName,
    activeSubscription,
    getStoreMetafields,
    setCustloOnboarding, custloOnboarding,
    embededStatusDisabled
  } = props;

  // Helper function for initial data structure
  function getInitialData() {
    return {
      setupRole: "",
      developerName: "",
      developerEmail: "",
      developerCompany: "",
      developerIntent: "",
      accountType: "",
      trialStarted: false,
      themeEnabled: false,
      onboardingComplete: false,
      storeUrl: window.shopify?.config?.shop,
      activeSubscription: {},
    };
  }

  // Initialize state from localStorage or defaults
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.data || getInitialData();
      } catch (e) {
        return getInitialData();
      }
    }
    return getInitialData();
  });
  const shouldSaveRef = useRef(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  // History stack to track actual navigation path
  const [historyStack, setHistoryStack] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.historyStack || ["step_user_type"];
      } catch (e) {
        return ["step_user_type"];
      }
    }
    return ["step_user_type"];
  });

  // Current step is always the last item in history
  const currentStepId = historyStack[historyStack.length - 1];

  // Get current step index (no filtering needed - fixed 6 steps)
  const currentIndex = onboardingSteps.findIndex(
    (step) => step.id === currentStepId
  );

  // Sync to localStorage whenever state changes
  useEffect(() => {
    const stateToSave = {
      data,
      historyStack,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [data, historyStack]);

  // Update data helper
  const updateData = useCallback((newData) => {
    setData((prev) => ({ ...prev, ...newData }));
  }, []);

  // Navigation: Next Step
  const nextStep = useCallback(async () => {

    const currentIdx = onboardingSteps.findIndex(step => step.id === currentStepId);
    const next = onboardingSteps[currentIdx + 1];

    if (next) {
      // Add next step to history stack
      shouldSaveRef.current = true; // mark save needed
      setHistoryStack(prev => [...prev, next.id]);
      // Scroll to top for better UX
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStepId]);

  useEffect(() => {
    if (!shouldSaveRef.current) return; // prevent initial run

    const updateOnboarding = async () => {
      setLoadingSave(true);

      console.log("data :::", data);

      // 👇 Extract developer fields separately
      const {
        developerName,
        developerEmail,
        developerCompany,
        developerIntent,
        ...restData
      } = data;

      // 👇 Create developerObject only if role is developer
      const developerObject =
        data?.setupRole === "developer"
          ? {
            developerName,
            developerEmail,
            developerCompany,
            developerIntent,
          }
          : {};

      try {
        const singletonPayload = {
          onboarding: {
            ...restData, // 👈 all fields except developer ones
            developerObject, // 👈 developer data only here
            historyStack,
            lastUpdated: new Date().toISOString(),
          },
          shop: window.shopify?.config?.shop,
        };

        console.log("singletonPayload ::", singletonPayload);

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
          onboardingComplete: data.onboardingComplete,
          setupRole: data.setupRole,
        };

        await PostApi("/api/update-onboarding-dbshopinfo", singletonPayload);
        await PostApi("/api/update-brevo-contact", payload);

      } catch (error) {
        console.error(error);
      } finally {
        setLoadingSave(false);
        shouldSaveRef.current = false; // reset flag
      }
    };

    updateOnboarding();
  }, [data, historyStack]);


  // Navigation: Previous Step (using history stack)
  const prevStep = useCallback(() => {
    if (historyStack.length > 1) {
      // Pop current step from history to go back
      setHistoryStack(prev => prev.slice(0, -1));
      // Scroll to top for better UX
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [historyStack]);

  // Reset onboarding (useful for testing or restart)
  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHistoryStack(["step_user_type"]);
    setData(getInitialData());
  }, []);

  // Get current step component
  const currentStep = onboardingSteps[currentIndex];
  const CurrentComponent = currentStep?.component;

  const getShopData = useCallback(async () => {
    try {
      const query = `
          query {
            shop {
              email
              name
              url
            }
          }
        `;
      const response = await fetch("shopify:admin/api/2025-07/graphql.json", {
        method: "POST",
        body: JSON.stringify({ query }),
      });

      const responseData = await response.json();
      if (responseData?.data?.shop) {
        setOwnerEmail(responseData.data.shop.email);
        setOwnerName(responseData.data.shop.name);
        setStoreUrl(responseData.data.shop.url);
      }
    } catch (error) {
      console.error("Error fetching shop data:", error);
    }
  }, []);

  useEffect(() => {
    getShopData();
  }, []);

  // Safety fallback: If no valid component, reset to first step
  if (!CurrentComponent) {
    // Silently reset to first step
    if (currentStepId !== onboardingSteps[0].id) {
      setHistoryStack([onboardingSteps[0].id]);
    }

    // Show first step while resetting
    const FirstComponent = onboardingSteps[0].component;
    return (
      <Page
        title="Welcome to Custlo"
        subtitle="Let's get your customer account portal set up"
      >
        <div className="main-onboarding-container">
          <Card padding="600" >
            <Layout>
              <Layout.Section>
                <OnboardingProgress
                  current={1}
                  total={onboardingSteps.length}
                  currentStepTitle={onboardingSteps[0].title}
                />
              </Layout.Section>
              <Layout.Section>
                {/* <Card padding="600"> */}
                <FirstComponent
                  data={data}
                  updateData={updateData}
                  nextStep={nextStep}
                  prevStep={prevStep}
                  isFirst={true}
                  isLast={false}
                  resetOnboarding={resetOnboarding}
                  // Pass through all parent props
                  classic={classic}
                  shopifyPlanName={shopifyPlanName}
                  activeSubscription={activeSubscription}
                  getStoreMetafields={getStoreMetafields}
                  setCustloOnboarding={setCustloOnboarding}
                  custloOnboarding={custloOnboarding}
                  embededStatusDisabled={embededStatusDisabled}
                  loadingSave={loadingSave}
                  setLoadingSave={setLoadingSave}
                  ownerName={ownerName}
                  ownerEmail={ownerEmail}
                  storeUrl={storeUrl}
                  historyStack={historyStack}
                  {...props}
                />
                {/* </Card> */}
              </Layout.Section>
            </Layout>
          </Card>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Welcome to Custlo"
      subtitle="Let's get your customer account portal set up"
    >
      <div className="main-onboarding-container">
        <Card padding="600" >
          <Layout>
            {/* Progress Bar Section */}
            <Layout.Section>
              <OnboardingProgress
                current={currentIndex + 1}
                total={onboardingSteps.length}
                currentStepTitle={currentStep.title}
              />
            </Layout.Section>

            {/* Main Content Section */}
            <Layout.Section>
              {/* <Card padding="600"> */}
              <CurrentComponent
                data={data}
                updateData={updateData}
                nextStep={nextStep}
                prevStep={prevStep}
                isFirst={historyStack.length === 1}
                isLast={currentIndex === onboardingSteps.length - 1}
                resetOnboarding={resetOnboarding}
                // Pass through all parent props (matching old onboarding)
                classic={classic}
                shopifyPlanName={shopifyPlanName}
                activeSubscription={activeSubscription}
                getStoreMetafields={getStoreMetafields}
                setCustloOnboarding={setCustloOnboarding}
                custloOnboarding={custloOnboarding}
                embededStatusDisabled={embededStatusDisabled}
                loadingSave={loadingSave}
                setLoadingSave={setLoadingSave}
                ownerName={ownerName}
                ownerEmail={ownerEmail}
                storeUrl={storeUrl}
                historyStack={historyStack}
                {...props}
              />
              {/* </Card> */}
            </Layout.Section>
          </Layout>
        </Card>
      </div>
    </Page>
  );
}
