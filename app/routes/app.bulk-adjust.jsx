/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from "react";
import {
  useLoaderData,
  useFetcher,
  useNavigate,
  useRouteError,
} from "react-router";
import { Page } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { runBulkAdjustmentJobAsync } from "../services/creditAdjustment.server";
import BulkAdjustForm from "../components/credit-adjustment/BulkAdjustForm";

// Loader
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const actionType = url.searchParams.get("actionType");

  if (actionType === "getJobStatus") {
    const jobId = url.searchParams.get("jobId");
    if (!jobId) return Response.json(null);
    const job = await db.bulkAdjustmentJob.findUnique({ where: { id: jobId } });
    return Response.json(job);
  }

  const latestJob = await db.bulkAdjustmentJob.findFirst({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });

  const shopSubdomain = shop.split(".")[0];

  return Response.json({ latestJob, shopSubdomain });
};

// Action
export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const payload = await request.json();
  const { actionType, csvText, adjustmentType, notifyCustomers } = payload;

  if (actionType === "startBulk") {
    // Create new job
    const job = await db.bulkAdjustmentJob.create({
      data: {
        shop,
        adjustmentType,
        status: "Pending",
        totalRecords: 0,
        processed: 0,
        successCount: 0,
        failedCount: 0,
      },
    });

    // Run job in background (asynchronously)
    runBulkAdjustmentJobAsync(
      admin,
      shop,
      job.id,
      csvText,
      notifyCustomers,
      session.email || "Merchant"
    ).catch((err) => {
      console.error("[Bulk Job Exception] Failed to run:", err);
    });

    return Response.json({ success: true, jobId: job.id });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
};

// React View
export default function BulkAdjust() {
  const { latestJob, shopSubdomain } = useLoaderData();
  const fetcher = useFetcher();
  const jobFetcher = useFetcher();
  const navigate = useNavigate();

  // File Upload State
  const [errorMessage, setErrorMessage] = useState("");

  // Job Progress State
  const [activeJob, setActiveJob] = useState(() => {
    if (latestJob && (latestJob.status === "Pending" || latestJob.status === "Processing")) {
      return latestJob;
    }
    return null;
  });
  const pollingIntervalRef = useRef(null);

  // Poll job progress if active job is pending or processing
  useEffect(() => {
    if (activeJob && (activeJob.status === "Pending" || activeJob.status === "Processing")) {
      if (!pollingIntervalRef.current) {
        pollingIntervalRef.current = setInterval(() => {
          jobFetcher.load(`/app/bulk-adjust?actionType=getJobStatus&jobId=${activeJob.id}`);
        }, 1500);
      }
    } else {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [activeJob]);

  useEffect(() => {
    if (jobFetcher.data) {
      setActiveJob(jobFetcher.data);
    }
  }, [jobFetcher.data]);

  // Handle Action response
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.success && fetcher.data.jobId) {
        navigate("/app/credit-adjustment" + window.location.search);
      } else if (fetcher.data.error) {
        setErrorMessage(fetcher.data.error);
      }
    }
  }, [fetcher.state, fetcher.data]);

  // Download template action
  const handleDownloadTemplate = () => {
    const csvContent = "email,currency,amount,reason,expiration_date\ncustomer@example.com,USD,10.00,Loyalty rewards,2026-12-31";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk_adjustment_template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDownloadResults = () => {
    if (!activeJob?.resultsCsv) return;
    const blob = new Blob([activeJob.resultsCsv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bulk_adjustment_results_${activeJob.id}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleStartUpload = ({ csvText, adjustmentType, notifyCustomers }) => {
    fetcher.submit(
      {
        actionType: "startBulk",
        csvText,
        adjustmentType,
        notifyCustomers,
      },
      {
        method: "POST",
        encType: "application/json",
      }
    );
  };

  return (
    <Page
      title="Bulk Adjust"
      backAction={{ content: "Credit Adjustment", url: "/app/credit-adjustment" }}
    >
      <BulkAdjustForm
        activeJob={activeJob}
        onStartUpload={handleStartUpload}
        onDownloadTemplate={handleDownloadTemplate}
        onDownloadResults={handleDownloadResults}
        onBack={() => navigate("/app/credit-adjustment")}
        errorMessage={errorMessage}
        setErrorMessage={setErrorMessage}
        isSubmitting={fetcher.state === "submitting"}
        shopSubdomain={shopSubdomain}
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
