import { useState, useCallback, useEffect } from "react";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import {
  Page,
  Layout,
  LegacyCard,
  Button,
  InlineStack,
  BlockStack,
  Text,
  Box,
  EmptyState,
  Modal,
  DescriptionList,
  Pagination,
  Tooltip,
  IndexFilters,
  IndexTable,
  ChoiceList,
  Badge,
  useSetIndexFiltersMode,
  IndexFiltersMode,
  SkeletonDisplayText,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import connectMongoDB, {
  getShopModel,
  syncMongoStoreSession,
  migrateShopData,
} from "../db.mongodb.server";

// Helper to format date cleanly
function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Loader to fetch logged database transactions for the merchant from MongoDB customer collections
export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  await syncMongoStoreSession(session);
  const shop = session.shop;

  // Process matured delayed store credits so they are up-to-date in the listing
  try {
    const { processDelayedCredits } =
      await import("../services/webhookProcessor.server");
    await processDelayedCredits(shop, admin);
  } catch (err) {
    console.error(
      "Failed to run processDelayedCredits in transactions loader:",
      err,
    );
  }

  const url = new URL(request.url);
  const activeTabId = url.searchParams.get("tab") || "0"; // "0" for Cashback, "1" for Custom Program

  // Connect to MongoDB
  await connectMongoDB();

  const allTransactions = [];

  try {
    const ShopModel = getShopModel(shop);
    if (ShopModel) {
      await migrateShopData(shop);
      await ShopModel.updateMany(
        { "events.programType": "Custom Program" },
        { $set: { "events.$[elem].programType": "Cashback" } },
        { arrayFilters: [{ "elem.programType": "Custom Program" }] }
      );
    }
    const docs = ShopModel ? await ShopModel.find({}) : [];

    for (const doc of docs) {
      if (doc.events && Array.isArray(doc.events)) {
        for (const ev of doc.events) {
          // Only push events that are in MongoDB (all events here are from MongoDB)
          // Skip events with no orderId (corrupted data)
          if (!ev.orderId) continue;

          // Filter by tab type
          if (activeTabId === "1") {
            if ((ev.programType || ev.type) !== "Custom Program") continue;
          } else {
            if ((ev.programType || ev.type) === "Custom Program") continue;
          }

          allTransactions.push({
            id: ev._id
              ? ev._id.toString()
              : String(ev.orderId || Math.random()),
            orderId: ev.orderId,
            customerId: ev.customerId,
            orderName: ev.orderName,
            createdAt: ev.createdAt
              ? new Date(ev.createdAt).toISOString()
              : new Date(doc.createdAt).toISOString(),
            issuedAt:
              ev.status === "Completed" && ev.issuedAt
                ? new Date(ev.issuedAt).toISOString()
                : null,
            processAt: ev.processAt
              ? new Date(ev.processAt).toISOString()
              : null,
            customerName: ev.customerName,
            issuedAmount: Number(ev.issuedAmount || 0),
            redeemedAmount: Number(ev.redeemedAmount || 0),
            currency: ev.currency,
            status: ev.status,
            emailStatus: ev.emailStatus,
            emailFailReason: ev.emailFailReason || "",
            type: ev.programType || ev.type || "Cashback",
          });
        }
      }
    }
  } catch (err) {
    console.error("❌ Error querying store collection in loader:", err);
  }

  // Sort combined results by createdAt descending
  allTransactions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // Deduplicate by orderId
  const uniqueTransactionsMap = new Map();
  for (const tx of allTransactions) {
    if (!tx.orderId) continue;
    if (!uniqueTransactionsMap.has(tx.orderId)) {
      uniqueTransactionsMap.set(tx.orderId, tx);
    } else {
      // If we already have this order, prefer 'Completed' over 'Pending'
      const existing = uniqueTransactionsMap.get(tx.orderId);
      if (tx.status === "Completed" && existing.status !== "Completed") {
        uniqueTransactionsMap.set(tx.orderId, tx);
      }
    }
  }
  const uniqueTransactions = Array.from(uniqueTransactionsMap.values());

  let enableDelay = false;
  try {
    const { getShopPrograms } = await import("../services/storeCredit.server");
    const programs = await getShopPrograms(admin);
    if (programs && programs.length > 0) {
      const prog = programs[0];
      enableDelay = prog.enableDelay === true || prog.enableDelay === "true";
    }
  } catch (err) {
    console.error("Error fetching programs in transactions loader:", err);
  }

  return {
    transactions: uniqueTransactions,
    searchQuery: "",
    activeTabId: parseInt(activeTabId, 10),
    shop,
    enableDelay,
  };
}

