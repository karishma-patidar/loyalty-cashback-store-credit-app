/* eslint-disable react/prop-types */

export function AdvancedSettings({
  enableExpiration,
  setEnableExpiration,
  expirationType,
  setExpirationType,
  expirationDate,
  setExpirationDate,
  expirationDays,
  setExpirationDays,
  enableDelay,
  setEnableDelay,
  delayDays,
  setDelayDays,
}) {
  return (
    <s-section>
      <s-box>
        <s-box padding="4">
          <s-heading variant="headingSm">Advanced settings</s-heading>
        </s-box>
        <s-box padding="5">
          <s-stack direction="block" gap="tight">
            <s-checkbox
              label="Enable expiration date"
              checked={enableExpiration}
              onInput={(e) => setEnableExpiration(e.target.checked)}
            />
            {enableExpiration && (
              <s-box paddingInlineStart="6">
                <s-stack direction="block" gap="tight">
                  <s-text color="subdued" variant="bold">
                    Expiration type
                  </s-text>
                  <s-radio-button
                    label="In a duration after the issue date"
                    checked={expirationType === "duration"}
                    onInput={() => setExpirationType("duration")}
                  />
                  <s-radio-button
                    label="On a fixed expiration date"
                    checked={expirationType === "fixed"}
                    onInput={() => setExpirationType("fixed")}
                  />
                  <s-box paddingBlockStart="2">
                    {expirationType === "fixed" ? (
                      <s-date-field
                        value={expirationDate}
                        onInput={(e) => setExpirationDate(e.target.value)}
                        onChange={(e) => setExpirationDate(e.target.value)}
                      />
                    ) : (
                      <s-text-field
                        type="number"
                        value={expirationDays}
                        onInput={(e) => setExpirationDays(e.target.value)}
                        suffix="days"
                      />
                    )}
                  </s-box>
                </s-stack>
              </s-box>
            )}

            <s-checkbox
              label="Enable delay issue credit"
              checked={enableDelay}
              onInput={(e) => setEnableDelay(e.target.checked)}
            />
            {enableDelay && (
              <s-box paddingInlineStart="6">
                <s-stack direction="block" gap="tight">
                  <s-text-field
                    type="number"
                    value={delayDays}
                    onInput={(e) => setDelayDays(e.target.value)}
                    suffix="days"
                  />
                  <s-text color="subdued" variant="small">
                    Set a delay time before rewarding store credit to the
                    customers.
                  </s-text>
                </s-stack>
              </s-box>
            )}
          </s-stack>
        </s-box>
      </s-box>
    </s-section>
  );
}
