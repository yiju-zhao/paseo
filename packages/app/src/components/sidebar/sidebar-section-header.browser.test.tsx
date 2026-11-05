import { useCallback, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SidebarSectionHeader } from "./sidebar-section-header";

afterEach(cleanup);

function CollapsibleSection() {
  const [collapsed, setCollapsed] = useState(false);
  const toggleCollapsed = useCallback(() => setCollapsed((value) => !value), []);
  return <SidebarSectionHeader title="Host" collapsed={collapsed} onToggle={toggleCollapsed} />;
}

it("exposes the current expanded state of a collapsible section to assistive technology", () => {
  render(<CollapsibleSection />);

  const button = screen.getByRole("button", { name: "Host" });
  expect(button.getAttribute("aria-expanded")).toBe("true");

  fireEvent.click(button);
  expect(button.getAttribute("aria-expanded")).toBe("false");

  fireEvent.click(button);
  expect(button.getAttribute("aria-expanded")).toBe("true");
});
