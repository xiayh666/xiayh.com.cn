import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WelcomePage } from "./WelcomePage";

describe("WelcomePage", () => {
  it("shows the initial explorer and search guidance", () => {
    render(<WelcomePage />);
    expect(screen.getByRole("heading", { name: "xiayh.com.cn" })).toBeInTheDocument();
    expect(screen.getByText("Browse articles")).toBeInTheDocument();
    expect(screen.getByText("Press Ctrl+K to search the knowledge base.")).toBeInTheDocument();
  });
});
