import { useNavigate, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return { success: true };
};

export const PromotionWidgets = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-3xl">
        <s-section heading="Promotion widgets">
          <s-box border="base" borderRadius="base">
            <s-clickable
              padding="small-100"
              onClick={() => navigate("/app/widget_settings")}
              accessibilityLabel="Manage widget settings"
            >
              <s-grid
                gridTemplateColumns="1fr auto"
                alignItems="center"
                gap="base"
              >
                <s-box>
                  <s-heading>Widget settings</s-heading>
                  <s-paragraph color="subdued">
                    Display the promotion widgets to boost visibility and
                    engagement of store credit programs
                  </s-paragraph>
                </s-box>
                <s-icon type="chevron-right" />
              </s-grid>
            </s-clickable>
            <s-box paddingInline="small-100">
              <s-divider />
            </s-box>
            <s-clickable
              padding="small-100"
              onClick={() => navigate("/app/widget_styling")}
              accessibilityLabel="Configure styling"
            >
              <s-grid
                gridTemplateColumns="1fr auto"
                alignItems="center"
                gap="base"
              >
                <s-box>
                  <s-heading>Styling</s-heading>
                  <s-paragraph color="subdued">
                    Customize how your promotion looks and displays
                  </s-paragraph>
                </s-box>
                <s-icon type="chevron-right" />
              </s-grid>
            </s-clickable>
            <s-box paddingInline="small-100">
              <s-divider />
            </s-box>
            <s-clickable
              padding="small-100"
              href="#"
              accessibilityLabel="Manage text content and translations"
            >
              <s-grid
                gridTemplateColumns="1fr auto"
                alignItems="center"
                gap="base"
              >
                <s-box>
                  <s-heading>Content & Translation</s-heading>
                  <s-paragraph color="subdued">
                    Manage text content and translations
                  </s-paragraph>
                </s-box>
                <s-icon type="chevron-right" />
              </s-grid>
            </s-clickable>
          </s-box>
        </s-section>
      </div>
    </div>
  );
};

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export default PromotionWidgets;
