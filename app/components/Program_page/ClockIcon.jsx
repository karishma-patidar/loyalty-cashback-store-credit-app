/* eslint-disable react/prop-types */

export function ClockIcon({ fill = "#5C5F62", width = "20", height = "20" }) {
  return (
    <svg viewBox="0 0 20 20" width={width} height={height} fill={fill}>
      <path d="M10 0C4.486 0 0 4.486 0 10s4.486 10 10 10 10-4.486 10-10S15.514 0 10 0zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm1-8.414V5a1 1 0 1 0-2 0v5a1 1 0 0 0 .293.707l3 3a1 1 0 0 0 1.414-1.414l-2.707-2.707z" />
    </svg>
  );
}
