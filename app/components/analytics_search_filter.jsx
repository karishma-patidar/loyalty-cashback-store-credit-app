import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";

// Helper: Format a date object to YYYY-MM-DD
const formatDate = (date) => {
    return date.toISOString().split("T")[0];
};

// Helper: Get dates for a given preset
const getPresetDates = (preset) => {
    const today = new Date();
    today.setHours(12, 0, 0, 0); // avoid timezone shifts

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    switch (preset) {
        case "today":
            return { from: formatDate(today), to: formatDate(today) };
        case "yesterday":
            return { from: formatDate(yesterday), to: formatDate(yesterday) };
        case "seven": {
            const start = new Date(today);
            start.setDate(today.getDate() - 6);
            return { from: formatDate(start), to: formatDate(today) };
        }
        case "thirty": {
            const start = new Date(today);
            start.setDate(today.getDate() - 29);
            return { from: formatDate(start), to: formatDate(today) };
        }
        case "month": {
            const start = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0);
            return { from: formatDate(start), to: formatDate(today) };
        }
        case "all":
            return { from: "", to: "" };
        default:
            return null;
    }
};

// Helper: Detect which preset matches the given date range
const detectPreset = (from, to) => {
    if (!from && !to) return "all";
    const presetIds = ["today", "yesterday", "seven", "thirty", "month"];
    for (const id of presetIds) {
        const dates = getPresetDates(id);
        if (dates && dates.from === from && dates.to === to) {
            return id;
        }
    }
    return "custom";
};

// Helper: Format range for preview and footer display
const formatDisplayRange = (fromStr, toStr) => {
    if (!fromStr && !toStr) return "All Time";

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const parse = (str) => {
        if (!str) return null;
        const parts = str.split("-").map(Number);
        if (parts.length !== 3) return null;
        return { year: parts[0], month: months[parts[1] - 1], day: parts[2] };
    };

    const from = parse(fromStr);
    const to = parse(toStr);

    if (from && to) {
        if (from.year === to.year) {
            if (from.month === to.month) {
                if (from.day === to.day) {
                    return `${from.day} ${from.month} ${from.year}`;
                }
                return `${from.day}–${to.day} ${from.month} ${from.year}`;
            }
            return `${from.day} ${from.month}–${to.day} ${to.month} ${from.year}`;
        }
        return `${from.day} ${from.month} ${from.year}–${to.day} ${to.month} ${to.year}`;
    } else if (from) {
        return `From ${from.day} ${from.month} ${from.year}`;
    } else {
        return `Until ${to.day} ${to.month} ${to.year}`;
    }
};

