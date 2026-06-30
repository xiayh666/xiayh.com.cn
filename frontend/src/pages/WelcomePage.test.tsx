import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { WelcomePage } from "./WelcomePage";

describe("WelcomePage", () => {
  it("shows the blog archive in the workspace welcome page", () => {
    const { container } = render(<MemoryRouter><WelcomePage /></MemoryRouter>);
    expect(screen.getByRole("region", { name: "博客概览" })).toBeInTheDocument();
    expect(screen.getByText("HOME / BLOG")).toBeInTheDocument();
    expect(screen.getByText("MODULE INDEX.")).toBeInTheDocument();
    expect(container.querySelector('[data-welcome-mode="workspace"]')).toBeInTheDocument();
    expect(container.querySelector("[data-welcome-environment]")).not.toBeInTheDocument();
  });

  it("keeps the dashboard entry in fullscreen intro mode", () => {
    const { container } = render(<MemoryRouter><WelcomePage intro /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "进入工作区" })).toBeInTheDocument();
    expect(screen.getByText("HOME / INDEX")).toBeInTheDocument();
    expect(screen.getByText("MODULE INDEX.")).toBeInTheDocument();
    expect(container.querySelector('[data-welcome-mode="homepage"]')).toBeInTheDocument();
    expect(container.querySelector("[data-welcome-environment]")).toBeInTheDocument();
  });
});
