import { render } from "preact";
import { useState, useEffect } from "preact/hooks";

export default () => {
  render(<Extension />, document.body);
};

const API_VERSION = "2026-04";

function Extension() {
  const order = shopify.order.value;

  const [message, setMessage] = useState("");
  const [translations, setTranslations] = useState(null);
  const [tone, setTone] = useState(/** @type {"info" | "success" } */("info"));
  const [langCode, setLangCode] = useState(
    shopify.localization?.language?.value?.isoCode?.toLowerCase() || "en"
  );

  const replacePlaceholders = (text, amount, currency) => {
    return (text || "").replace(
      "{loyalty_credit_amount}",
      `${amount} ${currency}`
    );
  };

  // Get active language code dynamically
  useEffect(() => {
    if (!shopify.localization?.language?.subscribe) return;
    const unsubscribe = shopify.localization.language.subscribe((lang) => {
      if (lang?.isoCode) {
        setLangCode(lang.isoCode.toLowerCase());
      }
    });
    return () => unsubscribe();
  }, []);

  // Get shop translations metafield
  useEffect(() => {
    shopify
      .query(`
        query {
          shop {
            metafield(
              namespace: "loyalty_cashback_app"
              key: "translations"
            ) {
              value
            }
          }
        }
      `)
      .then((/** @type {any} */ response) => {
        const { data } = response;
        console.log("Shop Data:", data);

        const val = data?.shop?.metafield?.value;
        if (val) {
          try {
            setTranslations(JSON.parse(val));
          } catch (e) {
            console.error("Error parsing translations:", e);
          }
        }
      })
      .catch(console.error);
  }, []);

  // Get order metafield
  useEffect(() => {
    if (!order?.id) return;

    let isMounted = true;
    let timeoutId;

    async function getOrderData() {
      try {
        const response = await fetch(
          `shopify://customer-account/api/${API_VERSION}/graphql.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: `
                query {
                  order(id: "${order.id}") {
                    metafield(
                      namespace: "loyalty_cashback_app"
                      key: "cashback_notify"
                    ) {
                      value
                    }
                  }
                }
              `,
            }),
          }
        );

        const { data } = await response.json();

        const metafieldValue = data?.order?.metafield?.value;

        if (!metafieldValue) {
          if (isMounted) timeoutId = setTimeout(getOrderData, 5000);
          return;
        }

        const eventData = JSON.parse(metafieldValue);
        const eventKeys = eventData ? Object.keys(eventData) : [];
        const firstKey = eventKeys[0];
        const isGrouped = firstKey && eventData[firstKey] && typeof eventData[firstKey] === "object";
        const currencyData = isGrouped ? eventData[firstKey] : eventData;

        const amount = currencyData?.issuedAmount || 0;
        const currency = currencyData?.currency || firstKey || "";
        const status = currencyData?.status || "Pending";

        const defaultLocale = (translations?.defaultLocale || translations?._defaultLocale || "en").toLowerCase();
        const defaultBaseLocale = defaultLocale.split("-")[0];
        const baseLang = langCode.split("-")[0];

        if (status === "Completed") {
          const rawTemplate = translations?.[langCode]?.widget_completed_msg ||
            translations?.[baseLang]?.widget_completed_msg ||
            translations?.[defaultLocale]?.widget_completed_msg ||
            translations?.[defaultBaseLocale]?.widget_completed_msg ||
            "🎁 You've earned {loyalty_credit_amount} for your recent order. Use it on your next purchase to save more!";
          const msg = replacePlaceholders(rawTemplate, amount, currency);

          if (isMounted) {
            setMessage(msg);
            setTone("success");
          }
          // Stop polling once Completed
        } else {
          const rawTemplate = translations?.[langCode]?.widget_pending_msg ||
            translations?.[baseLang]?.widget_pending_msg ||
            translations?.[defaultLocale]?.widget_pending_msg ||
            translations?.[defaultBaseLocale]?.widget_pending_msg ||
            "Thank you for your purchase! 🎉 You'll earn {loyalty_credit_amount} once your order is fulfilled. Use it on your next purchase to save more!";
          const msg = replacePlaceholders(rawTemplate, amount, currency);

          if (isMounted) {
            setMessage(msg);
            setTone("info");
            // Continue polling every 5 seconds if Pending
            timeoutId = setTimeout(getOrderData, 5000);
          }
        }
      } catch (error) {
        console.error(error);
        if (isMounted) timeoutId = setTimeout(getOrderData, 5000);
      }
    }

    getOrderData();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [order?.id, translations, langCode]);

  if (!message) {
    return null;
  }

  return (
    <s-banner
      tone={tone}
      heading={message}
    />
  );
}