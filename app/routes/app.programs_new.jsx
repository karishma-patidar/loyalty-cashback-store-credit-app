import { useState, useCallback, useEffect, useRef } from "react";
import {
  useNavigate,
  useSearchParams,
  useRouteError,
  useLoaderData,
  useFetcher,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getShopPrograms, setShopPrograms } from "../services/graphql.server";
import { PreviewSection } from "../components/Program_page/PreviewSection.jsx";
import { ProgramScheduling } from "../components/Program_page/ProgramScheduling.jsx";
import { PromotionSettings } from "../components/Program_page/PromotionSettings.jsx";
import { AdvancedSettings } from "../components/Program_page/AdvancedSettings.jsx";
import { ProgramSettingsCard } from "../components/Program_page/ProgramSettingsCard.jsx";
import { ChannelEligibilitySettings } from "../components/Program_page/ChannelEligibilitySettings.jsx";
import { Page } from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const editId = url.searchParams.get("id");

  const { programs } = await getShopPrograms(admin);

  let program = null;
  if (editId) {
    program = programs.find((p) => p.id === editId);
  }

  return { program };
};

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const payload = await request.json();
    let programData = payload.programData;
    if (typeof programData === "string") {
      programData = JSON.parse(programData);
    }

    const { shopId, programs } = await getShopPrograms(admin);

    let updatedPrograms = [];
    if (programs.length > 0) {
      programData.id = programs[0].id;
      updatedPrograms = [programData];
    } else {
      updatedPrograms = [programData];
    }

    await setShopPrograms(admin, shopId, updatedPrograms);
    return Response.json({ success: true, id: programData.id });
  } catch (error) {
    console.error("Action error:", error);
    return Response.json({ success: false, error: error.message });
  }
};

