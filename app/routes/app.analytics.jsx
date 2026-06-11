
import { useState, useEffect } from "react";
import { useLoaderData, useSubmit, useNavigation, useNavigate } from "react-router";
import DateFilter from "../components/analytics_search_filter";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    Cell,
} from "recharts";
import { authenticate } from "../shopify.server";
import connectMongoDB, { getShopModel, migrateShopData } from "../db.mongodb.server";
import { getStoreCreditTransactions } from "../services/storeCredit.server";
import { getShopPrograms } from "../services/graphql.server";
import { MetricCell, SkeletonLine } from "../components/MetricCell";

const getenabledPresentmentCurrencies = async () => {
    try {
        const response = await fetch("shopify:admin/api/2026-04/graphql.json", {
            method: "POST",
            body: JSON.stringify({
                query: ` query {
          shop{
            id
            enabledPresentmentCurrencies
            currencyCode
          }
        }`,
            }),
        });
        const responseData = await response.json();
        return responseData;
    } catch (error) {
        console.error("Error fetching shop data:", error);
    }
};

// ─── GraphQL Queries ────────────────────────────────────────────────────────

const GET_STORE_CONFIG = `#graphql
  query GetStoreConfig {
    shop {
      currencyCode
      enabledPresentmentCurrencies
    }
    shopLocales {
      locale
      name
      published
      primary
    }
  }
`;


const GET_ORDERS_QUERY = `#graphql
  query GetOrders($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Order {
        id
        currentTotalPriceSet {
          presentmentMoney {
            amount
            currencyCode
          }
        }
        customer {
          id
        }
      }
    }
  }
`;


// ─── Date Helpers ────────────────────────────────────────────────────────────

