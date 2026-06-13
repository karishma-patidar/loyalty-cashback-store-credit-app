import { useState, useEffect, useCallback, useRef } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  Box,
  Card,
  Tabs,
  TextField,
  Select,
  Button,
  ButtonGroup,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Banner,
  Divider
} from "@shopify/polaris";

export default function TranslationTab({ loaderData }) {
  const shopify = useAppBridge();
  const fetcher = useFetcher();

  const shopLocales = loaderData.shopLocales || [];
  const primaryLocale = loaderData.primaryLocale || "en";
  const publishedLocales = shopLocales.filter((l) => l.published);
  const hasMultipleLocales = publishedLocales.length > 1;

  const [translationMode, setTranslationMode] = useState(hasMultipleLocales ? "translation" : "default");
  const [selectedTabIndex, setSelectedTabIndex] = useState(2); // Customer account tab as default
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize selectedLocale to the first non-primary locale if in translation mode
  const initialLocale = hasMultipleLocales
    ? (publishedLocales.find((l) => l.locale !== primaryLocale)?.locale || primaryLocale)
    : primaryLocale;
  const [selectedLocale, setSelectedLocale] = useState(initialLocale);

  const [primaryFormState] = useState({
    widget_pending_msg: loaderData.widget_pending_msg,
    widget_completed_msg: loaderData.widget_completed_msg,
    widget_history_title: loaderData.widget_history_title,
    widget_all_transactions: loaderData.widget_all_transactions,
    widget_received_label: loaderData.widget_received_label,
    widget_used_label: loaderData.widget_used_label,
    widget_load_more: loaderData.widget_load_more,
    widget_empty_transaction: loaderData.widget_empty_transaction,
    widget_expires_on: loaderData.widget_expires_on,
    widget_available_credit: loaderData.widget_available_credit,
    widget_currency_label: loaderData.widget_currency_label,
    widget_empty_balance: loaderData.widget_empty_balance,
    widget_expired_balance: loaderData.widget_expired_balance,
    widget_promotion_msg: loaderData.widget_promotion_msg,
    widget_expired_msg: loaderData.widget_expired_msg,
    cashback_msg_product: loaderData.activeCashbackProgram?.msgProduct || "Receive {loyalty_credit_amount} store credit when purchasing each item.",
    cashback_msg_cart: loaderData.activeCashbackProgram?.msgCart || "You will get <strong>{loyalty_credit_amount}</strong> store credit after this purchase.",
    cashback_msg_checkout: loaderData.activeCashbackProgram?.msgCheckout || "",
    custom_msg_description: loaderData.activeCustomProgram?.description || "Earn 10 store credit on successful signup.",
  });

  const [formState, setFormState] = useState({ ...primaryFormState });
  const [initialFormState, setInitialFormState] = useState(JSON.stringify(primaryFormState));

  const isDirty = JSON.stringify(formState) !== initialFormState;

  useEffect(() => {
    if (isDirty) {
      shopify.saveBar.show("translations-save-bar");
    } else {
      shopify.saveBar.hide("translations-save-bar");
    }
  }, [isDirty, shopify]);

  const currentFormStateRef = useRef(JSON.stringify(formState));
  useEffect(() => {
    currentFormStateRef.current = JSON.stringify(formState);
  }, [formState]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      setIsSubmitting(false);
      // If we got translations payload back
      if (fetcher.data.widget_pending_msg !== undefined && fetcher.data.success === undefined) {
        setFormState(fetcher.data);
        setInitialFormState(JSON.stringify(fetcher.data));
        currentFormStateRef.current = JSON.stringify(fetcher.data);
      } else if (fetcher.data.success) {
        shopify.toast.show("Translations updated!");
        setInitialFormState(currentFormStateRef.current);
      } else if (fetcher.data.error || fetcher.data.errors) {
        shopify.toast.show(
          fetcher.data.errors?.[0]?.message || fetcher.data.error || "Error saving translations",
          { isError: true }
        );
      }
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const handleLocaleChange = useCallback((newLocale) => {
    setSelectedLocale(newLocale);
    if (newLocale === primaryLocale) {
      setFormState({ ...primaryFormState });
      setInitialFormState(JSON.stringify(primaryFormState));
      currentFormStateRef.current = JSON.stringify(primaryFormState);
    } else {
      fetcher.load(`?action=fetchTranslations&locale=${newLocale}`);
    }
  }, [primaryLocale, primaryFormState, fetcher]);

  const handleFieldChange = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = useCallback(() => {
    setIsSubmitting(true);
    fetcher.submit(
      {
        actionType: "saveTranslations",
        shopId: loaderData.shopId,
        fields: formState,
        locale: selectedLocale === primaryLocale ? "" : selectedLocale,
      },
      { method: "POST", encType: "application/json" }
    );
  }, [fetcher, loaderData.shopId, formState, selectedLocale, primaryLocale]);

  const handleDiscard = useCallback(() => {
    const initial = JSON.parse(initialFormState);
    setFormState(initial);
  }, [initialFormState]);

  const translationTabs = [
    { id: "cashback", content: "Cashback", panelID: "cashback-panel", disabled: translationMode === "default" },
    { id: "custom_program", content: "Custom program", panelID: "custom-program-panel", disabled: translationMode === "default" },
    { id: "customer_account", content: "Customer account", panelID: "customer-account-panel" },
    { id: "checkout_extension", content: "Checkout extension", panelID: "checkout-extension-panel" },
  ];

  const handleTabChange = useCallback(
    (index) => {
      setSelectedTabIndex(index);
    },
    []
  );

  const activeTabId = translationTabs[selectedTabIndex]?.id;

  const renderField = (label, key) => {
    const isMultiline = [
      "widget_pending_msg",
      "widget_completed_msg",
      "cashback_msg_product",
      "cashback_msg_cart",
      "custom_msg_description"
    ].includes(key);

    const isTranslationMode = selectedLocale !== primaryLocale;
    const multilineProps = (isMultiline || isTranslationMode) ? { multiline: 3 } : {};

    if (selectedLocale !== primaryLocale) {
      return (
        <Box key={key}>
          <InlineStack gap="400" blockAlign="center" wrap={false} className="translation-row">
            {/* Left Side */}
            <div style={{ flex: 1 }}>
              <TextField
                label={label}
                value={primaryFormState[key] || ""}
                readOnly
                {...multilineProps}
                autoComplete="off"
              />
            </div>

            <s-icon type="arrow-right"></s-icon>

            {/* Right Side */}
            <div style={{ flex: 1 }}>
              <TextField
                label={label}
                value={formState[key] || ""}
                onChange={(val) => handleFieldChange(key, val)}
                {...multilineProps}
                autoComplete="off"
              />
            </div>
          </InlineStack>
        </Box>
      );
    } else {
      return (
        <TextField
          key={key}
          label={label}
          value={formState[key] || ""}
          onChange={(val) => handleFieldChange(key, val)}
          {...multilineProps}
          autoComplete="off"
        />
      );
    }
  };
  return (
    <Box paddingBlockEnd="1600">
      <div className={`translation-tab-container ${translationMode === "translation" ? "in-translation-mode" : ""}`}>
        <style>{`
          .translation-tab-container.in-translation-mode .Polaris-TextField {
            height: 90px;
          }
          .translation-tab-container.in-translation-mode .Polaris-TextField__Input {
            height: 90px !important;
            resize: none;
          }
        `}</style>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <BlockStack gap="400">

            <s-banner heading="Warning" tone="warning" dismissible>
              Only translate the text outside the curly brackets
            </s-banner>

            {/* Controls Bar */}
            <InlineStack align="space-between" blockAlign="center">
              {/* Left side: switcher */}
              <InlineStack gap="200" blockAlign="center">
                <Text variant="bodyMd" fontWeight="bold">English</Text>
                <Badge tone="subdued">Default</Badge>
                {translationMode === "translation" && (
                  <>
                    <Text tone="subdued">→</Text>
                    <Select
                      options={publishedLocales.filter(l => l.locale !== primaryLocale).map(l => ({
                        label: l.name,
                        value: l.locale,
                      }))}
                      value={selectedLocale}
                      onChange={handleLocaleChange}
                    />
                  </>
                )}
              </InlineStack>

              {/* Right side: mode switcher */}
              {hasMultipleLocales && (
                <ButtonGroup variant="segmented">
                  <Button
                    pressed={translationMode === "default"}
                    onClick={() => {
                      setTranslationMode("default");
                      handleLocaleChange(primaryLocale);
                      if (selectedTabIndex < 2) {
                        setSelectedTabIndex(2);
                      }
                    }}
                  >
                    Default Text
                  </Button>
                  <Button
                    pressed={translationMode === "translation"}
                    onClick={() => {
                      setTranslationMode("translation");
                      const firstNonPrimary = publishedLocales.find(l => l.locale !== primaryLocale)?.locale || primaryLocale;
                      handleLocaleChange(firstNonPrimary);
                    }}
                  >
                    Translation
                  </Button>
                </ButtonGroup>
              )}
            </InlineStack>

            {/* Tabs Container */}
            <Card padding="0">
              <Tabs
                tabs={translationTabs}
                selected={selectedTabIndex}
                onSelect={handleTabChange}
              >
                <Box padding="500">
                  <BlockStack gap="500">
                    {/* CASHBACK TAB */}
                    {activeTabId === "cashback" && (
                      <BlockStack gap="300">
                        <Text variant="headingSm" as="h5">Cashback program</Text>
                        {renderField("Promotion message on product page", "cashback_msg_product")}
                        {renderField("Promotion message on cart page", "cashback_msg_cart")}
                      </BlockStack>
                    )}

                    {/* CUSTOM PROGRAM TAB */}
                    {activeTabId === "custom_program" && (
                      <BlockStack gap="300">
                        <Text variant="headingSm" as="h5">Custom program</Text>
                        {renderField("Description for customers", "custom_msg_description")}
                      </BlockStack>
                    )}

                    {/* CUSTOMER ACCOUNT TAB */}
                    {activeTabId === "customer_account" && (
                      <BlockStack gap="500">
                        <BlockStack gap="300">
                          <Text variant="headingSm" as="h5">Cashback notification</Text>
                          {renderField("Pending message", "widget_pending_msg")}
                          {renderField("Completed message", "widget_completed_msg")}
                        </BlockStack>

                        <Divider />

                        <BlockStack gap="300">
                          <Text variant="headingSm" as="h5">Store credit history</Text>
                          {renderField("Store credit history table title", "widget_history_title")}
                          {renderField("All transactions label", "widget_all_transactions")}
                          {renderField("Received transaction label", "widget_received_label")}
                          {renderField("Used transaction label", "widget_used_label")}
                          {renderField("Load more label", "widget_load_more")}
                          {renderField("Empty transaction label", "widget_empty_transaction")}
                          {renderField("Expires on label", "widget_expires_on")}
                          {renderField("Available store credit label", "widget_available_credit")}
                          {renderField("Currency label", "widget_currency_label")}
                          {renderField("Empty balance label", "widget_empty_balance")}
                          {renderField("Expired balance label", "widget_expired_balance")}
                        </BlockStack>
                      </BlockStack>
                    )}

                    {/* CHECKOUT EXTENSION TAB */}
                    {activeTabId === "checkout_extension" && (
                      <BlockStack gap="300">
                        <Text variant="headingSm" as="h5">Balance widget</Text>
                        {renderField("Promotion message", "widget_promotion_msg")}
                        {renderField("Expired message", "widget_expired_msg")}
                      </BlockStack>
                    )}
                  </BlockStack>
                </Box>
              </Tabs>
            </Card>

            {/* Action Save Bar */}
            <ui-save-bar id="translations-save-bar" open={isDirty ? "true" : undefined}>
              <button variant="primary" onClick={handleSave} loading={isSubmitting ? "true" : undefined} disabled={isSubmitting}>
                Save
              </button>
              <button onClick={handleDiscard} disabled={isSubmitting}>
                Discard
              </button>
            </ui-save-bar>

          </BlockStack>
        </div>
      </div>
    </Box>
  );
}
