import React from "react";
import { useNavigate } from "react-router";
import {
    Page,
    Layout,
    Card,
    Button,
    Text,
    Grid,
    BlockStack,
    Box,
    Image,
    InlineStack,
    Badge,
} from "@shopify/polaris";

const templates = [

    {
        id: "every_order_reward",
        title: "Cashback on every purchases",
        description: "Reward customers with store credit based on their purchases.",
        // img: "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/program%20main%20images/Order%20fulfilled.png",

    },
    {
        id: "first_order_reward",
        title: "First order reward",
        description:
            "Give store credit to customers after they place their first order.",
        // img: "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/program%20main%20images/First%20order%20reword.png",
        badge: "Sales & Marketing",
        badgeTone: "info",
    },
    {
        id: "second_order_reward",
        title: "Second order reward",
        description: "Give store credit to customers after they place their second order.",
        // img: "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/program%20main%20images/Second%20order%20reword.png",
        badge: "Sales & Marketing",
        badgeTone: "info",
    },
    {
        id: "create_account_reward",
        title: "Signup reward",
        description:
            "Automatically reward customers with store credit when they create an account on your store.",
        // img: "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/program%20main%20images/Creat%20customer.png",
        badge: "Engagement",
        badgeTone: "warning",
    },
    {
        id: "newsletter_subscribe_reward",
        title: "Newsletter subscribe reward",
        description:
            "Reward customers with store credit when they subscribe to your email newsletter.",
        // img: "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/program%20main%20images/Newsletter.png",
        badge: "Engagement",
        badgeTone: "warning",
    },
    {
        id: "birthday_reward",
        title: "Birthday reward",
        description: "Reward customers with store credit on their birthday.",
        // img: "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/Birthday%20Template.png",
        badge: "Engagement",
        badgeTone: "warning",
    },
    {
        id: "order_amount_reward",
        title: "Order amount reward",
        description: "Issue store credit based on total order amount.",
        // img: "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/program%20main%20images/Order%20amount%20reward.png",
        badge: "Sales & Marketing",
        badgeTone: "info",
    },
    {
        id: "order_specific_product",
        title: "Specific product reward",
        description: "Issue store credit based on the total order value when a specific product is included.",
        // img: "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/program%20main%20images/Custlo%20reward%20order%20that%20includes%20a%20specific%20product.png",
        badge: "Sales & Marketing",
        badgeTone: "info",
    },
    {
        id: "order_include_collection",
        title: "Specific collection reward",
        description: "Issue store credit based on the total order value when a specific collection is included.",
        // img: "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/program%20main%20images/Custlo%20reward%20order%20that%20includes%20products%20from%20a%20specific%20collection.png",
        badge: "Sales & Marketing",
        badgeTone: "info",
    },
];

