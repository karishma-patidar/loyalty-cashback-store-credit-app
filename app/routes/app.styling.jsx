import { useState, useEffect, useCallback, useRef } from "react";
import {
  useNavigate,
  useLoaderData,
  useFetcher,
  useRouteError,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { Page } from "@shopify/polaris";
import { StylingForm } from "../components/styling/StylingForm.jsx";
import { PreviewSection } from "../components/styling/PreviewSection.jsx";
import { getShopStyling, setShopStyling } from "../services/graphql.server";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  return getShopStyling(admin);
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const payload = await request.json();
  const { shopId, bgColor, textColor, creditIcon, hideWatermark } = payload;

  try {
    await setShopStyling(admin, shopId, { bgColor, textColor, creditIcon, hideWatermark });
    return { success: true };
  } catch (error) {
    return { success: false, errors: [{ message: error.message }] };
  }
}

export default function StylingPage() {
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const loaderData = useLoaderData();
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
      : null,
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentFormState = JSON.stringify({
    bgColor,
    textColor,
    creditIcon:
      creditIcon === "custom" && customIconSrc ? customIconSrc : creditIcon,
    hideWatermark,
  });

  const [initialFormState, setInitialFormState] = useState(
    JSON.stringify({
      bgColor: loaderData?.bgColor || "#cfb84a",
      textColor: loaderData?.textColor || "#000000",
      creditIcon: loaderData?.creditIcon || "icon2",
      hideWatermark: loaderData?.hideWatermark || false,
    }),
  );

  const isDirty = currentFormState !== initialFormState;

  useEffect(() => {
    if (isDirty) {
      shopify.saveBar.show("styling-save-bar");
    } else {
      shopify.saveBar.hide("styling-save-bar");
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
          { isError: true },
        );
      }
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const handleSave = useCallback(() => {
    setIsSubmitting(true);
    fetcher.submit(
      {
        shopId: loaderData?.shopId,
        bgColor,
        textColor,
        creditIcon:
          creditIcon === "custom" && customIconSrc ? customIconSrc : creditIcon,
        hideWatermark,
      },
      { method: "POST", encType: "application/json" },
    );
  }, [
    fetcher,
    loaderData,
    bgColor,
    textColor,
    creditIcon,
    customIconSrc,
    hideWatermark,
  ]);

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
    <Page
      title="Styling"
      backAction={{
        content: "Back",
        onAction: () => {
          if (isDirty) {
            handleDiscard();
          }
          navigate("/app/settings");
        },
      }}
    >
      <ui-save-bar id="styling-save-bar" open={isDirty ? "true" : undefined}>
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
        <s-grid gridTemplateColumns="1.5fr 1fr" gap="base" alignItems="start">
          {/* Left Column - Reusable Styling Form */}
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

          {/* Right Column - Reusable Live Preview */}
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
    </Page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
