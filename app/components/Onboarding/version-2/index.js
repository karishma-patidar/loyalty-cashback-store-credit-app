/**
 * Custlo Onboarding Flow - Version 2
 * Main export file for easy imports
 */

// Main component
export { default as OnboardingMain } from "./OnboardingMain";

// Configuration
export {
    onboardingSteps,
    getNextStep,
    getPreviousStep,
    getTotalSteps
} from "./OnboardingEngine";

// Components
export { default as OnboardingProgress } from "./OnboardingProgress";

// Step components
export { default as StepSetupRole } from "./steps/StepSetupRole";
export { default as StepDeveloperEmail } from "./steps/StepDeveloperEmail";
export { default as StepDeveloperIntent } from "./steps/StepDeveloperIntent";
export { default as StepAccountType } from "./steps/StepAccountType";
export { default as StepFeatures } from "./steps/StepFeatures";
export { default as StepTrial } from "./steps/StepTrial";
export { default as StepEnableTheme } from "./steps/StepEnableTheme";
export { default as StepSuccess } from "./steps/StepSuccess";

// Utilities
export * from "./utils";
