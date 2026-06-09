import {
    Badge,
    Banner,
    BlockStack,
    Box,
    Button,
    Card,
    Checkbox,
    Collapsible,
    EmptyState,
    Grid,
    Image,
    InlineStack,
    Link,
    List,
    Page,
    ResourceItem,
    ResourceList,
    Select,
    Text,
    TextField,
    Toast,
} from "@shopify/polaris";
import { ClipboardIcon, QuestionCircleIcon } from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, useLoaderData, useSubmit, useActionData, redirect, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { getShopPrograms, setShopPrograms } from "../services/graphql.server";
import { v4 as uuidv4 } from "uuid";
import AdminModel from "../hooks/AdminModel";
import { PostApi } from "../controller/Controller";
import { formatCurrency } from "../controller/formatCurrency";
import pkg from 'lodash';
const { isEqual } = pkg;
import UniversalSaveBar from "../controller/UniversalSaveBar"

// =============================================================================
// REMIX LOADER & ACTION
// =============================================================================
export const loader = async ({ request }) => {
    const { admin, session } = await authenticate.admin(request);

    // Fetch shop currency
    const query = `
      query {
        shop {
          currencyCode
        }
      }
    `;
    const response = await admin.graphql(query);
    const data = await response.json();
    const currencyCode = data?.data?.shop?.currencyCode || "USD";

    // Fetch existing programs
    const { shopId, programs } = await getShopPrograms(admin);

    return Response.json({
        shopId,
        currencyCode,
        programs,
        shopName: session.shop,
    });
};

