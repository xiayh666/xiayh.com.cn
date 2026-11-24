import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, RefreshCw, Save, X } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { api, type NoteSummary } from "../api";
import { loadMarkdownEditor } from "./loadMarkdownEditor";
import styles from "./AdminPage.module.css";


const MarkdownEditor = lazy(loadMarkdownEditor);
export const preloadMarkdownEditor = () => { void loadMarkdownEditor(); };
type Draft = { path: string; content: string; visibility: NoteSummary["visibility"]; published: boolean };

export function ArticleEditor({ note, onSaved, onCancel, initialPath = "" }: { note?: NoteSummary; onSaved: (id: number) => void; onCancel?: () => void; initialPath?: string }) {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const hydratedRef = useRef(false);
  const [createdId, setCreatedId] = useState<number>();
  const source = useQuery({ queryKey: ["note-source", note?.id], queryFn: () => api.noteSource(note!.id), enabled: Boolean(note) });
  const startsCollapsed = Boolean(note) && (window.matchMedia?.("(max-width: 760px)").matches ?? false);
  const [metadataCollapsed, setMetadataCollapsed] = useState(startsCollapsed);
  const [draft, setDraft] = useState<Draft>({
    path: source.data?.path ?? note?.path ?? initialPath,
    content: source.data?.content ?? "",
    visibility: note?.visibility ?? "private",
    published: note?.published ?? false,
  });
  const [savedDraft, setSavedDraft] = useState<Draft>(draft);

  useEffect(() => {
    if (source.data && !hydratedRef.current) {
      hydratedRef.current = true;
      setDraft({ ...draft, path: source.data.path, content: source.data.content });
      setSavedDraft({ path: source.data.path, content: source.data.content, visibility: note?.visibility ?? "private", published: note?.published ?? false });
    }
  }, [source.data, note, draft]);

  const save = useMutation({
    mutationFn: async (snapshot: Draft) => {
      const id = note?.id ?? createdId;
      if (id) {
        await api.updateNoteContent(id, snapshot.content);
        await api.updateVisibility(id, snapshot.visibility, snapshot.published);
        return { id };
      }
      return api.createNote({ ...snapshot, path: snapshot.path.trim() });
    },
    onSuccess: async ({ id }, snapshot) => {
      setSavedDraft(snapshot);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["notes"] }), queryClient.invalidateQueries({ queryKey: ["note"] })]);
      if (!note) setCreatedId(id);
      else onSaved(id);
    },
  });

  const waitingForSource = Boolean(note) && !source.data;
  const dirty = draft.path !== savedDraft.path || draft.content !== savedDraft.content || draft.visibility !== savedDraft.visibility || draft.published !== savedDraft.published;
  const canSave = !save.isPending && draft.path.trim().length > 0 && !waitingForSource;
  const submitSave = useCallback(() => {
    if (canSave) save.mutate(draft);
  }, [canSave, save, draft]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      if (!formRef.current?.contains(document.activeElement)) return;
      event.preventDefault();
      submitSave();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [submitSave]);

  return <form ref={formRef} className={styles.editorView} onSubmit={(event: FormEvent) => { event.preventDefault(); submitSave(); }}>
    <header><span>{note || createdId ? "EDIT ARTICLE" : "NEW ARTICLE"}{dirty ? " · UNSAVED" : ""}</span><small>{note ? note.path : draft.path || "EXPLORER / NEW FILE"}</small></header>
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
      <label><span>PATH</span><input value={draft.path} disabled={Boolean(note || createdId)} placeholder="section/article-name.md" onChange={(event) => setDraft((value) => ({ ...value, path: event.target.value }))} /></label>
      <label><span>VISIBILITY</span><select value={draft.visibility} onChange={(event) => setDraft((value) => ({ ...value, visibility: event.target.value as Draft["visibility"] }))}><option value="private">private</option><option value="unlisted">unlisted</option><option value="public">public</option></select></label>
      <label className={styles.publishToggle}><input type="checkbox" checked={draft.published} onChange={(event) => setDraft((value) => ({ ...value, published: event.target.checked }))} /><span>PUBLISHED</span></label>
      <span className={styles.editorActions}>{onCancel ? <button type="button" onClick={() => { if (!dirty || window.confirm("Discard unsaved changes?")) onCancel(); }}><X /> Cancel</button> : null}<button className={styles.primaryButton} disabled={!canSave} title="Ctrl+S / Cmd+S">{save.isPending ? <RefreshCw className={styles.spinning} /> : <Save />} Save</button></span>
    </div>
    {source.isError ? <div className={styles.editorLoading} role="alert">Could not load article source. <button type="button" onClick={() => void source.refetch()}>Retry</button></div> : waitingForSource ? <div className={styles.editorLoading}>Loading article source…</div> : <Suspense fallback={<div className={styles.editorLoading}>Loading Markdown editor…</div>}><MarkdownEditor value={draft.content} onChange={(content) => setDraft((value) => ({ ...value, content }))} onUploadImage={async (file) => (await api.uploadImage(file)).url} /></Suspense>}
    {save.error ? <p className={styles.errorMessage} role="alert">{save.error.message}</p> : null}
  </form>;
}

export function NewArticlePage() {
  const location = useLocation();
  return <ArticleEditor onSaved={() => undefined} initialPath={new URLSearchParams(location.search).get("path") ?? ""} />;
}
