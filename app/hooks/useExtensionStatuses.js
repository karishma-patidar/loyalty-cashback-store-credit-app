import { useState, useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

export function useExtensionStatuses(isNewCustomerAccounts) {
  const shopify = useAppBridge();
  const [themeAppExtensionExists, setThemeAppExtensionExists] = useState({
    customForm: null,
    cashbackOffer: null,
    themeActivations: [],
    loaded: false,
  });

  useEffect(() => {
    let active = true;

    async function fetchStatuses() {
      try {
        const extensions = await shopify.app.extensions();
        const themeExt = extensions.find((e) => e.type === "theme_app_extension");
        
        // Support custom-from handle and local block handles (credit_block, loyalty_credit_app_embed)
        const customForm = themeExt?.activations?.find(
          (e) => e.handle === "custom-from" || e.handle === "credit_block" || e.handle === "loyalty_credit_app_embed"
        );

        // cashbackOffer (support cashback-offer and cashback_notification handles)
        const cashbackOffer = isNewCustomerAccounts
          ? themeExt?.activations?.find((e) => e.handle === "cashback-offer" || e.handle === "cashback_notification")
          : null;

        if (active) {
          setThemeAppExtensionExists({
            customForm: customForm?.status ?? null,
            cashbackOffer: isNewCustomerAccounts ? (cashbackOffer?.status ?? null) : null,
            themeActivations: themeExt?.activations || [],
            loaded: true,
          });
        }
      } catch (err) {
        console.error("[useExtensionStatuses]", err);
        if (active) {
          setThemeAppExtensionExists((prev) => ({ ...prev, loaded: true }));
        }
      }
    }

    fetchStatuses();

    return () => {
      active = false;
    };
  }, [isNewCustomerAccounts, shopify]);

  return themeAppExtensionExists;
}
