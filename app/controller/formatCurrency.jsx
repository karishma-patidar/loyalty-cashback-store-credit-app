export const formatCurrency = (amount, currencyCode) => {
    try {
        const formatted = new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: currencyCode,
            minimumFractionDigits: 2,
        }).format(amount);

        return `${formatted} ${currencyCode}`;
    } catch (e) {
        console.error("Currency formatting error:", e);
        return `${amount} ${currencyCode}`;
    }
};

export const getShopDetails = async () => {
    const data = `query {
    shop {
      name
      currencyCode
      checkoutApiSupported
      taxesIncluded
      plan{
        partnerDevelopment
        publicDisplayName
        shopifyPlus
      }
      resourceLimits {
        maxProductVariants
      }
    }
  }`;
    return data;
};

export const storeCreditSettings = {
    isStoreCreditEnabled: false,
    currencyCode: "USD",
    rules: [
        {
            id: "sign-up",
            title: "Sign up",
            enabled: false,
            points: 10,
            description: "for creating an account",
        },
        {
            id: "first-order",
            title: "Place a first order",
            enabled: false,
            description: "Points awarded for placing their first order",
            earningMethod: "incremental", // or "fixed",
            perAmountSpent: 10,
            minOrderValue: 0,
            points: 1,
        },
        {
            id: "place-an-order",
            title: "Place an order",
            enabled: false,
            points: 1,
            description: "for each ₹1 spent",
            earningMethod: "incremental",
            perAmountSpent: 10,
            minOrderValue: 0,
        },
    ],
};
