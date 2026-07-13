import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Save, X } from "lucide-react";
import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, type NoteSummary } from "../api";
import styles from "./AdminPage.module.css";

const MarkdownEditor = lazy(() => import("./MarkdownEditor").then((module) => ({ default: module.MarkdownEditor })));
type Draft = { path: string; content: string; visibility: NoteSummary["visibility"]; published: boolean };

export function ArticleEditor({ note, onSaved, onCancel }: { note?: NoteSummary; onSaved: (id: number) => void; onCancel?: () => void }) {
  const queryClient = useQueryClient();
  const source = useQuery({ queryKey: ["note-source", note?.id], queryFn: () => api.noteSource(note!.id), enabled: Boolean(note) });
  const [draft, setDraft] = useState<Draft>({ path: note?.path ?? "", content: "", visibility: note?.visibility ?? "private", published: note?.published ?? false });

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

  return <form className={styles.editorView} onSubmit={(event: FormEvent) => { event.preventDefault(); save.mutate(); }}>
    <header><span>{note ? "EDIT ARTICLE" : "NEW ARTICLE"}</span><small>{note ? note.path : "EXPLORER / NEW FILE"}</small></header>
    <div className={styles.editorToolbar}>
      <label><span>PATH</span><input value={draft.path} disabled={Boolean(note)} placeholder="section/article-name.md" onChange={(event) => setDraft((value) => ({ ...value, path: event.target.value }))} /></label>
      <label><span>VISIBILITY</span><select value={draft.visibility} onChange={(event) => setDraft((value) => ({ ...value, visibility: event.target.value as Draft["visibility"] }))}><option value="private">private</option><option value="unlisted">unlisted</option><option value="public">public</option></select></label>
      <label className={styles.publishToggle}><input type="checkbox" checked={draft.published} onChange={(event) => setDraft((value) => ({ ...value, published: event.target.checked }))} /><span>PUBLISHED</span></label>
      <span className={styles.editorActions}>{onCancel ? <button type="button" onClick={onCancel}><X /> Cancel</button> : null}<button className={styles.primaryButton} disabled={save.isPending || !draft.path.trim()}>{save.isPending ? <RefreshCw className={styles.spinning} /> : <Save />} Save</button></span>
    </div>
    {note && source.isLoading ? <div className={styles.editorLoading}>Loading article source…</div> : <Suspense fallback={<div className={styles.editorLoading}>Loading Markdown editor…</div>}><MarkdownEditor value={draft.content} onChange={(content) => setDraft((value) => ({ ...value, content }))} onUploadImage={async (file) => (await api.uploadImage(file)).url} /></Suspense>}
    {save.error ? <p className={styles.errorMessage} role="alert">{save.error.message}</p> : null}
  </form>;
}

export function NewArticlePage() {
  const navigate = useNavigate();
  return <ArticleEditor onSaved={() => navigate("/login")} />;
}
