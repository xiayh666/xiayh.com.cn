import { Crepe } from "@milkdown/crepe";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import { Code2, Eye, ImagePlus, ImageUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from "react";
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
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const changeRef = useRef(onChange);
  const uploadRef = useRef(onUploadImage);
  const startsInSourceMode = useMemo(() => window.matchMedia?.("(max-width: 760px)").matches ?? false, []);
  const [mode, setMode] = useState<"visual" | "source">(startsInSourceMode ? "source" : "visual");
  const [editorValue, setEditorValue] = useState(value);
  const [error, setError] = useState("");
  const [uploadingImages, setUploadingImages] = useState(0);
  const { handleCopy } = useCodeCopyFeedback(rootRef);

  changeRef.current = onChange;
  uploadRef.current = onUploadImage;

  useEffect(() => {
    setEditorValue((current) => current === value ? current : value);
  }, [value]);

  const updateValue = (markdown: string) => {
    setEditorValue(markdown);
    changeRef.current(markdown);
  };

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith("image/")) throw new Error("Only image files can be uploaded.");
    setError("");
    setUploadingImages((value) => value + 1);
    try {
      return await uploadRef.current(file);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Image upload failed.";
      setError(message);
      throw reason;
    } finally {
      setUploadingImages((value) => Math.max(0, value - 1));
    }
  };

  const insertAtSourceSelection = (snippet: string) => {
    const textarea = sourceRef.current;
    const start = textarea?.selectionStart ?? editorValue.length;
    const end = textarea?.selectionEnd ?? start;
    const prefix = editorValue.slice(0, start);
    const suffix = editorValue.slice(end);
    const needsLeadingBreak = prefix.length > 0 && !prefix.endsWith("\n");
    const needsTrailingBreak = suffix.length > 0 && !suffix.startsWith("\n");
    const insertion = `${needsLeadingBreak ? "\n" : ""}${snippet}${needsTrailingBreak ? "\n" : ""}`;
    const nextValue = `${prefix}${insertion}${suffix}`;
    updateValue(nextValue);
    requestAnimationFrame(() => {
      sourceRef.current?.focus();
      const cursor = start + insertion.length;
      sourceRef.current?.setSelectionRange(cursor, cursor);
    });
  };

  const uploadAndInsertImages = async (files: File[]) => {
    if (!files.length) return;
    const snippets: string[] = [];
    for (const file of files) {
      const url = await uploadImage(file);
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[[\]]/g, "").trim() || "image";
      snippets.push(`![${alt}](${url})`);
    }
    insertAtSourceSelection(snippets.join("\n\n"));
  };

  const imagesFromTransfer = (transfer: DataTransfer) => {
    const files = [...transfer.files].filter((file) => file.type.startsWith("image/"));
    if (files.length) return files;
    return [...transfer.items]
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
  };

  const handleSourcePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const images = imagesFromTransfer(event.clipboardData);
    if (!images.length) return;
    event.preventDefault();
    void uploadAndInsertImages(images);
  };

  const handleSourceDrop = (event: DragEvent<HTMLTextAreaElement>) => {
    const images = imagesFromTransfer(event.dataTransfer);
    if (!images.length) return;
    event.preventDefault();
    void uploadAndInsertImages(images);
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const images = [...(event.target.files ?? [])].filter((file) => file.type.startsWith("image/"));
    event.target.value = "";
    if (!images.length) return;
    if (mode !== "source") setMode("source");
    void uploadAndInsertImages(images);
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
          onUpload: (file) => uploadImage(file),
          inlineOnUpload: (file) => uploadImage(file),
          blockOnUpload: (file) => uploadImage(file),
        },
        [Crepe.Feature.Latex]: { katexOptions: { throwOnError: false } },
      },
    });
    crepe.editor.use(listener)
    crepe.editor.config((ctx) => {
      ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, previousMarkdown) => {
      if (markdown !== previousMarkdown) {
        updateValue(markdown);
      }
    });
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
        <span><ImageUp /> {uploadingImages ? `Uploading ${uploadingImages} image${uploadingImages > 1 ? "s" : ""}…` : "Paste, drop, or select images"}</span>
        <input
          ref={fileInputRef}
          className={styles.markdownImageInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          onChange={handleFileSelect}
        />
        <div role="group" aria-label="Markdown editing mode">
          <button type="button" onClick={() => fileInputRef.current?.click()}><ImagePlus /> Image</button>
          <button type="button" className={mode === "visual" ? styles.markdownModeActive : ""} aria-pressed={mode === "visual"} onClick={() => setMode("visual")}><Eye /> Visual</button>
          <button type="button" className={mode === "source" ? styles.markdownModeActive : ""} aria-pressed={mode === "source"} onClick={() => setMode("source")}><Code2 /> Source</button>
        </div>
      </header>
      {mode === "visual" ? <div ref={rootRef} className={styles.markdownVisual} /> : (
        <textarea
          ref={sourceRef}
          aria-label="Markdown content"
          className={styles.markdownSource}
          value={editorValue}
          onChange={(event) => updateValue(event.target.value)}
          onDragOver={(event) => {
            if (imagesFromTransfer(event.dataTransfer).length) event.preventDefault();
          }}
          onDrop={handleSourceDrop}
          onPaste={handleSourcePaste}
          spellCheck={false}
        />
      )}
      {error ? <p className={styles.editorError} role="alert">{error}</p> : null}
    </section>
  );
}
