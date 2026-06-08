import { useState, useEffect, useCallback, useRef } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

export default function TranslationTab({ loaderData }) {
  const shopify = useAppBridge();
  const fetcher = useFetcher();

  const shopLocales = loaderData.shopLocales || [];
  const primaryLocale = loaderData.primaryLocale || "en";
  const publishedLocales = shopLocales.filter((l) => l.published);
  const showLanguageSwitcher = publishedLocales.length > 1;

  const [selectedTranslationTabId, setSelectedTranslationTabId] = useState("customer_account");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState(primaryLocale);

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
    custom_msg_description: loaderData.activeCustomProgram?.description || "Earn 10 undefined store credit on successful signup.",
  });

  // Ensure selected tab resets if changing language hides the current tab
  useEffect(() => {
    if (selectedLocale === primaryLocale && (selectedTranslationTabId === "cashback" || selectedTranslationTabId === "custom_program")) {
      setSelectedTranslationTabId("customer_account");
    }
  }, [selectedLocale, primaryLocale, selectedTranslationTabId]);

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

  const baseTabs = [
    { id: "customer_account", label: "Customer account" },
    { id: "checkout_extension", label: "Checkout extension" },
  ];

  const translationTabs = selectedLocale !== primaryLocale ? [
    { id: "cashback", label: "Cashback" },
    { id: "custom_program", label: "Custom program" },
    ...baseTabs,
  ] : baseTabs;

  const renderField = (label, key) => (
    <div style={{ marginBottom: "20px" }} key={key}>
      {selectedLocale !== primaryLocale ? (
        <div style={{ display: "flex", gap: "16px", alignItems: "stretch" }}>
          {/* Left Side */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <s-text color="subdued" variant="bold" style={{ display: "block", marginBottom: "8px" }}>{label}</s-text>
            <div style={{ flex: 1, backgroundColor: "#F4F6F8", padding: "8px 12px", border: "1px solid #E4E8EC", borderRadius: "6px", color: "#637381", fontSize: "14px", display: "flex", alignItems: "flex-start", whiteSpace: "pre-wrap" }}>
              {primaryFormState[key]}
            </div>
          </div>
          
          {/* Arrow */}
          <div style={{ flex: "0 0 auto", color: "#8c9196", display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "28px" }}>
            <svg viewBox="0 0 20 20" style={{ width: '20px', height: '20px', fill: 'currentColor' }}>
              <path d="M10.707 15.707a1 1 0 01-1.414-1.414L12.586 11H3a1 1 0 110-2h9.586L9.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5z" />
            </svg>
          </div>
          
          {/* Right Side */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <s-text color="subdued" variant="bold" style={{ display: "block", marginBottom: "8px" }}>{label}</s-text>
            <textarea
              style={{
                flex: 1,
                width: "100%",
                border: "1px solid #c9cccf",
                borderRadius: "6px",
                padding: "8px 12px",
                fontSize: "14px",
                color: "#202223",
                resize: "none",
                outline: "none",
                backgroundColor: "#ffffff",
                boxSizing: "border-box"
              }}
              value={formState[key] || ""}
              onInput={(e) => handleFieldChange(key, e.target.value)}
            />
          </div>
        </div>
      ) : (
        <>
          <s-text color="subdued" variant="bold" style={{ display: "block", marginBottom: "8px" }}>{label}</s-text>
          <s-text-field
            type="text"
            value={formState[key] || ""}
            onInput={(e) => handleFieldChange(key, e.target.value)}
          />
        </>
      )}
    </div>
  );

  return (
    <s-box className="pb-12">
      <s-box className="max-w-[800px] mx-auto">
        <s-stack gap="base" direction="block">
          <s-stack direction="inline" justifyContent="space-between" alignment="center">
            {/* <s-heading variant="headingLg" className="font-bold">
              Translations
            </s-heading> */}

            <s-stack direction="inline" gap="base" className="bg-[#F4F6F8] p-1 rounded-lg border border-[#E4E8EC]">
              {translationTabs.map((tab) => (
                <s-button
                  key={tab.id}
                  variant={selectedTranslationTabId === tab.id ? "secondary" : "tertiary"}
                  onClick={() => setSelectedTranslationTabId(tab.id)}
                  className={selectedTranslationTabId === tab.id ? "font-bold text-black" : "text-gray-500"}
                >
                  {tab.label}
                </s-button>
              ))}
            </s-stack>
          </s-stack>

          <ui-save-bar id="translations-save-bar" open={isDirty ? "true" : undefined}>
            <button variant="primary" onClick={handleSave} loading={isSubmitting ? "true" : undefined} disabled={isSubmitting}>
              Save
            </button>
            <button onClick={handleDiscard} disabled={isSubmitting}>
              Discard
            </button>
          </ui-save-bar>

          {showLanguageSwitcher && (
            <s-box className="mb-6">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: "600", fontSize: "14px", color: "#202223" }}>
                    {publishedLocales.find(l => l.locale === primaryLocale)?.name || "English"}
                  </span>
                  <span style={{ backgroundColor: "#E4E8EC", padding: "2px 8px", borderRadius: "12px", fontSize: "12px", color: "#5c5f62" }}>
                    Default
                  </span>
                </div>

                <div style={{ color: "#8c9196", display: "flex", alignItems: "center" }}>
                  <svg viewBox="0 0 20 20" style={{ width: '16px', height: '16px', fill: 'currentColor' }}>
                    <path d="M10.707 15.707a1 1 0 01-1.414-1.414L12.586 11H3a1 1 0 110-2h9.586L9.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5z" />
                  </svg>
                </div>

                <select
                  value={selectedLocale}
                  onChange={(e) => handleLocaleChange(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #c9cccf",
                    backgroundColor: "#fff",
                    fontSize: "14px",
                    color: "#202223",
                    cursor: "pointer",
                    outline: "none"
                  }}
                >
                  {publishedLocales.map(l => (
                    <option key={l.locale} value={l.locale}>
                      {l.name === 'English' ? 'English' : l.name}
                    </option>
                  ))}
                </select>
              </div>
            </s-box>
          )}

          <div style={{ backgroundColor: "#fff5cc", padding: "12px", borderRadius: "8px", border: "1px solid #ffe066", marginBottom: "24px" }}>
            <s-text color="warning"><strong>Warning:</strong> Only translate text outside the curly brackets {`{}`}. Variables like {`{loyalty_credit_amount}`} must remain intact.</s-text>
          </div>

          {/* CASHBACK TAB */}
          {selectedTranslationTabId === "cashback" && selectedLocale !== primaryLocale && (
            <s-stack direction="block" gap="base">
              <s-section>
                <s-box padding="5">
                  <s-stack direction="block" gap="base">
                    <s-heading variant="headingSm" className="font-bold text-[16px] text-gray-800">
                      Cashback program
                    </s-heading>
                    {renderField("Promotion message on product page", "cashback_msg_product")}
                    {renderField("Promotion message on cart page", "cashback_msg_cart")}
                  </s-stack>
                </s-box>
              </s-section>
            </s-stack>
          )}

          {/* CUSTOM PROGRAM TAB */}
          {selectedTranslationTabId === "custom_program" && selectedLocale !== primaryLocale && (
            <s-stack direction="block" gap="base">
              <s-section>
                <s-box padding="5">
                  <s-stack direction="block" gap="base">
                    <s-heading variant="headingSm" className="font-bold text-[16px] text-gray-800">
                      Custom program
                    </s-heading>
                    {renderField("Description for customers", "custom_msg_description")}
                  </s-stack>
                </s-box>
              </s-section>
            </s-stack>
          )}

          {/* CUSTOMER ACCOUNT TAB */}
          {selectedTranslationTabId === "customer_account" && (
            <s-stack direction="block" gap="base">
              <s-section>
                <s-box padding="5">
                  <s-stack direction="block" gap="base">
                    <s-heading variant="headingSm" className="font-bold text-[16px] text-gray-800">
                      Cashback notification
                    </s-heading>
                    {renderField("Pending message", "widget_pending_msg")}
                    {renderField("Completed message", "widget_completed_msg")}
                  </s-stack>
                </s-box>
              </s-section>

              <s-section>
                <s-box padding="5">
                  <s-stack direction="block" gap="base">
                    <s-heading variant="headingSm" className="font-bold text-[16px] text-gray-800">
                      Store credit history
                    </s-heading>
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
                  </s-stack>
                </s-box>
              </s-section>
            </s-stack>
          )}

          {/* CHECKOUT EXTENSION TAB */}
          {selectedTranslationTabId === "checkout_extension" && (
            <s-stack direction="block" gap="base">
              <s-section>
                <s-box padding="5">
                  <s-stack direction="block" gap="base">
                    <s-heading variant="headingSm" className="font-bold text-[16px] text-gray-800">
                      Balance widget
                    </s-heading>
                    {renderField("Promotion message", "widget_promotion_msg")}
                    {renderField("Expired message", "widget_expired_msg")}
                  </s-stack>
                </s-box>
              </s-section>
            </s-stack>
          )}
        </s-stack>
      </s-box>
    </s-box>
  );
}
