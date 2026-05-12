import { useState, useCallback } from "react";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import {
  Page,
  Layout,
  Card,
  Tabs,
  IndexTable,
  TextField,
  Badge,
  Button,
  InlineStack,
  BlockStack,
  Text,
  Box,
  EmptyState,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getShopPrograms, calculateCashbackAmount } from "../services/storeCredit.server";

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

// Loader to fetch native Shopify orders and calculate cashback on-the-fly with 100% database independence!
export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("query") || "";
  const activeTabId = url.searchParams.get("tab") || "0"; // "0" for Cashback, "1" for Custom Program

  const typeFilter = activeTabId === "1" ? "Custom Program" : "Cashback";

  // Fetch active program rules for live order cashback calculations
  const programs = await getShopPrograms(admin);
  const activeProgram = (programs && programs.length > 0) ? programs[0] : {
    id: "default",
    name: "Standard Cashback",
    programType: "order",
    amount: "10",
    amountType: "Percentage",
    status: "Active",
    notifyEmail: false
  };

  const transactions = [];

  try {
    const response = await admin.graphql(`#graphql
      query getOrders {
        orders(first: 50, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              name
              createdAt
              displayFinancialStatus
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              customer {
                id
                firstName
                lastName
                email
              }
              lineItems(first: 50) {
                edges {
                  node {
                    originalUnitPriceSet {
                      shopMoney {
                        amount
                      }
                    }
                    quantity
                  }
                }
              }
            }
          }
        }
      }
    `);

    const data = await response.json();
    const orders = data?.data?.orders?.edges || [];

    for (const edge of orders) {
      const order = edge.node;
      const orderId = String(order.id);
      const orderName = String(order.name);

      // Map GraphQL payload to standard structure expected by the calculation service
      const orderPayload = {
        id: orderId,
        name: orderName,
        currency: order.totalPriceSet?.shopMoney?.currencyCode || "USD",
        current_total_price: order.totalPriceSet?.shopMoney?.amount || "0",
        line_items: order.lineItems?.edges?.map(itemEdge => ({
          price: itemEdge.node?.originalUnitPriceSet?.shopMoney?.amount || "0",
          quantity: itemEdge.node?.quantity || 1
        })) || [],
        customer: {
          id: order.customer?.id?.split("/").pop() || ""
        }
      };

      const amount = calculateCashbackAmount(activeProgram, orderPayload);

      if (amount > 0) {
        const customerName = `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim() || "Guest Customer";
        
        // Search Filter
        if (searchQuery) {
          const searchLower = searchQuery.toLowerCase();
          const nameMatches = customerName.toLowerCase().includes(searchLower);
          const orderMatches = orderName.toLowerCase().includes(searchLower);
          if (!nameMatches && !orderMatches) {
            continue;
          }
        }

        // Program Type Tab Filter: All automatic loyalty cashbacks go to the Cashback tab
        const type = "Cashback";
        if (type !== typeFilter) {
          continue;
        }

        transactions.push({
          id: orderId,
          orderName,
          createdAt: order.createdAt,
          issuedAt: order.createdAt,
          customerName,
          amount,
          currency: orderPayload.currency,
          status: order.displayFinancialStatus === "PAID" ? "Completed" : "Pending",
          emailStatus: activeProgram.notifyEmail ? "Sent" : "Not Sent",
          type,
        });
      }
    }
  } catch (e) {
    console.error("Error auto-syncing orders in transactions loader:", e);
  }

  return {
    transactions,
    searchQuery,
    activeTabId: parseInt(activeTabId, 10),
  };
}

// Action to generate high performance CSV download file from live Shopify orders
export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);

  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "export") {
    // Fetch live program settings
    const programs = await getShopPrograms(admin);
    const activeProgram = (programs && programs.length > 0) ? programs[0] : {
      id: "default",
      name: "Standard Cashback",
      programType: "order",
      amount: "10",
      amountType: "Percentage",
      status: "Active",
      notifyEmail: false
    };

    const transactions = [];

    try {
      const response = await admin.graphql(`#graphql
        query getOrders {
          orders(first: 50, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                id
                name
                createdAt
                displayFinancialStatus
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                customer {
                  id
                  firstName
                  lastName
                }
                lineItems(first: 50) {
                  edges {
                    node {
                      originalUnitPriceSet {
                        shopMoney {
                          amount
                        }
                      }
                      quantity
                    }
                  }
                }
              }
            }
          }
        }
      `);

      const data = await response.json();
      const orders = data?.data?.orders?.edges || [];

      for (const edge of orders) {
        const order = edge.node;
        const orderId = String(order.id);
        const orderName = String(order.name);

        const orderPayload = {
          id: orderId,
          name: orderName,
          currency: order.totalPriceSet?.shopMoney?.currencyCode || "USD",
          current_total_price: order.totalPriceSet?.shopMoney?.amount || "0",
          line_items: order.lineItems?.edges?.map(itemEdge => ({
            price: itemEdge.node?.originalUnitPriceSet?.shopMoney?.amount || "0",
            quantity: itemEdge.node?.quantity || 1
          })) || [],
          customer: {
            id: order.customer?.id?.split("/").pop() || ""
          }
        };

        const amount = calculateCashbackAmount(activeProgram, orderPayload);

        if (amount > 0) {
          const customerName = `${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim() || "Guest Customer";
          transactions.push({
            id: orderId,
            orderName,
            createdAt: order.createdAt,
            customerName,
            amount,
            currency: orderPayload.currency,
            status: order.displayFinancialStatus === "PAID" ? "Completed" : "Pending",
            emailStatus: activeProgram.notifyEmail ? "Sent" : "Not Sent",
            type: "Cashback",
          });
        }
      }
    } catch (e) {
      console.error("Error exporting live orders:", e);
    }

    const headers = [
      "Order Name",
      "Customer Name",
      "Store Credit Amount",
      "Currency",
      "Status",
      "Email Status",
      "Program Type",
      "Date",
    ];

    const rows = transactions.map(t => [
      t.orderName,
      t.customerName,
      t.amount,
      t.currency,
      t.status,
      t.emailStatus,
      t.type,
      formatDate(t.createdAt),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")),
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
  const { transactions, searchQuery, activeTabId } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [searchVal, setSearchVal] = useState(searchQuery);

  const tabs = [
    { id: "0", content: "Cashback", panelID: "cashback-panel" },
    { id: "1", content: "Custom Program", panelID: "custom-program-panel" },
  ];

  // Handle Tab Switch
  const handleTabChange = useCallback(
    (selectedTabIndex) => {
      const params = new URLSearchParams();
      params.set("tab", String(selectedTabIndex));
      if (searchVal) params.set("query", searchVal);
      submit(params, { method: "get", replace: true });
    },
    [searchVal, submit]
  );

  // Handle Search Input Change
  const handleSearchChange = useCallback((value) => {
    setSearchVal(value);
    const params = new URLSearchParams();
    params.set("tab", String(activeTabId));
    if (value) params.set("query", value);
    submit(params, { method: "get", replace: true });
  }, [activeTabId, submit]);

  // Trigger Dynamic Refresh Sync
  const handleRefresh = useCallback(() => {
    const params = new URLSearchParams();
    params.set("tab", String(activeTabId));
    if (searchVal) params.set("query", searchVal);
    submit(params, { method: "get" });
  }, [activeTabId, searchVal, submit]);

  // Trigger CSV Export
  const handleExport = useCallback(() => {
    const formData = new FormData();
    formData.append("actionType", "export");
    submit(formData, { method: "post" });
  }, [submit]);

  const isLoading = navigation.state === "loading";

  // Table rows mapping
  const rowMarkup = transactions.map(
    ({ id, orderName, createdAt, issuedAt, customerName, amount, currency, status, emailStatus }, index) => (
      <IndexTable.Row id={id} key={id} position={index}>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {orderName}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{formatDate(createdAt)}</IndexTable.Cell>
        <IndexTable.Cell>{formatDate(issuedAt)}</IndexTable.Cell>
        <IndexTable.Cell>{customerName}</IndexTable.Cell>
        <IndexTable.Cell>
          <Text fontWeight="semibold" as="span">
            {Number(amount).toFixed(2)} {currency}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={status === "Completed" ? "success" : "attention"}>
            {status}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={emailStatus === "Sent" ? "success" : "info"}>
            {emailStatus}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button variant="plain" onClick={() => alert(`Details for Transaction ID: ${id}`)}>
            View Details
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  return (
    <Page
      title="Transactions"
      subtitle="Monitor and manage loyalty store credit awarded to customers automatically"
      primaryAction={{
        content: "Refresh Data",
        onAction: handleRefresh,
        loading: isLoading,
      }}
      secondaryActions={[
        {
          content: "Export CSV",
          onAction: handleExport,
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <Tabs tabs={tabs} selected={activeTabId} onSelect={handleTabChange}>
              <Box padding="400">
                <BlockStack gap="400">
                  <TextField
                    label="Search transactions"
                    labelHidden
                    value={searchVal}
                    onChange={handleSearchChange}
                    placeholder="Search by Order ID or Customer Name"
                    clearButton
                    onClearButtonClick={() => handleSearchChange("")}
                    autoComplete="off"
                  />

                  {transactions.length === 0 ? (
                    <EmptyState
                      heading="No transactions found"
                      action={{
                        content: "Sync Latest Shopify Orders",
                        onAction: handleRefresh,
                        loading: isLoading,
                      }}
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>
                        There are currently no recorded store credit transactions matching this tab. Click below to pull orders from Shopify.
                      </p>
                    </EmptyState>
                  ) : (
                    <IndexTable
                      resourceName={{ singular: "transaction", plural: "transactions" }}
                      itemCount={transactions.length}
                      selectable={false}
                      headings={[
                        { title: "Order" },
                        { title: "Created At" },
                        { title: "Issued At" },
                        { title: "Customer Name" },
                        { title: "Store Credit" },
                        { title: "Status" },
                        { title: "Email Status" },
                        { title: "Actions" },
                      ]}
                    >
                      {rowMarkup}
                    </IndexTable>
                  )}
                </BlockStack>
              </Box>
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
