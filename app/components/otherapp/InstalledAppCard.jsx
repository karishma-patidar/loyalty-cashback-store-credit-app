/* eslint-disable react/prop-types */
export default function InstalledAppCard({
    href,
    learnMoreHref,
    iconSrc,
    iconAlt,
    title,
    description,
    buttonText,
}) {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                overflow: "hidden",
                transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                boxSizing: "border-box"
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 12px 24px rgba(0, 0, 0, 0.08)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.05)";
            }}
        >
            {/* Banner Image */}
            <div style={{ width: "100%", height: "auto", overflow: "hidden", borderBottom: "1px solid #f3f4f6" }}>
                <img
                    src={iconSrc}
                    alt={iconAlt}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                    }}
                />
            </div>
            {/* Body */}
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", flexGrow: 1 }}>
                <h3
                    style={{
                        margin: "0 0 8px 0",
                        fontSize: "15px",
                        fontWeight: "600",
                        color: "#111827",
                        lineHeight: "1.4",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden"
                    }}
                >
                    {title}
                </h3>
                <p
                    style={{
                        margin: "0 0 16px 0",
                        fontSize: "13px",
                        color: "#4b5563",
                        lineHeight: "1.5",
                        flexGrow: 1,
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden"
                    }}
                >
                    {description}
                </p>
                {/* Footer Buttons Row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            textDecoration: "none",
                            padding: "6px 14px",
                            backgroundColor: "#ffffff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: "600",
                            color: "#111827",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                            cursor: "pointer"
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#f9fafb";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#ffffff";
                        }}
                    >
                        {buttonText}
                    </a>
                    <a
                        href={learnMoreHref || href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            textDecoration: "none",
                            fontSize: "13px",
                            fontWeight: "500",
                            color: "#4b5563",
                            cursor: "pointer"
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.textDecoration = "underline";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.textDecoration = "none";
                        }}
                    >
                        Learn more
                    </a>
                </div>
            </div>
        </div>
    );
}