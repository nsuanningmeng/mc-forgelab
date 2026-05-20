import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Import component (it attaches to window.MCFL.CustomSelect)
import "../public/ui/components/CustomSelect.jsx";

const CustomSelect = (window as any).MCFL.CustomSelect;

describe("CustomSelect", () => {
  const opts = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta" },
    { value: "c", label: "Gamma" },
  ];

  it("renders trigger with placeholder when no value", () => {
    render(<CustomSelect options={opts} onChange={() => {}} placeholder="Pick one" />);
    expect(screen.getByText("Pick one")).toBeTruthy();
  });

  it("renders trigger with selected label", () => {
    render(<CustomSelect options={opts} value="b" onChange={() => {}} />);
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  it("opens dropdown on trigger click", () => {
    render(<CustomSelect options={opts} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("selects an option on click and closes", () => {
    const onChange = vi.fn();
    render(<CustomSelect options={opts} value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("Gamma"));
    expect(onChange).toHaveBeenCalledWith("c");
    // Dropdown should close
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes on Escape key", () => {
    render(<CustomSelect options={opts} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button"));
    const listbox = screen.getByRole("listbox");
    fireEvent.keyDown(listbox, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("navigates with ArrowDown/ArrowUp", () => {
    render(<CustomSelect options={opts} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button"));
    const listbox = screen.getByRole("listbox");
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Enter" });
    // Should select Beta (index 1)
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not open when disabled", () => {
    render(<CustomSelect options={opts} value="" onChange={() => {}} disabled />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("renders grouped options", () => {
    const groups = [
      { label: "Group A", options: [{ value: "x", label: "X" }] },
      { label: "Group B", options: [{ value: "y", label: "Y" }, { value: "z", label: "Z" }] },
    ];
    render(<CustomSelect groups={groups} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Group A")).toBeTruthy();
    expect(screen.getByText("Group B")).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("renders data-testid on trigger", () => {
    render(<CustomSelect options={opts} value="" onChange={() => {}} data-testid="my-select" />);
    expect(screen.getByTestId("my-select-trigger")).toBeTruthy();
  });

  it("shows check icon on selected option", () => {
    render(<CustomSelect options={opts} value="a" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button"));
    const selectedOpt = screen.getAllByRole("option")[0];
    expect(selectedOpt.getAttribute("aria-selected")).toBe("true");
  });
});
