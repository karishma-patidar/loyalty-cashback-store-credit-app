import { useState, useEffect, useCallback, useRef } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { StylingForm } from "../styling/StylingForm.jsx";
import { PreviewSection } from "../styling/PreviewSection.jsx";

export default function StylingTab({ loaderData }) {
  const shopify = useAppBridge();
  const fetcher = useFetcher();

  const [bgColor, setBgColor] = useState(loaderData?.bgColor || "#cfb84a");
  const [textColor, setTextColor] = useState(loaderData?.textColor || "#000000");
  const [creditIcon, setCreditIcon] = useState(loaderData?.creditIcon || "icon2");
  const [hideWatermark, setHideWatermark] = useState(loaderData?.hideWatermark || false);
  const [previewPage, setPreviewPage] = useState("product");
  const [customIconSrc, setCustomIconSrc] = useState(
    loaderData?.creditIcon !== "icon1" &&
    loaderData?.creditIcon !== "icon2" &&
    loaderData?.creditIcon !== "icon3" &&
    loaderData?.creditIcon !== "icon4"
      ? loaderData?.creditIcon
      : null
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentFormState = JSON.stringify({
    bgColor,
    textColor,
    creditIcon: creditIcon === "custom" && customIconSrc ? customIconSrc : creditIcon,
    hideWatermark,
  });

  const [initialFormState, setInitialFormState] = useState(
    JSON.stringify({
      bgColor: loaderData?.bgColor || "#cfb84a",
      textColor: loaderData?.textColor || "#000000",
      creditIcon: loaderData?.creditIcon || "icon2",
      hideWatermark: loaderData?.hideWatermark || false,
    })
  );

  const isDirty = currentFormState !== initialFormState;

  useEffect(() => {
    if (isDirty) {
      shopify.saveBar.show("widget-styling-save-bar");
    } else {
      shopify.saveBar.hide("widget-styling-save-bar");
    }
  }, [isDirty, shopify]);

  const currentFormStateRef = useRef(currentFormState);
  useEffect(() => {
    currentFormStateRef.current = currentFormState;
  }, [currentFormState]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      setIsSubmitting(false);
      if (fetcher.data.success) {
        shopify.toast.show("Styling updated!");
        setInitialFormState(currentFormStateRef.current);
      } else {
        shopify.toast.show(
          fetcher.data.errors?.[0]?.message || "Error saving styling",
          { isError: true }
        );
      }
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const handleSave = useCallback(() => {
    setIsSubmitting(true);
    fetcher.submit(
      {
        actionType: "saveStyling",
        shopId: loaderData?.shopId,
        bgColor,
        textColor,
        creditIcon: creditIcon === "custom" && customIconSrc ? customIconSrc : creditIcon,
        hideWatermark,
      },
      { method: "POST", encType: "application/json" }
    );
  }, [fetcher, loaderData, bgColor, textColor, creditIcon, customIconSrc, hideWatermark]);

  const handleDiscard = useCallback(() => {
    const initial = JSON.parse(initialFormState);
    setBgColor(initial.bgColor);
    setTextColor(initial.textColor);
    if (
      initial.creditIcon === "icon1" ||
      initial.creditIcon === "icon2" ||
      initial.creditIcon === "icon3" ||
      initial.creditIcon === "icon4"
    ) {
      setCreditIcon(initial.creditIcon);
    } else {
      setCreditIcon("custom");
      setCustomIconSrc(initial.creditIcon);
    }
    setHideWatermark(initial.hideWatermark);
  }, [initialFormState]);

  return (
    <s-box padding="5">
      <ui-save-bar id="widget-styling-save-bar" open={isDirty ? "true" : undefined}>
        <button variant="primary" onClick={handleSave} loading={isSubmitting ? "true" : undefined} disabled={isSubmitting}>
          Save
        </button>
        <button onClick={handleDiscard} disabled={isSubmitting}>
          Discard
        </button>
      </ui-save-bar>

      <s-grid gridTemplateColumns="1.5fr 1fr" gap="base" alignItems="start">
        {/* Left Column - Reusable Form */}
        <s-box>
          <StylingForm
            bgColor={bgColor}
            setBgColor={setBgColor}
            textColor={textColor}
            setTextColor={setTextColor}
            creditIcon={creditIcon}
            setCreditIcon={setCreditIcon}
            customIconSrc={customIconSrc}
            setCustomIconSrc={setCustomIconSrc}
            hideWatermark={hideWatermark}
            setHideWatermark={setHideWatermark}
          />
        </s-box>

        {/* Right Column - Reusable Live Preview Card */}
        <s-box>
          <PreviewSection
            previewPage={previewPage}
            setPreviewPage={setPreviewPage}
            eligibility={{ d2c: true, b2b: false }}
            displayAmount="3.75"
            bgColor={bgColor}
            textColor={textColor}
            creditIcon={creditIcon === "custom" && customIconSrc ? customIconSrc : creditIcon}
            hideWatermark={hideWatermark}
          />
        </s-box>
      </s-grid>
    </s-box>
  );
}
