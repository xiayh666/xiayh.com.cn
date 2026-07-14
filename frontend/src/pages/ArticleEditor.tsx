import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, RefreshCw, Save, X } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, type NoteSummary } from "../api";
import styles from "./AdminPage.module.css";

const loadMarkdownEditor = () => import("./MarkdownEditor").then((module) => ({ default: module.MarkdownEditor }));
const MarkdownEditor = lazy(loadMarkdownEditor);
export const preloadMarkdownEditor = () => { void loadMarkdownEditor(); };
type Draft = { path: string; content: string; visibility: NoteSummary["visibility"]; published: boolean };

export function ArticleEditor({ note, onSaved, onCancel }: { note?: NoteSummary; onSaved: (id: number) => void; onCancel?: () => void }) {
  const queryClient = useQueryClient();
  const source = useQuery({ queryKey: ["note-source", note?.id], queryFn: () => api.noteSource(note!.id), enabled: Boolean(note) });
  const startsCollapsed = Boolean(note) && (window.matchMedia?.("(max-width: 760px)").matches ?? false);
  const [metadataCollapsed, setMetadataCollapsed] = useState(startsCollapsed);
  const [draft, setDraft] = useState<Draft>({
    path: source.data?.path ?? note?.path ?? "",
    content: source.data?.content ?? "",
    visibility: note?.visibility ?? "private",
    published: note?.published ?? false,
  });

  useEffect(() => {
    if (source.data) setDraft((value) => ({ ...value, path: source.data.path, content: source.data.content }));
  }, [source.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (note) {
        await api.updateNoteContent(note.id, draft.content);
        await api.updateVisibility(note.id, draft.visibility, draft.published);
        return { id: note.id };
      }
      return api.createNote({ ...draft, path: draft.path.trim() });
    },
    onSuccess: async ({ id }) => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["notes"] }), queryClient.invalidateQueries({ queryKey: ["note"] })]);
      onSaved(id);
    },
  });

  const waitingForSource = Boolean(note) && !source.data;
  const canSave = !save.isPending && draft.path.trim().length > 0 && !waitingForSource;
  const submitSave = useCallback(() => {
    if (canSave) save.mutate();
  }, [canSave, save]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      submitSave();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [submitSave]);

  return <form className={styles.editorView} onSubmit={(event: FormEvent) => { event.preventDefault(); submitSave(); }}>
    <header><span>{note ? "EDIT ARTICLE" : "NEW ARTICLE"}</span><small>{note ? note.path : "EXPLORER / NEW FILE"}</small></header>
    <div className={`${styles.editorToolbar}${metadataCollapsed ? ` ${styles.editorToolbarCollapsed}` : ""}`}>
      <button
        type="button"
        className={styles.editorMetaToggle}
        aria-expanded={!metadataCollapsed}
        onClick={() => setMetadataCollapsed((value) => !value)}
      >
        <span>META</span>
        <small>{draft.path || "untitled"} · {draft.visibility}{draft.published ? " · published" : " · draft"}</small>
        <ChevronDown />
      </button>
      <label><span>PATH</span><input value={draft.path} disabled={Boolean(note)} placeholder="section/article-name.md" onChange={(event) => setDraft((value) => ({ ...value, path: event.target.value }))} /></label>
      <label><span>VISIBILITY</span><select value={draft.visibility} onChange={(event) => setDraft((value) => ({ ...value, visibility: event.target.value as Draft["visibility"] }))}><option value="private">private</option><option value="unlisted">unlisted</option><option value="public">public</option></select></label>
      <label className={styles.publishToggle}><input type="checkbox" checked={draft.published} onChange={(event) => setDraft((value) => ({ ...value, published: event.target.checked }))} /><span>PUBLISHED</span></label>
      <span className={styles.editorActions}>{onCancel ? <button type="button" onClick={onCancel}><X /> Cancel</button> : null}<button className={styles.primaryButton} disabled={!canSave} title="Ctrl+S / Cmd+S">{save.isPending ? <RefreshCw className={styles.spinning} /> : <Save />} Save</button></span>
    </div>
    {waitingForSource ? <div className={styles.editorLoading}>Loading article source…</div> : <Suspense fallback={<div className={styles.editorLoading}>Loading Markdown editor…</div>}><MarkdownEditor value={draft.content} onChange={(content) => setDraft((value) => ({ ...value, content }))} onUploadImage={async (file) => (await api.uploadImage(file)).url} /></Suspense>}
    {save.error ? <p className={styles.errorMessage} role="alert">{save.error.message}</p> : null}
  </form>;
}

export function NewArticlePage() {
  const navigate = useNavigate();
  return <ArticleEditor onSaved={() => navigate("/login")} />;
}
