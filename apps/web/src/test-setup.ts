import React from "react";
import ReactDOM from "react-dom";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Make React available globally (Babel-standalone pattern)
(window as any).React = React;
(window as any).ReactDOM = ReactDOM;

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {};

// Auto-cleanup after each test
afterEach(() => {
  cleanup();
});

// Stub Icon component
function Icon({ name, className }: any) {
  return React.createElement("span", { "data-icon": name, className });
}

// Set up MCFL globals for component imports
(window as any).MCFL = {
  cx: {
    j: (...args: any[]) => args.filter(Boolean).join(" "),
    input: "input-base",
    label: "label-base",
  },
  Icon,
};
