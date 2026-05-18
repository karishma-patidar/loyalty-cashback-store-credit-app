import { useState, useCallback, useEffect } from "react";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import {
  Page,
  Layout,
  Card,
  Tabs,
  TextField,
  Button,
  InlineStack,
  BlockStack,
  Text,
  Box,
  EmptyState,
  Modal,
  DescriptionList,
  Popover,
  ActionList,
  Pagination,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import connectMongoDB, {
  getShopModel,
  syncMongoStoreSession,
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
  const { session } = await authenticate.admin(request);
  await syncMongoStoreSession(session);
  const shop = session.shop;

  const url = new URL(request.url);
  const activeTabId = url.searchParams.get("tab") || "0"; // "0" for Cashback, "1" for Custom Program

  const typeFilter = activeTabId === "1" ? "Custom Program" : null;

  // Connect to MongoDB
  await connectMongoDB();

  const allTransactions = [];

  try {
    const ShopModel = getShopModel(shop);
    const docs = await ShopModel.find({});

    for (const doc of docs) {
      if (doc.events && Array.isArray(doc.events)) {
        for (const ev of doc.events) {
          // Only push events that are in MongoDB (all events here are from MongoDB)
          // Skip events with no orderId (corrupted data)
          if (!ev.orderId) continue;

          // Filter by tab type
          if (typeFilter && ev.type !== typeFilter) {
            continue;
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
            customerName: ev.customerName,
            amount: Number(ev.amount || 0),
            currency: ev.currency,
            status: ev.status,
            emailStatus: ev.emailStatus,
            emailFailReason: ev.emailFailReason || "",
            type: ev.type,
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

  return {
    transactions: uniqueTransactions,
    searchQuery: "",
    activeTabId: parseInt(activeTabId, 8),
    shop,
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

      const typeFilter = tab === "1" ? "Custom Program" : null;

      for (const doc of docs) {
        if (doc.events && Array.isArray(doc.events)) {
          for (const ev of doc.events) {
            // 1. Program Type Filter
            if (typeFilter && ev.type !== typeFilter) {
              continue;
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
              amount: Number(ev.amount || 0),
              currency: ev.currency,
              status: ev.status,
              emailStatus: ev.emailStatus,
              type: ev.type,
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
        return b.amount - a.amount;
      } else if (sortValue === "amount-low") {
        return a.amount - b.amount;
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
      "Amount",
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
      t.amount,
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
  const { transactions, searchQuery, activeTabId, shop } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [searchVal, setSearchVal] = useState(searchQuery);
  const [isSearchActive, setIsSearchActive] = useState(!!searchQuery);

  const [sortValue, setSortValue] = useState("newest"); // "newest", "oldest", "amount-high", "amount-low"
  const [isSortOpen, setIsSortOpen] = useState(false);

  const [isAddFilterOpen, setIsAddFilterOpen] = useState(false);
  const [isDateActive, setIsDateActive] = useState(false);
  const [isStatusActive, setIsStatusActive] = useState(false);

  const [filterStatus, setFilterStatus] = useState([]); // array of active statuses, e.g. ["Completed", "Pending"]
  const [filterDate, setFilterDate] = useState("all"); // "all", "today", "yesterday", "7days", "30days"
  const isAddFilterDisabled = isDateActive && isStatusActive;

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchVal, sortValue, filterDate, filterStatus, activeTabId]);

  // Close menus on click outside
  useEffect(() => {
    if (!isAddFilterOpen && !isSortOpen) return;
    const handleClose = () => {
      setIsAddFilterOpen(false);
      setIsSortOpen(false);
    };
    document.addEventListener("click", handleClose);
    return () => document.removeEventListener("click", handleClose);
  }, [isAddFilterOpen, isSortOpen]);

  // Compute sorted transactions array dynamically on the client-side
  const sortedTransactions = [...transactions].sort((a, b) => {
    if (sortValue === "newest") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else if (sortValue === "oldest") {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (sortValue === "amount-high") {
      return Number(b.amount || 0) - Number(a.amount || 0);
    } else if (sortValue === "amount-low") {
      return Number(a.amount || 0) - Number(b.amount || 0);
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
      // Back to Sunday of previous week
      start.setDate(now.getDate() - dayOfWeek - 7);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      // Move 6 days forward to Saturday of previous week
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

  const formatDateStr = (date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDateRangeLabel = () => {
    const { start, end } = getDateRange();
    if (filterDate === "all" || !start) return "Date";
    return `${formatDateStr(start)} – ${formatDateStr(end)}`;
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
    { id: "0", content: "Cashback", panelID: "cashback-panel" },
    { id: "1", content: "Custom Program", panelID: "custom-program-panel" },
  ];

  // Handle Tab Switch
  const handleTabChange = useCallback(
    (selectedTabIndex) => {
      const params = new URLSearchParams();
      params.set("tab", String(selectedTabIndex));
      submit(params, { method: "get", replace: true });
    },
    [submit],
  );

  // Handle Search Input Change
  const handleSearchChange = useCallback((value) => {
    setSearchVal(value);
  }, []);

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (navigation.state === "idle" && isRefreshing) {
      setIsRefreshing(false);
      if (typeof window !== "undefined" && window.shopify) {
        window.shopify.toast.show("Transactions list refreshed successfully");
      }
    }
  }, [navigation.state, isRefreshing]);

  // Handle Refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    const params = new URLSearchParams();
    params.set("tab", String(activeTabId));
    submit(params, { method: "get", replace: true });
    if (typeof window !== "undefined" && window.shopify) {
      window.shopify.toast.show("Refreshing transactions...");
    }
  }, [activeTabId, submit]);

  // Trigger CSV Export
  const handleExport = useCallback(async () => {
    if (typeof window !== "undefined" && window.shopify) {
      window.shopify.toast.show("Exporting CSV file...");
    }

    try {
      // Build the form data with current filters
      const formData = new FormData();
      formData.append("actionType", "export");
      formData.append("tab", String(activeTabId));
      formData.append("query", searchVal || "");
      formData.append("sort", sortValue || "newest");
      formData.append("date", filterDate || "all");
      formData.append("status", filterStatus.join(","));

      // Standard fetch request to our action route (same page URL)
      // Since it's a relative URL, App Bridge v4 automatically intercepts it and attaches the Authorization Bearer JWT!
      const response = await fetch("/app/transactions", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to export CSV: ${response.statusText}`);
      }

      // Convert response to a blob
      const blob = await response.blob();

      // Trigger client-side browser download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `loyalty_credit_transactions_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();

      // Clean up link and object URL
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("❌ Error downloading CSV:", err);
      if (typeof window !== "undefined" && window.shopify) {
        window.shopify.toast.show("Export failed. Please try again.");
      }
    }
  }, [activeTabId, searchVal, sortValue, filterDate, filterStatus]);

  const shopSubdomain = shop ? shop.split(".")[0] : "";

  // Calculate Pagination Data
  const totalItems = filteredTransactions.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Ensure current page is within bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Table rows mapping
  const rowMarkup = paginatedTransactions.map(
    ({
      id,
      orderId,
      customerId,
      orderName,
      createdAt,
      issuedAt,
      customerName,
      amount,
      currency,
      status,
      emailStatus,
      emailFailReason,
    }) => {
      const cleanCustomerId = customerId ? customerId.split("/").pop() : "";
      const orderUrl = `https://admin.shopify.com/store/${shopSubdomain}/orders/${orderId}`;
      const customerUrl = `https://admin.shopify.com/store/${shopSubdomain}/customers/${cleanCustomerId}`;

      return (
        <s-table-row key={id}>
          <s-table-cell>
            <a
              href={orderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ab-link"
            >
              <strong>{orderName}</strong>
            </a>
          </s-table-cell>
          <s-table-cell>{formatDate(createdAt)}</s-table-cell>
          <s-table-cell>
            {status === "Completed" ? formatDate(issuedAt) : "-"}
          </s-table-cell>
          <s-table-cell>
            <a
              href={customerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ab-link"
            >
              {customerName}
            </a>
          </s-table-cell>
          <s-table-cell>
            <strong>
              +{Number(amount).toFixed(2)} {currency}
            </strong>
          </s-table-cell>
          <s-table-cell>
            <s-badge tone={status === "Completed" ? "success" : "warning"}>
              {status}
            </s-badge>
          </s-table-cell>
          <s-table-cell>
            <s-badge tone={emailStatus === "Sent" ? "success" : emailStatus === "Failed" ? "critical" : "info"}>
              {emailStatus}
            </s-badge>
          </s-table-cell>
          <s-table-cell>
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
                  customerName,
                  amount,
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
          </s-table-cell>
        </s-table-row>
      );
    },
  );

  // Sort menu helper
  const renderSortMenu = () => {
    const activator = (
      <Button
        onClick={(e) => {
          e.stopPropagation();
          setIsSortOpen(!isSortOpen);
        }}
        disclosure
      >
        Sort by
      </Button>
    );

    return (
      <Popover
        active={isSortOpen}
        activator={activator}
        onClose={() => setIsSortOpen(false)}
      >
        <ActionList
          actionRole="menuitem"
          items={[
            {
              content: "Newest first",
              active: sortValue === "newest",
              onAction: () => {
                setSortValue("newest");
                setIsSortOpen(false);
              },
            },
            {
              content: "Oldest first",
              active: sortValue === "oldest",
              onAction: () => {
                setSortValue("oldest");
                setIsSortOpen(false);
              },
            },
            {
              content: "Amount: high to low",
              active: sortValue === "amount-high",
              onAction: () => {
                setSortValue("amount-high");
                setIsSortOpen(false);
              },
            },
            {
              content: "Amount: low to high",
              active: sortValue === "amount-low",
              onAction: () => {
                setSortValue("amount-low");
                setIsSortOpen(false);
              },
            },
          ]}
        />
      </Popover>
    );
  };

  return (
    <Page
      title="Transactions"
      primaryAction={{
        content: "Refresh Data",
        onAction: handleRefresh,
        loading: isRefreshing,
      }}
      secondaryActions={[
        {
          content: "Export CSV",
          onAction: handleExport,
        },
      ]}
    >
      <style>{`
        .ab-link {
          color: black !important;
          text-decoration: none !important;
          cursor: pointer !important;
        }
        .ab-link:hover {
          text-decoration: underline !important;
        }
        /* Overflow visible overrides to float absolute dropdown menus */
        .Polaris-Card, .Polaris-Tabs, .Polaris-Box, .Polaris-LegacyCard {
          overflow: visible !important;
        }
      `}</style>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {transactions.length > 0 && (
              <>
                {!isSearchActive ? (
                  /* DEFAULT VIEW: Tabs on Left, Search Trigger Icons on Right */
                  <Box
                    padding="300"
                    borderBlockEndWidth="025"
                    borderColor="border-secondary"
                  >
                    <InlineStack align="space-between" blockAlign="center">
                      <div style={{ flex: 1 }}>
                        <Tabs
                          tabs={tabs}
                          selected={activeTabId}
                          onSelect={handleTabChange}
                        />
                      </div>

                      <InlineStack gap="150" blockAlign="center">
                        <Button
                          onClick={() => setIsSearchActive(true)}
                          icon={() => (
                            <svg
                              viewBox="0 0 20 20"
                              style={{ width: 16, height: 16, fill: "#5c5f62" }}
                            >
                              <path d="M8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8m5.293-.707a6.5 6.5 0 1 0-1.414 1.414l3.828 3.829a1 1 0 0 0 1.414-1.414z" />
                            </svg>
                          )}
                          accessibilityLabel="Search"
                        />

                        {renderSortMenu()}
                      </InlineStack>
                    </InlineStack>
                  </Box>
                ) : (
                  /* SEARCH ACTIVE VIEW: Full search bar input with "Cancel" and "Sort" + Filter Triggers */
                  <Box
                    padding="300"
                    borderBlockEndWidth="025"
                    borderColor="border-secondary"
                  >
                    <BlockStack gap="300">
                      <InlineStack
                        gap="300"
                        blockAlign="center"
                        align="space-between"
                        style={{ width: "100%" }}
                      >
                        <div
                          style={{
                            flex: 1,
                            display: "flex",
                            gap: "12px",
                            alignItems: "center",
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <TextField
                              label="Search transactions"
                              labelHidden
                              value={searchVal}
                              onChange={handleSearchChange}
                              placeholder="Search by customer or company location"
                              autoComplete="off"
                              clearButton
                              onClearButtonClick={() => handleSearchChange("")}
                            />
                          </div>

                          <Button
                            variant="plain"
                            onClick={() => {
                              setIsSearchActive(false);
                              if (searchVal) handleSearchChange("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>

                        {renderSortMenu()}
                      </InlineStack>

                      {/* Filter buttons row */}
                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        {/* 1. Date Filter s-select App Bridge component */}
                        {isDateActive && (
                          <div style={{ minWidth: "160px" }}>
                            <s-select
                              label={getDateRangeLabel()}
                              value={filterDate}
                              onInput={(e) => {
                                const val = e.target.value;
                                setFilterDate(val);
                                if (val === "all") {
                                  setIsDateActive(false);
                                }
                              }}
                            >
                              <s-option
                                value="all"
                                selected={
                                  filterDate === "all" ? "true" : undefined
                                }
                              >
                                All
                              </s-option>
                              <s-option
                                value="today"
                                selected={
                                  filterDate === "today" ? "true" : undefined
                                }
                              >
                                Today
                              </s-option>
                              <s-option
                                value="yesterday"
                                selected={
                                  filterDate === "yesterday"
                                    ? "true"
                                    : undefined
                                }
                              >
                                Yesterday
                              </s-option>
                              <s-option
                                value="7days"
                                selected={
                                  filterDate === "7days" ? "true" : undefined
                                }
                              >
                                Last 7 days
                              </s-option>
                              <s-option-group label="Custom ranges">
                                <s-option
                                  value="30days"
                                  selected={
                                    filterDate === "30days" ? "true" : undefined
                                  }
                                >
                                  Last 30 days
                                </s-option>
                                <s-option
                                  value="lastweek"
                                  selected={
                                    filterDate === "lastweek"
                                      ? "true"
                                      : undefined
                                  }
                                >
                                  Last week
                                </s-option>
                                <s-option
                                  value="lastmonth"
                                  selected={
                                    filterDate === "lastmonth"
                                      ? "true"
                                      : undefined
                                  }
                                >
                                  Last month
                                </s-option>
                              </s-option-group>
                            </s-select>
                          </div>
                        )}

                        {/* 2. Issue Status s-select App Bridge component */}
                        {isStatusActive && (
                          <div style={{ minWidth: "160px" }}>
                            <s-select
                              label="Issue status"
                              value={filterStatus[0] || "all"}
                              onInput={(e) => {
                                const val = e.target.value;
                                setFilterStatus(val === "all" ? [] : [val]);
                                if (val === "all") {
                                  setIsStatusActive(false);
                                }
                              }}
                            >
                              <s-option
                                value="all"
                                selected={
                                  filterStatus.length === 0 ? "true" : undefined
                                }
                              >
                                All
                              </s-option>
                              <s-option
                                value="Pending"
                                selected={
                                  filterStatus.includes("Pending")
                                    ? "true"
                                    : undefined
                                }
                              >
                                Pending
                              </s-option>
                              <s-option
                                value="Completed"
                                selected={
                                  filterStatus.includes("Completed")
                                    ? "true"
                                    : undefined
                                }
                              >
                                Completed
                              </s-option>
                              <s-option
                                value="Cancelled"
                                selected={
                                  filterStatus.includes("Cancelled")
                                    ? "true"
                                    : undefined
                                }
                              >
                                Cancelled
                              </s-option>
                              <s-option
                                value="Cancel Error"
                                selected={
                                  filterStatus.includes("Cancel Error")
                                    ? "true"
                                    : undefined
                                }
                              >
                                Cancel Error
                              </s-option>
                              <s-option
                                value="Failed"
                                selected={
                                  filterStatus.includes("Failed")
                                    ? "true"
                                    : undefined
                                }
                              >
                                Failed
                              </s-option>
                            </s-select>
                          </div>
                        )}

                        {/* 3. Add Filter button */}
                        <Popover
                          active={isAddFilterOpen && !isAddFilterDisabled}
                          activator={
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsAddFilterOpen(!isAddFilterOpen);
                              }}
                              disabled={isAddFilterDisabled}
                            >
                              Add filter +
                            </Button>
                          }
                          onClose={() => setIsAddFilterOpen(false)}
                        >
                          <ActionList
                            actionRole="menuitem"
                            items={[
                              ...(!isDateActive
                                ? [
                                    {
                                      content: "Date range",
                                      onAction: () => {
                                        setIsDateActive(true);
                                        setIsAddFilterOpen(false);
                                      },
                                    },
                                  ]
                                : []),
                              ...(!isStatusActive
                                ? [
                                    {
                                      content: "Issue status",
                                      onAction: () => {
                                        setIsStatusActive(true);
                                        setIsAddFilterOpen(false);
                                      },
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </Popover>

                        {/* 4. Global "Clear all" action trigger */}
                        {(isDateActive ||
                          isStatusActive ||
                          filterDate !== "all" ||
                          filterStatus.length > 0) && (
                          <Button
                            variant="plain"
                            onClick={() => {
                              setFilterDate("all");
                              setFilterStatus([]);
                              setIsDateActive(false);
                              setIsStatusActive(false);
                              setIsAddFilterOpen(false);
                            }}
                          >
                            Clear all
                          </Button>
                        )}
                      </div>
                    </BlockStack>
                  </Box>
                )}
              </>
            )}

            {/* Table Content Area */}
            <Box padding="400">
              <BlockStack gap="400">
                {transactions.length === 0 ? (
                  /* BASE SYSTEM EMPTY STATE */
                  <EmptyState
                    heading="No transactions recorded"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-transactions.png"
                  >
                    <p>
                      There are currently no store credit rewards issued or
                      transactions recorded. Once customers place orders
                      matching your store credit or custom program campaigns,
                      their rewards transactions will show up here
                      automatically.
                    </p>
                  </EmptyState>
                ) : filteredTransactions.length === 0 ? (
                  /* FILTER MATCH EMPTY STATE */
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
                ) : (
                  <s-section padding="none">
                    <s-table>
                      <s-table-header-row>
                        <s-table-header listSlot="primary">
                          Order
                        </s-table-header>
                        <s-table-header listSlot="inline">
                          Created At
                        </s-table-header>
                        <s-table-header listSlot="inline">
                          Issued At
                        </s-table-header>
                        <s-table-header listSlot="labeled">
                          Customer Name
                        </s-table-header>
                        <s-table-header listSlot="labeled">
                          Store Credit
                        </s-table-header>
                        <s-table-header listSlot="labeled">
                          Status
                        </s-table-header>
                        <s-table-header listSlot="labeled">
                          Email Status
                        </s-table-header>
                        <s-table-header listSlot="labeled">
                          Actions
                        </s-table-header>
                      </s-table-header-row>

                      <s-table-body>{rowMarkup}</s-table-body>
                    </s-table>
                  </s-section>
                )}
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
              </BlockStack>
            </Box>
          </Card>
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
                        {Number(selectedTransaction.amount).toFixed(2)}{" "}
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
                        {formatDate(selectedTransaction.issuedAt)}
                      </Text>
                    ),
                  },
                  {
                    term: "Transaction Status",
                    description: (
                      <s-badge
                        tone={
                          selectedTransaction.status === "Completed"
                            ? "success"
                            : "warning"
                        }
                      >
                        {selectedTransaction.status}
                      </s-badge>
                    ),
                  },
                  {
                    term: "Merchant Notification",
                    description: (
                      <s-badge
                        tone={
                          selectedTransaction.emailStatus === "Sent"
                            ? "success"
                            : selectedTransaction.emailStatus === "Failed"
                              ? "critical"
                              : "info"
                        }
                      >
                        {selectedTransaction.emailStatus}
                      </s-badge>
                    ),
                  },
                  ...(selectedTransaction.emailFailReason ? [{
                    term: "Notification Issue Reason",
                    description: (
                      <Text variant="bodyMd" tone="critical">
                        {selectedTransaction.emailFailReason}
                      </Text>
                    )
                  }] : []),
                ]}
              />
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
