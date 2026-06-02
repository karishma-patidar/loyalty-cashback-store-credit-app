import StepUserType from "./steps/StepUserType";
import StepAccountType from "./steps/StepAccountType";
import StepFeatures from "./steps/StepFeatures";
import StepTrial from "./steps/StepTrial";
import StepEnableTheme from "./steps/StepEnableTheme";
import StepSuccess from "./steps/StepSuccess";

/**
 * Onboarding Step Configuration
 * 
 * IMPORTANT: This is the MAIN step structure.
 * Step 1 (User Type) handles developer sub-flow internally.
 * 
 * Main Steps:
 * 1. User Type Selection (with internal developer sub-steps)
 * 2. Account Type Detection
 * 3. Features Selection
 * 4. Start Trial
 * 5. Enable Theme Extension
 * 6. Success & Preview
 */
export const onboardingSteps = [
  {
    id: "step_user_type",
    title: "User Type",
    component: StepUserType,
    skippable: false,
  },

  {
    id: "step_account_detection",
    title: "Account Detection",
    component: StepAccountType,
    skippable: false,
  },

  {
    id: "step_features",
    title: "Your Features",
    component: StepFeatures,
    skippable: false,
  },

  {
    id: "step_trial",
    title: "Start Trial",
    component: StepTrial,
    skippable: false,
  },

  {
    id: "step_enable_theme",
    title: "Enable Theme",
    component: StepEnableTheme,
    skippable: false,
  },

  {
    id: "step_success",
    title: "Success",
    component: StepSuccess,
    skippable: false,
  },
];

/**
 * Get total number of main steps (always 6)
 */
export function getTotalSteps() {
  return onboardingSteps.length;
}
