import { useRef, useEffect } from "react";
import PropTypes from "prop-types";

const ICONS = {
  icon1: (color = "#F59E0B") => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill={color} />
      <path d="M12 7l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6L12 7z" fill="#FFF" />
    </svg>
  ),
  icon2: (color = "#F59E0B") => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill={color} />
      <text x="12" y="16.5" fill="#FFF" fontSize="13" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">$</text>
    </svg>
  ),
  icon3: (color = "#F59E0B") => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill={color} />
      <circle cx="12" cy="12" r="6" stroke="#FFF" strokeWidth="2" fill="none" />
    </svg>
  ),
  icon4: (color = "#F59E0B") => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="6" width="16" height="12" rx="2" stroke={color} strokeWidth="2.5" fill="none" />
      <circle cx="16" cy="12" r="2" fill={color} />
    </svg>
  ),
};

export function StylingForm({
  bgColor,
  setBgColor,
  textColor,
  setTextColor,
  creditIcon,
  setCreditIcon,
  customIconSrc,
  setCustomIconSrc,
  hideWatermark,
  setHideWatermark,
}) {
  const bgColorFieldRef = useRef(null);
  const textColorFieldRef = useRef(null);

  useEffect(() => {
    const el = bgColorFieldRef.current;
    if (!el) return;
    const handleColorEvent = (e) => {
      const val = e.target?.value || e.detail?.value;
      if (val) setBgColor(val);
    };
    el.addEventListener("input", handleColorEvent);
    el.addEventListener("change", handleColorEvent);
    return () => {
      el.removeEventListener("input", handleColorEvent);
      el.removeEventListener("change", handleColorEvent);
    };
  }, [setBgColor]);

  useEffect(() => {
    const el = textColorFieldRef.current;
    if (!el) return;
    const handleColorEvent = (e) => {
      const val = e.target?.value || e.detail?.value;
      if (val) setTextColor(val);
    };
    el.addEventListener("input", handleColorEvent);
    el.addEventListener("change", handleColorEvent);
    return () => {
      el.removeEventListener("input", handleColorEvent);
      el.removeEventListener("change", handleColorEvent);
    };
  }, [setTextColor]);

  return (
    <s-stack direction="block" gap="base" style={{ width: "100%", boxSizing: "border-box" }}>
      {/* Card 1 - Watermark Toggle */}
      <s-section>
        <s-box padding="4">
          <s-checkbox
            label="Hide watermark"
            checked={hideWatermark ? true : undefined}
            onInput={(e) => setHideWatermark(e.target.checked)}
          />
        </s-box>
      </s-section>

      {/* Card 2 - Styling Settings */}
      <s-section>
        <s-box padding="5">
          <s-stack direction="block" gap="base">
            <s-heading variant="headingSm">Styles</s-heading>

            <s-color-field ref={bgColorFieldRef} label="Background color" value={bgColor}></s-color-field>
            <s-color-field ref={textColorFieldRef} label="Text primary color" value={textColor}></s-color-field>

            <s-stack direction="block" gap="small">
              <s-text variant="bold">
                Credit icon
              </s-text>
              <s-stack direction="inline" gap="base" alignment="center">
                {["icon1", "icon2", "icon3", "icon4"].map((iconKey) => (
                  <button
                    key={iconKey}
                    type="button"
                    onClick={() => setCreditIcon(iconKey)}
                    style={{
                      width: "44px",
                      height: "44px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: creditIcon === iconKey ? "2px solid #000" : "1px solid #E4E8EC",
                      borderRadius: "8px",
                      backgroundColor: "#FFF",
                      cursor: "pointer",
                    }}
                  >
                    {ICONS[iconKey]()}
                  </button>
                ))}

                <label
                  style={{
                    width: "88px",
                    height: "44px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    border: "1px dashed #C4CDD5",
                    borderRadius: "8px",
                    backgroundColor: "#FFF",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#454F5B",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: "#637381" }}
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement("canvas");
                            const ctx = canvas.getContext("2d");
                            canvas.width = 64;
                            canvas.height = 64;
                            ctx.drawImage(img, 0, 0, 64, 64);
                            const compressedDataUrl = canvas.toDataURL("image/png");
                            setCustomIconSrc(compressedDataUrl);
                            setCreditIcon("custom");
                          };
                          img.src = event.target?.result;
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    style={{ display: "none" }}
                  />
                </label>

                {customIconSrc && (
                  <>
                    <s-text color="subdued">or</s-text>
                    <button
                      type="button"
                      onClick={() => setCreditIcon("custom")}
                      style={{
                        width: "44px",
                        height: "44px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: creditIcon === "custom" ? "2px solid #000" : "1px solid #E4E8EC",
                        borderRadius: "8px",
                        backgroundColor: "#FFF",
                        cursor: "pointer",
                      }}
                    >
                      <img src={customIconSrc} alt="Custom Icon" style={{ width: "32px", height: "32px", objectFit: "contain" }} />
                    </button>
                  </>
                )}
              </s-stack>
            </s-stack>
          </s-stack>
        </s-box>
      </s-section>
    </s-stack>
  );
}

StylingForm.propTypes = {
  bgColor: PropTypes.string,
  setBgColor: PropTypes.func.isRequired,
  textColor: PropTypes.string,
  setTextColor: PropTypes.func.isRequired,
  creditIcon: PropTypes.string,
  setCreditIcon: PropTypes.func.isRequired,
  customIconSrc: PropTypes.string,
  setCustomIconSrc: PropTypes.func.isRequired,
  hideWatermark: PropTypes.bool,
  setHideWatermark: PropTypes.func.isRequired,
};