export default function NewProgram() {
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStatusToggling, setIsStatusToggling] = useState(false);
  const loaderData = useLoaderData();
  const initialProgram = loaderData?.program;

  const fetcher = useFetcher();

  // --- Form State ---
  const [name, setName] = useState(
    initialProgram?.name || "Cashback on every purchase",
  );
  const [programType, setProgramType] = useState(
    initialProgram?.programType || "order",
  );
  const [amountType, setAmountType] = useState(
    initialProgram?.amountType || "Fixed amount",
  );
  const [amount, setAmount] = useState(initialProgram?.amount || "15");
  const [maxAmount, setMaxAmount] = useState(initialProgram?.maxAmount || "");

  const [enableExpiration, setEnableExpiration] = useState(
    initialProgram?.enableExpiration ?? true,
  );
  const [expirationType, setExpirationType] = useState(
    initialProgram?.expirationType || "duration",
  );
  const [expirationDays, setExpirationDays] = useState(
    initialProgram?.expirationDays || "15",
  );
  const [expirationDate, setExpirationDate] = useState(
    initialProgram?.expirationDate || "2026-06-30",
  );

  const [enableDelay, setEnableDelay] = useState(
    initialProgram?.enableDelay ?? false,
  );
  const [delayDays, setDelayDays] = useState(initialProgram?.delayDays || "7");

  const [channels, setChannels] = useState(
    initialProgram?.channels || { online: true, pos: false, draft: false },
  );
  const [eligibility, setEligibility] = useState(
    initialProgram?.eligibility || { d2c: true, b2b: false },
  );

  const [startDate, setStartDate] = useState(
    initialProgram?.startDate || "2026-04-24",
  );
  const [startTime, setStartTime] = useState(
    initialProgram?.startTime || "02:41",
  );
  const [enableEndDate, setEnableEndDate] = useState(
    initialProgram?.enableEndDate ?? false,
  );
  const [endDate, setEndDate] = useState(
    initialProgram?.endDate || "2026-06-30",
  );
  const [endTime, setEndTime] = useState(initialProgram?.endTime || "06:35");
  const [showCartDrawerPoints, setShowCartDrawerPoints] = useState(
    initialProgram?.showCartDrawerPoints ?? true,
  );

  const [msgCart, setMsgCart] = useState(
    initialProgram?.msgCart ||
      "You will get <strong>{loyalty_credit_amount}</strong> store credit after this purchase.",
  );
  const [msgProduct, setMsgProduct] = useState(
    initialProgram?.msgProduct ||
      "Receive {loyalty_credit_amount} store credit when purchasing each item.",
  );
  const [notifyEmail, setNotifyEmail] = useState(
    initialProgram?.notifyEmail ?? false,
  );

  const [previewPage, setPreviewPage] = useState("product");
  const [currentStatus, setCurrentStatus] = useState(
    initialProgram?.status || "Active",
  );

  // Dynamically compute dirtiness
  const currentFormState = JSON.stringify({
    name,
    programType,
    amountType,
    amount,
    maxAmount,
    enableExpiration,
    expirationType,
    expirationDays,
    expirationDate,
    enableDelay,
    delayDays,
    channels,
    eligibility,
    startDate,
    startTime,
    enableEndDate,
    endDate,
    endTime,
    msgCart,
    msgProduct,
    notifyEmail,
    currentStatus,
    showCartDrawerPoints,
  });
  const [initialFormState, setInitialFormState] = useState(currentFormState);
  const isDirty = currentFormState !== initialFormState;

  useEffect(() => {
    if (isDirty) {
      shopify.saveBar.show("programs-save-bar");
    } else {
      shopify.saveBar.hide("programs-save-bar");
    }
  }, [isDirty, shopify]);

  useEffect(() => {
    if (initialProgram) {
      setInitialFormState(
        JSON.stringify({
          name: initialProgram.name || "Cashback on every purchase",
          programType: initialProgram.programType || "order",
          amountType: initialProgram.amountType || "Fixed amount",
          amount: initialProgram.amount || "15",
          maxAmount: initialProgram.maxAmount || "",
          enableExpiration: initialProgram.enableExpiration ?? true,
          expirationType: initialProgram.expirationType || "duration",
          expirationDays: initialProgram.expirationDays || "15",
          expirationDate: initialProgram.expirationDate || "2026-06-30",
          enableDelay: initialProgram.enableDelay ?? false,
          delayDays: initialProgram.delayDays || "7",
          channels: initialProgram.channels || {
            online: true,
            pos: false,
            draft: false,
          },
          eligibility: initialProgram.eligibility || { d2c: true, b2b: false },
          startDate: initialProgram.startDate || "2026-04-24",
          startTime: initialProgram.startTime || "02:41",
          enableEndDate: initialProgram.enableEndDate ?? false,
          endDate: initialProgram.endDate || "2026-06-30",
          endTime: initialProgram.endTime || "06:35",
          msgCart:
            initialProgram.msgCart ||
            "You will get <strong>{loyalty_credit_amount}</strong> store credit after this purchase.",
          msgProduct:
            initialProgram.msgProduct ||
            "Receive {loyalty_credit_amount} store credit when purchasing each item.",
          notifyEmail: initialProgram.notifyEmail ?? false,
          currentStatus: initialProgram.status || "Active",
          showCartDrawerPoints: initialProgram.showCartDrawerPoints ?? true,
        }),
      );
    }
  }, [initialProgram]);

  const currentFormStateRef = useRef(currentFormState);
  const hasStartedRef = useRef(false);
  useEffect(() => {
    currentFormStateRef.current = currentFormState;
  }, [currentFormState]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (hasStartedRef.current) {
        hasStartedRef.current = false;

        if (isSubmitting) {
          setIsSubmitting(false);
          if (fetcher.data.success) {
            shopify.toast.show("Program saved successfully");
            setInitialFormState(currentFormStateRef.current);
            if (!editId && fetcher.data.id) {
              navigate(`/app/programs_new?id=${fetcher.data.id}`, {
                replace: true,
              });
            }
          } else {
            shopify.toast.show(fetcher.data.error || "Error saving program", {
              isError: true,
            });
          }
        }
      }
    }
  }, [fetcher.state, fetcher.data, isSubmitting, editId, navigate, shopify]);

  useEffect(() => {
    if (currentStatus === "Paused") return;
    if (enableEndDate && endDate && endTime) {
      const datePart = endDate.includes("T") ? endDate.split("T")[0] : endDate;
      const end = new Date(`${datePart} ${endTime}`);
      if (end.toString() !== "Invalid Date" && end < new Date()) {
        setCurrentStatus("Expired");
      } else if (currentStatus !== "Active") {
        setCurrentStatus("Active");
      }
    } else {
      if (currentStatus !== "Active" && currentStatus !== "Paused")
        setCurrentStatus("Active");
    }
  }, [enableEndDate, endDate, endTime, currentStatus]);

  const calculatedAmount = ((parseFloat(amount) || 0) / 100) * 25.0;
  const maxCap = parseFloat(maxAmount);
  const displayAmount =
    amountType === "Fixed amount"
      ? (parseFloat(amount) || 0).toFixed(2)
      : (!isNaN(maxCap) && calculatedAmount > maxCap
          ? maxCap
          : calculatedAmount
        ).toFixed(2);

  const handleSave = useCallback(() => {
    setIsSubmitting(true);
    hasStartedRef.current = true;
    const programData = {
      id: editId || String(Date.now()),
      name,
      programType,
      amount,
      amountType,
      maxAmount,
      enableEndDate,
      endDate,
      endTime,
      status: currentStatus,
      enableExpiration,
      expirationType,
      expirationDays,
      expirationDate,
      enableDelay,
      delayDays,
      channels,
      eligibility,
      msgCart,
      msgProduct,
      notifyEmail,
      startDate,
      startTime,
      showCartDrawerPoints,
      issued: "0 INR",
      budget: "Unlimited",
    };

    fetcher.submit(
      { programData: JSON.stringify(programData) },
      { method: "POST", encType: "application/json" },
    );
  }, [
    fetcher,
    editId,
    name,
    programType,
    amount,
    amountType,
    maxAmount,
    enableEndDate,
    endDate,
    endTime,
    currentStatus,
    enableExpiration,
    expirationType,
    expirationDays,
    expirationDate,
    enableDelay,
    delayDays,
    channels,
    eligibility,
    msgCart,
    msgProduct,
    notifyEmail,
    startDate,
    startTime,
    showCartDrawerPoints,
  ]);

  const handleDiscard = useCallback(() => {
    const initial = JSON.parse(initialFormState);
    setName(initial.name);
    setProgramType(initial.programType);
    setAmountType(initial.amountType);
    setAmount(initial.amount);
    setMaxAmount(initial.maxAmount || "");
    setEnableExpiration(initial.enableExpiration);
    setExpirationType(initial.expirationType);
    setExpirationDays(initial.expirationDays);
    setExpirationDate(initial.expirationDate);
    setEnableDelay(initial.enableDelay);
    setDelayDays(initial.delayDays);
    setChannels(initial.channels);
    setEligibility(initial.eligibility);
    setStartDate(initial.startDate);
    setStartTime(initial.startTime);
    setEnableEndDate(initial.enableEndDate);
    setEndDate(initial.endDate);
    setEndTime(initial.endTime);
    setMsgCart(initial.msgCart);
    setMsgProduct(initial.msgProduct);
    setNotifyEmail(initial.notifyEmail);
  }, [initialFormState]);

  const toggleStatus = useCallback(() => {
    const nextStatus = currentStatus === "Active" ? "Paused" : "Active";
    setIsStatusToggling(true);

    // Show success toast instantly!
    shopify.toast.show("updated");

    // Clear loader spinner and update text after a tiny, minimal timeout for premium feedback
    setTimeout(() => {
      setCurrentStatus(nextStatus);
      setIsStatusToggling(false);

      // Update initialFormState immediately to avoid flashing the Save Bar
      try {
        const initialObj = JSON.parse(initialFormState);
        initialObj.currentStatus = nextStatus;
        setInitialFormState(JSON.stringify(initialObj));
      } catch (e) {
        console.error("Error parsing initial form state:", e);
      }
    }, 500);

    const programData = {
      id: editId || String(Date.now()),
      name,
      programType,
      amount,
      amountType,
      maxAmount,
      enableExpiration,
      expirationType,
      expirationDays,
      expirationDate,
      enableDelay,
      delayDays,
      channels,
      eligibility,
      startDate,
      startTime,
      enableEndDate,
      endDate,
      endTime,
      msgCart,
      msgProduct,
      notifyEmail,
      status: nextStatus,
      showCartDrawerPoints,
    };

    fetcher.submit(
      { programData: JSON.stringify(programData) },
      { method: "POST", encType: "application/json" },
    );
  }, [
    currentStatus,
    initialFormState,
    editId,
    name,
    programType,
    amount,
    amountType,
    maxAmount,
    enableExpiration,
    expirationType,
    expirationDays,
    expirationDate,
    enableDelay,
    delayDays,
    channels,
    eligibility,
    startDate,
    startTime,
    enableEndDate,
    endDate,
    endTime,
    msgCart,
    msgProduct,
    notifyEmail,
    showCartDrawerPoints,
    fetcher,
    shopify,
  ]);

  return (
    <Page
      title={`${name}`}
      backAction={{
        content: "Back",
        onAction: () => {
          if (isDirty) {
            handleDiscard();
          }
          navigate("/app/programs");
        },
      }}
    >
      <ui-save-bar id="programs-save-bar" open={isDirty ? "true" : undefined}>
        <button
          variant="primary"
          onClick={handleSave}
          loading={isSubmitting ? "true" : undefined}
          disabled={isSubmitting}
        >
          Save
        </button>
        <button onClick={handleDiscard} disabled={isSubmitting}>
          Discard
        </button>
      </ui-save-bar>

      <s-box padding="5">
        {/* Header Row */}
        <s-box paddingBlockEnd="loose">
          <s-stack direction="inline" alignment="center">
            <s-stack direction="inline" gap="base" alignment="center">
              <s-badge
                tone={currentStatus === "Active" ? "success" : "subdued"}
              >
                {currentStatus}
              </s-badge>
            </s-stack>
            <s-box flex="1" />
            <s-stack direction="inline" gap="tight">
              <s-button
                variant={currentStatus === "Active" ? "secondary" : "primary"}
                onClick={toggleStatus}
                loading={isStatusToggling ? "true" : undefined}
              >
                {currentStatus === "Active" ? "Deactivate" : "Activate"}
              </s-button>
            </s-stack>
          </s-stack>
        </s-box>

        <s-grid gridTemplateColumns="2fr 1fr" gap="base" alignItems="start">
          {/* Left Column - Form */}
          <s-box>
            <s-stack direction="block" gap="base">
              {/* Program Name */}
              <s-section>
                <s-stack gap="base">
                  <s-box padding="4">
                    <s-heading variant="headingSm">Program name</s-heading>
                  </s-box>
                  <s-box padding="5" paddingBlockStart="0">
                    <s-text-field
                      type="text"
                      value={name}
                      onInput={(e) => setName(e.target.value)}
                      placeholder="e.g. Cashback on every purchase"
                    />
                  </s-box>
                </s-stack>
              </s-section>

              <ProgramSettingsCard
                programType={programType}
                setProgramType={setProgramType}
                amountType={amountType}
                setAmountType={setAmountType}
                amount={amount}
                setAmount={setAmount}
                maxAmount={maxAmount}
                setMaxAmount={setMaxAmount}
              />

              <AdvancedSettings
                enableExpiration={enableExpiration}
                setEnableExpiration={setEnableExpiration}
                expirationType={expirationType}
                setExpirationType={setExpirationType}
                expirationDate={expirationDate}
                setExpirationDate={setExpirationDate}
                expirationDays={expirationDays}
                setExpirationDays={setExpirationDays}
                enableDelay={enableDelay}
                setEnableDelay={setEnableDelay}
                delayDays={delayDays}
                setDelayDays={setDelayDays}
              />

              <ChannelEligibilitySettings
                channels={channels}
                setChannels={setChannels}
                eligibility={eligibility}
                setEligibility={setEligibility}
              />

              <ProgramScheduling
                startDate={startDate}
                setStartDate={setStartDate}
                startTime={startTime}
                setStartTime={setStartTime}
                enableEndDate={enableEndDate}
                setEnableEndDate={setEnableEndDate}
                endDate={endDate}
                setEndDate={setEndDate}
                endTime={endTime}
                setEndTime={setEndTime}
              />

              <PromotionSettings
                msgProduct={msgProduct}
                setMsgProduct={setMsgProduct}
                msgCart={msgCart}
                setMsgCart={setMsgCart}
                showCartDrawerPoints={showCartDrawerPoints}
                setShowCartDrawerPoints={setShowCartDrawerPoints}
              />
            </s-stack>
          </s-box>

          <PreviewSection
            previewPage={previewPage}
            setPreviewPage={setPreviewPage}
            eligibility={eligibility}
            displayAmount={displayAmount}
            handleSave={handleSave}
            isSubmitting={isSubmitting}
            editId={editId}
          />
        </s-grid>
      </s-box>
    </Page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