// Action to generate high performance CSV download file from MongoDB customer collections
export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "export") {
    const tab = formData.get("tab") || "0";
    const searchQuery = formData.get("query") || "";
    const sortValue = formData.get("sort") || "newest";
    const filterDate = formData.get("date") || "all";
    const filterStatusStr = formData.get("status") || "";
    const filterStatus = filterStatusStr ? filterStatusStr.split(",") : [];

    // Connect to MongoDB

    // Connect to MongoDB
    await connectMongoDB();

    const allTransactions = [];

    try {
      const ShopModel = getShopModel(shop);
      const docs = await ShopModel.find({});

      for (const doc of docs) {
        if (doc.events && Array.isArray(doc.events)) {
          for (const ev of doc.events) {
            // 1. Program Type Filter
            if (tab === "1") {
              if ((ev.programType || ev.type) !== "Custom Program") continue;
            } else {
              if ((ev.programType || ev.type) === "Custom Program") continue;
            }

            // 2. Search Query Filter
            if (searchQuery) {
              const matchesQuery =
                String(ev.orderName || "")
                  .toLowerCase()
                  .includes(searchQuery.toLowerCase()) ||
                String(ev.customerName || "")
                  .toLowerCase()
                  .includes(searchQuery.toLowerCase());
              if (!matchesQuery) {
                continue;
              }
            }

            allTransactions.push({
              orderId: ev.orderId,
              orderName: ev.orderName,
              customerName: ev.customerName,
              issuedAmount: Number(ev.issuedAmount || 0),
              redeemedAmount: Number(ev.redeemedAmount || 0),
              currency: ev.currency,
              status: ev.status,
              emailStatus: ev.emailStatus,
              type: ev.programType || ev.type || "Cashback",
              createdAt: ev.createdAt
                ? new Date(ev.createdAt)
                : new Date(doc.createdAt),
              issuedAt: ev.issuedAt
                ? new Date(ev.issuedAt)
                : ev.createdAt
                  ? new Date(ev.createdAt)
                  : new Date(doc.createdAt),
            });
          }
        }
      }
    } catch (err) {
      console.error("❌ Error exporting from store collection:", err);
    }

    // Sort combined results dynamically based on sortValue
    allTransactions.sort((a, b) => {
      if (sortValue === "newest") {
        return b.createdAt.getTime() - a.createdAt.getTime();
      } else if (sortValue === "oldest") {
        return a.createdAt.getTime() - b.createdAt.getTime();
      } else if (sortValue === "amount-high") {
        return (b.issuedAmount || b.redeemedAmount || 0) - (a.issuedAmount || a.redeemedAmount || 0);
      } else if (sortValue === "amount-low") {
        return (a.issuedAmount || a.redeemedAmount || 0) - (b.issuedAmount || b.redeemedAmount || 0);
      }
      return 0;
    });

    // Dynamic Date Range Calculation Helper for action
    const getDateRangeForAction = () => {
      const now = new Date();
      now.setHours(23, 59, 59, 999);

      let start = null;
      let end = new Date(now);

      if (filterDate === "today") {
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
      } else if (filterDate === "yesterday") {
        start = new Date(now);
        start.setDate(now.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
      } else if (filterDate === "7days") {
        start = new Date(now);
        start.setDate(now.getDate() - 6);
        start.setHours(0, 0, 0, 0);
      } else if (filterDate === "30days") {
        start = new Date(now);
        start.setDate(now.getDate() - 29);
        start.setHours(0, 0, 0, 0);
      }
      return { start, end };
    };

    const { start: dateStart, end: dateEnd } = getDateRangeForAction();

    // Deduplicate by orderId
    const uniqueTransactionsMap = new Map();
    for (const tx of allTransactions) {
      if (!tx.orderId) continue;
      if (!uniqueTransactionsMap.has(tx.orderId)) {
        uniqueTransactionsMap.set(tx.orderId, tx);
      } else {
        const existing = uniqueTransactionsMap.get(tx.orderId);
        if (tx.status === "Completed" && existing.status !== "Completed") {
          uniqueTransactionsMap.set(tx.orderId, tx);
        }
      }
    }
    const uniqueTransactions = Array.from(uniqueTransactionsMap.values());

    // Filter results on status and dates
    const filtered = uniqueTransactions.filter((t) => {
      // 1. Status Filter
      if (filterStatus.length > 0 && !filterStatus.includes(t.status)) {
        return false;
      }
      // 2. Date Filter
      if (filterDate !== "all" && dateStart) {
        const txDate = new Date(t.createdAt);
        if (txDate < dateStart || txDate > dateEnd) {
          return false;
        }
      }
      return true;
    });

    const headers = [
      "Order name",
      "Order ID",
      "Campaign",
      "Creation date",
      "Issued date",
      "Customer",
      "Company name",
      "Issued Amount",
      "Redeemed Amount",
      "Currency",
      "Issue status",
      "Error message",
      "Cancellation reason",
    ];

    const rows = filtered.map((t) => [
      t.orderName,
      t.orderId || "",
      t.type || "Cashback",
      formatDate(t.createdAt),
      formatDate(t.issuedAt),
      t.customerName,
      "", // Company name (blank)
      t.issuedAmount,
      t.redeemedAmount,
      t.currency,
      String(t.status || "completed").toLowerCase(),
      "", // Error message (blank)
      "", // Cancellation reason (blank)
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="loyalty_credit_transactions_${Date.now()}.csv"`,
      },
    });
  }

  return null;
}

export default function Transactions() {
  const { transactions, searchQuery, activeTabId, shop, enableDelay } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [searchVal, setSearchVal] = useState(searchQuery);
  const [sortSelected, setSortSelected] = useState(["date desc"]);
  const sortValue = sortSelected[0] || "date desc";

  const [filterStatus, setFilterStatus] = useState([]); // array of active statuses, e.g. ["Completed", "Pending"]
  const [filterDate, setFilterDate] = useState("all"); // "all", "today", "yesterday", "7days", "30days"

  const { mode, setMode } = useSetIndexFiltersMode();

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchVal, sortValue, filterDate, filterStatus, activeTabId]);

  // Compute sorted transactions array dynamically on the client-side
  const sortedTransactions = [...transactions].sort((a, b) => {
    if (sortValue === "date desc") {
      // Newest first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else if (sortValue === "date asc") {
      // Oldest first
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (sortValue === "amount desc") {
      // High to low
      return Number(b.issuedAmount || b.redeemedAmount || 0) - Number(a.issuedAmount || a.redeemedAmount || 0);
    } else if (sortValue === "amount asc") {
      // Low to high
      return Number(a.issuedAmount || a.redeemedAmount || 0) - Number(b.issuedAmount || b.redeemedAmount || 0);
    }
    return 0;
  });

  // Dynamic Date Range Calculation Helper
  const getDateRange = () => {
    const now = new Date();
    now.setHours(23, 59, 59, 999); // end of today

    let start = null;
    let end = new Date(now);

    if (filterDate === "today") {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
    } else if (filterDate === "yesterday") {
      start = new Date(now);
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
    } else if (filterDate === "7days") {
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (filterDate === "30days") {
      start = new Date(now);
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    } else if (filterDate === "lastweek") {
      const dayOfWeek = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek - 7);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (filterDate === "lastmonth") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (filterDate === "weektodate") {
      const dayOfWeek = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
    } else if (filterDate === "monthtodate") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }

    return { start, end };
  };

  // Filter sorted transactions list on status, dates, and client-side search query
  const filteredTransactions = sortedTransactions.filter((t) => {
    // 1. Status Filter
    if (filterStatus.length > 0 && !filterStatus.includes(t.status)) {
      return false;
    }

    // 2. Date Filter
    if (filterDate !== "all") {
      const { start, end } = getDateRange();
      const transactionDate = new Date(t.createdAt);
      if (start && (transactionDate < start || transactionDate > end)) {
        return false;
      }
    }

    // 3. Search Query Filter (Instant client-side evaluation)
    if (searchVal) {
      const q = searchVal.toLowerCase().trim();
      const matches =
        String(t.orderName || "")
          .toLowerCase()
          .includes(q) ||
        String(t.customerName || "")
          .toLowerCase()
          .includes(q);
      if (!matches) {
        return false;
      }
    }

    return true;
  });

  const tabs = [
    { id: "0", content: "Cashback Program", index: 0 },
    // { id: "1", content: "Custom Program", index: 1 },
  ];

  const handleTabChange = useCallback(
    (selectedTabIndex) => {
      const params = new URLSearchParams();
      params.set("tab", String(selectedTabIndex));
      submit(params, { method: "get", replace: true });
    },
    [submit],
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (navigation.state === "idle" && isRefreshing) {
      setIsRefreshing(false);
    }
  }, [navigation.state, isRefreshing]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    const params = new URLSearchParams();
    params.set("tab", String(activeTabId));
    submit(params, { method: "get", replace: true });
  }, [activeTabId, submit]);

  const shopSubdomain = shop ? shop.split(".")[0] : "";

  // Calculate Pagination Data
  const totalItems = filteredTransactions.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const rowMarkup = paginatedTransactions.map(
    (
      {
        id,
        orderId,
        customerId,
        orderName,
        createdAt,
        issuedAt,
        processAt,
        customerName,
        issuedAmount,
        redeemedAmount,
        currency,
        status,
        emailStatus,
        emailFailReason,
      },
      index,
    ) => {
      const cleanCustomerId = customerId ? customerId.split("/").pop() : "";
      const orderUrl = `https://admin.shopify.com/store/${shopSubdomain}/orders/${orderId}`;
      const customerUrl = `https://admin.shopify.com/store/${shopSubdomain}/customers/${cleanCustomerId}`;

      return (
        <IndexTable.Row
          id={id}
          key={id}
          position={index}
        >
          <IndexTable.Cell>
            <a
              href={orderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ab-link"
            >
              <Text variant="bodyMd" fontWeight="bold" as="span">
                {orderName}
              </Text>
            </a>
          </IndexTable.Cell>
          <IndexTable.Cell>{formatDate(createdAt)}</IndexTable.Cell>
          <IndexTable.Cell>
            {status === "Completed" ? formatDate(issuedAt) : "-"}
          </IndexTable.Cell>
          <IndexTable.Cell>
            <a
              href={customerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ab-link"
            >
              {customerName}
            </a>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text variant="bodyMd" fontWeight="bold" as="span" tone={issuedAmount > 0 ? "success" : undefined}>
              {issuedAmount > 0 ? `+${Number(issuedAmount).toFixed(2)}` : "-"} {currency}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            {status === "Pending" ? (
              <Tooltip
                content={
                  enableDelay
                    ? "Store credit is automatically added when the order is marked as fulfilled and after the configured delay."
                    : "Order is not yet fulfilled."
                }
              >
                <span>
                  <Badge tone="warning">{status}</Badge>
                </span>
              </Tooltip>
            ) : (
              <Badge tone={status === "Completed" ? "success" : "warning"}>
                {status}
              </Badge>
            )}
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Badge
              tone={
                emailStatus === "Sent"
                  ? "success"
                  : emailStatus === "Failed"
                    ? "critical"
                    : "info"
              }
            >
              {emailStatus}
            </Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Button
              variant="plain"
              onClick={() => {
                setSelectedTransaction({
                  id,
                  orderId,
                  customerId,
                  orderName,
                  createdAt,
                  issuedAt,
                  processAt,
                  customerName,
                  issuedAmount,
                  redeemedAmount,
                  currency,
                  status,
                  emailStatus,
                  emailFailReason,
                  orderUrl,
                  customerUrl,
                });
                setIsDetailsOpen(true);
              }}
            >
              View Details
            </Button>
          </IndexTable.Cell>
        </IndexTable.Row>
      );
    },
  );

  const isLoading = navigation.state === "loading" || isRefreshing;

  const skeletonRows = Array.from({ length: paginatedTransactions.length > 0 ? paginatedTransactions.length : 5 }).map(
    (_, index) => (
      <IndexTable.Row
        id={`skeleton-row-${index}`}
        key={`skeleton-row-${index}`}
        position={index}
      >
        <IndexTable.Cell>
          <div style={{ padding: "4px 0" }}>
            <SkeletonDisplayText size="small" />
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <SkeletonDisplayText size="small" />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <SkeletonDisplayText size="small" />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <SkeletonDisplayText size="small" />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <SkeletonDisplayText size="small" />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <SkeletonDisplayText size="small" />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <SkeletonDisplayText size="small" />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <SkeletonDisplayText size="small" />
        </IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  const dateRangeChoices = [
    { label: "All", value: "all" },
    { label: "Today", value: "today" },
    { label: "Yesterday", value: "yesterday" },
    { label: "Last 7 days", value: "7days" },
    { label: "Last 30 days", value: "30days" },
    { label: "Last week", value: "lastweek" },
    { label: "Last month", value: "lastmonth" },
    { label: "Week to date", value: "weektodate" },
    { label: "Month to date", value: "monthtodate" },
  ];

  const statusChoices = [
    { label: "Pending", value: "Pending" },
    { label: "Cancelled", value: "Cancelled" },
    { label: "Cancel Error", value: "Cancel Error" },
    { label: "Failed", value: "Failed" },
    { label: "Completed", value: "Completed" },
  ];

  const filters = [
    {
      key: "dateRange",
      label: "Date range",
      filter: (
        <ChoiceList
          title="Date range"
          titleHidden
          choices={dateRangeChoices}
          selected={[filterDate]}
          onChange={(value) => setFilterDate(value[0])}
        />
      ),
      shortcut: true,
    },
    {
      key: "issueStatus",
      label: "Issue status",
      filter: (
        <ChoiceList
          title="Issue status"
          titleHidden
          choices={statusChoices}
          selected={filterStatus}
          onChange={setFilterStatus}
          allowMultiple
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = [];
  if (filterDate !== "all") {
    const label = dateRangeChoices.find((c) => c.value === filterDate)?.label || filterDate;
    appliedFilters.push({
      key: "dateRange",
      label: `Date: ${label}`,
      onRemove: () => setFilterDate("all"),
    });
  }
  if (filterStatus.length > 0) {
    appliedFilters.push({
      key: "issueStatus",
      label: `Status: ${filterStatus.join(", ")}`,
      onRemove: () => setFilterStatus([]),
    });
  }

  const handleFiltersClearAll = useCallback(() => {
    setFilterDate("all");
    setFilterStatus([]);
  }, []);

  const handleFiltersCancel = useCallback(() => {
    setMode(IndexFiltersMode.Default);
  }, [setMode]);

  const handleQueryValueChange = useCallback((value) => setSearchVal(value), []);
  const handleQueryValueRemove = useCallback(() => setSearchVal(""), []);

  // Polaris IndexFilters requires sort values in "field direction" format
  // (split by space internally to determine which arrow to highlight)
  const sortOptions = [
    { label: "Creation date", value: "date desc", directionLabel: "Newest to oldest" },
    { label: "Creation date", value: "date asc", directionLabel: "Oldest to newest" },
    { label: "Store credit amount", value: "amount desc", directionLabel: "Highest to lowest" },
    { label: "Store credit amount", value: "amount asc", directionLabel: "Lowest to highest" },
  ];

  const handleSortChange = useCallback((value) => {
    setSortSelected(value);
  }, []);

  const resourceName = {
    singular: "transaction",
    plural: "transactions",
  };

  return (
    <Page
      title="Transactions"
      primaryAction={{
        content: isLoading ? "Refreshing..." : "Refresh Data",
        onAction: handleRefresh,
        disabled: isLoading,
        loading: isLoading,
      }}
    >
      <style>{`
        .ab-link {
          color: var(--p-color-text-brand) !important;
          text-decoration: none !important;
          cursor: pointer !important;
        }
        .ab-link:hover {
          text-decoration: underline !important;
        }
        /* Overrides to make filters display correctly inside legacy card */
        .Polaris-LegacyCard {
          overflow: visible !important;
        }
      `}</style>
      <Layout>
        <Layout.Section>
          <LegacyCard>
            {transactions.length === 0 ? (
              <EmptyState
                heading="No transactions recorded"
                image="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT7dBIEy6r7yQ4KG2HydPxQmpTnQINwJZN5fw&s"
              >
                <p>
                  There are currently no store credit rewards issued or
                  transactions recorded. Once customers place orders
                  matching your store credit or custom program campaigns,
                  their rewards transactions will show up here
                  automatically.
                </p>
              </EmptyState>
            ) : (
              <>
                <IndexFilters
                  sortOptions={sortOptions}
                  sortSelected={sortSelected}
                  queryValue={searchVal}
                  queryPlaceholder="Search by Order ID or Customer Name"
                  onQueryChange={handleQueryValueChange}
                  onQueryClear={handleQueryValueRemove}
                  onSort={handleSortChange}
                  tabs={tabs}
                  selected={activeTabId}
                  onSelect={handleTabChange}
                  filters={filters}
                  appliedFilters={appliedFilters}
                  onClearAll={handleFiltersClearAll}
                  cancelAction={{
                    onAction: handleFiltersCancel,
                  }}
                  mode={mode}
                  setMode={setMode}
                  canCreateNewView={false}
                />
                {filteredTransactions.length === 0 ? (
                  <Box padding="400">
                    <EmptyState
                      heading="No transactions found"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>
                        There are currently no recorded store credit transactions
                        matching this filter. Try changing your search query or
                        clearing active filters.
                      </p>
                    </EmptyState>
                  </Box>
                ) : (
                  <>
                    <IndexTable
                      resourceName={resourceName}
                      itemCount={filteredTransactions.length}
                      selectable={false}
                      headings={[
                        { title: "Order" },
                        { title: "Created At" },
                        { title: "Issued At" },
                        { title: "Customer Name" },
                        { title: "Earned/Issued" },
                        { title: "Status" },
                        { title: "Email Status" },
                        { title: "Actions" },
                      ]}
                    >
                      {rowMarkup}
                    </IndexTable>
                    {totalPages > 1 && (
                      <Box paddingBlockStart="300" paddingBlockEnd="300">
                        <InlineStack align="center">
                          <Pagination
                            hasPrevious={currentPage > 1}
                            onPrevious={() => setCurrentPage((prev) => prev - 1)}
                            hasNext={currentPage < totalPages}
                            onNext={() => setCurrentPage((prev) => prev + 1)}
                            label={`Page ${currentPage} of ${totalPages}`}
                          />
                        </InlineStack>
                      </Box>
                    )}
                  </>
                )}
              </>
            )}
          </LegacyCard>
        </Layout.Section>
      </Layout>

      {selectedTransaction && (
        <Modal
          open={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          title="Store Credit Transaction Details"
          primaryAction={{
            content: "Close",
            onAction: () => setIsDetailsOpen(false),
          }}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <DescriptionList
                items={[
                  {
                    term: "Transaction ID",
                    description: (
                      <Text variant="bodyMd" fontWeight="semibold">
                        {selectedTransaction.id}
                      </Text>
                    ),
                  },
                  {
                    term: "Associated Order",
                    description: (
                      <a
                        href={selectedTransaction.orderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ab-link"
                      >
                        <strong>{selectedTransaction.orderName}</strong>
                      </a>
                    ),
                  },
                  {
                    term: "Customer Profile",
                    description: (
                      <a
                        href={selectedTransaction.customerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ab-link"
                      >
                        {selectedTransaction.customerName}
                      </a>
                    ),
                  },
                  {
                    term: "Store Credit Issued",
                    description: (
                      <Text variant="bodyMd" fontWeight="bold" tone="success">
                        {Number(selectedTransaction.issuedAmount || 0).toFixed(2)}{" "}
                        {selectedTransaction.currency}
                      </Text>
                    ),
                  },
                  {
                    term: "Store Credit Redeemed",
                    description: (
                      <Text variant="bodyMd" fontWeight="bold" tone="critical">
                        {Number(selectedTransaction.redeemedAmount || 0).toFixed(2)}{" "}
                        {selectedTransaction.currency}
                      </Text>
                    ),
                  },
                  {
                    term: "Log Time",
                    description: (
                      <Text variant="bodyMd">
                        {formatDate(selectedTransaction.createdAt)}
                      </Text>
                    ),
                  },
                  {
                    term: "Issuance Time",
                    description: (
                      <Text variant="bodyMd">
                        {selectedTransaction.issuedAt
                          ? formatDate(selectedTransaction.issuedAt)
                          : selectedTransaction.processAt
                            ? `Scheduled: ${formatDate(selectedTransaction.processAt)} (Delayed)`
                            : "-"}
                      </Text>
                    ),
                  },
                  {
                    term: "Transaction Status",
                    description: (
                      <Badge
                        tone={
                          selectedTransaction.status === "Completed"
                            ? "success"
                            : "warning"
                        }
                      >
                        {selectedTransaction.status}
                      </Badge>
                    ),
                  },
                  {
                    term: "Merchant Notification",
                    description: (
                      <Badge
                        tone={
                          selectedTransaction.emailStatus === "Sent"
                            ? "success"
                            : selectedTransaction.emailStatus === "Failed"
                              ? "critical"
                              : "info"
                        }
                      >
                        {selectedTransaction.emailStatus}
                      </Badge>
                    ),
                  },
                  ...(selectedTransaction.emailFailReason
                    ? [
                      {
                        term: "Notification Issue Reason",
                        description: (
                          <Text variant="bodyMd" tone="critical">
                            {selectedTransaction.emailFailReason}
                          </Text>
                        ),
                      },
                    ]
                    : []),
                ]}
              />
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
