import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/classic.css";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef } from "react";
import editorStyles from "./AdminPage.module.css";
import { useCodeCopyFeedback } from "./CodeCopyFeedback";
import { vscodeCodeTheme } from "./markdownCodeTheme";

export function MarkdownReader({ markdown, onReady }: { markdown: string; onReady?: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(onReady);
  const { handleCopy } = useCodeCopyFeedback(rootRef);
  readyRef.current = onReady;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let disposed = false;
    const measured = new WeakSet<Element>();
    const timers = new Set<number>();
    const markReadonlyCodeMirror = (editor: HTMLElement) => {
      const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
      editor.dataset.readonlyCodeMirror = "true";
      editor.setAttribute("aria-readonly", "true");
      if (isTouchDevice) editor.tabIndex = -1;
      editor.querySelectorAll<HTMLElement>(".cm-content").forEach((content) => {
        content.inputMode = "none";
        content.setAttribute("inputmode", "none");
        content.setAttribute("aria-readonly", "true");
        content.setAttribute("autocomplete", "off");
        content.setAttribute("autocorrect", "off");
        content.setAttribute("autocapitalize", "off");
        content.spellcheck = false;
        if (isTouchDevice) {
          content.contentEditable = "false";
          content.tabIndex = -1;
        }
      });
    };
    const measureCodeMirror = (editor: HTMLElement) => {
      markReadonlyCodeMirror(editor);
      if (measured.has(editor)) return;
      const view = EditorView.findFromDOM(editor);
      if (!view) return;
      measured.add(editor);
      const block = editor.closest<HTMLElement>(".milkdown-code-block");
      void (async () => {
        await (document.fonts?.ready ?? Promise.resolve());
        if (root.closest("[data-editor-flip-face='back']")) {
          await new Promise<void>((resolve) => {
            const timer = window.setTimeout(() => { timers.delete(timer); resolve(); }, 460);
            timers.add(timer);
          });
        }
        if (disposed) return;
        view.requestMeasure({
          read: () => null,
          write: () => {
            if (!disposed && block) block.dataset.codeMeasured = "true";
          },
        });
      })();
    };
    const scanCodeMirrors = () => {
      root.querySelectorAll<HTMLElement>(".cm-editor").forEach(measureCodeMirror);
    };
    const observer = new MutationObserver(scanCodeMirrors);
    observer.observe(root, { childList: true, subtree: true });
    const crepe = new Crepe({
      root,
      defaultValue: markdown,
      features: {
        [Crepe.Feature.TopBar]: false,
        [Crepe.Feature.Toolbar]: false,
        [Crepe.Feature.BlockEdit]: false,
        [Crepe.Feature.Cursor]: false,
        [Crepe.Feature.LinkTooltip]: false,
        [Crepe.Feature.AI]: false,
      },
      featureConfigs: {
        [Crepe.Feature.CodeMirror]: { theme: vscodeCodeTheme, onCopy: handleCopy },
        [Crepe.Feature.Latex]: { katexOptions: { throwOnError: false } },
      },
    });
    crepe.setReadonly(true);
    void crepe.create().then(() => {
      if (disposed) return;
      scanCodeMirrors();
      readyRef.current?.();
    });
    return () => {
      disposed = true;
      observer.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
      void crepe.destroy();
    };
  }, [handleCopy, markdown]);

  return <div ref={rootRef} className={editorStyles.markdownVisual} data-markdown-readonly="true" aria-label="Article content" />;
}