export default function DateFilter({ dateFrom, dateTo, onDateChange, onClose }) {
    const [activePreset, setActivePreset] = useState(() => detectPreset(dateFrom, dateTo));
    const [tempDateFrom, setTempDateFrom] = useState(dateFrom);
    const [tempDateTo, setTempDateTo] = useState(dateTo);

    const datePickerRef = useRef(null);
    const isProgrammaticUpdate = useRef(false);

    // Sync state when initial props change
    useEffect(() => {
        setTempDateFrom(dateFrom);
        setTempDateTo(dateTo);
        setActivePreset(detectPreset(dateFrom, dateTo));
    }, [dateFrom, dateTo]);

    const tempRangeValue = tempDateFrom && tempDateTo ? `${tempDateFrom}--${tempDateTo}` : (tempDateFrom ? `${tempDateFrom}--` : "");

    // Force value updates to custom element calendar directly (skip if interactive manual selection)
    useEffect(() => {
        if (datePickerRef.current) {
            if (datePickerRef.current.value !== tempRangeValue) {
                // Set the programmatic update flag before writing properties/attributes
                isProgrammaticUpdate.current = true;

                // We only write values when state is out of sync with calendar's internal state
                // (e.g. on mount or when clicking preset buttons).
                datePickerRef.current.value = tempRangeValue;
                if (datePickerRef.current.getAttribute("value") !== tempRangeValue) {
                    datePickerRef.current.setAttribute("value", tempRangeValue);
                }
                // Sync calendar view to show the start month of the selected range
                if (tempDateFrom) {
                    const targetView = tempDateFrom.substring(0, 7); // e.g. "2026-05"
                    if (datePickerRef.current.getAttribute("view") !== targetView) {
                        datePickerRef.current.setAttribute("view", targetView);
                    }
                }

                // Safely clear the programmatic update flag in the next tick after events propagate
                setTimeout(() => {
                    isProgrammaticUpdate.current = false;
                }, 0);
            }
        }
    }, [tempRangeValue, tempDateFrom]);

    // Handle events using native DOM listeners to avoid React Web Component issues
    useEffect(() => {
        const picker = datePickerRef.current;
        if (!picker) return;

        const handleCalendarChange = (e) => {
            if (isProgrammaticUpdate.current) {
                return; // Ignore programmatic change events triggered by setting values
            }

            const val = e.target.value;
            setActivePreset("custom"); // Switch to custom range on calendar interaction
            if (!val) {
                setTempDateFrom("");
                setTempDateTo("");
                return;
            }
            const parts = val.split("--");
            if (parts.length === 2 && parts[1]) {
                setTempDateFrom(parts[0]);
                setTempDateTo(parts[1]);
            } else {
                setTempDateFrom(parts[0]);
                setTempDateTo("");
            }
        };

        picker.addEventListener("change", handleCalendarChange);
        picker.addEventListener("input", handleCalendarChange);

        return () => {
            picker.removeEventListener("change", handleCalendarChange);
            picker.removeEventListener("input", handleCalendarChange);
        };
    }, []);

    const presets = [
        { id: "today", label: "Today" },
        { id: "yesterday", label: "Yesterday" },
        { id: "seven", label: "Last 7 Days" },
        { id: "thirty", label: "Last 30 Days" },
        { id: "month", label: "This Month" },
        { id: "all", label: "All Time" },
        { id: "custom", label: "Custom Range" },
    ];

    const handlePresetClick = (presetId) => {
        setActivePreset(presetId);
        if (presetId !== "custom") {
            const range = getPresetDates(presetId);
            if (range) {
                setTempDateFrom(range.from);
                setTempDateTo(range.to);
            }
        }
    };

    const handleApply = () => {
        onDateChange({ from: tempDateFrom, to: tempDateTo });
        if (onClose) onClose();
    };

    return (
        <s-stack direction="inline" gap="base">
            {/* Left Sidebar Column - Default Options */}
            <s-stack direction="vertical" gap="small">
                <s-stack direction="vertical" gap="small">
                    <s-text size="small" weight="bold" tone="subdued">
                        Presets
                    </s-text>
                    <s-divider />
                    {presets.map((p) => {
                        const isActive = activePreset === p.id;
                        return (
                            <s-button
                                key={p.id}
                                onClick={() => handlePresetClick(p.id)}
                                variant={isActive ? "primary" : "tertiary"}
                                style={{ width: "100%", justifyContent: "flex-start" }}
                            >
                                {p.label}
                            </s-button>
                        );
                    })}
                    <s-divider />
                    <s-button
                        variant="critical"
                        tone="critical"
                        onClick={() => handlePresetClick("all")}
                        style={{ width: "100%" }}
                    >
                        Reset
                    </s-button>
                </s-stack>
            </s-stack>
            <s-divider direction="block" />
            {/* Right Column - Selection & Actions */}
            <s-stack direction="vertical" gap="base">
                <s-stack direction="vertical" gap="small">
                    <s-text weight="bold" tone="subdued" size="small">
                        Selected :- {formatDisplayRange(tempDateFrom, tempDateTo)}
                    </s-text>
                    <s-divider />
                    <s-stack direction="vertical" gap="small">
                        {/* <s-text size="small" tone="subdued">Select range on the calendar:</s-text> */}
                        <s-box>
                            <s-date-picker
                                ref={datePickerRef}
                                type="range"
                                multiMonth={false}
                                multi-month="false"
                            />
                        </s-box>
                    </s-stack>
                </s-stack>

                <s-stack direction="vertical" gap="small">
                    <s-divider />
                    <s-stack direction="inline" gap="small" alignment="space-between" items="center">
                        <s-stack direction="inline" gap="small">
                            <s-button variant="secondary" onClick={onClose}>
                                Cancel
                            </s-button>
                            <s-button variant="primary" onClick={handleApply}>
                                Apply
                            </s-button>
                        </s-stack>
                    </s-stack>
                </s-stack>
            </s-stack>
        </s-stack>
    );
}

DateFilter.propTypes = {
    dateFrom: PropTypes.string.isRequired,
    dateTo: PropTypes.string.isRequired,
    onDateChange: PropTypes.func.isRequired,
    onClose: PropTypes.func
};