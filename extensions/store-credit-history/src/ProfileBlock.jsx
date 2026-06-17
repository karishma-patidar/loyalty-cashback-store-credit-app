import '@shopify/ui-extensions/preact';
import { useSettings } from '@shopify/ui-extensions/customer-account/preact';
import { render } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";

export default () => {
  render(<ProfileExtension />, document.body);
};

// Currency symbols for standard currencies
const currencySymbols = {
  INR: "₹",
  USD: "$",
  CAD: "C$",
  AUD: "A$",
  GBP: "£",
  EUR: "€",
  JPY: "¥",
};

// Helper to format currency
const formatCurrency = (amount, currencyCode) => {
  const symbol = currencySymbols[currencyCode] || currencyCode || "$";
  return `${symbol}${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

function ProfileExtension() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All"); // "All", "Received", "Used"
  const [visibleLimit, setVisibleLimit] = useState(8);
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [isLoadMoreLoading, setIsLoadMoreLoading] = useState(false);
  const settings = useSettings();
  const expiryRangeDays = Number(settings?.expiry_range_days) > 0 ? Number(settings.expiry_range_days) : 3;
  const timeoutRef = useRef(null);

  // Clear timeout and loading state when filters change
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsLoadMoreLoading(false);
  }, [activeTab, selectedCurrency]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Data State
  const [shopDomain, setShopDomain] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [storeDefaultCurrency, setStoreDefaultCurrency] = useState("USD");
  const [enabledCurrencies, setEnabledCurrencies] = useState([]);
  const [customerBalances, setCustomerBalances] = useState(/** @type {any} */({}));
  const [transactions, setTransactions] = useState([]);
  const [langCode, setLangCode] = useState(() => {
    return shopify.localization?.language?.value?.isoCode || "en";
  });
  const [translationsMeta, setTranslationsMeta] = useState(/** @type {any} */({}));

  // Fetch data from Shopify Storefront API and handle customer subscription
  useEffect(() => {
    // Get initial stateful subscription values if available
    const initialCustomer = shopify.authenticatedAccount?.customer?.value?.id;
    if (initialCustomer) {
      setCustomerId(initialCustomer);
    }

    // Subscribe to updates for the customer
    const unsubCustomer = shopify.authenticatedAccount?.customer?.subscribe?.((val) => {
      if (val?.id) {
        setCustomerId(val.id);
      }
    });

    const unsubLanguage = shopify.localization?.language?.subscribe?.((val) => {
      if (val?.isoCode) {
        setLangCode(val.isoCode);
      }
    });

    // Run GraphQL storefront query to get shop host and app url
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
    `).then((/** @type {any} */ response) => {
      const shopData = response?.data?.shop;
      const fetchedHost = shopData?.primaryDomain?.host || "loyalty-store-credit.myshopify.com";
      setShopDomain(fetchedHost);

      const appUrlVal = shopData?.app_url?.value || "https://affecting-attention-bases-keyboards.trycloudflare.com";
      setAppUrl(appUrlVal);

      let parsedTranslations = {};
      try {
        if (shopData?.translations?.value) {
          parsedTranslations = JSON.parse(shopData.translations.value);
        }
      } catch (err) {
        console.error("Error parsing translations metafield:", err);
      }
      setTranslationsMeta(parsedTranslations);
    }).catch((err) => {
      console.error("Storefront API query error in ProfileBlock:", err);
      setShopDomain("loyalty-store-credit.myshopify.com");
      setAppUrl("https://affecting-attention-bases-keyboards.trycloudflare.com");
    });

    return () => {
      unsubCustomer?.();
      unsubLanguage?.();
    };
  }, []);

  // Handle mock data preview in the admin Customize editor when customer is not logged in
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!customerId) {
        setIsLoading(false);
        setTransactions([
          {
            id: "mock-1",
            amount: 15.00,
            currencyCode: "USD",
            type: "credit",
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "mock-2",
            amount: 10.00,
            currencyCode: "USD",
            type: "debit",
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            expiresAt: null,
          },
        ]);
        setEnabledCurrencies(["USD", "CAD"]);
        setCustomerBalances({
          USD: 25.00,
          CAD: 35.00,
        });
        setSelectedCurrency("USD");
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [customerId]);

  // Fetch transactions once appUrl and customerId are loaded
  useEffect(() => {
    if (!appUrl || !customerId || !shopDomain) return;

    let isMounted = true;
    async function fetchStoreCreditData() {
      try {
        setIsLoading(true);
        const response = await fetch(`${appUrl}/api/store-credit?shop=${shopDomain}&customerId=${customerId}`);
        const data = await response.json();

        if (isMounted && data) {
          setTransactions(data.transactions || []);
          setEnabledCurrencies(data.enabledCurrencies || []);

          // Use default/first account currency as initial selected currency if not already selected
          const activeCurrency = data.currency || "USD";
          setStoreDefaultCurrency(activeCurrency);
          setSelectedCurrency((prev) => prev || activeCurrency);

          // Update balances from backend response
          if (data.balances) {
            const parsedBalances = {};
            Object.keys(data.balances).forEach(key => {
              parsedBalances[key] = parseFloat(data.balances[key]);
            });
            setCustomerBalances(parsedBalances);
          } else if (data.balance !== undefined) {
            setCustomerBalances((prev) => ({
              ...prev,
              [activeCurrency]: parseFloat(data.balance)
            }));
          }
        }
      } catch (err) {
        console.error("Error fetching store credit transactions:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchStoreCreditData();
    return () => { isMounted = false; };
  }, [appUrl, customerId, shopDomain, storeDefaultCurrency]);

  // Helper to handle currency selection change safely in worker environments
  const handleCurrencyChange = (e) => {
    let val = "";
    if (typeof e === "string") {
      val = e;
    } else if (e?.detail?.value) {
      val = e.detail.value;
    } else if (e?.target?.value) {
      val = e.target.value;
    } else if (e?.currentTarget?.value) {
      val = e.currentTarget.value;
    }
    if (val) {
      setSelectedCurrency(val);
      setVisibleLimit(8);
    }
  };

  const handleLoadMore = () => {
    if (isLoadMoreLoading) return;
    setIsLoadMoreLoading(true);
    timeoutRef.current = setTimeout(() => {
      setVisibleLimit((prev) => prev + 8);
      setIsLoadMoreLoading(false);
      timeoutRef.current = null;
    }, 1000);
  };

  // Handle selected balance
  const activeCurrency = selectedCurrency || storeDefaultCurrency || "USD";
  const balanceAmount = customerBalances[activeCurrency] !== undefined ? customerBalances[activeCurrency] : 0.00;

  // Filter transactions based on selected currency
  const currencyFilteredTransactions = transactions.filter(t => t.currencyCode === activeCurrency);

  // Filter transactions based on active tab
  const tabFilteredTransactions = currencyFilteredTransactions.filter(t => {
    if (activeTab === "Received") return t.type === "credit";
    if (activeTab === "Used") return t.type === "debit";
    return true; // "All"
  });

  // Calculate expiring credit balance for selected currency (within configured range)
  const now = new Date();
  const expiryRangeEnd = new Date(now.getTime() + expiryRangeDays * 24 * 60 * 60 * 1000);
  const expiringAmount = currencyFilteredTransactions
    .filter(t => t.type === "credit" && t.expiresAt && new Date(t.expiresAt) > now && new Date(t.expiresAt) <= expiryRangeEnd)
    .reduce((sum, t) => sum + (t.remainingAmount !== null ? parseFloat(t.remainingAmount) : parseFloat(t.amount)), 0);

  // Pagination logic
  const paginatedTransactions = tabFilteredTransactions.slice(0, visibleLimit);
  const hasMore = tabFilteredTransactions.length > visibleLimit;

  // Format date utility
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

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
        widget_history_title: "Credit Rewards",
        widget_all_transactions: "All Transactions",
        widget_received_label: "Received",
        widget_used_label: "Used",
        widget_load_more: "Load More",
        widget_empty_transaction: "No transactions found.",
        widget_expires_on: "Expires on {expired_date}",
        widget_available_credit: "Available Store Credits",
        widget_currency_label: "Currency",
        widget_empty_balance: "No store credit found.",
        widget_expired_balance: "{expired_amount} will be expired soon",
      };
      val = fallbacks[key] || "";
    }

    let result = val;
    Object.keys(replacements).forEach((k) => {
      result = result.replace(`{${k}}`, replacements[k]);
    });
    return result;
  };

  const transactionRows = paginatedTransactions.length === 0 ? (
    <s-box padding="large">
      <s-stack direction="inline" justifyContent="center">
        <s-text color="subdued">{t("widget_empty_transaction")}</s-text>
      </s-stack>
    </s-box>
  ) : (
    paginatedTransactions.map((tx, idx) => {
      const isCredit = tx.type === "credit";
      return (
        <s-box
          key={tx.id}
          padding="base"
          background={idx % 2 === 0 ? "subdued" : "transparent"}
        >
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-text type="strong">
                {formatDate(tx.createdAt)}
              </s-text>
              {isCredit && tx.expiresAt && (
                <s-text color="subdued">
                  ({t("widget_expires_on", { expired_date: formatDate(tx.expiresAt) })})
                </s-text>
              )}
            </s-stack>

            <s-text
              tone={isCredit ? "success" : "critical"}
              type="strong"
            >
              {isCredit ? "" : "-"}{formatCurrency(tx.amount, tx.currencyCode)}
            </s-text>
          </s-stack>
        </s-box>
      );
    })
  );

  if (isLoading && transactions.length === 0) {
    return (
      <s-grid gridTemplateColumns="6fr 4fr" gap="base" alignItems="end">
        <s-box padding="small">
          <s-stack gap="base">
            <s-box background="subdued" borderRadius="base" padding="small" inlineSize="120px">
              <s-text color="subdued">⠀</s-text>
            </s-box>
            <s-box background="subdued" borderRadius="base" padding="small">
              <s-text color="subdued">⠀</s-text>
            </s-box>
          </s-stack>
        </s-box>
        <s-box padding="small">
          <s-box background="subdued" borderRadius="base" padding="small">
            <s-text color="subdued">⠀</s-text>
          </s-box>
        </s-box>
      </s-grid>
    );
  }

  // Define curated dropdown options for currency select
  const currencyOptions = enabledCurrencies.length > 0
    ? enabledCurrencies
    : [activeCurrency];

  return (
    <s-stack gap='base'>
      <s-heading>{t("widget_history_title")}</s-heading>
      <s-grid gridTemplateColumns="6fr 4fr" gap="base" alignItems="start">

        {/* Left Column: Credit Rewards */}
        <s-stack gap="base">


          <s-box background="base" border="base" borderRadius="large" padding="large">
            <s-stack gap="base">

              {/* Filter buttons */}
              <s-stack direction="inline" gap="small" alignItems="center">
                {activeTab === "All" ? (
                  <s-clickable
                    onClick={() => { setActiveTab("All"); setVisibleLimit(8); }}
                    background="transparent"
                    border="base"
                    borderRadius="base"
                    paddingBlock="small-300"
                    paddingInline="small"
                  >
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <s-icon type="credit-card" tone="info" />
                      <s-text type="strong" tone="info">{t("widget_all_transactions")}</s-text>
                    </s-stack>
                  </s-clickable>
                ) : (
                  <s-clickable
                    onClick={() => { setActiveTab("All"); setVisibleLimit(8); }}
                    background="transparent"
                    border="base"
                    borderRadius="base"
                    paddingBlock="small-300"
                    paddingInline="small"
                  >
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <s-icon type="credit-card" />
                      <s-text color="subdued">{t("widget_all_transactions")}</s-text>
                    </s-stack>
                  </s-clickable>
                )}

                {activeTab === "Received" ? (
                  <s-clickable
                    onClick={() => { setActiveTab("Received"); setVisibleLimit(8); }}
                    background="transparent"
                    border="base"
                    borderRadius="base"
                    paddingBlock="small-300"
                    paddingInline="small"
                  >
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <s-icon type="arrow-up" tone="success" />
                      <s-text type="strong" tone="success">{t("widget_received_label")}</s-text>
                    </s-stack>
                  </s-clickable>
                ) : (
                  <s-clickable
                    onClick={() => { setActiveTab("Received"); setVisibleLimit(8); }}
                    background="transparent"
                    border="base"
                    borderRadius="base"
                    paddingBlock="small-300"
                    paddingInline="small"
                  >
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <s-icon type="arrow-up" tone="success" />
                      <s-text color="subdued">{t("widget_received_label")}</s-text>
                    </s-stack>
                  </s-clickable>
                )}

                {activeTab === "Used" ? (
                  <s-clickable
                    onClick={() => { setActiveTab("Used"); setVisibleLimit(8); }}
                    background="transparent"
                    border="base"
                    borderRadius="base"
                    paddingBlock="small-300"
                    paddingInline="small"
                  >
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <s-icon type="arrow-down" tone="critical" />
                      <s-text type="strong" tone="critical">{t("widget_used_label")}</s-text>
                    </s-stack>
                  </s-clickable>
                ) : (
                  <s-clickable
                    onClick={() => { setActiveTab("Used"); setVisibleLimit(8); }}
                    background="transparent"
                    border="base"
                    borderRadius="base"
                    paddingBlock="small-300"
                    paddingInline="small"
                  >
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <s-icon type="arrow-down" tone="critical" />
                      <s-text color="subdued">{t("widget_used_label")}</s-text>
                    </s-stack>
                  </s-clickable>
                )}
              </s-stack>

              {/* Transaction List */}
              <s-box padding="none">
                {visibleLimit > 8 ? (
                  <s-scroll-box maxBlockSize="620px">
                    <s-stack gap="none">
                      {transactionRows}
                    </s-stack>
                  </s-scroll-box>
                ) : (
                  <s-stack gap="none">
                    {transactionRows}
                  </s-stack>
                )}

                {hasMore && (
                  <s-box paddingBlockStart="base" paddingBlockEnd="none">
                    <s-stack direction="inline" justifyContent="center">
                      {isLoadMoreLoading ? (
                        <s-stack direction="inline" gap="small" alignItems="center">
                          <s-spinner size="small" />
                        </s-stack>
                      ) : (
                        <s-link
                          onClick={handleLoadMore}
                        >
                          {t("widget_load_more")}
                        </s-link>
                      )}
                    </s-stack>
                  </s-box>
                )}
              </s-box>
            </s-stack>
          </s-box>
        </s-stack>

        {/* Right Column: Available Store Credits */}
        <s-stack gap="base">
          <s-box background="base" border="base" borderRadius="large" padding="large">
            <s-stack gap="base">
              <s-stack
                direction="inline"
                justifyContent="space-between"
                alignItems="center"
                minBlockSize="36px"
              >
                <s-heading>{t("widget_available_credit")}</s-heading>

                {currencyOptions.length > 1 && balanceAmount > 0 && (
                  <s-box minInlineSize="180px">
                    <s-select
                      label={t("widget_currency_label")}
                      value={activeCurrency}
                      onChange={handleCurrencyChange}
                    >
                      {currencyOptions.map((code) => (
                        <s-option key={code} value={code}>
                          {code}
                        </s-option>
                      ))}
                    </s-select>
                  </s-box>
                )}
              </s-stack>

              {/* Reward Content */}
              <s-stack direction="inline" alignItems="center" gap="base">
                <s-box inlineSize="100px">
                  <s-image
                    src={
                      balanceAmount > 0
                        ? "https://cdn.getkoin.io/sdk/coin-crown-icon.svg"
                        : "https://cdn.getkoin.io/sdk/coin.svg"
                    }
                    alt="Store Credit"
                    inlineSize="fill"
                    aspectRatio="1"
                  />
                </s-box>

                <s-stack gap="none">
                  {balanceAmount > 0 ? (
                    <>
                      <s-text type="strong">
                        {formatCurrency(balanceAmount, activeCurrency)}
                      </s-text>

                      {expiringAmount > 0 && (
                        <s-text color="subdued">
                          {t("widget_expired_balance", { expired_amount: formatCurrency(expiringAmount, activeCurrency) })}
                        </s-text>
                      )}
                    </>
                  ) : (
                    <s-text type="strong">
                      {t("widget_empty_balance")}
                    </s-text>
                  )}
                </s-stack>
              </s-stack>
            </s-stack>
          </s-box>
        </s-stack>

      </s-grid>
    </s-stack>
  );
}
