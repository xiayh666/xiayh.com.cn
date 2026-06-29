import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { EditorTabs, type EditorTabModel } from "./EditorTabs";

const tabs: EditorTabModel[] = [
  { id: "welcome", kind: "welcome", label: "Welcome", href: "/" },
  { id: "article:one", kind: "article", label: "one.md", href: "/notes/one", detail: "one.md", kept: false },
  { id: "article:two", kind: "article", label: "two.md", href: "/notes/two", detail: "two.md" },
];

describe("EditorTabs context menu", () => {
  it("opens on right click and dispatches VS Code-style close actions", () => {
    const closeRight = vi.fn();
    const togglePin = vi.fn();
    const keepOpen = vi.fn();
    const split = vi.fn();
    const move = vi.fn();
    render(
      <MemoryRouter>
        <EditorTabs
          tabs={tabs}
          activeId="article:one"
          onActivate={vi.fn()}
          onClose={vi.fn()}
          onCloseOthers={vi.fn()}
          onCloseRight={closeRight}
          onCloseAll={vi.fn()}
          onKeepOpen={keepOpen}
          onTogglePin={togglePin}
          onSplit={split}
          onMove={move}
        />
      </MemoryRouter>,
    );

    fireEvent.contextMenu(screen.getByTitle("one.md"), { clientX: 300, clientY: 200 });
    expect(screen.getByRole("menu", { name: "Tab actions" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Keep Open" }));
    expect(keepOpen).toHaveBeenCalledWith("article:one");

    fireEvent.contextMenu(screen.getByTitle("one.md"), { clientX: 300, clientY: 200 });
    fireEvent.click(screen.getByRole("menuitem", { name: "Pin" }));
    expect(togglePin).toHaveBeenCalledWith("article:one");

    fireEvent.contextMenu(screen.getByTitle("one.md"), { clientX: 300, clientY: 200 });
    fireEvent.click(screen.getByRole("menuitem", { name: "Split Right" }));
    expect(split).toHaveBeenCalledWith("article:one", "right");

    fireEvent.contextMenu(screen.getByTitle("one.md"), { clientX: 300, clientY: 200 });
    fireEvent.pointerEnter(screen.getByRole("menuitem", { name: /Split & Move/ }).parentElement!);
    fireEvent.click(screen.getByRole("menuitem", { name: "Split Down" }));
    expect(split).toHaveBeenCalledWith("article:one", "down");

    fireEvent.contextMenu(screen.getByTitle("one.md"), { clientX: 300, clientY: 200 });
    fireEvent.pointerEnter(screen.getByRole("menuitem", { name: /Split & Move/ }).parentElement!);
    fireEvent.click(screen.getByRole("menuitem", { name: "Move Below" }));
    expect(move).toHaveBeenCalledWith("article:one", "down");

    fireEvent.contextMenu(screen.getByTitle("one.md"), { clientX: 300, clientY: 200 });
    fireEvent.click(screen.getByRole("menuitem", { name: "Close to the Right" }));
    expect(closeRight).toHaveBeenCalledWith("article:one");
    expect(screen.queryByRole("menu", { name: "Tab actions" })).not.toBeInTheDocument();
  });
});
