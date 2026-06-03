/* global process */
import { Outlet, useLoaderData, useRouteError, redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { getAppSettings } from "../db.mongodb.server";
import "@shopify/polaris/build/esm/styles.css";

export const loader = async ({ request }) => {
  console.log("App Loader: Authenticating...");
  const { admin, session } = await authenticate.admin(request);
  console.log("App Loader: Authenticated for shop:", session.shop);

  // Check onboarding completed flag in MongoDB
  const settings = await getAppSettings(session.shop);
  const onboardingCompleted = settings?.onboardingCompleted ?? false;

  const url = new URL(request.url);
  const path = url.pathname;
  const searchParams = url.searchParams.toString();
  const searchString = searchParams ? `?${searchParams}` : "";

  if (!onboardingCompleted && path !== "/app/onboarding") {
    throw redirect(`/app/onboarding${searchString}`);
  }

  if (onboardingCompleted && path === "/app/onboarding") {
    throw redirect(`/app${searchString}`);
  }

  // Background check to process matured delayed store credits
  try {
    const { processDelayedCredits } = await import("../services/webhookProcessor.server");
    // Run asynchronously without blocking loader response
    processDelayedCredits(session.shop, admin).catch((err) =>
      console.error("Error processing delayed credits in app loader:", err)
    );
  } catch (err) {
    console.error("Failed to run processDelayedCredits in app loader:", err);
  }

  // eslint-disable-next-line no-undef
  return {
    apiKey: process.env.SHOPIFY_API_KEY,
    onboardingCompleted,
  };
};

export default function App() {
  const { apiKey, onboardingCompleted } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={enTranslations}>
        {onboardingCompleted && (
          <s-app-nav>
            <s-link href="/app/programs">Programs</s-link>
            <s-link href="/app/settings">Settings</s-link>
            <s-link href="/app/transactions">Transactions</s-link>
            <s-link href="/app/analytics">Analytics</s-link>
          </s-app-nav>
        )}
        <Outlet />
      </PolarisAppProvider>
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
