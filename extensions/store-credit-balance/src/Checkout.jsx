import '@shopify/ui-extensions/preact';
import { render } from "preact";
import { useState, useEffect } from "preact/hooks";

// 1. Export the extension
export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const isEditor = !!shopify.extension?.editor;
  const customer = shopify.buyerIdentity?.customer.value;
  console.log(customer);

  // Configuration and Data States
  const [isLoading, setIsLoading] = useState(true);
  const [shopDomain, setShopDomain] = useState("");
  const [customerId, setCustomerId] = useState(
    shopify.buyerIdentity?.customer?.value?.id || ""
  );
  const [appUrl, setAppUrl] = useState("");
  const [translationsMeta, setTranslationsMeta] = useState(/** @type {any} */({}));
  const [langCode, setLangCode] = useState(
    shopify.localization?.language?.value?.isoCode?.toLowerCase() || "en"
  );

  // Balance States
  const [balanceAmount, setBalanceAmount] = useState(0.00);
  const [expiringAmount, setExpiringAmount] = useState(0.00);
  const [activeCurrency, setActiveCurrency] = useState("USD");

  // Expiry range days setting
  const [expiryRangeDays, setExpiryRangeDays] = useState(() => {
    return Number(shopify.settings?.value?.expiry_range_days) > 0
      ? Number(shopify.settings.value.expiry_range_days)
      : 3;
  });

  // Subscribe to buyerIdentity customer changes
  useEffect(() => {
    if (shopify.buyerIdentity?.customer?.subscribe) {
      const unsubscribeCustomer = shopify.buyerIdentity.customer.subscribe((customer) => {
        setCustomerId(customer?.id || "");
      });
      return () => unsubscribeCustomer();
    }
  }, []);

  // Subscribe to locale/language changes
  useEffect(() => {
    if (shopify.localization?.language?.subscribe) {
      const unsubscribeLanguage = shopify.localization.language.subscribe((lang) => {
        if (lang?.isoCode) {
          setLangCode(lang.isoCode.toLowerCase());
        }
      });
      return () => unsubscribeLanguage();
    }
  }, []);

  // Subscribe to extension settings changes
  useEffect(() => {
    if (shopify.settings?.subscribe) {
      const unsubscribeSettings = shopify.settings.subscribe((settings) => {
        setExpiryRangeDays(Number(settings?.expiry_range_days) > 0 ? Number(settings.expiry_range_days) : 3);
      });
      return () => unsubscribeSettings();
    }
  }, []);

  // Fetch shop config and translation metafields via storefront GraphQL API
  useEffect(() => {
    shopify.query(`
      query {
        shop {
          primaryDomain {
            host
          }
          app_url: metafield(namespace: "loyalty_cashback_app", key: "app_url") {
            value
          }
          translations: metafield(namespace: "loyalty_cashback_app", key: "translations") {
            value
          }
        }
      }
    `).then((response) => {
      const shopData = response?.data?.shop;
      const fetchedHost = shopData?.primaryDomain?.host || "loyalty-store-credit.myshopify.com";
      setShopDomain(fetchedHost);

      const appUrlVal = shopData?.app_url?.value || "https://kodak-pensions-jones-antiques.trycloudflare.com";
      setAppUrl(appUrlVal);

      let parsedTranslations = {};
      try {
        if (shopData?.translations?.value) {
          parsedTranslations = JSON.parse(shopData.translations.value);
        }
      } catch (err) {
        console.error("Error parsing translations metafield in checkout extension:", err);
      }
      setTranslationsMeta(parsedTranslations);
    }).catch((err) => {
      console.error("Storefront GraphQL API error in checkout extension:", err);
    });
  }, []);

  // Fetch dynamic customer store credit data from backend
  useEffect(() => {
    if (!appUrl || !customerId || !shopDomain) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    async function fetchStoreCreditData() {
      try {
        setIsLoading(true);
        const response = await fetch(`${appUrl}/api/store-credit?shop=${shopDomain}&customerId=${customerId}`);
        const data = await response.json();

        if (isMounted && data) {
          const currencyVal = data.currency || "USD";
          setActiveCurrency(currencyVal);

          let parsedBalance = 0.00;
          if (data.balances && data.balances[currencyVal] !== undefined) {
            parsedBalance = parseFloat(data.balances[currencyVal]);
          } else if (data.balance !== undefined) {
            parsedBalance = parseFloat(data.balance);
          }
          setBalanceAmount(parsedBalance);

          // Calculate expiring amount using transactions data and settings expiryRangeDays
          const now = new Date();
          const expiryRangeEnd = new Date(now.getTime() + expiryRangeDays * 24 * 60 * 60 * 1000);

          const txs = data.transactions || [];
          const currencyFiltered = txs.filter(t => t.currencyCode === currencyVal);
          const expAmount = currencyFiltered
            .filter(t => t.type === "credit" && t.expiresAt && new Date(t.expiresAt) > now && new Date(t.expiresAt) <= expiryRangeEnd)
            .reduce((sum, t) => sum + (t.remainingAmount !== null ? parseFloat(t.remainingAmount) : parseFloat(t.amount)), 0);

          setExpiringAmount(expAmount);
        }
      } catch (err) {
        console.error("Error fetching checkout customer store credit:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchStoreCreditData();
    return () => { isMounted = false; };
  }, [appUrl, customerId, shopDomain, expiryRangeDays]);

  // Handle locale translation helper
  const t = (key, replacements = {}) => {
    const defaultLocale = (translationsMeta?.defaultLocale || translationsMeta?._defaultLocale || "en").toLowerCase();
    const defaultBaseLocale = defaultLocale.split("-")[0];
    const currentLang = langCode.toLowerCase();
    const baseLang = currentLang.split("-")[0];

    let val = "";
    if (translationsMeta?.[currentLang]?.[key] !== undefined && translationsMeta?.[currentLang]?.[key] !== "") {
      val = translationsMeta[currentLang][key];
    } else if (translationsMeta?.[baseLang]?.[key] !== undefined && translationsMeta?.[baseLang]?.[key] !== "") {
      val = translationsMeta[baseLang][key];
    } else if (translationsMeta?.[defaultLocale]?.[key] !== undefined && translationsMeta?.[defaultLocale]?.[key] !== "") {
      val = translationsMeta[defaultLocale][key];
    } else if (translationsMeta?.[defaultBaseLocale]?.[key] !== undefined && translationsMeta?.[defaultBaseLocale]?.[key] !== "") {
      val = translationsMeta[defaultBaseLocale][key];
    } else {
      const fallbacks = {
        widget_promotion_msg: "You have {balance} store credit. Apply it now!",
        widget_expired_msg: "{expired_amount} will expire soon.",
        widget_available_credit: "Available Store Credits",
        widget_editor_preview_msg: "Editor mode: This is a preview of the Store credit balance.",
      };
      val = fallbacks[key] || "";
    }

    let result = val;
    Object.keys(replacements).forEach((k) => {
      result = result.replace(`{${k}}`, replacements[k]);
    });
    return result;
  };

  // Helper to format currency
  const formatCurrency = (amount, currencyCode) => {
    try {
      return shopify.i18n.formatCurrency(Number(amount || 0), { currency: currencyCode });
    } catch (e) {
      const currencySymbols = {
        INR: "₹",
        USD: "$",
        CAD: "C$",
        AUD: "A$",
        GBP: "£",
        EUR: "€",
        JPY: "¥",
      };
      const symbol = currencySymbols[currencyCode] || currencyCode || "$";
      return `${symbol}${Number(amount || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
  };

  // Utility to split text by placeholder and inject a bold wrapper for the value
  const renderTranslatedText = (template, placeholder, replacementElement) => {
    if (!template || !template.includes(`{${placeholder}}`)) {
      return template;
    }
    const parts = template.split(`{${placeholder}}`);
    return (
      <>
        {parts[0]}
        {replacementElement}
        {parts[1]}
      </>
    );
  };

  // Render skeleton loading state while fetching API data
  if (isLoading && (customerId || isEditor)) {
    return (
      <s-stack gap="none">
        {isEditor && (
          <s-banner
            tone="warning"
            heading={t("widget_editor_preview_msg")}
          />
        )}
        <s-box background="subdued" borderRadius="large" padding="base">
          <s-stack direction="inline" gap="base" alignItems="center">
            {/* Circular skeleton for the credit icon */}
            <s-box background="base" borderRadius="large" inlineSize="36px" blockSize="36px" />

            {/* Skeleton lines for text details */}
            <s-stack gap="small-200">
              {/* Title / promotion message skeleton */}
              <s-box background="base" borderRadius="base" inlineSize="200px" blockSize="12px" />
              {/* Expiry message skeleton */}
              <s-box background="base" borderRadius="base" inlineSize="120px" blockSize="12px" />
            </s-stack>
          </s-stack>
        </s-box>
      </s-stack>
    );
  }

  // Check display conditions
  // If not in editor and customer is logged out OR has no store credit, hide block completely.
  if (!isEditor && (!customerId || balanceAmount <= 0)) {
    return null;
  }

  // Handle mock data for Editor mode preview
  const previewBalance = (!customerId || balanceAmount <= 0) && isEditor ? 100.00 : balanceAmount;
  const previewExpiry = (!customerId || balanceAmount <= 0) && isEditor ? 10.00 : expiringAmount;
  const previewCurrency = (!customerId || balanceAmount <= 0) && isEditor ? "USD" : activeCurrency;

  const formattedBalance = formatCurrency(previewBalance, previewCurrency);
  const formattedExpiry = formatCurrency(previewExpiry, previewCurrency);

  const promotionTemplate = t("widget_promotion_msg");
  const expiryTemplate = t("widget_expired_msg");

  return (
    <s-stack gap="none">
      {/* 1. Preview Mode warning banner shown only in the checkout editor */}
      {isEditor && (
        <s-banner
          tone="warning"
          heading={t("widget_editor_preview_msg")}
        />
      )}

      {/* 2. Main Store Credit Balance Info Card */}
      <s-box background="subdued" borderRadius="large" padding="base">
        <s-stack direction="inline" gap="base" alignItems="center">
          {/* Credit Coin Icon on the left */}
          <s-box inlineSize="32px" blockSize="32px">
            <s-image
              src="https://cdn.getkoin.io/sdk/coin-crown-icon.svg"
              alt="Store Credit Icon"
              inlineSize="fill"
              aspectRatio="1"
            />
          </s-box>

          {/* Balance and Expiry Details on the right */}
          <s-stack gap="small-400">
            <s-text>
              {renderTranslatedText(
                promotionTemplate,
                "balance",
                <s-text type="strong">{formattedBalance}</s-text>
              )}
            </s-text>
            {previewExpiry > 0 && (
              <s-text tone="warning">
                {renderTranslatedText(
                  expiryTemplate,
                  "expired_amount",
                  <s-text type="strong">{formattedExpiry}</s-text>
                )}
              </s-text>
            )}
          </s-stack>
        </s-stack>
      </s-box>
    </s-stack>
  );
}