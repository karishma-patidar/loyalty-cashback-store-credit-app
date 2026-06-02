/**
 * Onboarding Utilities
 * Helper functions for the onboarding flow
 */

/**
 * Storage key for onboarding state
 */
export const STORAGE_KEY = "custlo_onboarding_state";

/**
 * Save onboarding state to localStorage
 * @param {string} currentStepId - Current step ID
 * @param {Object} data - Onboarding data object
 */
export function saveOnboardingState(currentStepId, data) {
    try {
        const stateToSave = {
            currentStepId,
            data,
            lastUpdated: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        return true;
    } catch (error) {
        console.error("Failed to save onboarding state:", error);
        return false;
    }
}

/**
 * Load onboarding state from localStorage
 * @returns {Object|null} Saved state or null if not found
 */
export function loadOnboardingState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
        return null;
    } catch (error) {
        console.error("Failed to load onboarding state:", error);
        return null;
    }
}

/**
 * Clear onboarding state from localStorage
 */
export function clearOnboardingState() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        return true;
    } catch (error) {
        console.error("Failed to clear onboarding state:", error);
        return false;
    }
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
export function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Get initial onboarding data structure
 * @returns {Object} Initial data object
 */
export function getInitialOnboardingData() {
    return {
        setupRole: "",
        developerName: "",
        developerEmail: "",
        developerCompany: "",
        developerIntent: "",
        accountType: "",
        trialStarted: false,
        themeEnabled: false,
    };
}

/**
 * Calculate onboarding completion percentage
 * @param {number} currentStep - Current step number (1-indexed)
 * @param {number} totalSteps - Total number of steps
 * @returns {number} Completion percentage (0-100)
 */
export function calculateProgress(currentStep, totalSteps) {
    if (totalSteps === 0) return 0;
    return Math.round((currentStep / totalSteps) * 100);
}

/**
 * Format step title for display
 * @param {string} stepId - Step ID
 * @returns {string} Formatted title
 */
export function formatStepTitle(stepId) {
    return stepId
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/**
 * Check if onboarding is complete
 * @param {Object} data - Onboarding data
 * @returns {boolean} True if all required fields are filled
 */
export function isOnboardingComplete(data) {
    const requiredFields = [
        "setupRole",
        "accountType",
        "trialStarted",
        "themeEnabled",
    ];

    const allRequiredFilled = requiredFields.every(
        (field) => data[field] !== "" && data[field] !== false
    );

    // Additional checks for developer flow
    if (data.setupRole === "developer") {
        return (
            allRequiredFilled &&
            data.developerName !== "" &&
            data.developerEmail !== "" &&
            data.developerIntent !== ""
        );
    }

    return allRequiredFilled;
}

/**
 * Get onboarding analytics data
 * @param {Object} data - Onboarding data
 * @param {number} currentStep - Current step number
 * @param {number} totalSteps - Total steps
 * @returns {Object} Analytics data object
 */
export function getOnboardingAnalytics(data, currentStep, totalSteps) {
    return {
        setupRole: data.setupRole,
        accountType: data.accountType,
        completionPercentage: calculateProgress(currentStep, totalSteps),
        isDeveloper: data.setupRole === "developer",
        isComplete: isOnboardingComplete(data),
        timestamp: new Date().toISOString(),
    };
}

/**
 * Scroll to top of page smoothly
 */
export function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: "smooth",
    });
}

/**
 * Debounce function for input handlers
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Track onboarding event (placeholder for analytics integration)
 * @param {string} eventName - Event name
 * @param {Object} properties - Event properties
 */
export function trackOnboardingEvent(eventName, properties = {}) {
    // TODO: Integrate with your analytics service (Google Analytics, Segment, etc.)
    console.log("Onboarding Event:", eventName, properties);

    // Example integration:
    // if (window.analytics) {
    //   window.analytics.track(eventName, properties);
    // }
}

/**
 * Get user-friendly error message
 * @param {Error} error - Error object
 * @returns {string} User-friendly error message
 */
export function getErrorMessage(error) {
    if (error.message) {
        return error.message;
    }
    return "An unexpected error occurred. Please try again.";
}

/**
 * Check if localStorage is available
 * @returns {boolean} True if localStorage is available
 */
export function isLocalStorageAvailable() {
    try {
        const test = "__localStorage_test__";
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}
