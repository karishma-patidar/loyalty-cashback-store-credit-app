import { RadioButton, Button, BlockStack, InlineStack, Text } from "@shopify/polaris";
import { useState } from "react";

export default function StepDeveloperIntent({
  data,
  updateData,
  nextStep,
  prevStep,
  isFirst,
}) {
  const [value, setValue] = useState(data.developerIntent || "");
  const [error, setError] = useState("");

  const handleContinue = () => {
    if (!value) {
      setError("Please select your intent");
      return;
    }
    setError("");
    updateData({ developerIntent: value });
    nextStep();
  };

  return (
    <BlockStack gap="500">
      <BlockStack gap="200">
        <Text variant="headingLg" as="h1">
          What's your goal today?
        </Text>
        <Text variant="bodyMd" tone="subdued">
          This helps us tailor the setup experience
        </Text>
      </BlockStack>

      <BlockStack gap="300">
        <RadioButton
          label="Setting up for a client"
          helpText="I'm configuring this for a client's store"
          checked={value === "client"}
          onChange={() => {
            setValue("client");
            setError("");
          }}
        />

        <RadioButton
          label="Just testing"
          helpText="I'm exploring the app's features"
          checked={value === "testing"}
          onChange={() => {
            setValue("testing");
            setError("");
          }}
        />
      </BlockStack>

      {error && (
        <Text variant="bodyMd" tone="critical">
          {error}
        </Text>
      )}

      <InlineStack align="space-between" gap="300">
        <Button onClick={prevStep}>Back</Button>
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