function calculateDateRange(preset, startDateStr, endDateStr) {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === "today") {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    } else if (preset === "yesterday") {
        start.setDate(now.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(now.getDate() - 1);
        end.setHours(23, 59, 59, 999);
    } else if (preset === "7days") {
        start.setDate(now.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    } else if (preset === "30days") {
        start.setDate(now.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    } else if (preset === "lastweek") {
        const startDay = now.getDay();
        start.setDate(now.getDate() - startDay - 7);
        start.setHours(0, 0, 0, 0);
        end.setDate(now.getDate() - startDay - 1);
        end.setHours(23, 59, 59, 999);
    } else if (preset === "lastmonth") {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (preset === "weektodate") {
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    } else if (preset === "monthtodate") {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    } else if (preset === "custom" && startDateStr && endDateStr) {
        const sParts = startDateStr.split("-");
        const eParts = endDateStr.split("-");
        if (sParts.length === 3 && eParts.length === 3) {
            start = new Date(parseInt(sParts[0], 10), parseInt(sParts[1], 10) - 1, parseInt(sParts[2], 10), 0, 0, 0, 0);
            end = new Date(parseInt(eParts[0], 10), parseInt(eParts[1], 10) - 1, parseInt(eParts[2], 10), 23, 59, 59, 999);
        } else {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        }
    } else {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    }
    return { start, end };
}

function formatYYYYMMDD(date) {
    if (!date) return "";
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function formatDateLabel(dateObj) {
    const d = new Date(dateObj);
    const day = String(d.getDate()).padStart(2, "0");
    const mon = d.toLocaleString("en-US", { month: "short" });
    return `${day} ${mon}`;
}

// ─── Currency Helpers ────────────────────────────────────────────────────────

const currencySymbols = {
    INR: "₹",
    USD: "$",
    CAD: "C$",
    AUD: "A$",
    GBP: "£",
    EUR: "€",
    JPY: "¥",
};



function formatCurrency(amount, currencyCode) {
    const symbol = currencySymbols[currencyCode] || currencyCode || "$";
    return `${symbol}${Number(amount || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

// ─── Chart Colors ────────────────────────────────────────────────────────────

const CHART_COLORS = {
    primary: "#008060",
    secondary: "#5C6AC4",
    accent: "#47C1BF",
    orange: "#F49342",
    purple: "#9C6ADE",
    green: "#50B83C",
};


const PROGRAM_COLORS = [
    CHART_COLORS.primary,
    CHART_COLORS.secondary,
    CHART_COLORS.accent,
    CHART_COLORS.orange,
    CHART_COLORS.purple,
    CHART_COLORS.green,
];

// ─── Tooltip Texts ───────────────────────────────────────────────────────────

const TOOLTIPS = {
    issuedCredit: "The total value of loyalty cashback credits issued from reward programs and manual adjustments, excluding refunded or debited credits.",
    appliedCredit: "The total value of loyalty cashback credits redeemed and applied to customer orders.",
    debitRefunded: "The total amount of credits refunded, reversed, or removed from customer balances.",
    redemptionRate: "The percentage of issued credits that were actually applied to purchases (Redemption rate = Applied credit / Issued credit × 100)",
    totalOrders: "Number of orders where loyalty cashback credit was issued or redeemed.",
    totalSales: "Combined sales value generated from orders associated with cashback credits.",
    aov: "Average order value for orders where store credit was issued from loyalty cashback credit (AOV = Total sales of orders / Total orders)",
    totalCustomersRedeem: "Total customers who redeemed loyalty cashback credits.",
    totalDistributedCustomers: "Number of customers who received cashback credits.",
};


// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }) => {
    const { admin, session } = await authenticate.admin(request);
    const shop = session.shop;

    const url = new URL(request.url);
    const preset = url.searchParams.get("preset") || "7days";
    const customStart = url.searchParams.get("startDate") || "";
    const customEnd = url.searchParams.get("endDate") || "";

    await connectMongoDB();
    try {
        await migrateShopData(shop);
    } catch (e) {
        console.error("Error migrating old events in analytics loader:", e);
    }
    await new Promise((resolve) => setTimeout(resolve, 850));

    const { start, end } = calculateDateRange(preset, customStart, customEnd);
    let programs = [];
    try {
        const progRes = await getShopPrograms(admin);
        programs = progRes.programs || [];
    } catch (e) {
        console.error("Error fetching shop programs in analytics loader:", e);
    }

    // ── Shop configuration fetching
    let shopCurrency = "INR";
    let rawCurrencies = [];
    let activeLanguages = [];

    try {
        const configRes = await admin.graphql(GET_STORE_CONFIG);
        const configData = await configRes.json();

        const shopData = configData?.data?.shop;
        shopCurrency = shopData?.currencyCode || "INR";

        rawCurrencies = shopData?.enabledPresentmentCurrencies || [shopCurrency];

        const rawLocales = configData?.data?.shopLocales || [];
        const publishedLocales = rawLocales.filter(l => l.published);
        const primaryLocaleObj = publishedLocales.find(l => l.primary) || publishedLocales[0];
        const defaultLanguage = primaryLocaleObj ? primaryLocaleObj.locale : "en";

        activeLanguages = publishedLocales.map(l => ({
            value: l.locale,
            label: l.name,
        }));

    } catch (err) {
        console.error("Error fetching shop configuration:", err);
        rawCurrencies = ["INR"];
        activeLanguages = [{ value: "en", label: "English" }];
    }

    // ── Load ALL events (allTime needed for new-vs-repeat logic)
    let allTimeEvents = [];
    let rangeEvents = [];
    try {
        const ShopModel = getShopModel(shop);
        if (ShopModel) {
            const docs = await ShopModel.find({});
            for (const doc of docs) {
                if (!Array.isArray(doc.events)) continue;
                for (const ev of doc.events) {
                    if (!ev.orderId) continue;
                    const eventDate = ev.createdAt ? new Date(ev.createdAt) : new Date(doc.createdAt);
                    let programName = ev.programName;
                    if (!programName && programs.length > 0) {
                        if (ev.programId) {
                            const p = programs.find(p => p.id === ev.programId || p.programId === ev.programId);
                            if (p) programName = p.name || p.programName;
                        } else {
                            const evIsCustom = ev.programType === "Custom Program" || ev.programType === "custom" || ev.programType === "fixed" || ev.programType === "percentage";
                            const firstCashbackProg = programs.find(p => p.programType !== "custom" && !p.isFlowProgram);
                            const firstCustomProg = programs.find(p => p.programType === "custom" || p.isFlowProgram);
                            if (evIsCustom && firstCustomProg) {
                                programName = firstCustomProg.name || firstCustomProg.programName;
                            } else if (!evIsCustom && firstCashbackProg) {
                                programName = firstCashbackProg.name || firstCashbackProg.programName;
                            }
                        }
                    }

                    const eventObj = {
                        orderId: ev.orderId,
                        orderName: ev.orderName,
                        customerId: ev.customerId,
                        customerName: ev.customerName,
                        amount: Number(ev.issuedAmount || 0),
                        redeemedAmount: Number(ev.redeemedAmount || 0),
                        currency: ev.currency,
                        status: ev.status,
                        name: programName || (ev.programType === "Cashback" ? "Cashback" : ev.programType) || "Cashback",
                        type: ev.programType || "Cashback",
                        createdAt: eventDate,
                    };
                    allTimeEvents.push(eventObj);
                    if (eventDate >= start && eventDate <= end) rangeEvents.push(eventObj);
                }
            }
        }
    } catch (err) {
        console.error("Error loading MongoDB events:", err);
    }

    // Unique database event currencies from MongoDB
    const mongoCurrencies = Array.from(new Set(allTimeEvents.map(e => e.currency))).filter(Boolean);

    // ── Selected values (from URL or fallbacks)
    const selectedCurrency = url.searchParams.get("currency") || shopCurrency;
    const finalCurrency = selectedCurrency;

    const defaultLangCode = activeLanguages.find(l => l.value === url.searchParams.get("language"))
        ? url.searchParams.get("language")
        : (activeLanguages.length === 1 ? activeLanguages[0].value : (activeLanguages.find(l => l.primary)?.value || activeLanguages[0]?.value || "en"));
    const selectedLanguage = url.searchParams.get("language") || defaultLangCode;

    // ── Filter by currency
    const filteredRangeEvents = rangeEvents.filter((e) => e.currency === finalCurrency);

    const completedEvents = filteredRangeEvents.filter((e) => e.status === "Completed");
    const uniqueOrderIds = Array.from(new Set(completedEvents.map((e) => e.orderId)));
    const totalOrders = uniqueOrderIds.length;
    const totalDistributedCustomers = new Set(completedEvents.map((e) => e.customerId)).size;
    const issuedCredit = completedEvents.reduce((acc, ev) => acc + ev.amount, 0);

    // ── Fetch order sales
    let totalSales = 0;
    const orderSpendingMap = {};
    const allRangeOrderIds = Array.from(new Set(filteredRangeEvents.map((e) => e.orderId)));
    if (allRangeOrderIds.length > 0) {
        try {
            const orderGids = allRangeOrderIds.map((id) =>
                id.startsWith("gid://") ? id : `gid://shopify/Order/${id}`
            );
            for (let i = 0; i < orderGids.length; i += 50) {
                const chunk = orderGids.slice(i, i + 50);
                const orderRes = await admin.graphql(GET_ORDERS_QUERY, { variables: { ids: chunk } });
                const orderData = await orderRes.json();
                for (const order of (orderData?.data?.nodes || [])) {
                    if (order) {
                        const oId = order.id.split("/").pop();
                        const amt = parseFloat(order.currentTotalPriceSet?.presentmentMoney?.amount || "0");
                        orderSpendingMap[oId] = amt;
                    }
                }
            }
        } catch (err) {
            console.error("Error loading order prices:", err);
        }
    }

    for (const oId of uniqueOrderIds) {
        totalSales += orderSpendingMap[oId] || 0;
    }

    const aov = totalOrders > 0 ? Number((totalSales / totalOrders).toFixed(2)) : 0;

    // ── Fetch store credit transactions (specifically for debitRefunded)
    let debitRefunded = 0;

    try {
        const txNodes = await getStoreCreditTransactions(admin);

        for (const node of txNodes) {
            const txDate = new Date(node.createdAt);
            if (txDate < start || txDate > end) continue;
            const amount = parseFloat(node.amount?.amount || "0");
            const type = node.transactionType;

            if (type === "EXPIRATION" || (type === "ADJUST" && amount < 0) || type === "REVERSION") {
                debitRefunded += Math.abs(amount);
            }
        }
    } catch (err) {
        console.error("Error fetching Shopify transactions:", err);
    }

    // ── Fetch Applied Credit and Redeemed Customers from MongoDB events
    const appliedCredit = filteredRangeEvents.reduce((acc, ev) => acc + (ev.redeemedAmount || 0), 0);
    const redeemingCustomers = new Set(
        filteredRangeEvents
            .filter((ev) => (ev.redeemedAmount || 0) > 0)
            .map((ev) => ev.customerId)
    );
    const totalCustomersRedeem = redeemingCustomers.size;

    const redemptionRate = issuedCredit > 0
        ? Number(((appliedCredit / issuedCredit) * 100).toFixed(2))
        : 0;

    // ── Top Programs
    const programsMap = {};
    for (const ev of completedEvents) {
        const k = ev.name || "Cashback";
        programsMap[k] = (programsMap[k] || 0) + ev.amount;
    }
    const topPrograms = Object.entries(programsMap)
        .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
        .sort((a, b) => b.value - a.value);

    // ── Top Customers
    const customersMap = {};
    for (const ev of filteredRangeEvents) {
        const custId = ev.customerId;
        if (!custId) continue;
        const custName = ev.customerName || "Anonymous Customer";

        if (!customersMap[custId]) {
            customersMap[custId] = {
                name: custName,
                redeemedAmount: 0,
                totalSpending: 0,
                orderIds: new Set()
            };
        }

        customersMap[custId].redeemedAmount += ev.redeemedAmount || 0;

        if (ev.orderId && !customersMap[custId].orderIds.has(ev.orderId)) {
            if ((ev.redeemedAmount || 0) > 0) {
                customersMap[custId].orderIds.add(ev.orderId);
                customersMap[custId].totalSpending += orderSpendingMap[ev.orderId] || 0;
            }
        }
    }
    const topCustomers = Object.values(customersMap)
        .map((c) => ({
            name: c.name,
            redeemedAmount: Number(c.redeemedAmount.toFixed(2)),
            totalSpending: Number(c.totalSpending.toFixed(2))
        }))
        .filter((c) => c.redeemedAmount > 0)
        .sort((a, b) => b.redeemedAmount - a.redeemedAmount)
        .slice(0, 3);

    // ── CHART 1: Rewards Issued Per Day (line)
    const rewardsPerDayMap = {};
    for (const ev of completedEvents) {
        const dk = ev.createdAt.toISOString().split("T")[0];
        rewardsPerDayMap[dk] = (rewardsPerDayMap[dk] || 0) + ev.amount;
    }
    const rewardsPerDay = Object.entries(rewardsPerDayMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dk, amount]) => ({
            date: formatDateLabel(new Date(dk + "T12:00:00")),
            amount: Number(amount.toFixed(2)),
        }));

    // ── CHART 2 & 3: Customer Frequency — new vs repeat
    // First-ever credit date per customer across ALL TIME
    const customerFirstDate = {};
    for (const ev of allTimeEvents) {
        if (ev.status !== "Completed") continue;
        const cid = ev.customerId;
        if (!customerFirstDate[cid] || ev.createdAt < customerFirstDate[cid]) {
            customerFirstDate[cid] = ev.createdAt;
        }
    }

    const freqByDateMap = {};
    for (const ev of completedEvents) {
        const dk = ev.createdAt.toISOString().split("T")[0];
        if (!freqByDateMap[dk]) freqByDateMap[dk] = { newSet: new Set(), repeatSet: new Set() };
        const firstDate = customerFirstDate[ev.customerId];
        const isNew = firstDate >= start && firstDate <= end;
        if (isNew) freqByDateMap[dk].newSet.add(ev.customerId);
        else freqByDateMap[dk].repeatSet.add(ev.customerId);
    }
    const customerFrequencyByDate = Object.entries(freqByDateMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dk, { newSet, repeatSet }]) => ({
            date: formatDateLabel(new Date(dk + "T12:00:00")),
            new: newSet.size,
            repeat: repeatSet.size,
        }));


    // ── CHART 4: Rewards By Program (horizontal bar)
    const rewardsByProgram = topPrograms.slice(0, 8);

    return {
        preset,
        startDateStr: customStart,
        endDateStr: customEnd,
        shopCurrency,
        selectedCurrency: finalCurrency,
        selectedLanguage,
        mongoCurrencies,
        activeLanguages,
        metrics: {
            issuedCredit: Number(issuedCredit.toFixed(2)),
            appliedCredit: Number(appliedCredit.toFixed(2)),
            debitRefunded: Number(debitRefunded.toFixed(2)),
            redemptionRate,
            totalOrders,
            totalSales: Number(totalSales.toFixed(2)),
            aov,
            totalCustomersRedeem,
            totalDistributedCustomers,
        },
        topPrograms,
        topCustomers,
        rewardsPerDay,
        customerFrequencyByDate,
        rewardsByProgram,
    };
};

