import React from "react";
import { BlockStack } from "@shopify/polaris";

export default function OnboardingProgress({ current, total }) {
  // Styles based on custlo_onboarding_wireframes.html
  // Creating styles as an inline style object or className-ready string isn't standard in Polaris/React
  // But we can inject a <style> tag since user asked for CSS inside component.

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

  // Create an array of steps based on total count
  const steps = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <BlockStack gap="400">
      <style>{styles}</style>

      <div className="mock-progress">
        {steps.map((step, index) => {
          // Determine state
          const isCompleted = step < current;
          const isActive = step === current;
          let statusClass = "inactive";

          if (isCompleted) statusClass = "completed";
          if (isActive) statusClass = "active";

          // Calculate if the line following this step should be completed
          // Line is completed if the NEXT step is reached (current > step)
          // Actually wireframe shows:
          // Step 1 (active) -> Line (gray) -> Step 2 (inactive)
          // Step 1 (complete) -> Line (green) -> Step 2 (active)
          // So line after step X is green if current > step + 1? No.
          // If current is 2, step 1 is complete. Line after step 1 leads to step 2.
          // In wireframe Screen 2.0 (Step 2 active):
          // Step 1 (completed) -> Line (completed) -> Step 2 (active)
          // So line after step 1 is completed if step 1 is completed.
          const isLineCompleted = isCompleted;

          return (
            <React.Fragment key={step}>
              {/* Step Circle */}
              <div className={`progress-step ${statusClass}`}>
                {isCompleted ? "✓" : step}
              </div>

              {/* Connecting Line (render for all except the very last step) */}
              {index < steps.length - 1 && (
                <div
                  className={`progress-line ${isLineCompleted ? "completed" : ""}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </BlockStack>
  );
}