export default function AutomationIndex() {
    const navigate = useNavigate();

    const cashbackTemplate = templates.find((t) => t.id === "every_order_reward");
    const allTemplates = templates.find((t) => t.id === "every_order_reward") 
        ? templates.filter((t) => t.id !== "every_order_reward") 
        : templates;

    const [selectedTab, setSelectedTab] = React.useState("All");

    const badges = React.useMemo(() => {
        const counts = {};
        allTemplates.forEach((t) => {
            if (t.badge) {
                counts[t.badge] = (counts[t.badge] || 0) + 1;
            }
        });
        return Object.entries(counts).map(([badge, count]) => ({ badge, count }));
    }, [allTemplates]);

    const tabsList = [
        { label: `All (${allTemplates.length})`, value: "All" },
        ...badges.map((b) => ({ label: `${b.badge} (${b.count})`, value: b.badge })),
    ];

    const filteredTemplates =
        selectedTab === "All"
            ? allTemplates
            : allTemplates.filter((t) => t.badge === selectedTab);

    return (
        <Box padding={{ xs: "200" }}>
            <Page
                title="Programs"
                backAction={{
                    content: "",
                    onAction: () => navigate(-1),
                }}
            >
                <Layout>
                    <Layout.Section>
                        <BlockStack gap="500">
                            {/* Cashback Program Section */}
                            <BlockStack gap="300">
                                <Text variant="headingMd" as="h4">
                                    Cashback Program
                                </Text>
                                <Grid>
                                    <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 6, lg: 4, xl: 4 }}>
                                        <Card>
                                            <BlockStack gap="400">
                                                <Box minHeight="120px">
                                                    <BlockStack gap="400">
                                                        <InlineStack wrap={false} align="space-between">
                                                            <Box width="100%">
                                                                <Text as="h2" variant="headingMd">
                                                                    {cashbackTemplate.title}
                                                                </Text>
                                                            </Box>
                                                        </InlineStack>
                                                        <Text variant="bodyMd" tone="subdued">
                                                            {cashbackTemplate.description}
                                                        </Text>
                                                    </BlockStack>
                                                </Box>
                                                <InlineStack>
                                                    <Button onClick={() => navigate("/app/programs_new")}>
                                                        Manage
                                                    </Button>
                                                </InlineStack>
                                            </BlockStack>
                                        </Card>
                                    </Grid.Cell>
                                </Grid>
                            </BlockStack>

                            {/* All Programs Section */}
                            <BlockStack gap="400">
                                <InlineStack align="space-between" blockAlign="center">
                                    <BlockStack gap="100">
                                        <Text variant="headingMd" as="h4">
                                            Custom programs
                                        </Text>
                                        <Text variant="bodyMd" tone="subdued">
                                            Cashback with specific conditions by using Shopify Flow
                                        </Text>
                                    </BlockStack>

                                    <InlineStack gap="100">
                                        {tabsList.map((tab) => {
                                            const isSelected = selectedTab === tab.value;
                                            return (
                                                <div
                                                    key={tab.value}
                                                    style={{ cursor: "pointer" }}
                                                    onClick={() => setSelectedTab(tab.value)}
                                                >
                                                    <Box
                                                        paddingInlineStart="300"
                                                        paddingInlineEnd="300"
                                                        paddingBlockStart="150"
                                                        paddingBlockEnd="150"
                                                        background={isSelected ? "bg-surface-secondary" : "transparent"}
                                                        borderRadius="200"
                                                    >
                                                        <Text
                                                            variant="bodyMd"
                                                            fontWeight={isSelected ? "medium" : "regular"}
                                                            tone={isSelected ? "base" : "subdued"}
                                                        >
                                                            {tab.label}
                                                        </Text>
                                                    </Box>
                                                </div>
                                            );
                                        })}
                                    </InlineStack>
                                </InlineStack>
                                <Grid>
                                    {filteredTemplates.map((item) => (
                                        <Grid.Cell
                                            key={item.id}
                                            columnSpan={{ xs: 6, sm: 3, md: 6, lg: 4, xl: 4 }}
                                        >
                                            <Card>
                                                <BlockStack gap="400">
                                                    <Box minHeight="120px">
                                                        <BlockStack gap="400">
                                                            <InlineStack wrap={false} align="space-between">
                                                                <Box width="50%">
                                                                    <Text as="h2" variant="headingMd">
                                                                        {item.title}
                                                                    </Text>
                                                                </Box>
                                                                <Box>
                                                                    <Badge tone={item.badgeTone}>
                                                                        {item.badge}
                                                                    </Badge>
                                                                </Box>
                                                            </InlineStack>
                                                            <Text variant="bodyMd" tone="subdued">
                                                                {item.description}
                                                            </Text>
                                                        </BlockStack>
                                                    </Box>
                                                    <InlineStack>
                                                        <Button
                                                            onClick={() => navigate(`/app/flow-temapate?id=${item.id}`, { replace: true })}
                                                        >
                                                            Create
                                                        </Button>
                                                    </InlineStack>
                                                </BlockStack>
                                            </Card>
                                        </Grid.Cell>
                                    ))}
                                </Grid>
                            </BlockStack>
                        </BlockStack>
                    </Layout.Section>
                </Layout>
            </Page>
        </Box>
    );
}