// ─── Skeleton Helpers ────────────────────────────────────────────────────────

function SkeletonLines({ lines = 4, height = 12 }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
            {Array.from({ length: lines }).map((_, i) => (
                <SkeletonLine key={i} width={i === lines - 1 ? "70%" : "100%"} height={height} />
            ))}
        </div>
    );
}

// ─── Chart Empty State ───────────────────────────────────────────────────────

function ChartEmptyState() {
    return (
        <s-stack direction="block" gap="base" style={{ width: "100%" }}>
            <s-text color="subdued">No reward data available</s-text>
            <s-stack direction="block" gap="base" style={{ width: "100%" }}>
                {Array.from({ length: 5 }).map((_, i) => (
                    <s-stack key={i} direction="inline" gap="base" alignment="center" style={{ width: "100%" }}>
                        <SkeletonLine width="33px" height={12} style={{ borderRadius: 3, flexShrink: 0 }} />
                        <div style={{
                            height: "2px",
                            backgroundColor: "#f1f2f4",
                            flexGrow: 1
                        }} />
                    </s-stack>
                ))}
            </s-stack>
        </s-stack>
    );
}

// ─── Custom Recharts Tooltip ─────────────────────────────────────────────────

function CustomChartTooltip({ active, payload, label, currencyCode, isCount }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: "#fff", border: "1px solid #e1e3e5", borderRadius: 8,
            padding: "10px 14px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 13,
        }}>
            <p style={{ margin: "0 0 6px", fontWeight: 600, color: "#202223" }}>{label}</p>
            {payload.map((entry, i) => (
                <p key={i} style={{ margin: "2px 0", color: entry.color }}>
                    {entry.name}: {isCount ? entry.value : formatCurrency(entry.value, currencyCode)}
                </p>
            ))}
        </div>
    );
}


