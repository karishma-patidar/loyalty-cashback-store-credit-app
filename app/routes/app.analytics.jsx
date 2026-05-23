import { useState, useCallback, useEffect } from "react";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import {
    Page,
    Layout,
    Card,
    BlockStack,
    InlineStack,
    Text,
    DatePicker,
    Box,
    Divider,
    Button,
    Popover,
    Tooltip,
    Grid,
    Badge,
    Spinner,
    SkeletonBodyText,
    SkeletonDisplayText,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import connectMongoDB, { getShopModel } from "../db.mongodb.server";

// ─── GraphQL Queries ───────────────────────────────────────────────────────────

const GET_STORE_CURRENCY = `#graphql
  query GetStoreCurrency {
    shop {
      currencyCode
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
      }
    }
  }
`;

const GET_TRANSACTIONS_QUERY = `#graphql
  query GetStoreCreditTransactions {
    storeCreditAccountTransactions {
      edges {
        node {
          id
          amount {
            amount
            currencyCode
          }
          transactionType
          createdAt
          account {
            id
            owner {
              __typename
              ... on Customer {
                id
                displayName
                email
              }
              ... on CompanyLocation {
                id
                name
              }
            }
          }
        }
      }
    }
  }
`;

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

// ─── Tooltip texts ─────────────────────────────────────────────────────────────

const TOOLTIPS = {
    issuedCredit: "The total value of loyalty cashback credits issued from reward programs and manual adjustments, excluding refunded or debited credits.",
    appliedCredit: "The total value of loyalty cashback credits redeemed and applied to customer orders.",
    debitRefunded: "The total amount of credits refunded, reversed, or removed from customer balances.",
    redemptionRate: "Percentage of issued loyalty cashback credits successfully redeemed by customers.",
    totalOrders: "Number of orders where loyalty cashback credit was issued or redeemed.",
    totalSales: "Combined sales value generated from orders associated with cashback credits.",
    aov: "Average order value for orders containing loyalty cashback credits.",
    totalCustomersRedeem: "Total customers who redeemed loyalty cashback credits.",
    totalDistributedCustomers: "Number of customers who received cashback credits.",
    totalDistributedLocations: "Number of company locations where cashback credits were distributed.",
};

// ─── Inline SVG Icons ──────────────────────────────────────────────────────────

const CalendarIcon = () => (
    <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        style={{ width: 16, height: 16, display: "inline-block", verticalAlign: "middle" }}
    >
        <path
            fillRule="evenodd"
            d="M6.5 2a.75.75 0 0 1 .75.75V4h5.5V2.75a.75.75 0 0 1 1.5 0V4h1.25A2.5 2.5 0 0 1 18 6.5v9A2.5 2.5 0 0 1 15.5 18h-11A2.5 2.5 0 0 1 2 15.5v-9A2.5 2.5 0 0 1 4.5 4H5.75V2.75A.75.75 0 0 1 6.5 2Zm10 7.5h-13v6a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-6ZM5.75 5.5v.75a.75.75 0 0 1-1.5 0V5.5H4.5A1 1 0 0 0 3.5 6.5V8h13V6.5a1 1 0 0 0-1-1h-.25v.75a.75.75 0 0 1-1.5 0V5.5H5.75Z"
            clipRule="evenodd"
        />
    </svg>
);

// ─── Loader ────────────────────────────────────────────────────────────────────

export const loader = async ({ request }) => {
    const { admin, session } = await authenticate.admin(request);
    const shop = session.shop;

    const url = new URL(request.url);
    const preset = url.searchParams.get("preset") || "today";
    const customStart = url.searchParams.get("startDate") || "";
    const customEnd = url.searchParams.get("endDate") || "";

    await connectMongoDB();
    await new Promise((resolve) => setTimeout(resolve, 850));

    const { start, end } = calculateDateRange(preset, customStart, customEnd);

    let currencyCode = "INR";
    try {
        const shopRes = await admin.graphql(GET_STORE_CURRENCY);
        const shopData = await shopRes.json();
        currencyCode = shopData?.data?.shop?.currencyCode || "INR";
    } catch (err) {
        console.error("Error fetching shop currency:", err);
    }

    let allEvents = [];
    try {
        const ShopModel = getShopModel(shop);
        if (ShopModel) {
            const docs = await ShopModel.find({});
            for (const doc of docs) {
                if (doc.events && Array.isArray(doc.events)) {
                    for (const ev of doc.events) {
                        if (!ev.orderId) continue;
                        const eventDate = ev.createdAt ? new Date(ev.createdAt) : new Date(doc.createdAt);
                        if (eventDate >= start && eventDate <= end) {
                            allEvents.push({
                                orderId: ev.orderId,
                                orderName: ev.orderName,
                                customerId: ev.customerId,
                                customerName: ev.customerName,
                                amount: Number(ev.amount || 0),
                                currency: ev.currency,
                                status: ev.status,
                                type: ev.type || "Cashback",
                                createdAt: eventDate,
                            });
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error("Error loading MongoDB events:", err);
    }

    const completedEvents = allEvents.filter((e) => e.status === "Completed");
    const uniqueOrderIds = Array.from(new Set(completedEvents.map((e) => e.orderId)));
    const totalOrders = uniqueOrderIds.length;
    const totalDistributedCustomers = new Set(completedEvents.map((e) => e.customerId)).size;
    const issuedCredit = completedEvents.reduce((acc, ev) => acc + ev.amount, 0);

    let totalSales = 0;
    if (uniqueOrderIds.length > 0) {
        try {
            const orderGids = uniqueOrderIds.map((id) =>
                id.startsWith("gid://") ? id : `gid://shopify/Order/${id}`
            );
            const chunkedGids = [];
            for (let i = 0; i < orderGids.length; i += 50) {
                chunkedGids.push(orderGids.slice(i, i + 50));
            }
            for (const chunk of chunkedGids) {
                const orderRes = await admin.graphql(GET_ORDERS_QUERY, { variables: { ids: chunk } });
                const orderData = await orderRes.json();
                const nodes = orderData?.data?.nodes || [];
                for (const order of nodes) {
                    if (order && order.currentTotalPriceSet) {
                        totalSales += parseFloat(order.currentTotalPriceSet.presentmentMoney.amount || "0");
                    }
                }
            }
        } catch (err) {
            console.error("Error loading order prices:", err);
        }
    }

    const aov = totalOrders > 0 ? Number((totalSales / totalOrders).toFixed(2)) : 0;

    let appliedCredit = 0;
    let debitRefunded = 0;
    let totalCustomersRedeem = 0;
    let totalDistributedLocations = 0;
    const redeemCustomersSet = new Set();
    const locationsSet = new Set();

    try {
        const txResponse = await admin.graphql(GET_TRANSACTIONS_QUERY);
        const txData = await txResponse.json();
        const txNodes = txData?.data?.storeCreditAccountTransactions?.edges?.map((e) => e.node) || [];

        for (const node of txNodes) {
            const txDate = new Date(node.createdAt);
            if (txDate >= start && txDate <= end) {
                const amount = parseFloat(node.amount?.amount || "0");
                const type = node.transactionType;
                const owner = node.account?.owner;

                if (type === "DEBIT") {
                    appliedCredit += amount;
                    if (owner && owner.__typename === "Customer") {
                        redeemCustomersSet.add(owner.id);
                    }
                } else if (type === "EXPIRATION" || (type === "ADJUST" && amount < 0) || type === "REVERSION") {
                    debitRefunded += Math.abs(amount);
                }

                if (owner && owner.__typename === "CompanyLocation") {
                    locationsSet.add(owner.id);
                }
            }
        }

        totalCustomersRedeem = redeemCustomersSet.size;
        totalDistributedLocations = locationsSet.size;
    } catch (err) {
        console.error("Error fetching Shopify transactions:", err);
    }

    const redemptionRate = issuedCredit > 0 ? Number(((appliedCredit / issuedCredit) * 100).toFixed(2)) : 0;

    const programsMap = {};
    for (const ev of completedEvents) {
        const progType = ev.type || "Cashback";
        programsMap[progType] = (programsMap[progType] || 0) + ev.amount;
    }
    const topPrograms = Object.entries(programsMap)
        .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
        .sort((a, b) => b.value - a.value);

    const customersMap = {};
    for (const ev of completedEvents) {
        const custId = ev.customerId;
        const custName = ev.customerName || "Anonymous Customer";
        if (!customersMap[custId]) customersMap[custId] = { name: custName, amount: 0 };
        customersMap[custId].amount += ev.amount;
    }
    const topCustomers = Object.values(customersMap)
        .map((c) => ({ name: c.name, amount: Number(c.amount.toFixed(2)) }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

    return {
        preset,
        startDateStr: customStart,
        endDateStr: customEnd,
        currencyCode,
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
            totalDistributedLocations,
        },
        topPrograms,
        topCustomers,
    };
};

// ─── Skeleton metric cell ──────────────────────────────────────────────────────

function MetricSkeleton() {
    return (
        <BlockStack gap="100">
            <SkeletonDisplayText size="small" />
            <SkeletonBodyText lines={1} />
        </BlockStack>
    );
}

// ─── Metric cell ──────────────────────────────────────────────────────────────

function MetricCell({ label, tooltip, value, loading }) {
    return (
        <BlockStack gap="100">
            <Tooltip content={tooltip} dismissOnMouseOut preferredPosition="above">
                <Text
                    variant="bodySm"
                    tone="subdued"
                    as="span"
                    textDecorationLine="underline"
                    fontWeight="medium"
                >
                    {label}
                </Text>
            </Tooltip>
            {loading ? (
                <SkeletonDisplayText size="medium" />
            ) : (
                <Text variant="headingLg" as="p">
                    {value}
                </Text>
            )}
        </BlockStack>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function Analytics() {
    const {
        preset,
        startDateStr,
        endDateStr,
        currencyCode,
        metrics,
        topPrograms,
        topCustomers,
    } = useLoaderData();

    const submit = useSubmit();
    const navigation = useNavigation();
    const isFetching = navigation.state === "loading";

    const [popoverActive, setPopoverActive] = useState(false);
    const [tempPreset, setTempPreset] = useState(preset);

    const initialRange = calculateDateRange(preset, startDateStr, endDateStr);
    const [tempSelectedDates, setTempSelectedDates] = useState({
        start: initialRange.start,
        end: initialRange.end,
    });

    const [{ month, year }, setCalendarMonth] = useState({
        month: tempSelectedDates.start.getMonth(),
        year: tempSelectedDates.start.getFullYear(),
    });

    useEffect(() => {
        if (!isFetching) {
            setTempPreset(preset);
            const currentRange = calculateDateRange(preset, startDateStr, endDateStr);
            setTempSelectedDates({ start: currentRange.start, end: currentRange.end });
        }
    }, [preset, startDateStr, endDateStr, isFetching]);

    const handlePresetChange = (value) => {
        setTempPreset(value);
        if (value !== "custom") {
            const calculated = calculateDateRange(value, "", "");
            setTempSelectedDates({ start: calculated.start, end: calculated.end });
            setCalendarMonth({ month: calculated.start.getMonth(), year: calculated.start.getFullYear() });
        }
    };

    const handleDatePickerChange = (range) => {
        setTempSelectedDates(range);
        setTempPreset("custom");
    };

    const handleMonthChange = (month, year) => setCalendarMonth({ month, year });

    const handleApply = () => {
        setPopoverActive(false);
        const params = new URLSearchParams();
        params.set("preset", tempPreset);
        if (tempPreset === "custom") {
            params.set("startDate", tempSelectedDates.start.toISOString().split("T")[0]);
            params.set("endDate", tempSelectedDates.end.toISOString().split("T")[0]);
        }
        submit(params, { method: "get", replace: true });
    };

    const handleCancel = () => {
        setPopoverActive(false);
        setTempPreset(preset);
        const currentRange = calculateDateRange(preset, startDateStr, endDateStr);
        setTempSelectedDates({ start: currentRange.start, end: currentRange.end });
    };

    const handleRefresh = () => {
        const params = new URLSearchParams();
        params.set("preset", preset);
        if (preset === "custom") {
            params.set("startDate", startDateStr);
            params.set("endDate", endDateStr);
        }
        params.set("_refresh", String(Date.now()));
        submit(params, { method: "get", replace: true });
    };

    const formatInputDate = (date) => {
        if (!date) return "";
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, "0");
        const mon = String(d.getMonth() + 1).padStart(2, "0");
        return `${day}-${mon}-${d.getFullYear()}`;
    };

    const getButtonLabel = () => {
        if (preset === "today") return "Today";
        if (preset === "yesterday") return "Yesterday";
        if (preset === "7days") return "Last 7 days";
        if (preset === "30days") return "Last 30 days";
        return `${formatInputDate(initialRange.start)} – ${formatInputDate(initialRange.end)}`;
    };

    const presetsOptions = [
        { label: "Today", value: "today" },
        { label: "Yesterday", value: "yesterday" },
        { label: "Last 7 days", value: "7days" },
        { label: "Last 30 days", value: "30days" },
        { label: "Custom range", value: "custom" },
    ];

    const togglePopoverActive = useCallback(() => setPopoverActive((v) => !v), []);

    const datePickerActivator = (
        <Button onClick={togglePopoverActive} icon={CalendarIcon}>
            {getButtonLabel()}
        </Button>
    );

    return (
        <Page
            title="Analytics"
            primaryAction={{
                content: isFetching ? "Refreshing..." : "Refresh data",
                onAction: handleRefresh,
                disabled: isFetching,
                loading: isFetching,
            }}
        >
            <Layout>
                {/* ── Date Range Filter ── */}
                <Layout.Section>
                    <InlineStack align="start">
                        <Popover
                            active={popoverActive}
                            activator={datePickerActivator}
                            onClose={togglePopoverActive}
                            autofocusTarget="none"
                        >
                            <Box padding="400" minWidth="330px">
                                <BlockStack gap="400">
                                    <Text variant="headingSm" as="h3">
                                        Date range
                                    </Text>

                                    {/* Preset select */}
                                    <BlockStack gap="100">
                                        <Text variant="bodyXs" as="label" tone="subdued">
                                            Preset range
                                        </Text>
                                        <select
                                            value={tempPreset}
                                            onChange={(e) => handlePresetChange(e.target.value)}
                                            style={{
                                                width: "100%",
                                                padding: "8px 12px",
                                                borderRadius: "6px",
                                                border: "1px solid #d2d5d8",
                                                backgroundColor: "#ffffff",
                                                fontSize: "13px",
                                                outline: "none",
                                            }}
                                        >
                                            {presetsOptions.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </BlockStack>

                                    {/* Date inputs */}
                                    <InlineStack gap="300" wrap={false}>
                                        <Box flex="1">
                                            <BlockStack gap="100">
                                                <Text variant="bodyXs" as="label" tone="subdued">
                                                    Starting
                                                </Text>
                                                <input
                                                    type="date"
                                                    value={tempSelectedDates.start.toISOString().split("T")[0]}
                                                    onChange={(e) => {
                                                        const date = new Date(e.target.value);
                                                        if (date.toString() !== "Invalid Date") {
                                                            setTempSelectedDates((prev) => ({ ...prev, start: date }));
                                                            setTempPreset("custom");
                                                        }
                                                    }}
                                                    style={{
                                                        width: "100%",
                                                        padding: "6px 8px",
                                                        borderRadius: "6px",
                                                        border: "1px solid #d2d5d8",
                                                        fontSize: "13px",
                                                    }}
                                                />
                                            </BlockStack>
                                        </Box>
                                        <Box flex="1">
                                            <BlockStack gap="100">
                                                <Text variant="bodyXs" as="label" tone="subdued">
                                                    Ending
                                                </Text>
                                                <input
                                                    type="date"
                                                    value={tempSelectedDates.end.toISOString().split("T")[0]}
                                                    onChange={(e) => {
                                                        const date = new Date(e.target.value);
                                                        if (date.toString() !== "Invalid Date") {
                                                            setTempSelectedDates((prev) => ({ ...prev, end: date }));
                                                            setTempPreset("custom");
                                                        }
                                                    }}
                                                    style={{
                                                        width: "100%",
                                                        padding: "6px 8px",
                                                        borderRadius: "6px",
                                                        border: "1px solid #d2d5d8",
                                                        fontSize: "13px",
                                                    }}
                                                />
                                            </BlockStack>
                                        </Box>
                                    </InlineStack>

                                    {/* Calendar */}
                                    <Box
                                        borderWidth="025"
                                        borderColor="border"
                                        borderRadius="200"
                                        padding="200"
                                    >
                                        <DatePicker
                                            month={month}
                                            year={year}
                                            onChange={handleDatePickerChange}
                                            onMonthChange={handleMonthChange}
                                            selected={tempSelectedDates}
                                            allowRange
                                        />
                                    </Box>

                                    <Text variant="bodyXs" tone="subdued">
                                        Maximum range is 90 days
                                    </Text>

                                    <InlineStack gap="200" align="end">
                                        <Button onClick={handleCancel}>Cancel</Button>
                                        <Button variant="primary" onClick={handleApply}>
                                            Apply
                                        </Button>
                                    </InlineStack>
                                </BlockStack>
                            </Box>
                        </Popover>
                    </InlineStack>
                </Layout.Section>

                {/* ── SECTION 1: Store Credit ── */}
                <Layout.Section>
                    <BlockStack gap="200">
                        <Text variant="headingSm" as="h2" tone="subdued">
                            Store credit
                        </Text>
                        <Card>
                            <BlockStack gap="400">
                                <Grid columns={{ xs: 1, sm: 2, md: 4, lg: 4 }} gap={{ xs: "400", md: "600" }}>
                                    <Grid.Cell>
                                        <MetricCell
                                            label="Issued credit"
                                            tooltip={TOOLTIPS.issuedCredit}
                                            value={formatCurrency(metrics.issuedCredit, currencyCode)}
                                            loading={isFetching}
                                        />
                                    </Grid.Cell>
                                    <Grid.Cell>
                                        <MetricCell
                                            label="Applied credit"
                                            tooltip={TOOLTIPS.appliedCredit}
                                            value={formatCurrency(metrics.appliedCredit, currencyCode)}
                                            loading={isFetching}
                                        />
                                    </Grid.Cell>
                                    <Grid.Cell>
                                        <MetricCell
                                            label="Debit/Refunded credit"
                                            tooltip={TOOLTIPS.debitRefunded}
                                            value={formatCurrency(metrics.debitRefunded, currencyCode)}
                                            loading={isFetching}
                                        />
                                    </Grid.Cell>
                                    <Grid.Cell>
                                        <MetricCell
                                            label="Redemption rate"
                                            tooltip={TOOLTIPS.redemptionRate}
                                            value={`${metrics.redemptionRate.toFixed(2)}%`}
                                            loading={isFetching}
                                        />
                                    </Grid.Cell>
                                </Grid>

                                <Divider />

                                {/* Top Programs */}
                                <BlockStack gap="200">
                                    <Text variant="headingXs" as="h3">
                                        Top programs with issued credits
                                    </Text>
                                    {isFetching ? (
                                        <SkeletonBodyText lines={3} />
                                    ) : topPrograms.length === 0 ? (
                                        <Box paddingBlock="200">
                                            <Text align="center" tone="subdued">
                                                No programs found.
                                            </Text>
                                        </Box>
                                    ) : (
                                        <BlockStack gap="0">
                                            {topPrograms.map((program) => (
                                                <Box
                                                    key={program.name}
                                                    paddingBlock="300"
                                                    borderBlockEndWidth="025"
                                                    borderColor="border-subdued"
                                                >
                                                    <InlineStack align="space-between" blockAlign="center">
                                                        <Text variant="bodySm" tone="subdued">
                                                            {program.name}
                                                        </Text>
                                                        <Text variant="bodySm" fontWeight="semibold">
                                                            {formatCurrency(program.value, currencyCode)}
                                                        </Text>
                                                    </InlineStack>
                                                </Box>
                                            ))}
                                        </BlockStack>
                                    )}
                                </BlockStack>
                            </BlockStack>
                        </Card>
                    </BlockStack>
                </Layout.Section>

                {/* ── SECTION 2: Orders ── */}
                <Layout.Section>
                    <BlockStack gap="200">
                        <Text variant="headingSm" as="h2" tone="subdued">
                            Orders
                        </Text>
                        <Grid columns={{ xs: 1, sm: 1, md: 3, lg: 3 }} gap="400">
                            <Grid.Cell>
                                <Card>
                                    <MetricCell
                                        label="Total orders with issued credit"
                                        tooltip={TOOLTIPS.totalOrders}
                                        value={metrics.totalOrders}
                                        loading={isFetching}
                                    />
                                </Card>
                            </Grid.Cell>
                            <Grid.Cell>
                                <Card>
                                    <MetricCell
                                        label="Total sales of orders with issued credit"
                                        tooltip={TOOLTIPS.totalSales}
                                        value={formatCurrency(metrics.totalSales, currencyCode)}
                                        loading={isFetching}
                                    />
                                </Card>
                            </Grid.Cell>
                            <Grid.Cell>
                                <Card>
                                    <MetricCell
                                        label="AOV with issued credit"
                                        tooltip={TOOLTIPS.aov}
                                        value={formatCurrency(metrics.aov, currencyCode)}
                                        loading={isFetching}
                                    />
                                </Card>
                            </Grid.Cell>
                        </Grid>
                    </BlockStack>
                </Layout.Section>

                {/* ── SECTION 3: Customers ── */}
                <Layout.Section>
                    <BlockStack gap="200">
                        <Text variant="headingSm" as="h2" tone="subdued">
                            Customers
                        </Text>
                        <Card>
                            <BlockStack gap="400">
                                <Grid columns={{ xs: 1, sm: 2, md: 3, lg: 3 }} gap="400">
                                    <Grid.Cell>
                                        <MetricCell
                                            label="Total customers redeem credit"
                                            tooltip={TOOLTIPS.totalCustomersRedeem}
                                            value={metrics.totalCustomersRedeem}
                                            loading={isFetching}
                                        />
                                    </Grid.Cell>
                                    <Grid.Cell>
                                        <MetricCell
                                            label="Total distributed customers"
                                            tooltip={TOOLTIPS.totalDistributedCustomers}
                                            value={metrics.totalDistributedCustomers}
                                            loading={isFetching}
                                        />
                                    </Grid.Cell>
                                    <Grid.Cell>
                                        <MetricCell
                                            label="Total distributed company locations"
                                            tooltip={TOOLTIPS.totalDistributedLocations}
                                            value={metrics.totalDistributedLocations}
                                            loading={isFetching}
                                        />
                                    </Grid.Cell>
                                </Grid>

                                <Divider />

                                {/* Top Customers */}
                                <BlockStack gap="200">
                                    <Text variant="headingXs" as="h3">
                                        Top customers redeem credits
                                    </Text>
                                    {isFetching ? (
                                        <SkeletonBodyText lines={3} />
                                    ) : topCustomers.length === 0 ? (
                                        <Box paddingBlock="200">
                                            <Text align="center" tone="subdued">
                                                No customers found.
                                            </Text>
                                        </Box>
                                    ) : (
                                        <BlockStack gap="0">
                                            {topCustomers.map((cust, idx) => (
                                                <Box
                                                    key={idx}
                                                    paddingBlock="300"
                                                    borderBlockEndWidth="025"
                                                    borderColor="border-subdued"
                                                >
                                                    <InlineStack align="space-between" blockAlign="center">
                                                        <Text variant="bodySm" tone="subdued">
                                                            {cust.name}
                                                        </Text>
                                                        <Text variant="bodySm" fontWeight="semibold">
                                                            {formatCurrency(cust.amount, currencyCode)}
                                                        </Text>
                                                    </InlineStack>
                                                </Box>
                                            ))}
                                        </BlockStack>
                                    )}
                                </BlockStack>
                            </BlockStack>
                        </Card>
                    </BlockStack>
                </Layout.Section>

                <Layout.Section>
                    <Box paddingBlockEnd="400" />
                </Layout.Section>
            </Layout>
        </Page>
    );
}
