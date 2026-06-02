import React, { useState } from "react";
import { BlockStack, TextField } from "@shopify/polaris";
import { PostApi } from "../../../../controller/Controller";

export default function StepUserType({
  data,
  updateData,
  nextStep,
  prevStep,
  isFirst,
  loadingSave,
  setLoadingSave,
  ownerName,
  ownerEmail,
  storeUrl,
}) {
  // Internal sub-state for developer flow
  const [subStep, setSubStep] = useState(() => {
    // If we are returning to this step, try to restore state
    if (data.setupRole === "developer") {
      // If we have intent, we might have been at the end, but let's default to where we left off
      if (data.developerIntent) return "intent";
      if (data.developerEmail) return "details";
      return "role";
    }
    return "role";
  });

  const [errors, setErrors] = useState({});

  // Styles from custlo_onboarding_wireframes.html
  const styles = `
        :root {
            --primary: #2D7FF9;
            --primary-dark: #1a5fd4;
            --success: #10B981;
            --gray-50: #F9FAFB;
            --gray-100: #F3F4F6;
            --gray-200: #E5E7EB;
            --gray-500: #6B7280;
            --gray-800: #1F2937;
            --gray-900: #111827;
        }

        .step-container {
            /* minimal reset if needed */
        }

        .option-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 16px;
            margin: 24px 0;
        }
        
        .option-card {
            border: 2px solid var(--gray-200);
            border-radius: 12px;
            padding: 24px;
            cursor: pointer;
            transition: all 0.2s;
            background: white;
            display: flex;
            flex-direction: column;
            position: relative;
        }
        
        .option-card:hover {
            border-color: var(--primary);
            box-shadow: 0 4px 12px rgba(45, 127, 249, 0.15);
        }
        
        .option-card.selected {
            border-color: var(--primary);
            background: #EFF6FF;
        }
        
        .option-card .icon {
            width: 48px;
            height: 48px;
            background: var(--gray-100);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            margin-bottom: 16px;
        }
        
        .option-card h5 {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--gray-900);
        }
        
        .option-card p {
            font-size: 0.875rem;
            color: var(--gray-500);
            margin-bottom: 16px; /* Space for button */
        }

        .email-capture-section {
            background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
            border-radius: 12px;
            padding: 24px;
            margin: 24px 0;
        }

        .feature-list {
            list-style: none;
            margin: 0 0 20px 0;
            padding: 0;
        }
        
        .feature-list li {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 8px 0;
            font-size: 0.95rem;
        }
        
        .feature-list .check {
            color: var(--success);
            font-weight: bold;
        }

        .info-box {
            background: #F0F9FF;
            border: 1px solid #BAE6FD;
            border-radius: 8px;
            padding: 16px 18px;
            margin: 16px 0;
            display: flex;
            gap: 12px;
        }
        
        .info-box .icon {
            font-size: 1.25rem;
        }
        
        .info-box .content strong {
            display: block;
            margin-bottom: 4px;
            font-size: 15px;
        }
        
        .info-box .content p {
            font-size: 0.875rem;
            color: var(--gray-600);
            margin: 0;
        }
    `;

  // --- LOGIC HANDLERS ---

  const handleRoleSelect = (role) => {
    updateData({ setupRole: role });
    // Don't clear errors immediately if unrelated
  };

  const handleRoleNext = () => {
    if (data.setupRole === "owner") {
      nextStep();
    } else if (data.setupRole === "developer") {
      setSubStep("details");
    }
  };

  const validateDeveloperDetails = () => {
    const newErrors = {};
    if (!data.developerName?.trim())
      newErrors.developerName = "Name is required";
    if (!data.developerEmail?.trim()) {
      newErrors.developerEmail = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.developerEmail)) {
      newErrors.developerEmail = "Please enter a valid email";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDeveloperDetailsNext = () => {
    if (validateDeveloperDetails()) {
      setSubStep("intent");
    }
  };

  const handleIntentSelect = (intent) => {
    updateData({ developerIntent: intent });
  };

  const handleIntentNext = () => {
    nextStep();
  };

  const handleBack = () => {
    if (subStep === "intent") {
      setSubStep("details");
    } else if (subStep === "details") {
      setSubStep("role");
      // Optional: reset developer data if backing out?
      // Previous implementation did this, keeping it for consistency
      updateData({
        setupRole: "",
        developerName: "",
        developerEmail: "",
        developerCompany: "",
        developerIntent: "",
      });
    } else if (subStep === "role") {
      if (!isFirst) prevStep();
    }
  };

  // 1. Role Selection (Screen 1.0)
  if (subStep === "role" || subStep === "complete") {
    // Note: 'complete' was used in prev version, handling it here just in case logic lingers,
    // but primarily we stick to 'role'
    return (
      <div className="step-container">
        <style>{styles}</style>
        <div className="mock-title">👋 Welcome to Custlo!</div>
        <div className="mock-subtitle">
          Let's personalize your setup experience. Who's setting this up?
        </div>

        <div className="option-cards">
          {/* Store Owner Option */}
          <div
            className={`option-card ${data.setupRole === "owner" ? "selected" : ""}`}
            onClick={() => handleRoleSelect("owner")}
          >
            <div className="icon">🏪</div>
            <h5>I'm the Store Owner</h5>
            <p>I own this store and I'm setting up Custlo for myself.</p>

            {data.setupRole === "owner" && (
              <button
                className="btn btn-primary"
                disabled={loadingSave}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRoleNext();
                }}
              >
                {loadingSave ? "Saving..." : "Continue →"}
              </button>
            )}
          </div>

          {/* Developer Option */}
          <div
            className={`option-card ${data.setupRole === "developer" ? "selected" : ""}`}
            onClick={() => handleRoleSelect("developer")}
          >
            <div className="icon">💻</div>
            <h5>I'm a Developer / Agency</h5>
            <p>I'm setting this up for a client or testing features.</p>

            {data.setupRole === "developer" && (
              <button
                className="btn btn-primary"
                disabled={loadingSave}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRoleNext();
                }}
              >
                {loadingSave ? "Saving..." : "Continue →"}
              </button>
            )}
          </div>
        </div>

        {/* Back Button */}
        {!isFirst && (
          <div style={{ marginTop: "16px" }}>
            <button className="btn btn-ghost" onClick={prevStep}>
              ← Back
            </button>
          </div>
        )}
      </div>
    );
  }

  // 2. Developer Details (Screen 1.1)
  if (subStep === "details") {
    return (
      <div className="step-container">
        <style>{styles}</style>
        <div className="mock-title">📧 Stay in the Loop</div>
        <div className="mock-subtitle">
          We'll send setup guides and important updates to your email (not the
          store owner's).
        </div>

        <div className="email-capture-section">
          <h5
            className="mock-title"
            style={{ fontSize: "1rem", marginBottom: "16px" }}
          >
            🎁 What you'll get:
          </h5>
          <ul className="feature-list">
            <li>
              <span className="check">✓</span> Priority developer support
            </li>
            <li>
              <span className="check">✓</span> Setup completion checklist
            </li>
            <li>
              <span className="check">✓</span> Client handover documentation
            </li>
            <li>
              <span className="check">✓</span> New feature announcements
            </li>
          </ul>

          <BlockStack gap="400">
            {/* <TextField
                            label="Your Name"
                            placeholder="John Smith"
                            value={data.developerName || ""}
                            onChange={(val) => updateData({ developerName: val })}
                            error={errors.developerName}
                            autoComplete="name"
                        />
                        <TextField
                            label="Your Work Email"
                            type="email"
                            placeholder="john@agency.com"
                            value={data.developerEmail || ""}
                            onChange={(val) => updateData({ developerEmail: val })}
                            error={errors.developerEmail}
                            autoComplete="email"
                        />
                        <TextField
                            label="Company / Agency Name (Optional)"
                            placeholder="Awesome Agency Inc."
                            value={data.developerCompany || ""}
                            onChange={(val) => updateData({ developerCompany: val })}
                            autoComplete="organization"
                        /> */}
              {/* Your Name */}
              <div className="input-group">
                <label>Your Name</label>
                <input
                  type="text"
                  placeholder="John Smith"
                  value={data.developerName || ""}
                  onChange={(e) =>
                    updateData({ developerName: e.target.value })
                  }
                  autoComplete="name"
                />
                {errors.developerName && (
                  <p className="error" style={{color:"red"}}>{errors.developerName}</p>
                )}
              </div>

              {/* Your Work Email */}
              <div className="input-group">
                <label>Your Work Email</label>
                <input
                  type="email"
                  placeholder="john@agency.com"
                  value={data.developerEmail || ""}
                  onChange={(e) =>
                    updateData({ developerEmail: e.target.value })
                  }
                  autoComplete="email"
                />
                {errors.developerEmail && (
                  <p style={{color:"red"}} className="error">{errors.developerEmail}</p>
                )}
              </div>

              {/* Company / Agency Name */}
              <div className="input-group">
                <label>Company / Agency Name (Optional)</label>
                <input
                  type="text"
                  placeholder="Awesome Agency Inc."
                  value={data.developerCompany || ""}
                  onChange={(e) =>
                    updateData({ developerCompany: e.target.value })
                  }
                  autoComplete="organization"
                />
            </div>
          </BlockStack>
        </div>

        <div className="info-box">
          <span className="icon">ℹ️</span>
          <div style={{margin:"0px"}} className="content">
            <strong>Store owner will also receive emails</strong>
            <p>
              We'll still send essential notifications to the store owner. Your
              email will receive developer-specific communications.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "24px",
          }}
        >
          <button className="btn btn-ghost" onClick={handleBack}>
            ← Back
          </button>
          <button
            className="btn btn-primary"
            onClick={handleDeveloperDetailsNext}
            style={{ width: "auto" }}
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // 3. Developer Intent (Screen 1.2)
  if (subStep === "intent") {
    return (
      <div className="step-container">
        <style>{styles}</style>
        <div className="mock-title">🎯 What's your goal today?</div>
        <div className="mock-subtitle">
          This helps us tailor the setup experience for you.
        </div>

        <div className="option-cards">
          {/* Client Option */}
          <div
            className={`option-card ${data.developerIntent === "client" ? "selected" : ""}`}
            onClick={() => handleIntentSelect("client")}
          >
            <div className="icon">🔧</div>
            <h5>Setting up for a client</h5>
            <p>I'll configure Custlo and hand it over to the store owner.</p>

            {data.developerIntent === "client" && (
              <button
                className="btn btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleIntentNext();
                }}
              >
                Continue →
              </button>
            )}
          </div>

          {/* Testing Option */}
          <div
            className={`option-card ${data.developerIntent === "testing" ? "selected" : ""}`}
            onClick={() => handleIntentSelect("testing")}
          >
            <div className="icon">🧪</div>
            <h5>Just testing / exploring</h5>
            <p>I want to see the features before recommending to clients.</p>

            {data.developerIntent === "testing" && (
              <button
                className="btn btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleIntentNext();
                }}
              >
                Continue →
              </button>
            )}
          </div>
        </div>

        <div style={{ marginTop: "24px" }}>
          <button className="btn btn-ghost" onClick={handleBack}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return null;
}
