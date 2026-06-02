import { RadioButton, Button, BlockStack, InlineStack, Text } from "@shopify/polaris";
import { useState } from "react";

export default function StepSetupRole({
  data,
  updateData,
  nextStep,
  prevStep,
  isFirst,
}) {
  const [value, setValue] = useState(data.setupRole || "");
  const [error, setError] = useState("");

  const handleContinue = () => {
    if (!value) {
      setError("Please select who's setting up this app");
      return;
    }
    setError("");
    updateData({ setupRole: value });
    nextStep();
  };

  return (
    <BlockStack gap="500">
      <BlockStack gap="200">
        <Text variant="headingLg" as="h1">
          👋 Welcome to Custlo!
        </Text>
        <Text variant="bodyMd" tone="subdued">
          Let's personalize your setup experience. Who's setting this up?
        </Text>
      </BlockStack>

      <BlockStack gap="300">
        <RadioButton
          label="Store Owner"
          helpText="I own or manage this store"
          checked={value === "owner"}
          onChange={() => {
            setValue("owner");
            setError("");
          }}
        />

        <RadioButton
          label="Developer / Agency"
          helpText="I'm setting this up for a client or testing"
          checked={value === "developer"}
          onChange={() => {
            setValue("developer");
            setError("");
          }}
        />
      </BlockStack>

      {error && (
        <Text variant="bodyMd" tone="critical">
          {error}
        </Text>
      )}

      <InlineStack align="end" gap="300">
        <Button
          variant="primary"
          onClick={handleContinue}
          disabled={!value}
        >
          Continue
        </Button>
      </InlineStack>
    </BlockStack>
  );
}
