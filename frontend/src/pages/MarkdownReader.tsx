import { useEffect, useRef, type MouseEvent } from "react";
import "katex/dist/katex.min.css";
import styles from "./MarkdownReader.module.css";

type MarkdownReaderProps = {
  html: string;
  onReady?: () => void;
};

export function MarkdownReader({ html, onReady }: MarkdownReaderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("pre").forEach((block) => {
      if (block.querySelector("[data-code-copy]")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.codeCopy = "true";
      button.setAttribute("aria-label", "Copy code");
      button.textContent = "Copy";
      block.append(button);
    });
    const frame = requestAnimationFrame(() => readyRef.current?.());
    return () => cancelAnimationFrame(frame);
  }, [html]);

  const copyCode = (event: MouseEvent<HTMLDivElement>) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-code-copy]");
    if (!button) return;
    const code = button.parentElement?.querySelector("code")?.textContent ?? "";
    if (!code) return;
    void navigator.clipboard?.writeText(code).then(() => {
      button.textContent = "Copied";
      window.setTimeout(() => { button.textContent = "Copy"; }, 1_800);
    }).catch(() => undefined);
  };

  return <div
    ref={rootRef}
    className={styles.reader}
    aria-label="Article content"
    onClick={copyCode}
    dangerouslySetInnerHTML={{ __html: html }}
  />;
}
