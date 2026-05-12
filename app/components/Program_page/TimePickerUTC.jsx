/* eslint-disable react/prop-types */
import { useState } from "react";
import { Popover, TextField, Listbox, Icon } from "./PolarisMock.jsx";
import { ClockIcon } from "./ClockIcon.jsx";

function generateUTCTimeOptions(interval = 30) {
  const times = [];

  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += interval) {
      const date = new Date(Date.UTC(2000, 0, 1, h, m));

      const hours = date.getUTCHours();
      const minutes = date.getUTCMinutes();

      const hour12 = hours % 12 === 0 ? 12 : hours % 12;
      const ampm = hours < 12 ? "AM" : "PM";

      const minuteStr = minutes.toString().padStart(2, "0");

      times.push(`${hour12}:${minuteStr} ${ampm}`);
    }
  }

  return times;
}

export function TimePickerUTC({ value, onChange, label }) {
  const [active, setActive] = useState(false);
  const toggleActive = () => setActive(!active);

  const times = generateUTCTimeOptions(30);

  return (
    <Popover
      active={active}
      activator={
        <TextField
          label={label || "Start time (UTC-04:00)"}
          value={value}
          onFocus={toggleActive}
          prefix={<Icon source={ClockIcon} />}
          autoComplete="off"
        />
      }
      onClose={toggleActive}
    >
      <Popover.Pane fixed>
        <div style={{ maxHeight: "220px", overflowY: "auto" }}>
          <Listbox
            onSelect={(val) => {
              onChange(val);
              setActive(false);
            }}
          >
            {times.map((time) => (
              <Listbox.Option key={time} value={time}>
                {time}
              </Listbox.Option>
            ))}
          </Listbox>
        </div>
      </Popover.Pane>
    </Popover>
  );
}
