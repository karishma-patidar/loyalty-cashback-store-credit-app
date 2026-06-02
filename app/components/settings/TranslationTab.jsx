import { useState, useEffect, useCallback, useRef } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

export default function TranslationTab({ loaderData }) {
  const shopify = useAppBridge();
  const fetcher = useFetcher();

  const [selectedTranslationTab, setSelectedTranslationTab] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formState, setFormState] = useState({
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
  });

  const [initialFormState, setInitialFormState] = useState(
    JSON.stringify({
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
    })
  );

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
      if (fetcher.data.success) {
        shopify.toast.show("Translations updated!");
        setInitialFormState(currentFormStateRef.current);
      } else {
        shopify.toast.show(
          fetcher.data.errors?.[0]?.message || "Error saving translations",
          { isError: true }
        );
      }
    }
  }, [fetcher.state, fetcher.data, shopify]);

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
      },
      { method: "POST", encType: "application/json" }
    );
  }, [fetcher, loaderData.shopId, formState]);

  const handleDiscard = useCallback(() => {
    const initial = JSON.parse(initialFormState);
    setFormState(initial);
  }, [initialFormState]);

  const translationTabs = [
    { id: 0, label: "Customer account" },
    { id: 1, label: "Checkout extension" },
  ];

  return (
    <s-box className="pb-12">
      <s-box className="max-w-[800px] mx-auto">
        <s-stack gap="base" direction="block">
          <s-stack direction="inline" justifyContent="space-between" alignment="center">
            <s-heading variant="headingLg" className="font-bold">
              Translations
            </s-heading>

            <s-stack direction="inline" gap="base" className="bg-[#F4F6F8] p-1 rounded-lg border border-[#E4E8EC]">
              {translationTabs.map((tab) => (
                <s-button
                  key={tab.id}
                  variant={selectedTranslationTab === tab.id ? "secondary" : "tertiary"}
                  onClick={() => setSelectedTranslationTab(tab.id)}
                  className={selectedTranslationTab === tab.id ? "font-bold text-black" : "text-gray-500"}
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

          {/* CUSTOMER ACCOUNT TAB */}
          {selectedTranslationTab === 0 && (
            <s-stack direction="block" gap="base">
              <s-section>
                <s-box padding="5">
                  <s-stack direction="block" gap="base">
                    <s-heading variant="headingSm" className="font-bold text-[16px] text-gray-800">
                      Cashback notification
                    </s-heading>
                    <s-stack direction="block" gap="tight">
                      <s-text color="subdued" variant="bold">Pending message</s-text>
                      <s-text-field type="text" value={formState.widget_pending_msg} onInput={(e) => handleFieldChange("widget_pending_msg", e.target.value)} />
                    </s-stack>
                    <s-stack direction="block" gap="tight">
                      <s-text color="subdued" variant="bold">Completed message</s-text>
                      <s-text-field type="text" value={formState.widget_completed_msg} onInput={(e) => handleFieldChange("widget_completed_msg", e.target.value)} />
                    </s-stack>
                  </s-stack>
                </s-box>
              </s-section>

              <s-section>
                <s-box padding="5">
                  <s-stack direction="block" gap="base">
                    <s-heading variant="headingSm" className="font-bold text-[16px] text-gray-800">
                      Store credit history
                    </s-heading>
                    <s-stack direction="block" gap="tight">
                      <s-text color="subdued" variant="bold">Store credit history table title</s-text>
                      <s-text-field type="text" value={formState.widget_history_title} onInput={(e) => handleFieldChange("widget_history_title", e.target.value)} />
                    </s-stack>
                    <s-stack direction="block" gap="tight">
                      <s-text color="subdued" variant="bold">All transactions label</s-text>
                      <s-text-field type="text" value={formState.widget_all_transactions} onInput={(e) => handleFieldChange("widget_all_transactions", e.target.value)} />
                    </s-stack>
                    <s-stack direction="block" gap="tight">
                      <s-text color="subdued" variant="bold">Received transaction label</s-text>
                      <s-text-field type="text" value={formState.widget_received_label} onInput={(e) => handleFieldChange("widget_received_label", e.target.value)} />
                    </s-stack>
                    <s-stack direction="block" gap="tight">
                      <s-text color="subdued" variant="bold">Used transaction label</s-text>
                      <s-text-field type="text" value={formState.widget_used_label} onInput={(e) => handleFieldChange("widget_used_label", e.target.value)} />
                    </s-stack>
                    <s-stack direction="block" gap="tight">
                      <s-text color="subdued" variant="bold">Load more label</s-text>
                      <s-text-field type="text" value={formState.widget_load_more} onInput={(e) => handleFieldChange("widget_load_more", e.target.value)} />
                    </s-stack>
                    <s-stack direction="block" gap="tight">
                      <s-text color="subdued" variant="bold">Empty transaction label</s-text>
                      <s-text-field type="text" value={formState.widget_empty_transaction} onInput={(e) => handleFieldChange("widget_empty_transaction", e.target.value)} />
                    </s-stack>
                    <s-stack direction="block" gap="tight">
                      <s-text color="subdued" variant="bold">Expires on label</s-text>
                      <s-text-field type="text" value={formState.widget_expires_on} onInput={(e) => handleFieldChange("widget_expires_on", e.target.value)} />
                    </s-stack>
                    <s-stack direction="block" gap="tight">
                      <s-text color="subdued" variant="bold">Available store credit label</s-text>
                      <s-text-field type="text" value={formState.widget_available_credit} onInput={(e) => handleFieldChange("widget_available_credit", e.target.value)} />
                    </s-stack>
                    <s-stack direction="block" gap="tight">
                      <s-text color="subdued" variant="bold">Currency label</s-text>
                      <s-text-field type="text" value={formState.widget_currency_label} onInput={(e) => handleFieldChange("widget_currency_label", e.target.value)} />
                    </s-stack>
                    <s-stack direction="block" gap="tight">
                      <s-text color="subdued" variant="bold">Empty balance label</s-text>
                      <s-text-field type="text" value={formState.widget_empty_balance} onInput={(e) => handleFieldChange("widget_empty_balance", e.target.value)} />
                    </s-stack>
                    <s-stack direction="block" gap="tight">
                      <s-text color="subdued" variant="bold">Expired balance label</s-text>
                      <s-text-field type="text" value={formState.widget_expired_balance} onInput={(e) => handleFieldChange("widget_expired_balance", e.target.value)} />
                    </s-stack>
                  </s-stack>
                </s-box>
              </s-section>
            </s-stack>
          )}

          {/* CHECKOUT EXTENSION TAB */}
          {selectedTranslationTab === 1 && (
            <s-stack direction="block" gap="base">
              <s-section>
                <s-box padding="5">
                  <s-stack direction="block" gap="base">
                    <s-heading variant="headingSm" className="font-bold text-[16px] text-gray-800">
                      Balance widget
                    </s-heading>
                    <s-stack direction="block" gap="tight">
                      <s-text color="subdued" variant="bold">Promotion message</s-text>
                      <s-text-field type="text" value={formState.widget_promotion_msg} onInput={(e) => handleFieldChange("widget_promotion_msg", e.target.value)} />
                    </s-stack>
                    <s-stack direction="block" gap="tight">
                      <s-text color="subdued" variant="bold">Expired message</s-text>
                      <s-text-field type="text" value={formState.widget_expired_msg} onInput={(e) => handleFieldChange("widget_expired_msg", e.target.value)} />
                    </s-stack>
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
