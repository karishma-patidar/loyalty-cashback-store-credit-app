/* eslint-disable react/prop-types */
export function ChannelEligibilitySettings({
  channels,
  setChannels,
  eligibility,
  setEligibility,
}) {
  return (
    <>
      {/* Sales Channels */}
      <s-section>
        <s-box>
          <s-box padding="4">
            <s-heading variant="headingSm">Applying to sales channel</s-heading>
          </s-box>
          <s-box padding="5">
            <s-stack direction="block">
              <s-checkbox
                label="Online Store"
                checked={channels.online}
                onInput={(e) =>
                  setChannels({ ...channels, online: e.target.checked })
                }
              />
              <s-checkbox
                label="Draft Order"
                checked={channels.draft}
                onInput={(e) =>
                  setChannels({ ...channels, draft: e.target.checked })
                }
              />
            </s-stack>
          </s-box>
        </s-box>
      </s-section>

      {/* Eligibility */}
      <s-section>
        <s-box>
          <s-box padding="4">
            <s-heading variant="headingSm">Eligibility</s-heading>
          </s-box>
          <s-box padding="5">
            <s-stack direction="block" gap="loose">
              <s-checkbox
                label="D2C (Direct to Consumer)"
                checked={eligibility.d2c}
                onInput={(e) =>
                  setEligibility({
                    ...eligibility,
                    d2c: e.target.checked,
                  })
                }
              />
            </s-stack>
          </s-box>
        </s-box>
      </s-section>
    </>
  );
}
