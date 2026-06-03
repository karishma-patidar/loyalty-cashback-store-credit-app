/* eslint-disable react/prop-types */
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function Icon({ source: SvgIcon }) {
  return (
    <div style={{ width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <SvgIcon />
    </div>
  );
}

export function TextField({ label, value, onFocus, prefix }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
      <span style={{ fontSize: "13px", color: "#303030" }}>{label}</span>
      <div 
        style={{ 
          display: "flex", 
          alignItems: "center", 
          border: "1px solid #8C9196", 
          borderRadius: "8px", 
          padding: "6px 12px",
          backgroundColor: "#fff",
          cursor: "pointer",
          width: "100%",
          boxSizing: "border-box",
          height: "36px"
        }}
      >
        {prefix && <div style={{ marginRight: "8px", flexShrink: 0 }}>{prefix}</div>}
        <input 
          readOnly
          value={value}
          style={{ 
            border: "none", 
            outline: "none", 
            width: "100%", 
            fontSize: "14px",
            color: "#202223",
            background: "transparent",
            cursor: "pointer",
            fontFamily: "inherit"
          }}
          onFocus={onFocus}
        />
      </div>
    </label>
  );
}

export function Listbox({ onSelect, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {React.Children.map(children, child => 
        React.cloneElement(child, { onSelect })
      )}
    </div>
  );
}

Listbox.Option = function ListboxOption({ value, children, onSelect }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect(value);
      }}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        border: "none",
        background: "transparent",
        padding: "10px 16px",
        cursor: "pointer",
        fontSize: "14px",
        color: "#333",
        fontFamily: "inherit",
        outline: "none"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "#F1F2F4";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {children}
    </button>
  );
};

export function Popover({ active, activator, children, onClose }) {
  const wrapperRef = useRef(null);
  const dropdownRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        wrapperRef.current && !wrapperRef.current.contains(event.target) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    if (active && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [active]);

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: "100%" }}>
      <div>{activator}</div>
      {active && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "absolute",
            top: coords.top,
            left: coords.left,
            width: coords.width,
            zIndex: 99999,
            background: "white",
            border: "1px solid #E3E3E3",
            borderRadius: "8px",
            maxHeight: "220px",
            overflowY: "auto",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {children}
        </div>,
        document.body
      )}
    </div>
  );
}

Popover.Pane = function PopoverPane({ children }) {
  return <>{children}</>;
};