export const action = async ({ request }) => {
    const { admin, session } = await authenticate.admin(request);
    const payload = await request.json();

    const { shopId, programs } = await getShopPrograms(admin);

    // Keep the actual programType (fixed/percentage) but flag it as a flow program
    const programData = {
        ...payload,
        isFlowProgram: true,
        id: payload.programId // use programId as id to keep consistency in metafield array
    };

    const existingIndex = programs.findIndex(p => p.programId === programData.programId || p.id === programData.programId);

    if (existingIndex >= 0) {
        programs[existingIndex] = programData;
    } else {
        programs.push(programData);
    }

    try {
        await setShopPrograms(admin, shopId, programs);
        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
};
// =============================================================================
// TEMPLATE FACTORY
// Single source of truth for all reward templates.
// Accepts currencyCode and a date/time context object.
// Add new templates here — no changes needed anywhere else.
// =============================================================================
function buildTemplates(currencyCode, { currentDate, currentTime, endsAtDateFormatted }) {
    return [
        {
            id: "create_account_reward",
            settings: {
                name: "Create Account Reward",
                allowedProgramTypes: ["fixed", "percentage"],
                status: false,
                programId: uuidv4(),
                programName: "Create Account Reward",
                programType: "fixed",
                amount: "10",
                currencyCode: currencyCode,
                enableExpirationDate: false,
                img: "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/program%20main%20images/Creat%20customer%20YouTube.png",
                connectProgramImage:
                    "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/flow-connect-program01.png",
                activateProgramImage:
                    "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/flow-connect-program02.png",
                setupVide: "https://youtu.be/TREMIEvAEeg",
                expirationDays: "30",
                startsAtDate: currentDate,
                startsAtTime: currentTime,
                enableEndsAt: false,
                endsAtDate: endsAtDateFormatted,
                endsAtTime: currentTime,
                downloadTemplate: "/Loyalty - Signup.flow",
                description: "Earn {loyalty_credit_amount} store credit on successful signup.",
                notify: false,
            },
        },
        {
            id: "first_order_reward",
            settings: {
                name: "First Order Reward",
                allowedProgramTypes: ["fixed", "percentage"],
                status: false,
                programId: uuidv4(),
                programName: "First Order Reward",
                programType: "percentage",
                amount: "15",
                currencyCode: currencyCode,
                img: "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/program%20main%20images/First%20order%20reword%20YouTube.png",
                connectProgramImage:
                    "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/Custlo%20-%20First%20Order%20Reward.jpg",
                activateProgramImage:
                    "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/Custlo%20-%20First%20Order%20Reward01.jpg",
                setupVide: "https://youtu.be/28piQeFpGq8",
                enableExpirationDate: true,
                expirationDays: "30",
                startsAtDate: currentDate,
                startsAtTime: currentTime,
                enableEndsAt: false,
                endsAtDate: endsAtDateFormatted,
                endsAtTime: currentTime,
                downloadTemplate: "/Loyalty - First_Order_Reward.flow",
                description: "Earn {loyalty_credit_amount} store credit on successful order.",
                notify: false,
            },
        },
        {
            id: "second_order_reward",
            settings: {
                name: "Second Order Reward",
                allowedProgramTypes: ["fixed", "percentage"],
                status: false,
                programId: uuidv4(),
                programName: "Second Order Reward",
                programType: "fixed",
                amount: "20",
                currencyCode: currencyCode,
                enableExpirationDate: false,
                img: "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/program%20main%20images/Second%20order%20reword%20YoutTube.png",
                connectProgramImage:
                    "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/flow-connect-program01.png",
                activateProgramImage:
                    "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/flow-connect-program02.png",
                setupVide: "https://youtu.be/TREMIEvAEeg",
                expirationDays: "30",
                startsAtDate: currentDate,
                startsAtTime: currentTime,
                enableEndsAt: false,
                endsAtDate: endsAtDateFormatted,
                endsAtTime: currentTime,
                downloadTemplate: "/Loyalty - Second_Order_Reward.flow",
                description: "Earn {loyalty_credit_amount} store credit on successful order.",
                notify: false,
            },
        },
        {
            id: "every_order_reward",
            settings: {
                name: "Order Reward",
                allowedProgramTypes: ["fixed", "percentage"],
                status: false,
                programId: uuidv4(),
                programName: "Order Reward",
                programType: "fixed",
                amount: "10",
                currencyCode: currencyCode,
                enableExpirationDate: false,
                img: "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/program%20main%20images/Order%20fulfilled%20YouTube.png",
                connectProgramImage:
                    "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/Custlo%20-%20First%20Order%20Reward.jpg",
                activateProgramImage:
                    "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/Custlo%20-%20First%20Order%20Reward01.jpg",
                setupVide: "https://youtu.be/28piQeFpGq8",
                expirationDays: "30",
                startsAtDate: currentDate,
                startsAtTime: currentTime,
                enableEndsAt: false,
                endsAtDate: endsAtDateFormatted,
                endsAtTime: currentTime,
                downloadTemplate: "/Loyalty - Order Rewards.flow",
                description: "Earn {loyalty_credit_amount} store credit on every successful order.",
                notify: false,
            },
        },
        {
            id: "newsletter_subscribe_reward",
            settings: {
                name: "Newsletter Subscribe Reward",
                allowedProgramTypes: ["fixed", "percentage"],
                status: false,
                programId: uuidv4(),
                programName: "Newsletter Subscribe Reward",
                programType: "fixed",
                amount: "10",
                currencyCode: currencyCode,
                enableExpirationDate: false,
                img: "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/program%20main%20images/Newsletter%20YouTube%20(1).png",
                connectProgramImage:
                    "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/Custlo%20-%20First%20Order%20Reward.jpg",
                activateProgramImage:
                    "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/Custlo%20-%20First%20Order%20Reward01.jpg",
                setupVide: "https://youtu.be/28piQeFpGq8",
                expirationDays: "30",
                startsAtDate: currentDate,
                startsAtTime: currentTime,
                enableEndsAt: false,
                endsAtDate: endsAtDateFormatted,
                endsAtTime: currentTime,
                downloadTemplate: "/Loyalty - Email Subscriber Reward.flow",
                description: "Earn {loyalty_credit_amount} store credit when you subscribe to the newsletter.",
                notify: false,
            },
        },
        {
            id: "birthday_reward",
            settings: {
                name: "Birthday Reward",
                allowedProgramTypes: ["fixed", "percentage"],
                status: false,
                programId: uuidv4(),
                programName: "Birthday Reward",
                programType: "fixed",
                amount: "10",
                currencyCode: currencyCode,
                enableExpirationDate: false,
                img: "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/program%20main%20images/Birthday%20YouTube%20(1).png",
                connectProgramImage:
                    "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/Custlo%20-%20First%20Order%20Reward.jpg",
                activateProgramImage:
                    "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/Custlo%20-%20First%20Order%20Reward01.jpg",
                setupVide: "https://youtu.be/28piQeFpGq8",
                expirationDays: "30",
                startsAtDate: currentDate,
                startsAtTime: currentTime,
                enableEndsAt: false,
                endsAtDate: endsAtDateFormatted,
                endsAtTime: currentTime,
                downloadTemplate: "/Loyalty - Birthday Reward.flow",
                description: "Earn {loyalty_credit_amount} store credit on your birthday.",
                notify: false,
            },
        },
        {
            id: "order_amount_reward",
            settings: {
                name: "Order amount reward",
                allowedProgramTypes: ["fixed", "percentage"],
                status: false,
                programId: uuidv4(),
                programName: "Order amount reward",
                programType: "fixed",
                amount: "10",
                currencyCode: currencyCode,
                enableExpirationDate: false,
                img: "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/program%20main%20images/Order%20amount%20reward%20YouTube.png",
                connectProgramImage:
                    "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/flow-connect-program01.png",
                activateProgramImage:
                    "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/flow-connect-program02.png",
                setupVide: "https://youtu.be/TREMIEvAEeg",
                expirationDays: "30",
                startsAtDate: currentDate,
                startsAtTime: currentTime,
                enableEndsAt: false,
                endsAtDate: endsAtDateFormatted,
                endsAtTime: currentTime,
                downloadTemplate: "/Loyalty - Order amount reward.flow",
                description: "Earn {loyalty_credit_amount} in store credit on every successful order above 100.",
                notify: false,
            },
        },
        {
            id: "order_specific_product",
            settings: {
                name: "Order with specific product reward",
                allowedProgramTypes: ["fixed", "percentage"],
                status: false,
                programId: uuidv4(),
                programName: "Specific product reward",
                programType: "fixed",
                amount: "12",
                currencyCode: currencyCode,
                enableExpirationDate: false,
                img: "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/program%20main%20images/Custlo%20reward%20order%20that%20includes%20a%20specific%20product%20YouTube.png",
                connectProgramImage:
                    "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/flow-connect-program01.png",
                activateProgramImage:
                    "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/flow-connect-program02.png",
                setupVide: "https://youtu.be/TREMIEvAEeg",
                expirationDays: "30",
                startsAtDate: currentDate,
                startsAtTime: currentTime,
                enableEndsAt: false,
                endsAtDate: endsAtDateFormatted,
                endsAtTime: currentTime,
                downloadTemplate: "/Loyalty-include-specific-product-reward.flow",
                description: "Earn {loyalty_credit_amount} in store credit on purchase specific product.",
                notify: false,
                infoBannerDescription: "This template is to issue store credit based on total order value when a specific product is included.",
            },
        },

        {
            id: "order_include_collection",
            settings: {
                name: "Order with specific collection product reward",
                allowedProgramTypes: ["fixed", "percentage"],
                status: false,
                programId: uuidv4(),
                programName: "Specific collection reward",
                programType: "fixed",
                amount: "15",
                currencyCode: currencyCode,
                enableExpirationDate: false,
                img: "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/program%20main%20images/Custlo%20reward%20order%20that%20includes%20products%20from%20a%20specific%20collection%20YouTube.png",
                connectProgramImage:
                    "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/flow-connect-program01.png",
                activateProgramImage:
                    "https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/flow-connect-program02.png",
                setupVide: "https://youtu.be/TREMIEvAEeg",
                expirationDays: "30",
                startsAtDate: currentDate,
                startsAtTime: currentTime,
                enableEndsAt: false,
                endsAtDate: endsAtDateFormatted,
                endsAtTime: currentTime,
                downloadTemplate: "/Loyalty-include-collection-reward.flow",
                description: "Earn {loyalty_credit_amount} in store credit on purchase from specific collection.",
                notify: false,
                infoBannerDescription: "This template is to issue store credit based on total order value when a specific product is included.",
            },
        }
    ];
}

// =============================================================================
// COMPONENT
// =============================================================================
function TemplateId() {
    const shopify = useAppBridge();
    const loaderData = useLoaderData();
    const currencyCode = loaderData?.currencyCode || "USD";
    const shopName = (loaderData?.shopName || "").replace(".myshopify.com", "");
    const programs = loaderData?.programs || [];
    const fetcher = useFetcher();

    // -------------------------------------------------------------------------
    // Date / time helpers — computed once on mount
    // -------------------------------------------------------------------------
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const currentDate = now.toISOString().slice(0, 10);
    const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const endsAtDate = new Date(now);
    endsAtDate.setDate(endsAtDate.getDate() + 30);
    const endsAtDateFormatted = endsAtDate.toISOString().slice(0, 10);

    // Shared date/time context passed to buildTemplates
    const dateTimeCtx = { currentDate, currentTime, endsAtDateFormatted };

    // -------------------------------------------------------------------------
    // Router
    // -------------------------------------------------------------------------
    const [searchParams] = useSearchParams();
    const paramsId = searchParams.get("id"); // templateId from URL
    const programId = searchParams.get("programId"); // existing program UUID to edit
    const navigate = useNavigate();

    // -------------------------------------------------------------------------
    // UI state
    // -------------------------------------------------------------------------
    const [handleSetupVideoModel, setHandleSetupVideoModel] = useState(false);
    const [pagenavigation, setpagenavigation] = useState("full_setup_guide");
    const [openId, setOpenId] = useState(1);
    const [openModel, setOpenModel] = useState(false);
    const [contentId, setContentId] = useState(1);
    const [loading, setLoading] = useState(false);
    const [modelHeading, setModelHeading] = useState("Apply a campaign template");
    const [hoveredMenu, setHoveredMenu] = useState(null);

    // -------------------------------------------------------------------------
    // Templates — derived from currencyCode (single source of truth)
    // -------------------------------------------------------------------------
    const templates = useMemo(
        () => buildTemplates(currencyCode, dateTimeCtx),
        [currencyCode]
    );

    // -------------------------------------------------------------------------
    // Selected template — derived from URL param
    // -------------------------------------------------------------------------
    const selectedTemplate = useMemo(
        () => templates.find((t) => t.id === paramsId) || templates[0],
        [templates, paramsId]
    );

    const existingProgram = useMemo(
        () => {
            if (!programId) return null;
            return programs.find((p) => p.programId === programId || p.id === programId);
        },
        [programId, programs]
    );

    // -------------------------------------------------------------------------
    // Settings state — synced whenever selectedTemplate changes
    // -------------------------------------------------------------------------
    const [settings, setSettings] = useState(() => existingProgram || selectedTemplate?.settings);
    const [defaultSettings, setDefaultSettings] = useState(existingProgram || selectedTemplate?.settings);

    useEffect(() => {
        if (existingProgram) {
            setSettings(existingProgram);
            setDefaultSettings(existingProgram);
        } else if (selectedTemplate) {
            setSettings(selectedTemplate.settings);
            setDefaultSettings(selectedTemplate.settings);
        }
    }, [selectedTemplate, existingProgram]);

    // Handle 2-second delay for saving
    useEffect(() => {
        if (fetcher.data?.success && fetcher.state === "idle") {
            const timer = setTimeout(() => {
                setLoading(false);
                setDefaultSettings(settings); // This hides the save bar instantly
                navigate("/app/programs?toast=saved", { replace: true });
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [fetcher.data, fetcher.state, navigate, settings]);

    // -------------------------------------------------------------------------
    // Static config
    // -------------------------------------------------------------------------
    const menus = [
        { title: "Full setup guide", menu_key: "full_setup_guide" },
        { title: "Workflow settings", menu_key: "program_settings" },
        { title: "Connect to shopify flow", menu_key: "connect_shopify_flow" },
    ];

    const programOptions = [
        { label: "Fixed amount", value: "fixed" },
        { label: "Percentage amount", value: "percentage" },
    ];

    // -------------------------------------------------------------------------
    // formatDescription
    // -------------------------------------------------------------------------
    const formatDescription = (description, amount, currencyCode, programType) => {
        if (!description) return "";
        if (!description.includes("{loyalty_credit_amount}")) return description;
        const replacement =
            programType === "percentage"
                ? `${amount}%`
                : formatCurrency(amount, currencyCode);
        return description.replace(/\{loyalty_credit_amount\}/g, replacement);
    };

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------
    const handleCopy = () => {
        navigator.clipboard.writeText(settings?.programId);
        shopify.toast.show("Workflow id copied");
    };

    const handleToggle = useCallback((id) => {
        setOpenId((prevId) => (prevId === id ? null : id));
    }, []);

    const handleChange = (key, value) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    const handleDownload = () => {
        const link = document.createElement("a");
        link.href = settings?.downloadTemplate; // file path inside public folder
        link.download = settings?.downloadTemplate; // name of file when downloaded
        link.click();
        window.open(`https://admin.shopify.com/store/${shopName}/apps/flow`, "_blank");
    };

    const handleNotifyEmailContent = () => {
        window.open(`https://admin.shopify.com/store/${shopName}/email_templates/store_credit_issued/preview`, "_blank");
    }

    const handleSaveData = async () => {
        setLoading(true);
        fetcher.submit(settings, { method: "POST", encType: "application/json" });
    };

    const handleOpenEditor = (id, heading) => {
        setOpenModel(!openModel);
        setContentId(id);
        setModelHeading(heading);
    };

    const handleSupport = () => {
        FrontChat("show");
    };

    // -------------------------------------------------------------------------
    // Modal image content (keyed by contentId)
    // -------------------------------------------------------------------------
    const renderContent = () => {
        switch (contentId) {
            case 1:
                return (
                    <Image
                        src="https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/Custlo%20-%20Import.jpg"
                        width="100%"
                    />
                );
            case 2:
                return <Image src={settings?.connectProgramImage} width="100%" />;
            case 3:
                return <Image src={settings?.activateProgramImage} width="100%" />;
            default:
                return <div>No content available</div>;
        }
    };

    // -------------------------------------------------------------------------
    // Setup video guide (keyed by template name)
    // -------------------------------------------------------------------------
    const renderSetupViodeGuide = () => {
        switch (settings?.name) {
            case "Create Account Reward":
                return (
                    <iframe
                        width="100%"
                        height="500"
                        src="https://www.youtube.com/embed/zZ0HQAQdORQ?si=m8K9wJbEfAC563e8"
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                    />
                );
            case "First Order Reward":
                return (
                    <iframe
                        width="100%"
                        height="500"
                        src="https://www.youtube.com/embed/QD9-iqPC5mk?si=th_xEMLlKJf5DCsU"
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                    />
                );
            case "Second Order Reward":
                return (
                    <iframe
                        width="100%"
                        height="500"
                        src="https://www.youtube.com/embed/rsrHul-Hqd0?si=sNzXAOfTqlWbtadk"
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                    />
                );
            case "Order Reward":
                return (
                    <iframe
                        width="100%"
                        height="500"
                        src="https://www.youtube.com/embed/iW3tfZUJ7So?si=sHU8YkoGxbbB2iwY"
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                    />
                );
            case "Newsletter Subscribe Reward":
                return (
                    <iframe
                        width="100%"
                        height="500"
                        src="https://www.youtube.com/embed/ID53r4GcLIQ?si=aRmmxxyQ1mv2drw7"
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                    />
                );

            case "Birthday Reward":
                return (
                    <iframe
                        width="100%"
                        height="500"
                        src="https://www.youtube.com/embed/LRLk0gmEh-o?si=EDKbc6I-7d-1hT0H"
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                    />
                );

            case "Order amount reward":
                return (
                    <iframe
                        width="100%"
                        height="500"
                        src="https://www.youtube.com/embed/75IOsj5QUPw?si=Uq6vlGeaEBaBZtWB"
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                    />
                );

            case "Order with specific product reward":
                return (
                    <iframe
                        width="100%"
                        height="500"
                        src="https://www.youtube.com/embed/prEPkdE51jM?si=Ho2nlmbbO6bSIljw"
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                    />
                );

            case "Order with specific collection product reward":
                return (
                    <iframe
                        width="100%"
                        height="500"
                        src="https://www.youtube.com/embed/8qjDJDKAZNc?si=rsXizITWgpmx2OJB"
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                    />
                );

            default:
                return <div>No content available</div>;
        }
    };

    // -------------------------------------------------------------------------
    // Program type + amount UI (inline component)
    // -------------------------------------------------------------------------
    const programTypeUI = (
        <InlineStack gap="300" blockAlign="center">
            {selectedTemplate?.settings?.allowedProgramTypes.length > 1 ? (
                <Select
                    options={programOptions.filter((opt) =>
                        selectedTemplate.settings?.allowedProgramTypes.includes(opt.value)
                    )}
                    onChange={(val) => handleChange("programType", val)}
                    value={settings?.programType}
                />
            ) : (
                <Select
                    options={[{ label: "Fixed amount", value: "fixed" }]}
                    onChange={(val) => handleChange("programType", val)}
                    value={settings?.programType}
                />
            )}
            <TextField
                type="text"
                value={settings?.amount}
                onChange={(val) => handleChange("amount", val)}
                autoComplete="off"
                suffix={settings?.programType === "fixed" ? currencyCode : "%"}
            />
        </InlineStack>
    );

    const [isDiscarding, setIsDiscarding] = useState(false);
    const hasChanges = !isEqual(settings, defaultSettings) && !isDiscarding;

    const handleCancelSaveData = () => {
        setIsDiscarding(true);
        setSettings(defaultSettings);

        // Wait for React to render open={false} and App Bridge to hide the bar
        setTimeout(() => {
            navigate("/app/programs");
        }, 500);
    };

    useEffect(() => {
        if (!settings?.status) {
            handleChange("status", "Active");
        }
    }, [settings?.status]);

    // =========================================================================
    // RENDER
    // =========================================================================
    return (
        <Box padding={{ xs: "200" }}>
            <Page
                backAction={{
                    content: "",
                    onAction: () => {
                        if (hasChanges) {
                            window.open("shopify://admin/apps", "_self");
                        } else {
                            navigate(`/app/choose-template`, { replace: true });
                        }
                    },
                }}
                title={settings?.programName}
                titleMetadata={
                    settings?.status === "Active" ? (
                        <Badge progress="complete" tone="success">
                            Active
                        </Badge>
                    ) : (
                        <Badge progress="incomplete" tone="info">
                            Paused
                        </Badge>
                    )
                }
                primaryAction={{
                    content: settings?.status === "Active" ? "Deactivate" : "Activate",
                    onAction: () => handleChange("status", settings?.status === "Active" ? "Paused" : "Active"),
                }}
            >
                {/* ---------------- Universal Save Bar ---------------------*/}
                <UniversalSaveBar
                    open={hasChanges}
                    loading={loading}
                    save={handleSaveData}
                    unsave={handleCancelSaveData}
                />
                {/* ------------------------------------------------------------------ */}
                {/* Modals                                                               */}
                {/* ------------------------------------------------------------------ */}
                <AdminModel
                    modalOpen={openModel}
                    setModalOpen={setOpenModel}
                    title={modelHeading}
                    buttonLabel=""
                    size="base"
                    modelContent={renderContent()}
                    loading={false}
                    tone="critical"
                />
                <AdminModel
                    modalOpen={handleSetupVideoModel}
                    setModalOpen={setHandleSetupVideoModel}
                    title={"Setup Guide"}
                    buttonLabel=""
                    size="large"
                    modelContent={renderSetupViodeGuide()}
                    loading={false}
                    tone="critical"
                />

                {/* ------------------------------------------------------------------ */}
                {/* Main layout                                                          */}
                {/* ------------------------------------------------------------------ */}
                <Grid>
                    {/* Left sidebar — sticky navigation menu */}
                    <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}>
                        <div style={{ position: "sticky", top: "5px" }}>
                            <Card padding="0">
                                <BlockStack gap="0">
                                    {menus.map((item, index) => {
                                        const { title, menu_key, dis } = item;
                                        const isActive = pagenavigation === menu_key;
                                        return (
                                            <div
                                                key={menu_key}
                                                onClick={() => setpagenavigation(menu_key)}
                                                onMouseEnter={() => setHoveredMenu(menu_key)}
                                                onMouseLeave={() => setHoveredMenu(null)}
                                                style={{ cursor: "pointer" }}
                                            >
                                                <Box
                                                    padding="400"
                                                    background={isActive ? "bg-surface-inverse" : (hoveredMenu === menu_key ? "bg-surface-secondary" : "bg-surface")}
                                                    borderBlockEndWidth={index < menus.length - 1 ? "025" : "0"}
                                                    borderColor="border"
                                                >
                                                    <InlineStack wrap={false} gap="300" blockAlign="center">
                                                        <div
                                                            style={{
                                                                width: "30px",
                                                                height: "30px",
                                                                borderRadius: "50%",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                flexShrink: 0,
                                                                backgroundColor: isActive ? "var(--p-color-bg-surface)" : "var(--p-color-bg-fill-transparent-secondary)",
                                                            }}
                                                        >
                                                            <Text
                                                                as="span"
                                                                fontWeight="semibold"
                                                                tone={isActive ? "base" : "subdued"}
                                                            >
                                                                {index + 1}
                                                            </Text>
                                                        </div>
                                                        <BlockStack gap="0">
                                                            <div
                                                                style={{
                                                                    fontWeight: isActive ? "600" : "500",
                                                                    color: isActive ? "#ffffff" : "var(--p-color-text)",
                                                                    fontSize: "14px"
                                                                }}
                                                            >
                                                                {title}
                                                            </div>
                                                            {dis && dis !== "" && (
                                                                <div
                                                                    style={{
                                                                        color: isActive ? "#e3e5e7" : "var(--p-color-text-subdued)",
                                                                        fontSize: "13px",
                                                                        marginTop: "2px"
                                                                    }}
                                                                >
                                                                    {dis}
                                                                </div>
                                                            )}
                                                        </BlockStack>
                                                    </InlineStack>
                                                </Box>
                                            </div>
                                        );
                                    })}
                                </BlockStack>
                            </Card>
                        </div>
                    </Grid.Cell>

                    {/* Right content area */}
                    <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 4, lg: 8, xl: 8 }}>

                        {/* ============================================================== */}
                        {/* TAB: Full Setup Guide                                            */}
                        {/* ============================================================== */}
                        {pagenavigation == "full_setup_guide" && (
                            <Card>
                                <BlockStack gap="300">

                                    <InlineStack align="space-between" blockAlign="center" gap="100">
                                        <Text as="h2" variant="headingMd">
                                            Setup Guide Video Walkthrough
                                        </Text>
                                        <Button
                                            variant="plain"
                                            icon={QuestionCircleIcon}
                                            onClick={handleSupport}
                                        >
                                            Need help ? contact us on live chat
                                        </Button>
                                    </InlineStack>
                                    <Text variant="bodyMd" color="subdued">
                                        Watch this short video to learn how to set up store credit
                                        workflow with shopify flow and get started quickly.
                                    </Text>
                                    <List type="number">
                                        <List.Item>
                                            Adjust the cashback amount in the <strong>Program Settings</strong>.
                                        </List.Item>
                                        <List.Item>
                                            Download the workflow template from <strong>Connect to Flow</strong>.
                                        </List.Item>
                                        <List.Item>
                                            Copy the <strong>Program ID</strong> and paste it into the required
                                            <strong> Shopify Flow actions</strong>.
                                        </List.Item>
                                        <List.Item>
                                            Save the workflow in <strong>Shopify Flow</strong> and publish it.
                                        </List.Item>
                                    </List>
                                    <div onClick={() => setHandleSetupVideoModel(!handleSetupVideoModel)}>
                                        <Image
                                            width="100%"
                                            height="100%"
                                            src={settings?.img}
                                            style={{ cursor: "pointer" }}
                                        />
                                    </div>
                                </BlockStack>
                            </Card>
                        )}

                        {/* ============================================================== */}
                        {/* TAB: Program / Workflow Settings                                 */}
                        {/* ============================================================== */}
                        {pagenavigation == "program_settings" && (
                            <>
                                <BlockStack gap="300">
                                    {
                                        settings?.infoBannerDescription && <Banner tone="info" >{settings?.infoBannerDescription} <a style={{ color: "#004299", cursor: "pointer" }} onClick={handleSupport} >Need help? contact us on live chat</a></Banner>
                                    }
                                    {/* Internal name */}
                                    <Card sectioned>
                                        <BlockStack gap="100">
                                            <Text as="h2" variant="headingSm">
                                                Name
                                            </Text>
                                            <TextField
                                                label=""
                                                value={settings?.programName}
                                                onChange={(val) => handleChange("programName", val)}
                                            // helpText="Your customers will see this."
                                            />
                                            <Text variant="bodySm" tone="subdued">
                                                Your customers will see this.
                                            </Text>
                                        </BlockStack>
                                    </Card>


                                    {/* Amount / Program type */}
                                    <Card sectioned>
                                        <BlockStack gap="100">
                                            <Text as="h2" variant="headingSm">
                                                Program settings
                                            </Text>
                                            <Text variant="bodyMd" tone="subdued">
                                                Amount of store credit buyers receive
                                            </Text>
                                            {programTypeUI}
                                            <Text
                                                variant="bodySm"
                                                tone="subdued"
                                                style={{ marginTop: "8px" }}
                                            >
                                                To comply with Shopify regulations, the store credit does
                                                not exceed $15,000 USD/customer
                                            </Text>
                                        </BlockStack>
                                    </Card>
                                    {/* Description */}
                                    <Card sectioned>
                                        <BlockStack gap="100">
                                            <Text as="h2" variant="headingSm">
                                                Description for customers
                                            </Text>
                                            <TextField
                                                label=""
                                                value={formatDescription(
                                                    settings?.description,
                                                    settings?.amount,
                                                    settings?.currencyCode,
                                                    settings?.programType
                                                )}
                                                onChange={(val) => handleChange("description", val)}
                                                multiline={3}
                                            // helpText="Show description to customers"
                                            // helpText={
                                            //   <>
                                            //     Manually editable. Use{" "}
                                            //     <strong>{`{loyalty_credit_amount}`}</strong>{" "}
                                            //     as a placeholder — it will be replaced dynamically
                                            //     with the formatted reward value.
                                            //   </>
                                            // }
                                            />
                                            <Text variant="bodySm" tone="subdued">
                                                Show description to customers
                                            </Text>
                                        </BlockStack>
                                    </Card>


                                    {/* Advanced settings — expiration */}
                                    <Card sectioned>
                                        <BlockStack gap="100">
                                            <Text as="h2" variant="headingSm">
                                                Advanced settings
                                            </Text>
                                            <Checkbox
                                                label="Enable expiration date"
                                                checked={settings?.enableExpirationDate}
                                                onChange={(val) =>
                                                    handleChange("enableExpirationDate", val)
                                                }
                                            />
                                            {settings?.enableExpirationDate && (
                                                <InlineStack gap="300">
                                                    <TextField
                                                        type="number"
                                                        value={settings?.expirationDays}
                                                        onChange={(val) =>
                                                            handleChange("expirationDays", val)
                                                        }
                                                        autoComplete="off"
                                                        suffix="days"
                                                    />
                                                </InlineStack>
                                            )}
                                            <Text variant="bodySm" tone="subdued">
                                                The expiration date is determined by the number of days
                                                after the issue date.
                                            </Text>
                                        </BlockStack>
                                    </Card>

                                    {/* Scheduling */}
                                    <Card sectioned>
                                        <BlockStack gap="100">
                                            <Text as="h2" variant="headingSm">
                                                Workflow scheduling
                                            </Text>
                                            <InlineStack gap="300">
                                                <TextField
                                                    type="date"
                                                    label="Start date"
                                                    value={settings?.startsAtDate}
                                                    onChange={(val) => handleChange("startsAtDate", val)}
                                                />
                                                <TextField
                                                    type="time"
                                                    label="Start time"
                                                    value={settings?.startsAtTime}
                                                    onChange={(val) => handleChange("startsAtTime", val)}
                                                />
                                            </InlineStack>

                                            <Checkbox
                                                label="Enable end date"
                                                checked={settings?.enableEndsAt}
                                                onChange={(val) => handleChange("enableEndsAt", val)}
                                            />

                                            {settings?.enableEndsAt && (
                                                <InlineStack gap="300">
                                                    <TextField
                                                        type="date"
                                                        label="End date"
                                                        value={settings?.endsAtDate}
                                                        onChange={(val) => handleChange("endsAtDate", val)}
                                                    />
                                                    <TextField
                                                        type="time"
                                                        label="End time"
                                                        value={settings?.endsAtTime}
                                                        onChange={(val) => handleChange("endsAtTime", val)}
                                                    />
                                                </InlineStack>
                                            )}
                                            <Text variant="bodySm" tone="subdued">
                                                Make sure to set the correct time according to your timezone.
                                            </Text>
                                        </BlockStack>
                                    </Card>

                                    {/* Notify customers when the received store credit */}
                                    <Card sectioned>
                                        <BlockStack gap="100">
                                            <Text as="h2" variant="headingSm">
                                                Email notification
                                            </Text>
                                            <Text variant="bodySm" tone="subdued">
                                                Notify customers when store credit is successfully issued.
                                            </Text>
                                            <Checkbox
                                                label="Notify customers via Shopify notifications"
                                                checked={settings?.notify || false}
                                                onChange={(val) => handleChange("notify", val)}
                                            />
                                            <Text variant="bodySm" tone="subdued">
                                                <Link onClick={handleNotifyEmailContent} >Customize email content</Link> in Customer notifications.
                                            </Text>
                                        </BlockStack>
                                    </Card>
                                </BlockStack>
                            </>
                        )}

                        {/* ============================================================== */}
                        {/* TAB: Connect to Shopify Flow                                     */}
                        {/* ============================================================== */}
                        {pagenavigation == "connect_shopify_flow" && (
                            <Card padding="200">
                                <BlockStack gap="100">

                                    {/* Step 1 — Download & import template */}
                                    <Box
                                        padding="200"
                                        borderRadius="200"
                                        background={openId === 1 ? "bg-fill-active" : ""}
                                    >
                                        <div>
                                            <InlineStack
                                                align="space-between"
                                                blockAlign="start"
                                                wrap={false}
                                                gap="200"
                                            >
                                                <InlineStack wrap={false} gap="200">
                                                    <div
                                                        style={{ cursor: "pointer" }}
                                                        onClick={() => handleToggle(1)}
                                                        className="flow_template_steps"
                                                    >
                                                        1
                                                    </div>
                                                    <BlockStack gap="150">
                                                        <div
                                                            style={{ cursor: "pointer" }}
                                                            onClick={() => handleToggle(1)}
                                                        >
                                                            <Text as="h2" variant="headingMd">
                                                                Apply a campaign template
                                                            </Text>
                                                        </div>
                                                        <Collapsible
                                                            open={openId === 1}
                                                            id="collapsible-1"
                                                            transition={{
                                                                duration: "500ms",
                                                                timingFunction: "ease-in-out",
                                                            }}
                                                            expandOnPrint
                                                        >
                                                            <BlockStack gap="100">
                                                                <div
                                                                    style={{
                                                                        paddingTop: "8px",
                                                                        paddingBottom: "8px",
                                                                    }}
                                                                >
                                                                    <List type="number">
                                                                        <List.Item>
                                                                            Click on <strong>Download template</strong>{" "}
                                                                            button to save the template to your device.
                                                                        </List.Item>
                                                                        <List.Item>
                                                                            In Shopify Flow, click{" "}
                                                                            <strong>Import</strong> {">"} choose{" "}
                                                                            <strong>Add</strong> file and select the{" "}
                                                                            <div>downloaded template</div>
                                                                        </List.Item>
                                                                    </List>
                                                                </div>
                                                                <Box>
                                                                    <Button
                                                                        onClick={handleDownload}
                                                                        size="large"
                                                                        variant="primary"
                                                                    >
                                                                        <InlineStack blockAlign="center" gap="150">
                                                                            <Image
                                                                                style={{ borderRadius: "4px" }}
                                                                                src="https://cdn.getkoin.io/portal/shopify-flow.png"
                                                                                width="25px"
                                                                                height="25px"
                                                                            />
                                                                            <Text>Download template</Text>
                                                                        </InlineStack>
                                                                    </Button>
                                                                </Box>
                                                            </BlockStack>
                                                        </Collapsible>
                                                    </BlockStack>
                                                </InlineStack>
                                                {openId === 1 && (
                                                    <Box>
                                                        <Button
                                                            onClick={() =>
                                                                handleOpenEditor(1, "Apply a campaign template")
                                                            }
                                                            icon={QuestionCircleIcon}
                                                            variant="plain"
                                                        >
                                                            Guide
                                                        </Button>
                                                    </Box>
                                                )}
                                            </InlineStack>
                                        </div>
                                    </Box>

                                    {/* Step 2 — Connect program to Shopify Flow */}
                                    <Box
                                        padding="200"
                                        borderRadius="200"
                                        background={openId === 2 ? "bg-fill-active" : ""}
                                    >
                                        <div>
                                            <InlineStack
                                                align="space-between"
                                                blockAlign="start"
                                                wrap={false}
                                                gap="200"
                                            >
                                                <InlineStack wrap={false} gap="200">
                                                    <div
                                                        style={{ cursor: "pointer" }}
                                                        onClick={() => handleToggle(2)}
                                                        className="flow_template_steps"
                                                    >
                                                        2
                                                    </div>
                                                    <BlockStack gap="150">
                                                        <div
                                                            style={{ cursor: "pointer" }}
                                                            onClick={() => handleToggle(2)}
                                                        >
                                                            <Text as="h2" variant="headingMd">
                                                                Connect program to Shopify Flow
                                                            </Text>
                                                        </div>
                                                        <Collapsible
                                                            open={openId === 2}
                                                            id="collapsible-2"
                                                            transition={{
                                                                duration: "500ms",
                                                                timingFunction: "ease-in-out",
                                                            }}
                                                            expandOnPrint
                                                        >
                                                            <BlockStack>
                                                                <div
                                                                    style={{
                                                                        paddingTop: "8px",
                                                                        paddingBottom: "8px",
                                                                    }}
                                                                >
                                                                    <List type="number">
                                                                        <List.Item>
                                                                            Copy the Program ID:
                                                                            <div
                                                                                style={{
                                                                                    display: "flex",
                                                                                    alignItems: "center",
                                                                                    gap: "10px",
                                                                                }}
                                                                            >
                                                                                <strong>{settings?.programId}</strong>{" "}
                                                                                <Button
                                                                                    icon={ClipboardIcon}
                                                                                    onClick={handleCopy}
                                                                                />
                                                                            </div>
                                                                        </List.Item>
                                                                        <List.Item>
                                                                            Open your{" "}
                                                                            <strong>Shopify Flow template</strong> →
                                                                            choose the{" "}
                                                                            <strong>Issue store credit</strong> action
                                                                            <div>
                                                                                and paste the <strong>copied ID</strong>{" "}
                                                                                into the <strong>Program ID field</strong>
                                                                                .
                                                                            </div>
                                                                        </List.Item>
                                                                    </List>
                                                                </div>
                                                            </BlockStack>
                                                        </Collapsible>
                                                    </BlockStack>
                                                </InlineStack>
                                                {openId === 2 && (
                                                    <Box>
                                                        <Button
                                                            onClick={() =>
                                                                handleOpenEditor(
                                                                    2,
                                                                    "Connect program to Shopify Flow"
                                                                )
                                                            }
                                                            icon={QuestionCircleIcon}
                                                            variant="plain"
                                                        >
                                                            Guide
                                                        </Button>
                                                    </Box>
                                                )}
                                            </InlineStack>
                                        </div>
                                    </Box>

                                    {/* Step 3 — Activate the workflow */}
                                    <Box
                                        padding="200"
                                        borderRadius="200"
                                        background={openId === 3 ? "bg-fill-active" : ""}
                                    >
                                        <div>
                                            <InlineStack
                                                align="space-between"
                                                blockAlign="start"
                                                wrap={false}
                                                gap="200"
                                            >
                                                <InlineStack wrap={false} gap="200">
                                                    <div
                                                        style={{ cursor: "pointer" }}
                                                        onClick={() => handleToggle(3)}
                                                        className="flow_template_steps"
                                                    >
                                                        3
                                                    </div>
                                                    <BlockStack gap="150">
                                                        <div
                                                            style={{ cursor: "pointer" }}
                                                            onClick={() => handleToggle(3)}
                                                        >
                                                            <Text as="h2" variant="headingMd">
                                                                Active the workflow
                                                            </Text>
                                                        </div>
                                                        <Collapsible
                                                            open={openId === 3}
                                                            id="collapsible-2"
                                                            transition={{
                                                                duration: "500ms",
                                                                timingFunction: "ease-in-out",
                                                            }}
                                                            expandOnPrint
                                                        >
                                                            <BlockStack>
                                                                <div
                                                                    style={{
                                                                        paddingTop: "8px",
                                                                        paddingBottom: "8px",
                                                                    }}
                                                                >
                                                                    Click <strong>"Turn on workflow"</strong> to
                                                                    start using your workflow
                                                                </div>
                                                            </BlockStack>
                                                        </Collapsible>
                                                    </BlockStack>
                                                </InlineStack>
                                                {openId === 3 && (
                                                    <Box>
                                                        <Button
                                                            onClick={() =>
                                                                handleOpenEditor(3, "Active the workflow")
                                                            }
                                                            icon={QuestionCircleIcon}
                                                            variant="plain"
                                                        >
                                                            Guide
                                                        </Button>
                                                    </Box>
                                                )}
                                            </InlineStack>
                                        </div>
                                    </Box>

                                </BlockStack>
                            </Card>
                        )}

                        {/* ============================================================== */}
                        {/* TAB: Publish Workflow                                            */}
                        {/* ============================================================== */}
                        {pagenavigation == "publish_program" && (
                            <Card>
                                {settings?.status === false ? (
                                    <EmptyState
                                        heading="Activate your store credit workflow"
                                        action={{
                                            content: "Publish Workflow",
                                            loading: loading,
                                            onAction: () => handleSaveData("status", !settings?.status),
                                        }}
                                        image="https://cdn.getkoin.io/portal/flow-publish.png"
                                    >
                                        <p>
                                            Publish this workflow to automatically issue store credits to
                                            customers based on your rules — no manual work needed.
                                        </p>
                                    </EmptyState>
                                ) : (
                                    <EmptyState
                                        heading="Program published successfully!"
                                        action={{
                                            content: "View all programs",
                                            onAction: () => {
                                                if (hasChanges) {
                                                    window.open("shopify://admin/apps", "_self");
                                                } else {
                                                    navigate("/dashboard-plus/automation", { replace: true });
                                                }
                                            },
                                        }}
                                        image="https://mandasa1.b-cdn.net/CustLo/Flow%20Integration/verified%20(1)01.png"
                                    >
                                        <p>
                                            Your program is now live and ready to issue store credits
                                            automatically.
                                        </p>
                                    </EmptyState>
                                )}
                            </Card>
                        )}

                    </Grid.Cell>
                </Grid>
            </Page>
        </Box >
    );
}

export default TemplateId;

// =============================================================================
// EXPORTED HELPER
// Returns the default settings for a given template ID.
// Reuses buildTemplates — the single source of truth.
// =============================================================================
export function getTemplateSettingsById(id, currencyCode = "USD") {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const currentDate = now.toISOString().slice(0, 10);
    const currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const endsAtDate = new Date(now);
    endsAtDate.setDate(endsAtDate.getDate() + 30);
    const endsAtDateFormatted = endsAtDate.toISOString().slice(0, 10);

    const templates = buildTemplates(currencyCode, {
        currentDate,
        currentTime,
        endsAtDateFormatted,
    });

    const found = templates.find((t) => t.id === id);
    return found ? found.settings : null;
}
