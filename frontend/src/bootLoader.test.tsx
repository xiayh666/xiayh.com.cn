import { StrictMode, Suspense, lazy } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BootReady } from "./bootLoader";

function installLoader(visible: boolean) {
  document.documentElement.className = visible ? "boot-loader-visible" : "";
  const loader = document.createElement("div");
  loader.id = "boot-loader";
  document.body.append(loader);
  window.__bootLoader = {
    fadeMs: 180, minVisibleMs: 180, readyClass: "app-ready", showDelayMs: 120,
    shownAt: performance.now(), visibleClass: "boot-loader-visible",
    showTimer: window.setTimeout(() => document.documentElement.classList.add("boot-loader-visible"), 120),
  };
  return loader;
}

afterEach(() => {
  document.getElementById("boot-loader")?.remove();
  document.documentElement.className = "";
  delete window.__bootLoader;
  vi.useRealTimers();
});

describe("boot loader", () => {
  // Slow route downloads must remain behind the startup animation until the page commits.
  it("waits for the actual lazy page and survives StrictMode effect replay", async () => {
    vi.useFakeTimers();
    const loader = installLoader(true);
    let resolvePage!: (value: { default: () => JSX.Element }) => void;
    const Page = lazy(() => new Promise<{ default: () => JSX.Element }>((resolve) => { resolvePage = resolve; }));
    render(<StrictMode><Suspense fallback={null}><Page /><BootReady /></Suspense></StrictMode>);
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(loader).toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass("app-ready");
    await act(async () => { resolvePage({ default: () => <div>Homepage</div> }); });
    await act(async () => { vi.advanceTimersByTime(50); });
    expect(document.documentElement).toHaveClass("app-ready");
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(loader).not.toBeInTheDocument();
  });

  // A cached startup should not force a half-second animation or show a delayed loader.
  it("cancels the delayed animation for a fast startup", async () => {
    vi.useFakeTimers();
    const loader = installLoader(false);
    render(<BootReady />);
    await act(async () => { vi.advanceTimersByTime(50); });
    expect(loader).not.toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(document.documentElement).not.toHaveClass("boot-loader-visible");
  });
});
