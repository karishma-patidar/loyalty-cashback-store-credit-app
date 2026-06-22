import { useState, useCallback, useEffect } from "react";
import { useLoaderData, useSubmit, useNavigation, useFetcher } from "react-router";
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
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import connectMongoDB, {
  getShopModel,
  syncMongoStoreSession,
  migrateShopData,
} from "../db.mongodb.server";
import db from "../db.server";

// Helper to format date cleanly
function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const currentYear = new Date().getFullYear();
  const dateYear = date.getFullYear();

  if (dateYear === currentYear) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } else {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

function formatDateOnly(dateInput) {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function fetchAdjustmentTransactions(shop) {
  let adjustments = [];
  try {
    adjustments = await db.creditAdjustment.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    console.error("Error fetching credit adjustments in transactions loader:", err);
  }
  return adjustments.map(adj => ({
    id: adj.id,
    shop: adj.shop,
    customerId: adj.customerId,
    customerName: adj.customerName,
    customerEmail: adj.customerEmail,
    companyLocationId: adj.companyLocationId,
    companyLocationName: adj.companyLocationName,
    companyId: adj.companyId,
    amount: adj.amount,
    currency: adj.currency,
    adjustmentType: adj.adjustmentType,
    reason: adj.reason,
    expirationDate: adj.expirationDate ? adj.expirationDate.toISOString() : null,
    status: adj.status,
    emailStatus: adj.emailStatus,
    createdAt: adj.createdAt.toISOString(),
    createdBy: adj.createdBy,
  }));
}

async function fetchMongoTransactions(shop, admin, activeTabId = null) {
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

  // Connect to MongoDB
  await connectMongoDB();

  // Load programs
  let programs = [];
  try {
    const { getShopPrograms } = await import("../services/storeCredit.server");
    programs = (await getShopPrograms(admin)) || [];
  } catch (err) {
    console.error("Error fetching programs in transactions loader:", err);
  }

  const cashback = [];
  const custom = [];

  try {
    const ShopModel = getShopModel(shop);
    if (ShopModel) {
      await migrateShopData(shop);
    }
    const docs = ShopModel ? await ShopModel.find({}) : [];

    for (const doc of docs) {
      if (doc.events && Array.isArray(doc.events)) {
        for (const ev of doc.events) {
          if (!ev.orderId) continue;

          // Skip manual credit adjustments so they are only shown in the Credit Adjustment tab (tab index 2)
          if (
            ev.programId === "credit-adjustment" ||
            ev.programType === "credit_adjustment" ||
            ev.programType === "debit_adjustment" ||
            String(ev.orderId).startsWith("adj-")
          ) {
            continue;
          }

          // Determine if custom program transaction
          let isCustom = ["Custom Program", "custom", "fixed", "percentage", "Flow Program"].includes(ev.programType || ev.type);
          if (ev.programId && programs.length > 0) {
            const matchedProg = programs.find(p => p.programId === ev.programId || p.id === ev.programId);
            if (matchedProg) {
              isCustom = matchedProg.programType === "custom" || matchedProg.isFlowProgram === true;
            }
          }

          const txObj = {
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
          };

          if (isCustom) {
            custom.push(txObj);
          } else {
            cashback.push(txObj);
          }
        }
      }
    }
  } catch (err) {
    console.error("❌ Error querying store collection in loader:", err);
  }

  // Sort and deduplicate helper
  const processList = (list) => {
    list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const uniqueMap = new Map();
    for (const tx of list) {
      if (!tx.orderId) continue;
      if (!uniqueMap.has(tx.orderId)) {
        uniqueMap.set(tx.orderId, tx);
      } else {
        const existing = uniqueMap.get(tx.orderId);
        if (tx.status === "Completed" && existing.status !== "Completed") {
          uniqueMap.set(tx.orderId, tx);
        }
      }
    }
    return Array.from(uniqueMap.values());
  };

  let enableDelay = false;
  if (programs && programs.length > 0) {
    const prog = programs[0];
    enableDelay = prog.enableDelay === true || prog.enableDelay === "true";
  }

  if (activeTabId !== null) {
    if (activeTabId === "1") {
      return { cashback: [], custom: processList(custom), enableDelay };
    } else {
      return { cashback: processList(cashback), custom: [], enableDelay };
    }
  }

  return {
    cashback: processList(cashback),
    custom: processList(custom),
    enableDelay,
  };
}

// Loader to fetch logged database transactions for the merchant from MongoDB customer collections
export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  await syncMongoStoreSession(session);
  const shop = session.shop;

  const url = new URL(request.url);
  const activeTabId = url.searchParams.get("tab") || "0"; // "0" for Cashback, "1" for Custom Program, "2" for Credit Adjustment
  const isRefresh = url.searchParams.get("refresh") === "true";

  if (isRefresh) {
    if (activeTabId === "2") {
      const adjustments = await fetchAdjustmentTransactions(shop);
      return {
        tab: 2,
        transactions: adjustments,
      };
    } else {
      const { cashback, custom, enableDelay } = await fetchMongoTransactions(shop, admin, activeTabId);
      return {
        tab: parseInt(activeTabId, 10),
        transactions: activeTabId === "1" ? custom : cashback,
        enableDelay,
      };
    }
  }

  // Initial load: Fetch everything
  const adjustments = await fetchAdjustmentTransactions(shop);
  const { cashback, custom, enableDelay } = await fetchMongoTransactions(shop, admin);

  return {
    cashbackTransactions: cashback,
    customTransactions: custom,
    adjustmentTransactions: adjustments,
    activeTabId: parseInt(activeTabId, 10),
    shop,
    enableDelay,
  };
}

// Action to generate high performance CSV download file from MongoDB customer collections
export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
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
    await connectMongoDB();

    // Load programs
    let programs = [];
    try {
      const { getShopPrograms } = await import("../services/storeCredit.server");
      programs = (await getShopPrograms(admin)) || [];
    } catch (err) {
      console.error("Error fetching programs in transactions action:", err);
    }

    const allTransactions = [];

    try {
      const ShopModel = getShopModel(shop);
      const docs = await ShopModel.find({});

      for (const doc of docs) {
        if (doc.events && Array.isArray(doc.events)) {
          for (const ev of doc.events) {
            // Skip manual credit adjustments so they are only shown in the Credit Adjustment tab (tab index 2)
            if (
              ev.programId === "credit-adjustment" ||
              ev.programType === "credit_adjustment" ||
              ev.programType === "debit_adjustment" ||
              String(ev.orderId).startsWith("adj-")
            ) {
              continue;
            }

            // Determine if custom program transaction
            let isCustom = ["Custom Program", "custom", "fixed", "percentage", "Flow Program"].includes(ev.programType || ev.type);
            if (ev.programId && programs.length > 0) {
              const matchedProg = programs.find(p => p.programId === ev.programId || p.id === ev.programId);
              if (matchedProg) {
                isCustom = matchedProg.programType === "custom" || matchedProg.isFlowProgram === true;
              }
            }

            // 1. Program Type Filter
            if (tab === "1") {
              if (!isCustom) continue;
            } else {
              if (isCustom) continue;
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
  const loaderData = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const fetcher = useFetcher();

  const [activeTabId, setActiveTabId] = useState(loaderData.activeTabId ?? 0);
  const [cashbackData, setCashbackData] = useState(loaderData.cashbackTransactions || []);
  const [customData, setCustomData] = useState(loaderData.customTransactions || []);
  const [adjustmentData, setAdjustmentData] = useState(loaderData.adjustmentTransactions || []);
  const [enableDelay, setEnableDelay] = useState(loaderData.enableDelay || false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (loaderData) {
      if (loaderData.cashbackTransactions) setCashbackData(loaderData.cashbackTransactions);
      if (loaderData.customTransactions) setCustomData(loaderData.customTransactions);
      if (loaderData.adjustmentTransactions) setAdjustmentData(loaderData.adjustmentTransactions);
      if (loaderData.enableDelay !== undefined) setEnableDelay(loaderData.enableDelay);
    }
  }, [loaderData]);

  // Handle fetcher load completion (for refresh)
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      const refreshedTab = fetcher.data.tab;
      const refreshedTransactions = fetcher.data.transactions || [];
      if (refreshedTab === 0) {
        setCashbackData(refreshedTransactions);
      } else if (refreshedTab === 1) {
        setCustomData(refreshedTransactions);
      } else if (refreshedTab === 2) {
        setAdjustmentData(refreshedTransactions);
      }
      if (fetcher.data.enableDelay !== undefined) {
        setEnableDelay(fetcher.data.enableDelay);
      }
      setIsRefreshing(false);
    }
  }, [fetcher.state, fetcher.data]);

  const shop = loaderData.shop || "";
  const searchQuery = loaderData.searchQuery || "";

  // Determine current active list of transactions based on activeTabId
  const getTransactionsForActiveTab = () => {
    if (activeTabId === 0) return cashbackData;
    if (activeTabId === 1) return customData;
    if (activeTabId === 2) return adjustmentData;
    return [];
  };
  const transactions = getTransactionsForActiveTab();

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
      if (activeTabId === 2) {
        const valA = a.adjustmentType === "Debit" ? -Number(a.amount) : Number(a.amount);
        const valB = b.adjustmentType === "Debit" ? -Number(b.amount) : Number(b.amount);
        return valB - valA;
      }
      return Number(b.issuedAmount || b.redeemedAmount || 0) - Number(a.issuedAmount || a.redeemedAmount || 0);
    } else if (sortValue === "amount asc") {
      // Low to high
      if (activeTabId === 2) {
        const valA = a.adjustmentType === "Debit" ? -Number(a.amount) : Number(a.amount);
        const valB = b.adjustmentType === "Debit" ? -Number(b.amount) : Number(b.amount);
        return valA - valB;
      }
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
      if (activeTabId === 2) {
        const matches =
          String(t.customerName || "")
            .toLowerCase()
            .includes(q) ||
          String(t.companyLocationName || "")
            .toLowerCase()
            .includes(q) ||
          String(t.reason || "")
            .toLowerCase()
            .includes(q);
        if (!matches) {
          return false;
        }
      } else {
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
    }

    return true;
  });

  const tabs = [
    { id: "0", content: "Cashback Program", index: 0 },
    { id: "1", content: "Custom Program", index: 1 },
    { id: "2", content: "Credit Adjustment", index: 2 },
  ];

  const handleTabChange = useCallback(
    (selectedTabIndex) => {
      setActiveTabId(selectedTabIndex);
    },
    [],
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetcher.load(`?tab=${activeTabId}&refresh=true`);
  }, [activeTabId, fetcher]);

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
    (tx, index) => {
      if (activeTabId === 2) {
        const isCredit = tx.adjustmentType === "Credit";
        const ownerName = tx.customerId ? tx.customerName : tx.companyLocationName;

        const cleanOwnerId = tx.customerId
          ? tx.customerId.split("/").pop()
          : tx.companyLocationId?.split("/").pop();

        const cleanCompanyId = tx.companyId?.split("/").pop();

        const ownerUrl = tx.customerId
          ? `https://admin.shopify.com/store/${shopSubdomain}/customers/${cleanOwnerId}`
          : cleanCompanyId
          ? `https://admin.shopify.com/store/${shopSubdomain}/companies/${cleanCompanyId}/locations/${cleanOwnerId}`
          : `https://admin.shopify.com/store/${shopSubdomain}/companies`;

        return (
          <IndexTable.Row
            id={tx.id}
            key={tx.id}
            position={index}
          >
            {/* Customer / Company Location */}
            <IndexTable.Cell>
              <a
                href={ownerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ab-link"
              >
                <Text variant="bodyMd" fontWeight="bold" as="span">
                  {ownerName || "-"}
                </Text>
              </a>
            </IndexTable.Cell>

            {/* Adjusted Date */}
            <IndexTable.Cell>{formatDate(tx.createdAt)}</IndexTable.Cell>

            {/* Amount */}
            <IndexTable.Cell>
              <Text
                variant="bodyMd"
                fontWeight="bold"
                as="span"
                tone={isCredit ? "success" : "critical"}
              >
                {isCredit ? "+" : "-"}
                {Number(tx.amount).toString()} {tx.currency}
              </Text>
            </IndexTable.Cell>

            {/* Expiration Date */}
            <IndexTable.Cell>
              {tx.expirationDate ? formatDateOnly(tx.expirationDate) : "-"}
            </IndexTable.Cell>

            {/* Status */}
            <IndexTable.Cell>
              <Badge tone={tx.status === "Success" ? "success" : "critical"}>
                {tx.status}
              </Badge>
            </IndexTable.Cell>

            {/* Email Status */}
            <IndexTable.Cell>
              {tx.emailStatus && tx.emailStatus.trim() !== "" ? (
                <Badge tone={tx.emailStatus === "Sent" ? "success" : "info"}>
                  {tx.emailStatus}
                </Badge>
              ) : null}
            </IndexTable.Cell>
          </IndexTable.Row>
        );
      }

      const {
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
      } = tx;

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

  const isLoading = navigation.state === "loading" || fetcher.state === "loading" || isRefreshing;


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

  const statusChoices = activeTabId === 2
    ? [
        { label: "Success", value: "Success" },
        { label: "Failed", value: "Failed" },
        { label: "Pending", value: "Pending" },
        { label: "Processing", value: "Processing" },
      ]
    : [
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
    { label: "Creation date", value: "date asc", directionLabel: "Oldest to newest" },
    { label: "Creation date", value: "date desc", directionLabel: "Newest to oldest" },
    { label: "Store credit amount", value: "amount asc", directionLabel: "Lowest to highest" },
    { label: "Store credit amount", value: "amount desc", directionLabel: "Highest to lowest" },
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
                   queryPlaceholder={activeTabId === 2 ? "Search by customer name, location or reason" : "Search by Order ID or Customer Name"}
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
                       headings={activeTabId === 2
                         ? [
                             { title: "Customer / Company Location" },
                             { title: "Adjusted Date" },
                             { title: "Amount" },
                             { title: "Expiration Date" },
                             { title: "Status" },
                             { title: "Email Status" },
                           ]
                         : [
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