// ─── Main Component ──────────────────────────────────────────────────────────

export default function Analytics() {
    const {
        preset, startDateStr, endDateStr,
        shopCurrency, selectedCurrency,
        selectedLanguage,
        mongoCurrencies, activeLanguages,
        metrics, topPrograms, topCustomers,
        rewardsPerDay, customerFrequencyByDate, rewardsByProgram,
    } = useLoaderData();

    const [currencyOptions, setCurrencyOptions] = useState([]);

    const submit = useSubmit();
    const navigate = useNavigate();
    const navigation = useNavigation();
    const isFetching = navigation.state === "loading";

    // ── Date filter state (derived from loader URL params)
    const initialRange = calculateDateRange(preset, startDateStr, endDateStr);
    const [dateFrom, setDateFrom] = useState(formatYYYYMMDD(initialRange.start));
    const [dateTo, setDateTo] = useState(formatYYYYMMDD(initialRange.end));

    // ── Currency and Language state
    const [tempCurrency, setTempCurrency] = useState(selectedCurrency);
    const [tempLanguage, setTempLanguage] = useState(selectedLanguage);

    // Sync date filter state when loader data changes (after navigation)
    useEffect(() => {
        if (!isFetching) {
            const r = calculateDateRange(preset, startDateStr, endDateStr);
            setDateFrom(formatYYYYMMDD(r.start));
            setDateTo(formatYYYYMMDD(r.end));
            setTempCurrency(selectedCurrency);
            setTempLanguage(selectedLanguage);
        }
    }, [preset, startDateStr, endDateStr, selectedCurrency, selectedLanguage, isFetching]);

    const mongoCurrenciesKey = mongoCurrencies?.join(",") || "";
    useEffect(() => {
        const fetchCurrencies = async () => {
            const result = await getenabledPresentmentCurrencies();
            const shop = result?.data?.shop;
            const shopCode = shop?.currencyCode || shopCurrency;

            // Only show currencies that actually exist in current MongoDB orders.
            // If mongoCurrencies is empty (no orders yet), fall back to shopCode only.
            const activeCurrencies = mongoCurrencies.length > 0 ? mongoCurrencies : [shopCode];
            setCurrencyOptions(activeCurrencies.map((cur) => ({ label: cur, value: cur })));

            // Determine the best default currency:
            // prefer store default (shopCode) if it's in the active list, else first available.
            const defaultCurrency = activeCurrencies.includes(shopCode)
                ? shopCode
                : activeCurrencies[0];

            const params = new URLSearchParams(window.location.search);
            const currentCurrency = params.get("currency");

            // Auto-correct the URL if:
            // 1. No currency param is set yet (first load), OR
            // 2. The current currency is no longer in the active orders list (e.g. INR was deleted).
            if (!currentCurrency || !activeCurrencies.includes(currentCurrency)) {
                params.set("currency", defaultCurrency);
                submit(params, { method: "get", replace: true });
            }
        };
        fetchCurrencies();
    }, [mongoCurrenciesKey, shopCurrency, submit]);

    // ── Handlers
    const buildParams = (overrides = {}) => {
        const p = new URLSearchParams();
        p.set("preset", overrides.preset ?? "custom");
        p.set("currency", overrides.currency ?? tempCurrency);
        p.set("language", overrides.language ?? tempLanguage);
        if (overrides.startDate || overrides.endDate) {
            p.set("startDate", overrides.startDate ?? dateFrom);
            p.set("endDate", overrides.endDate ?? dateTo);
        }
        return p;
    };

    // Called when DateFilter applies a date range
    const handleDateChange = ({ from, to }) => {
        setDateFrom(from);
        setDateTo(to);
        const p = new URLSearchParams();
        p.set("preset", "custom");
        p.set("currency", tempCurrency);
        p.set("language", tempLanguage);
        p.set("startDate", from);
        p.set("endDate", to);
        submit(p, { method: "get", replace: true });
    };

    const handleRefresh = () => {
        const p = buildParams({ startDate: dateFrom, endDate: dateTo });
        p.set("_refresh", String(Date.now()));
        submit(p, { method: "get", replace: true });
    };

    const handleCurrencyChange = (value) => {
        setTempCurrency(value);
        const p = buildParams({ currency: value, startDate: dateFrom, endDate: dateTo });
        submit(p, { method: "get", replace: true });
    };

    const handleLanguageChange = (value) => {
        setTempLanguage(value);
        const p = buildParams({ language: value, startDate: dateFrom, endDate: dateTo });
        submit(p, { method: "get", replace: true });
    };

    // Generate readable date display text for the filter button
    const getButtonText = () => {
        if (!dateFrom && !dateTo) return "All Time";
        if (dateFrom && dateTo) {
            if (dateFrom === dateTo) return `Date: ${dateFrom}`;
            return `Date: ${dateFrom} to ${dateTo}`;
        }
        if (dateFrom) return `Date: From ${dateFrom}`;
        return `Date: Until ${dateTo}`;
    };

    // Close the date filter popover programmatically
    const closeDatePopover = () => {
        const popover = document.getElementById("date-actions");
        if (popover) {
            if (typeof popover.hidePopover === "function") {
                try { popover.hidePopover(); } catch (_) { /* ignore */ }
            }
            popover.removeAttribute("open");
        }
    };

    return (
        <s-box className="min-h-screen">
            <s-page>
                <s-stack gap="base">

                    {/* ── Custom Page Header & Filters Row ── */}
                    <s-stack direction="inline" justifyContent="space-between" alignment="center">
                        <s-stack direction="inline" gap="base" alignment="center">
                            <s-button
                                icon="arrow-left"
                                variant="tertiary"
                                onClick={() => navigate("/app")}
                                accessibilityLabel="Back"
                            />
                            <s-heading variant="headingLg" className="font-bold">
                                Analytics
                            </s-heading>
                        </s-stack>

                        <s-stack direction="inline" gap="base" alignment="center">
                            <s-box>
                                <s-button
                                    onClick={handleRefresh}
                                    icon="refresh"
                                    loading={isFetching}
                                    disabled={isFetching}
                                >
                                    Refresh Data
                                </s-button>
                            </s-box>

                            {currencyOptions.length > 1 && (
                                <s-box>
                                    <s-select
                                        value={tempCurrency}
                                        onInput={(e) => handleCurrencyChange(e.target.value)}
                                    >
                                        {currencyOptions.map((currency) => (
                                            <s-option
                                                key={currency.value}
                                                value={currency.value}
                                            >
                                                {currency.label}
                                            </s-option>
                                        ))}
                                    </s-select>
                                </s-box>
                            )}

                            <s-stack direction="inline" gap="small" alignment="center">
                                <s-button
                                    icon="calendar"
                                    variant="secondary"
                                    accessibilityLabel="Select Date Range"
                                    commandFor="date-actions"
                                >
                                    {getButtonText()}
                                </s-button>

                                <s-popover id="date-actions">
                                    <s-box padding="base">
                                        <DateFilter
                                            dateFrom={dateFrom}
                                            dateTo={dateTo}
                                            onDateChange={handleDateChange}
                                            onClose={closeDatePopover}
                                        />
                                    </s-box>
                                </s-popover>
                            </s-stack>
                        </s-stack>
                    </s-stack>

                    {/* ── SECTION 1: Store Credit ── */}
                    <s-stack direction="block" gap="base">
                        <s-heading variant="headingSm" className="text-gray-500">Store credit</s-heading>
                        <s-section padding="base" background="surface" borderWidth="base" borderRadius="base">
                            <s-stack direction="block" gap="base">
                                <s-grid gridTemplateColumns="repeat(4, 1fr)" gap="base" className="w-full">
                                    <MetricCell id="issued" label="Issued credit" tooltip={TOOLTIPS.issuedCredit}
                                        value={formatCurrency(metrics.issuedCredit, selectedCurrency)} loading={isFetching} />
                                    <MetricCell id="applied" label="Applied credit" tooltip={TOOLTIPS.appliedCredit}
                                        value={formatCurrency(metrics.appliedCredit, selectedCurrency)} loading={isFetching} />
                                    <MetricCell id="debit" label="Debit/Refunded credit" tooltip={TOOLTIPS.debitRefunded}
                                        value={formatCurrency(metrics.debitRefunded, selectedCurrency)} loading={isFetching} />
                                    <MetricCell id="redemption" label="Redemption rate" tooltip={TOOLTIPS.redemptionRate}
                                        value={`${metrics.redemptionRate.toFixed(2)}%`} loading={isFetching} />
                                </s-grid>
                                <s-divider />
                                <s-stack direction="block" gap="base">
                                    <s-heading variant="headingXs">Top programs with issued credits</s-heading>
                                    {isFetching ? <SkeletonLines lines={3} /> :
                                        topPrograms.length === 0
                                            ? <s-box padding="base"><s-text color="subdued">No programs found.</s-text></s-box>
                                            : <s-stack direction="block" >
                                                {/* Header Row */}
                                                <s-box paddingBlock="none">
                                                    <s-stack direction="inline" justifyContent="space-between" alignment="center">
                                                        <s-text className="text-[11px] font-bold text-gray-400 uppercase tracking-tight">Program name</s-text>
                                                        <s-text className="text-[11px] font-bold text-gray-400 uppercase tracking-tight" style={{ textAlign: "right" }}>Issued credit</s-text>
                                                    </s-stack>
                                                </s-box>
                                                {topPrograms.map((p, idx) => (
                                                    <s-box key={p.name}>
                                                        {idx > 0 && <s-divider />}
                                                        <s-box paddingBlock="small">
                                                            <s-stack direction="inline" justifyContent="space-between" alignment="center">
                                                                <s-text color="subdued">{p.name}</s-text>
                                                                <s-text variant="bold">
                                                                    {formatCurrency(p.value, selectedCurrency)}
                                                                </s-text>
                                                            </s-stack>
                                                        </s-box>
                                                    </s-box>
                                                ))}
                                            </s-stack>
                                    }
                                </s-stack>
                            </s-stack>
                        </s-section>
                    </s-stack>

                    {/* ── SECTION 2: Orders ── */}
                    <s-stack direction="block" gap="base">
                        <s-heading variant="headingSm" className="text-gray-500">Orders</s-heading>

                        {/* <s-section> */}
                        <s-grid gridTemplateColumns="repeat(3, 1fr)" gap="base" className="w-full">
                            <s-section padding="base" background="surface" borderWidth="base" borderRadius="base">
                                <MetricCell id="total-orders" label="Total orders with issued credit" tooltip={TOOLTIPS.totalOrders}
                                    value={metrics.totalOrders} loading={isFetching} />
                            </s-section>
                            <s-section padding="base" background="surface" borderWidth="base" borderRadius="base">
                                <MetricCell id="total-sales" label="Total sales of orders with issued credit" tooltip={TOOLTIPS.totalSales}
                                    value={formatCurrency(metrics.totalSales, selectedCurrency)} loading={isFetching} />
                            </s-section>
                            <s-section padding="base" background="surface" borderWidth="base" borderRadius="base">
                                <MetricCell id="aov" label="AOV with issued credit" tooltip={TOOLTIPS.aov}
                                    value={formatCurrency(metrics.aov, selectedCurrency)} loading={isFetching} />
                            </s-section>
                        </s-grid>
                        {/* </s-section> */}
                    </s-stack>

                    {/* ── SECTION 3: Customers ── */}
                    <s-stack direction="block" gap="base">
                        <s-heading variant="headingSm" className="text-gray-500 w-full block" style={{ borderBottom: ".125rem dotted rgb(221, 224, 228)", paddingBottom: "4px" }}>Customers</s-heading>
                        <s-section padding="base" background="surface" borderWidth="base" borderRadius="base">
                            <s-stack direction="block" gap="base">
                                <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="base" className="w-full">
                                    <MetricCell id="redeem" label="Total customers redeem credit" tooltip={TOOLTIPS.totalCustomersRedeem}
                                        value={metrics.totalCustomersRedeem} loading={isFetching} />
                                    <MetricCell id="distributed" label="Total distributed customers" tooltip={TOOLTIPS.totalDistributedCustomers}
                                        value={metrics.totalDistributedCustomers} loading={isFetching} />
                                </s-grid>
                                <s-divider />
                                <s-stack direction="block" gap="none">
                                    <s-heading variant="headingXs" className="w-full block" >Top customers redeem credits</s-heading>
                                    {isFetching ? <SkeletonLines lines={3} /> :
                                        topCustomers.length === 0
                                            ? <s-box padding="base"><s-text color="subdued">No customers found.</s-text></s-box>
                                            : <s-stack direction="block" gap="none">
                                                {/* Header Row */}
                                                <s-grid gridTemplateColumns="2.5fr 1fr 1fr" gap="base" className="w-full">
                                                    <s-box paddingBlock="base">
                                                        <s-text className="text-[11px] font-bold text-gray-400 uppercase tracking-tight">Customer</s-text>
                                                    </s-box>
                                                    <s-box paddingBlock="base" style={{ textAlign: "right" }}>
                                                        <s-text className="text-[11px] font-bold text-gray-400 uppercase tracking-tight">Redeemed credits</s-text>
                                                    </s-box>
                                                    <s-box paddingBlock="base" style={{ textAlign: "right" }}>
                                                        <s-text className="text-[11px] font-bold text-gray-400 uppercase tracking-tight">Total spending</s-text>
                                                    </s-box>
                                                </s-grid>
                                                {topCustomers.map((c) => (
                                                    <s-grid key={c.name} gridTemplateColumns="2.5fr 1fr 1fr" gap="tight" className="w-full">
                                                        <s-box paddingBlock="small">
                                                            <s-text color="subdued">{c.name}</s-text>
                                                        </s-box>
                                                        <s-box paddingBlock="small" style={{ textAlign: "right" }}>
                                                            <s-text variant="bold">
                                                                {formatCurrency(c.redeemedAmount, selectedCurrency)}
                                                            </s-text>
                                                        </s-box>
                                                        <s-box paddingBlock="small" style={{ textAlign: "right" }}>
                                                            <s-text color="subdued">
                                                                {formatCurrency(c.totalSpending, selectedCurrency)}
                                                            </s-text>
                                                        </s-box>
                                                    </s-grid>
                                                ))}
                                            </s-stack>
                                    }
                                </s-stack>
                            </s-stack>
                        </s-section>
                    </s-stack>

                    {/* ── SECTION 4: Charts / Trends ── */}

                    <s-stack direction="block" gap="base" >
                        <s-heading variant="headingSm" className="text-gray-500">Trends</s-heading>

                        {/* Row 1 */}
                        <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="base" className="w-full">

                            {/* Chart 1 — Rewards Issued Per Day (Line) */}
                            <s-section padding="base" background="surface" borderWidth="base" borderRadius="base">
                                <s-stack direction="block" gap="base">
                                    <s-stack direction="block" gap="none">
                                        <s-heading variant="headingXs">Rewards Issued Day</s-heading>
                                        <s-text color="subdued" variant="small">Currency: {selectedCurrency}</s-text>
                                    </s-stack>
                                    {isFetching
                                        ? <SkeletonLines lines={6} height={16} />
                                        : rewardsPerDay.length === 0
                                            ? <ChartEmptyState />
                                            : (
                                                <ResponsiveContainer width="100%" height={260}>
                                                    <AreaChart data={rewardsPerDay}
                                                        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                                                        <defs>
                                                            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                                                                <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f2f4" vertical={false} />
                                                        <XAxis dataKey="date"
                                                            tick={{ fontSize: 11, fill: "#8c9196" }}
                                                            tickLine={false} axisLine={false} />
                                                        <YAxis
                                                            tick={{ fontSize: 11, fill: "#8c9196" }}
                                                            tickLine={false} axisLine={false}
                                                            tickFormatter={(v) => `${currencySymbols[selectedCurrency] || ""}${v}`} />
                                                        <RechartsTooltip
                                                            content={<CustomChartTooltip currencyCode={selectedCurrency} />} />
                                                        <Area type="monotone" dataKey="amount" name="Issued"
                                                            stroke={CHART_COLORS.primary} strokeWidth={2.5}
                                                            fillOpacity={1} fill="url(#colorAmount)"
                                                            activeDot={{ r: 6 }} />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            )
                                    }
                                </s-stack>
                            </s-section>

                            {/* Chart 2 — Customer Frequency By Date (Grouped Bar) */}
                            <s-section padding="base" background="surface" borderWidth="base" borderRadius="base">
                                <s-stack direction="block" gap="base">
                                    <s-stack direction="block" gap="none">
                                        <s-heading variant="headingXs">Customer Frequency By Date</s-heading>
                                        <s-text color="subdued" variant="small">
                                            Customers earn credit for the first time vs repeatedly. · Currency: {selectedCurrency}
                                        </s-text>
                                    </s-stack>
                                    {isFetching
                                        ? <SkeletonLines lines={6} height={16} />
                                        : customerFrequencyByDate.length === 0
                                            ? <ChartEmptyState />
                                            : (
                                                <ResponsiveContainer width="100%" height={260}>
                                                    <BarChart data={customerFrequencyByDate}
                                                        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                                                        barCategoryGap="25%" barGap={6}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f2f4" vertical={false} />
                                                        <XAxis dataKey="date"
                                                            tick={{ fontSize: 11, fill: "#8c9196" }}
                                                            tickLine={false} axisLine={false} />
                                                        <YAxis
                                                            tick={{ fontSize: 11, fill: "#8c9196" }}
                                                            tickLine={false} axisLine={false} allowDecimals={false} />
                                                        <RechartsTooltip
                                                            content={<CustomChartTooltip currencyCode={selectedCurrency} isCount />}
                                                            cursor={{ fill: '#f4f6f8' }} />
                                                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                                                        <Bar dataKey="new" name="New"
                                                            fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={16} />
                                                        <Bar dataKey="repeat" name="Repeat"
                                                            fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} maxBarSize={16} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            )
                                    }
                                </s-stack>
                            </s-section>
                        </s-grid>

                        {/* Row 2 - Total Rewards By Program */}
                        <s-section padding="base" background="surface" borderWidth="base" borderRadius="base">
                            <s-stack direction="block" gap="base">
                                <s-stack direction="block" gap="none">
                                    <s-heading variant="headingXs">Total Rewards By Program</s-heading>
                                    <s-text color="subdued" variant="small">Currency: {selectedCurrency}</s-text>
                                </s-stack>
                                {isFetching
                                    ? <SkeletonLines lines={6} height={16} />
                                    : rewardsByProgram.length === 0
                                        ? <ChartEmptyState />
                                        : (
                                            <ResponsiveContainer width="100%" height={280}>
                                                <BarChart data={rewardsByProgram}
                                                    margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                                                    barCategoryGap="25%">
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f2f4" vertical={false} />
                                                    <XAxis dataKey="name"
                                                        tick={{ fontSize: 12, fill: "#202223" }}
                                                        tickLine={false} axisLine={false} />
                                                    <YAxis
                                                        tick={{ fontSize: 11, fill: "#8c9196" }}
                                                        tickLine={false} axisLine={false}
                                                        tickFormatter={(v) => `${currencySymbols[selectedCurrency] || ""}${v}`} />
                                                    <RechartsTooltip
                                                        content={<CustomChartTooltip currencyCode={selectedCurrency} />}
                                                        cursor={{ fill: '#f4f6f8' }} />
                                                    <Bar dataKey="value" name="Rewards" radius={[4, 4, 0, 0]} maxBarSize={32}>
                                                        {rewardsByProgram.map((_, idx) => (
                                                            <Cell key={`cell-${idx}`}
                                                                fill={PROGRAM_COLORS[idx % PROGRAM_COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )
                                }
                            </s-stack>
                        </s-section>

                    </s-stack>

                    <s-box paddingBlockStart="large" />
                </s-stack>
            </s-page>
        </s-box>
    );
}

