/* eslint-disable react/prop-types */
import { TimePickerUTC } from "./TimePickerUTC.jsx";

export function ProgramScheduling({
  startDate,
  setStartDate,
  startTime,
  setStartTime,
  enableEndDate,
  setEnableEndDate,
  endDate,
  setEndDate,
  endTime,
  setEndTime,
}) {
  return (
    <s-section>
      <s-box>
        <s-box padding="4">
          <s-heading variant="headingSm">Program scheduling</s-heading>
        </s-box>
        <s-box padding="5">
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base">
              <s-box>
                <s-date-field
                  label="Start date"
                  value={startDate}
                  onInput={(e) => setStartDate(e.target.value)}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </s-box>
              <s-box inlineSize="48%">
                <TimePickerUTC
                  label="Start time (UTC-04:00)"
                  value={startTime}
                  onChange={setStartTime}
                />
              </s-box>
            </s-stack>
            <s-checkbox
              label="Enable end date"
              checked={enableEndDate}
              onInput={(e) => setEnableEndDate(e.target.checked)}
            />
            {enableEndDate && (
              <s-box paddingInlineStart="6">
                <s-stack direction="inline" gap="base">
                  <s-date-field
                    label="End date"
                    value={endDate}
                    onInput={(e) => setEndDate(e.target.value)}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                  <s-box inlineSize="48%">
                    <TimePickerUTC
                      label="End time (UTC-04:00)"
                      value={endTime}
                      onChange={setEndTime}
                    />
                  </s-box>
                </s-stack>
              </s-box>
            )}
          </s-stack>
        </s-box>
      </s-box>
    </s-section>
  );
}
