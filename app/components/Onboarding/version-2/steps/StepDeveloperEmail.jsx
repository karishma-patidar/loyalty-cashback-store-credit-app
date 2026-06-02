import { TextField, Button, BlockStack, InlineStack, Text } from "@shopify/polaris";
import { useState } from "react";

export default function StepDeveloperEmail({
  data,
  updateData,
  nextStep,
  prevStep,
  isFirst,
}) {
  const [form, setForm] = useState({
    name: data.developerName || "",
    email: data.developerEmail || "",
    company: data.developerCompany || "",
  });

  const [errors, setErrors] = useState({
    name: "",
    email: "",
  });

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleContinue = () => {
    const newErrors = {
      name: "",
      email: "",
    };

    if (!form.name.trim()) {
      newErrors.name = "Developer name is required";
    }

    if (!form.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(form.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    setErrors(newErrors);

    // Check if there are any errors
    if (newErrors.name || newErrors.email) {
      return;
    }

    // All valid, proceed
    updateData({
      developerName: form.name,
      developerEmail: form.email,
      developerCompany: form.company,
    });
    nextStep();
  };

  return (
    <BlockStack gap="500">
      <BlockStack gap="200">
        <Text variant="headingLg" as="h1">
          Developer Information
        </Text>
        <Text variant="bodyMd" tone="subdued">
          We'll use this to keep you updated on the setup progress
        </Text>
      </BlockStack>

      <BlockStack gap="400">
        <TextField
          label="Developer Name"
          value={form.name}
          onChange={(v) => {
            setForm({ ...form, name: v });
            setErrors({ ...errors, name: "" });
          }}
          error={errors.name}
          autoComplete="name"
          requiredIndicator
        />

        <TextField
          label="Email Address"
          type="email"
          value={form.email}
          onChange={(v) => {
            setForm({ ...form, email: v });
            setErrors({ ...errors, email: "" });
          }}
          error={errors.email}
          autoComplete="email"
          requiredIndicator
        />

        <TextField
          label="Company Name"
          value={form.company}
          onChange={(v) => setForm({ ...form, company: v })}
          autoComplete="organization"
          helpText="Optional - helps us understand your use case"
        />
      </BlockStack>

      <InlineStack align="space-between" gap="300">
        <Button onClick={prevStep}>Back</Button>
        <Button
          variant="primary"
          onClick={handleContinue}
          disabled={!form.name.trim() || !form.email.trim()}
        >
          Continue
        </Button>
      </InlineStack>
    </BlockStack>
  );
}
