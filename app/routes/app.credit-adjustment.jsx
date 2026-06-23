import { useEffect, useRef, useState } from "react";
import { useLoaderData, useSubmit, useFetcher, useRouteError, useNavigate, useNavigation } from "react-router";
import { Page } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import {
  searchCustomers,
  searchCompanyLocations,
  issueCreditAdjustment,
} from "../services/creditAdjustment.server";
import CreditAdjustmentList from "../components/credit-adjustment/CreditAdjustmentList";

// Loader
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const actionType = url.searchParams.get("actionType");

  if (actionType === "searchCustomers") {
    const query = url.searchParams.get("query") || "";
    try {
      const customers = await searchCustomers(admin, query);
      return Response.json(customers);
    } catch (err) {
      console.error(err);
      return Response.json([]);
    }
  }

  if (actionType === "searchCompanyLocations") {
    const query = url.searchParams.get("query") || "";
    try {
      const locations = await searchCompanyLocations(admin, query);
      return Response.json(locations);
    } catch (err) {
      console.error(err);
      return Response.json([]);
    }
  }

  if (actionType === "getJobStatus") {
    const jobId = url.searchParams.get("jobId");
    if (!jobId) return Response.json(null);
    const job = await db.bulkAdjustmentJob.findUnique({ where: { id: jobId } });
    return Response.json(job);
  }

  let shopCurrency = "USD";
  let enabledCurrencies = ["USD"];
  try {
    const currencyRes = await admin.graphql(`#graphql
      query getShopCurrencies {
        shop {
          currencyCode
          enabledPresentmentCurrencies
        }
      }
    `);
    const currencyJson = await currencyRes.json();
    shopCurrency = currencyJson?.data?.shop?.currencyCode || "USD";
    enabledCurrencies = currencyJson?.data?.shop?.enabledPresentmentCurrencies || [shopCurrency];
  } catch (err) {
    console.error(err);
  }

  const searchQuery = url.searchParams.get("query") || "";
  const filterType = url.searchParams.get("type") || "all";
  const filterStatus = url.searchParams.get("status") || "all";
  const sortSelected = url.searchParams.get("sort") || "date desc";
  const currentPage = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = 10;

  const where = { shop };
  if (searchQuery) {
    where.OR = [
      { customerName: { contains: searchQuery } },
      { customerEmail: { contains: searchQuery } },
      { companyLocationName: { contains: searchQuery } },
      { reason: { contains: searchQuery } },
    ];
  }

  if (filterType !== "all") {
    where.adjustmentType = filterType;
  }

  if (filterStatus !== "all") {
    where.status = filterStatus;
  }

  let orderBy = { createdAt: "desc" };
  if (sortSelected === "date-asc" || sortSelected === "date asc") {
    orderBy = { createdAt: "asc" };
  } else if (sortSelected === "date-desc" || sortSelected === "date desc") {
    orderBy = { createdAt: "desc" };
  } else if (sortSelected === "amount-desc" || sortSelected === "amount desc") {
    orderBy = { amount: "desc" };
  } else if (sortSelected === "amount-asc" || sortSelected === "amount asc") {
    orderBy = { amount: "asc" };
  }

  const totalAdjustments = await db.creditAdjustment.count({ where });
  const totalPages = Math.ceil(totalAdjustments / pageSize);
  const adjustments = await db.creditAdjustment.findMany({
    where,
    orderBy,
    skip: (currentPage - 1) * pageSize,
    take: pageSize,
  });

  const bulkJob = await db.bulkAdjustmentJob.findFirst({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });

  const shopSubdomain = shop.split(".")[0];

  return Response.json({
    adjustments,
    totalPages,
    currentPage,
    searchQuery,
    filterType,
    filterStatus,
    sortSelected,
    bulkJob,
    shopCurrency,
    enabledCurrencies,
    shopSubdomain,
  });
};

// Action
export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const payload = await request.json();
  const { actionType } = payload;

  if (actionType === "adjustSingle") {
    const {
      adjustmentType,
      ownerType,
      id,
      name,
      email,
      amount,
      currencyCode,
      reason,
      expiresAt,
      notifyCustomer,
    } = payload;

    try {
      await issueCreditAdjustment(admin, shop, {
        adjustmentType,
        ownerType,
        id,
        name,
        email,
        amount: parseFloat(amount),
        currencyCode,
        reason,
        expiresAt,
        notifyCustomer,
        createdBy: session.email || "Merchant",
      });
      return Response.json({ success: true });
    } catch (err) {
      console.error(err);
      return Response.json({ success: false, error: err.message });
    }
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
};

