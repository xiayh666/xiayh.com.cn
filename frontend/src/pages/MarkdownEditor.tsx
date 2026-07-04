import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/classic.css";
import { Code2, Eye, ImageUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./AdminPage.module.css";
import { useCodeCopyFeedback } from "./CodeCopyFeedback";
import { vscodeCodeTheme } from "./markdownCodeTheme";

type MarkdownEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
  onUploadImage: (file: File) => Promise<string>;
};

export function MarkdownEditor({ value, onChange, onUploadImage }: MarkdownEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const changeRef = useRef(onChange);
  const uploadRef = useRef(onUploadImage);
  const [mode, setMode] = useState<"visual" | "source">("visual");
  const [editorValue, setEditorValue] = useState(value);
  const [error, setError] = useState("");
  const { handleCopy } = useCodeCopyFeedback(rootRef);

  changeRef.current = onChange;
  uploadRef.current = onUploadImage;

  const updateValue = (markdown: string) => {
    setEditorValue(markdown);
    changeRef.current(markdown);
  };

  useEffect(() => {
    if (mode !== "visual" || !rootRef.current) return;
    setError("");
    const crepe = new Crepe({
      root: rootRef.current,
      defaultValue: editorValue,
      features: {
        [Crepe.Feature.TopBar]: true,
        [Crepe.Feature.AI]: false,
      },
      featureConfigs: {
        [Crepe.Feature.CodeMirror]: { theme: vscodeCodeTheme, onCopy: handleCopy },
        [Crepe.Feature.Placeholder]: { text: "Start writing your article…", mode: "block" },
        [Crepe.Feature.ImageBlock]: {
          onUpload: (file) => uploadRef.current(file),
          inlineOnUpload: (file) => uploadRef.current(file),
          blockOnUpload: (file) => uploadRef.current(file),
        },
        [Crepe.Feature.Latex]: { katexOptions: { throwOnError: false } },
      },
    });
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => updateValue(markdown));
    });
    void crepe.create().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "The Markdown editor could not be initialized.");
    });
    return () => { void crepe.destroy(); };
  // Recreate the ProseMirror document only when switching editing modes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <section className={styles.markdownEditor} aria-label="Markdown editor">
      <header className={styles.markdownModebar}>
        <span><ImageUp /> Paste, drop, or select images</span>
        <div role="group" aria-label="Markdown editing mode">
          <button type="button" className={mode === "visual" ? styles.markdownModeActive : ""} aria-pressed={mode === "visual"} onClick={() => setMode("visual")}><Eye /> Visual</button>
          <button type="button" className={mode === "source" ? styles.markdownModeActive : ""} aria-pressed={mode === "source"} onClick={() => setMode("source")}><Code2 /> Source</button>
        </div>
      </header>
      {mode === "visual" ? <div ref={rootRef} className={styles.markdownVisual} /> : (
        <textarea aria-label="Markdown content" className={styles.markdownSource} value={editorValue} onChange={(event) => updateValue(event.target.value)} spellCheck={false} />
      )}
      {error ? <p className={styles.editorError} role="alert">{error}</p> : null}
    </section>
  );
}
