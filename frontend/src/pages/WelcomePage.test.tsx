import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { WelcomePage } from "./WelcomePage";

describe("WelcomePage", () => {
  it("shows the dashboard entry", () => {
    render(<MemoryRouter><WelcomePage /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "进入工作区" })).toBeInTheDocument();
  });

  it("keeps the dashboard entry in fullscreen intro mode", () => {
    render(<MemoryRouter><WelcomePage intro /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "进入工作区" })).toBeInTheDocument();
  });
});