// Component View
export default function CreditAdjustmentListing() {
  const loaderData = useLoaderData();
  const submit = useSubmit();
  const fetcher = useFetcher();
  const searchFetcher = useFetcher();
  const jobFetcher = useFetcher();
  const refreshFetcher = useFetcher();
  const navigate = useNavigate();

  const {
    adjustments,
    totalPages,
    currentPage,
    searchQuery,
    filterType,
    filterStatus,
    sortSelected,
    bulkJob,
    shopCurrency,
    enabledCurrencies,
    shopSubdomain,
  } = loaderData;

  const [adjustmentsState, setAdjustmentsState] = useState(adjustments);
  const [totalPagesState, setTotalPagesState] = useState(totalPages);
  const [currentPageState, setCurrentPageState] = useState(currentPage);

  useEffect(() => {
    setAdjustmentsState(adjustments);
    setTotalPagesState(totalPages);
    setCurrentPageState(currentPage);
  }, [adjustments, totalPages, currentPage]);

  const navigation = useNavigation();
  const isRefreshing = refreshFetcher.state !== "idle" || navigation.state === "loading";

  useEffect(() => {
    if (refreshFetcher.state === "idle" && refreshFetcher.data) {
      if (refreshFetcher.data.adjustments) {
        setAdjustmentsState(refreshFetcher.data.adjustments);
      }
      if (refreshFetcher.data.totalPages !== undefined) {
        setTotalPagesState(refreshFetcher.data.totalPages);
      }
      if (refreshFetcher.data.currentPage !== undefined) {
        setCurrentPageState(refreshFetcher.data.currentPage);
      }
    }
  }, [refreshFetcher.state, refreshFetcher.data]);

  // Track bulk job status locally for live polling updates
  const [currentBulkJob, setCurrentBulkJob] = useState(bulkJob);
  const pollingRef = useRef(null);

  // Sync with loader data when it changes (e.g. after page reload)
  useEffect(() => {
    setCurrentBulkJob(bulkJob);
  }, [bulkJob]);

  // Poll bulk job status every 2 seconds while Pending/Processing
  useEffect(() => {
    const isActive = currentBulkJob &&
      (currentBulkJob.status === "Pending" || currentBulkJob.status === "Processing");

    if (isActive) {
      pollingRef.current = setInterval(() => {
        jobFetcher.load(
          `/app/credit-adjustment?actionType=getJobStatus&jobId=${currentBulkJob.id}`
        );
      }, 2000);
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [currentBulkJob?.status, currentBulkJob?.id]);

  // Update local job state from polling and refresh page on completion
  useEffect(() => {
    if (jobFetcher.data) {
      const updatedJob = jobFetcher.data;
      setCurrentBulkJob(updatedJob);

      // Once job finishes, refresh the full page data (history table + banner)
      if (updatedJob && (updatedJob.status === "Completed" || updatedJob.status === "Failed")) {
        const params = new URLSearchParams(window.location.search);
        submit(params, { method: "get", replace: true });
      }
    }
  }, [jobFetcher.data, submit]);

  const handleFilterChange = (key, value) => {
    const params = new URLSearchParams(window.location.search);
    if (key === "clearAll") {
      params.delete("type");
      params.delete("status");
      params.delete("query");
    } else {
      if (value && value !== "all") params.set(key, value);
      else params.delete(key);
    }
    params.set("page", "1");
    submit(params, { method: "get", replace: true });
  };

  const handlePageChange = (newPage) => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(newPage));
    submit(params, { method: "get", replace: true });
  };

  const handleApplySingle = (payload, onSuccess) => {
    fetcher.submit(
      { actionType: "adjustSingle", ...payload },
      { method: "POST", encType: "application/json" }
    );
    // Track modal close on success
    onSuccessRef.current = onSuccess;
  };

  const onSuccessRef = useRef(null);
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.success) {
        if (onSuccessRef.current) {
          onSuccessRef.current();
          onSuccessRef.current = null;
        }
        // Reload data
        const params = new URLSearchParams(window.location.search);
        submit(params, { method: "get", replace: true });
      } else if (fetcher.data.error) {
        alert(fetcher.data.error);
      }
    }
  }, [fetcher.state, fetcher.data, submit]);

  const handleExport = () => {
    const params = new URLSearchParams(window.location.search);
    const searchVal = params.get("query") || "";
    const typeFilter = params.get("type") || "all";
    const statusFilter = params.get("status") || "all";
    const sortSelectedVal = params.get("sort") || "date desc";

    const payload = {
      actionType: "export",
      searchQuery: searchVal,
      filterType: typeFilter,
      filterStatus: statusFilter,
      sortSelected: sortSelectedVal,
    };

    fetch("/app/credit-adjustment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `credit_adjustments_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
  };

  const handleRefresh = () => {
    const params = new URLSearchParams(window.location.search);
    refreshFetcher.load(`/app/credit-adjustment?${params.toString()}`);
  };

  return (
    <Page
      title="Credit adjustment"
      secondaryActions={[
        { content: "Export", onAction: handleExport },
        {
          content: "Refresh",
          onAction: handleRefresh,
          disabled: isRefreshing,
          loading: isRefreshing,
        },
      ]}
      actionGroups={[
        {
          title: "Adjust Store Credit",
          actions: [
            {
              content: "Adjust Single Account",
              onAction: () => {
                // Trigger modal opening inside the list component
                const btn = document.getElementById("trigger-single-modal-btn");
                if (btn) btn.click();
              },
            },
            {
              content: "Bulk Adjust",
              onAction: () => {
                navigate("/app/bulk-adjust" + window.location.search);
              },
            },
          ],
        },
      ]}
    >
      <CreditAdjustmentList
        adjustments={adjustmentsState}
        totalPages={totalPagesState}
        currentPage={currentPageState}
        searchQuery={searchQuery}
        filterType={filterType}
        filterStatus={filterStatus}
        sortSelected={sortSelected}
        bulkJob={currentBulkJob}
        shopCurrency={shopCurrency}
        enabledCurrencies={enabledCurrencies}
        shopSubdomain={shopSubdomain}
        onFilterChange={handleFilterChange}
        onPageChange={handlePageChange}
        onApplySingle={handleApplySingle}
        onExport={handleExport}
        onRefresh={handleRefresh}
        searchFetcher={searchFetcher}
        isRefreshing={isRefreshing}
        isApplying={fetcher.state !== "idle"}
      />
    </Page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
