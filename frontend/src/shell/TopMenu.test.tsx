import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TopMenu, type TopMenuDefinition } from "./TopMenu";

describe("TopMenu", () => {
  it("opens actions, runs commands, and supports keyboard menu switching", async () => {
    const run = vi.fn();
    const menus: TopMenuDefinition[] = [
      { label: "File", items: [{ label: "Open Home", action: run }] },
      { label: "View", items: [{ label: "Explorer", checked: true, action: run }] },
    ];
    render(<TopMenu menus={menus} />);

    fireEvent.click(screen.getByRole("button", { name: "File" }));
    expect(screen.getByRole("menu", { name: "File menu" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Open Home" }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu", { name: "File menu" })).not.toBeInTheDocument();

    const file = screen.getByRole("button", { name: "File" });
    file.focus();
    fireEvent.keyDown(file, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Open Home" })).toHaveFocus());
    fireEvent.keyDown(screen.getByRole("menu", { name: "File menu" }), { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("menu", { name: "View menu" })).toBeInTheDocument());
  });
});
