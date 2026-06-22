import { useRef, useState, useEffect } from "react";
import Nojiro from "../../app-logos/Nojiro.png";
import postPurchase from "../../app-logos/post-purchase.png";
import checkout from "../../app-logos/Checkout.png";
import InstalledAppCard from "./InstalledAppCard";
import orderEditing from "../../app-logos/orderEditing.png";
// import passonext from "../../app-logos/passonext.png";

export default function InstalledApps() {
    const sliderRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScrollState = () => {
        if (sliderRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
            // Use a threshold of 1px to handle sub-pixel rendering issues
            setCanScrollLeft(scrollLeft > 1);
            setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
        }
    };

    useEffect(() => {
        const slider = sliderRef.current;
        if (slider) {
            updateScrollState();
            slider.addEventListener("scroll", updateScrollState);
            window.addEventListener("resize", updateScrollState);
        }
        return () => {
            if (slider) slider.removeEventListener("scroll", updateScrollState);
            window.removeEventListener("resize", updateScrollState);
        };
    }, []);

    const scrollLeft = () => {
        if (!sliderRef.current) return;

        sliderRef.current.scrollBy({
            left: -sliderRef.current.clientWidth / 2.5,
            behavior: "smooth",
        });
    };

    const scrollRight = () => {
        if (!sliderRef.current) return;

        sliderRef.current.scrollBy({
            left: sliderRef.current.clientWidth / 2.5,
            behavior: "smooth",
        });
    };

    const apps = [
        {
            href: "https://apps.shopify.com/checkout-extensions-pro?utm_source=custlo&utm_medium=listing&utm_campaign=checkout_extensions",
            learnMoreHref: "https://checkoutextensions.pro/?utm_source=custlo&utm_medium=listing&utm_campaign=checkout_extensions",
            iconSrc: checkout,
            iconAlt: "Checkout Extensions Pro - MT: Streamline Checkout Management",
            title: "Checkout Extensions Pro - MT: Streamline Checkout Management",
            description: "Powerful App for Checkout Custom Fields, Rules & Customization, Upsells, Conversion, Branding etc.",
            buttonText: "Try Checkout Extensions FREE ❤️",
        },
        {
            href: "https://apps.shopify.com/post-purchase-upsells?utm_source=custlo&utm_medium=listing&utm_campaign=post_purchase_upsells",
            learnMoreHref: "https://apps.shopify.com/post-purchase-upsells?utm_source=custlo&utm_medium=listing&utm_campaign=post_purchase_upsells",
            iconSrc: postPurchase,
            iconAlt: "Post Purchase Upsell - MT: Boost AOV & Retention",
            title: "Post Purchase Upsell - MT: Boost AOV & Retention",
            description: "Boost AOV with one-click post-purchase upsells, funnels, targeting, analytics & translations.",
            buttonText: "Try Upsells FREE ❤️",
        },
        {
            href: "https://apps.shopify.com/customer-account-verification?utm_source=custlo&utm_medium=listing&utm_campaign=customer_account_verification",
            learnMoreHref: "https://apps.shopify.com/customer-account-verification?utm_source=custlo&utm_medium=listing&utm_campaign=customer_account_verification",
            iconSrc: Nojiro,
            iconAlt: "Nojiro : Fraud Filter, Blocker: Protect Store",
            title: "Nojiro : Fraud Filter, Blocker: Protect Store",
            description: "Block spam, protect content, and restrict countries with Nojiro - your all-in-one store protector.",
            buttonText: "Try Nojiro FREE ❤️",
        },
        // {
        //     href: "https://apps.shopify.com/passonext",
        //     iconSrc: passonext,
        //     iconAlt: "PassoNext: DPP for EU",
        //     title: "PassoNext: DPP for EU",
        //     description: "Create Digital Product Passports (DPP) with QR codes for EU compliance.",
        //     buttonText: "Try PassoNext FREE :heart:",
        // },
        // {
        //     href: "https://apps.shopify.com/order-editing-mt",
        //     iconSrc: orderEditing,
        //     iconAlt: "Order Editing - MT",
        //     title: "Order Editing - MT",
        //     description: "Allows edit address, edit orders, cancel order after checkout easily.",
        //     buttonText: "Try Order Editing FREE :heart:",
        // },
    ];

    return (
        <s-box
            background="base"
            borderRadius="large"
           padding="small"
        >
            <s-stack gap="large">
                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                    <s-heading >Discover More Apps to Grow Your Store</s-heading>
                    <s-stack direction="inline" alignment="center" gap="small">
                        {/* <s-stack alignItems="center"><s-link href="https://apps.shopify.com/search?q=mandasa">View more top apps</s-link></s-stack> */}
                        {/* <s-stack direction="inline" alignment="center" gap="small"> */}
                        <s-button
                            icon="chevron-left"
                            accessibilityLabel="Previous"
                            onClick={scrollLeft}
                            disabled={!canScrollLeft}
                        />
                        <s-button
                            icon="chevron-right"
                            accessibilityLabel="Next"
                            onClick={scrollRight}
                            disabled={!canScrollRight}
                        />
                        {/* </s-stack> */}
                    </s-stack>
                </s-stack>

                <a
                    href="https://apps.shopify.com/order-editing-mt"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none', color: 'inherit', display: 'block', marginBottom: '8px' }}
                >
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.2s ease',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #f3f4f6' }}>
                                <img src={orderEditing} alt="Order Editing - MT" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#111827' }}>Order Editing - MT</h3>
                                    <span style={{
                                        padding: '2px 8px',
                                        backgroundColor: '#eff6ff',
                                        color: '#2563eb',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        borderRadius: '12px'
                                    }}>Custlo Picks</span>
                                </div>
                                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                                    Let customers edit orders, addresses, products & cancel orders after checkout easily.
                                </p>
                            </div>
                        </div>
                        <div>
                            <button style={{
                                padding: '6px 14px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#111827',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                            }}>
                                Try FREE <span>❤️</span>
                            </button>
                        </div>
                    </div>
                </a>

                <s-stack>
                    {/* Slider */}
                    <div
                        ref={sliderRef}
                        style={{
                            display: "flex",
                            overflowX: "auto",
                            scrollbarWidth: "none",
                            msOverflowStyle: "none",
                            columnGap: "10px",
                            flexWrap: "nowrap",
                        }}
                    >
                        {apps.map((app, index) => (
                            <div
                                key={index}
                                style={{
                                    flex: "0 0 calc((100% - 15px) / 2.5)", width: "calc((100% - 15px) / 2.5)"
                                }}
                            >
                                <InstalledAppCard {...app} />
                            </div>
                        ))}
                    </div>
                </s-stack>
            </s-stack>
        </s-box>
    );
}