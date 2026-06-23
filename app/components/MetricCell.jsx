import PropTypes from "prop-types";

export function SkeletonLine({ width = "100%", height = 14, style = {} }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 6,
        background: "linear-gradient(90deg, #f1f2f4 25%, #e8e9eb 50%, #f1f2f4 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
        ...style,
      }}
    />
  );
}

SkeletonLine.propTypes = {
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  style: PropTypes.object,
};

export function MetricCell({ label, tooltip, value, loading, id }) {
  const tooltipId = `tooltip-${id}`;
  return (
    <s-stack direction="block" gap="base">
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      {tooltip && <s-tooltip id={tooltipId}>{tooltip}</s-tooltip>}
      <s-text interestFor={tooltip ? tooltipId : undefined}>
        <span style={{ borderBottom: tooltip ? "1px dashed #919eab" : "none", cursor: tooltip ? "pointer" : "default", fontWeight: "bold" }}>
          {label}
        </span>
      </s-text>
      {loading ? (
        <SkeletonLine width="80%" height={28} />
      ) : (
        <s-text style={{ fontSize: 20, fontWeight: 700, color: "#202223" }}>
          {value}
        </s-text>
      )}
    </s-stack>
  );
}

MetricCell.propTypes = {
  label: PropTypes.node.isRequired,
  tooltip: PropTypes.node,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  loading: PropTypes.bool,
  id: PropTypes.string,
};
