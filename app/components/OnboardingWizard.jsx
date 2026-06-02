import React, { useState } from "react";
import { Page, Layout, Card, BlockStack } from "@shopify/polaris";

// --- Progress Bar Component ---
// Copied visual behavior from existing onboarding progress
function WizardProgress({ current, total }) {
  const styles = `
    .mock-progress {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 24px;
      width: 100%;
    }
    
    .progress-step {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      font-weight: 600;
      flex-shrink: 0;
      transition: all 0.3s ease;
      cursor: default;
    }
    
    .progress-step.active {
      background: #2D7FF9;
      color: white;
    }
    
    .progress-step.completed {
      background: #10B981;
      color: white;
    }
    
    .progress-step.inactive {
      background: #E5E7EB;
      color: #6B7280;
    }
    
    .progress-line {
      flex: 1;
      height: 2px;
      background: #E5E7EB;
      transition: all 0.3s ease;
    }
    
    .progress-line.completed {
      background: #10B981;
    }
  `;

  const steps = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <BlockStack gap="400">
      <style>{styles}</style>
      <div className="mock-progress">
        {steps.map((step, index) => {
          const isCompleted = step < current;
          const isActive = step === current;
          let statusClass = "inactive";

          if (isCompleted) statusClass = "completed";
          if (isActive) statusClass = "active";

          return (
            <React.Fragment key={step}>
              <div className={`progress-step ${statusClass}`}>
                {isCompleted ? "✓" : step}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`progress-line ${isCompleted ? "completed" : ""}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </BlockStack>
  );
}

// --- Hardcoded Step Components ---
// Each step is its own clearly named function so future developers can add content independently.

function StepOne() {
  return (
    <div className="step-container">
      <h1 className="mock-title">Step 1: Welcome</h1>
      <p className="mock-subtitle">
        This is the first step of the new standalone onboarding wizard.
      </p>
      <div className="pricing-box">
        <div className="pricing-text">Let's get started</div>
        <p className="pricing-subtext">Basic configuration and setup.</p>
      </div>
    </div>
  );
}

function StepTwo() {
  return (
    <div className="step-container">
      <h1 className="mock-title">Step 2: Configuration</h1>
      <p className="mock-subtitle">
        Configure your preferences and settings here.
      </p>
      <ul className="feature-list">
        <li>
          <span className="check">✓</span> Choose your theme
        </li>
        <li>
          <span className="check">✓</span> Set your defaults
        </li>
      </ul>
    </div>
  );
}

function StepThree() {
  return (
    <div className="step-container">
      <h1 className="mock-title">Step 3: Integration</h1>
      <p className="mock-subtitle">
        Connect your tools and services for a seamless experience.
      </p>
    </div>
  );
}

function StepFour() {
  return (
    <div className="step-container">
      <h1 className="mock-title">Step 4: All Done!</h1>
      <p className="mock-subtitle">
        You have successfully reviewed all the steps. Click complete to finish.
      </p>
    </div>
  );
}

// --- Main Standalone Onboarding Component ---
export default function OnboardingWizard() {
  // Minimal state requirements
  const [currentStep, setCurrentStep] = useState(1);
  const TOTAL_STEPS = 4;

  // Navigation handlers
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
    // Future: add finish logic here
  };

  // Renders the current step's function output based on the state
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <StepOne />;
      case 2:
        return <StepTwo />;
      case 3:
        return <StepThree />;
      case 4:
        return <StepFour />;
      default:
        return <StepOne />;
    }
  };

  return (
    <Page
      title="Welcome to Custlo"
      subtitle="Let's get your customer account portal set up"
    >
      <div className="main-onboarding-container">
        <Card padding="600">
          <Layout>
            {/* Progress Bar Section */}
            <Layout.Section>
              <WizardProgress current={currentStep} total={TOTAL_STEPS} />
            </Layout.Section>

            {/* Main Content Section */}
            <Layout.Section>
              {renderStepContent()}

              {/* Shared Navigation Buttons container mimicking existing layout */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "32px",
                  alignItems: "center",
                  flexDirection: "row-reverse", // Next button on the right, Back button on the left
                }}
              >
                <div>
                  {/* Next / Continue button: visible on Steps 1, 2, 3 */}
                  {currentStep < TOTAL_STEPS && (
                    <button
                      className="btn btn-primary btn-large"
                      onClick={handleNext}
                    >
                      Continue →
                    </button>
                  )}
                  {/* Finish button: visible only on Step 4 */}
                  {currentStep === TOTAL_STEPS && (
                    <button
                      className="btn btn-primary btn-large"
                      onClick={handleComplete}
                    >
                      Complete 🎉
                    </button>
                  )}
                </div>

                <div>
                  {/* Back button: hidden on Step 1, visible on Steps 2, 3, 4 */}
                  {currentStep > 1 && (
                    <button className="btn btn-ghost" onClick={handleBack}>
                      ← Back
                    </button>
                  )}
                </div>
              </div>
            </Layout.Section>
          </Layout>
        </Card>
      </div>
    </Page>
  );
}
