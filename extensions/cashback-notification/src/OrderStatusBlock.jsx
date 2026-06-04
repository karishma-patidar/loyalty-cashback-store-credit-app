import { render } from "preact";
import { useState, useEffect } from "preact/hooks";

export default () => {
  render(<Extension />, document.body);
};

const API_VERSION = "2026-04";

function Extension() {
  const order = shopify.order.value;

  const [message, setMessage] = useState("");
  const [pendingMsg, setPendingMsg] = useState("");
  const [completedMsg, setCompletedMsg] = useState("");
  const [tone, setTone] = useState(/** @type {"info" | "success" } */("info"));

  const replacePlaceholders = (text, amount, currency) => {
    return (text || "").replace(
      "{loyalty_credit_amount}",
      `${amount} ${currency}`
    );
  };

  // Get shop metafields
  useEffect(() => {
    shopify
      .query(`
        query {
          shop {
            metafields(
              identifiers: [
                {
                  namespace: "loyalty_cashback_app"
                  key: "widget_pending_msg"
                }
                {
                  namespace: "loyalty_cashback_app"
                  key: "widget_completed_msg"
                }
              ]
            ) {
              key
              value
            }
          }
        }
      `)
      .then((/** @type {any} */ response) => {
        const { data } = response;
        console.log("Shop Data:", data);

        const metafields = data?.shop?.metafields || [];

        metafields.forEach((/** @type {any} */ item) => {
          if (item && item.key === "widget_pending_msg") {
            setPendingMsg(item.value);
          }

          if (item && item.key === "widget_completed_msg") {
            setCompletedMsg(item.value);
          }
        });
      })
      .catch(console.error);
  }, []);

  // Get order metafield
  useEffect(() => {
    if (!order?.id) return;

    let isMounted = true;
    let timeoutId;

    async function getOrderData() {
      try {
        const response = await fetch(
          `shopify://customer-account/api/${API_VERSION}/graphql.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: `
                query {
                  order(id: "${order.id}") {
                    metafield(
                      namespace: "loyalty_cashback_app"
                      key: "cashback_notify"
                    ) {
                      value
                    }
                  }
                }
              `,
            }),
          }
        );

        const { data } = await response.json();

        // console.log("Order Data:", data);

        const metafieldValue = data?.order?.metafield?.value;

        if (!metafieldValue) {
          if (isMounted) timeoutId = setTimeout(getOrderData, 5000);
          return;
        }

        const eventData = JSON.parse(metafieldValue);
        // console.log("eventData", eventData);

        const amount = eventData?.issuedAmount || 0;
        const currency = eventData?.currency || "";
        const status = eventData?.status || "Pending";

        if (status === "Completed") {
          const msg = replacePlaceholders(completedMsg, amount, currency);

          if (isMounted) {
            setMessage(msg);
            setTone("success");
          }
          // Stop polling once Completed
        } else {
          const msg = replacePlaceholders(pendingMsg, amount, currency);

          if (isMounted) {
            setMessage(msg);
            setTone("info");
            // Continue polling every 5 seconds if Pending
            timeoutId = setTimeout(getOrderData, 5000);
          }
        }
      } catch (error) {
        console.error(error);
        if (isMounted) timeoutId = setTimeout(getOrderData, 5000);
      }
    }

    getOrderData();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [order?.id, pendingMsg, completedMsg]);

  if (!message) {
    return null;
  }

  return (
    <s-banner
      tone={tone}
      heading={message}
    />
  );
}