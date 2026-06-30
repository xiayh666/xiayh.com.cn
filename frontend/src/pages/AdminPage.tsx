import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Edit3, Eye, FilePlus2, LogIn, LogOut, RefreshCw, Save, Search, Trash2, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, type NoteSummary } from "../api";
import styles from "./AdminPage.module.css";

type AdminView = "profile" | "publish" | "manage";
type Draft = { id?: number; path: string; content: string; visibility: NoteSummary["visibility"]; published: boolean };
const emptyDraft: Draft = { path: "", content: "", visibility: "private", published: false };

export function AdminPage({ view = "settings" }: { view?: "login" | "settings" }) {
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ["session"], queryFn: api.session });
  const [activeView, setActiveView] = useState<AdminView>(view === "login" ? "profile" : "manage");
  const notes = useQuery({ queryKey: ["notes"], queryFn: api.notes, enabled: session.data?.authenticated === true });
  const profile = useQuery({ queryKey: ["admin-profile"], queryFn: api.adminProfile, enabled: session.data?.authenticated === true });
  const [login, setLogin] = useState({ username: "admin", password: "" });
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [filter, setFilter] = useState("");

  const refreshAdminData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["notes"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-profile"] }),
      queryClient.invalidateQueries({ queryKey: ["stats"] }),
    ]);
  };

  const loginMutation = useMutation({
    mutationFn: () => api.login(login.username.trim(), login.password),
    onSuccess: async () => { setLogin((value) => ({ ...value, password: "" })); await queryClient.invalidateQueries({ queryKey: ["session"] }); },
  });
  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => { queryClient.removeQueries({ queryKey: ["admin-profile"] }); await queryClient.invalidateQueries({ queryKey: ["session"] }); },
  });
  const syncMutation = useMutation({ mutationFn: api.sync, onSuccess: refreshAdminData });
  const sourceMutation = useMutation({
    mutationFn: api.noteSource,
    onSuccess: (source) => {
      const note = notes.data?.items.find((item) => item.id === source.id);
      setDraft({ id: source.id, path: source.path, content: source.content, visibility: note?.visibility ?? "private", published: note?.published ?? false });
      setActiveView("publish");
    },
  });
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (draft.id) {
        await api.updateNoteContent(draft.id, draft.content);
        await api.updateVisibility(draft.id, draft.visibility, draft.published);
        return { id: draft.id };
      }
      return api.createNote({ path: draft.path.trim(), content: draft.content, visibility: draft.visibility, published: draft.published });
    },
    onSuccess: async (result) => { await refreshAdminData(); setDraft((value) => ({ ...value, id: result.id })); },
  });
  const deleteMutation = useMutation({
    mutationFn: api.deleteNote,
    onSuccess: refreshAdminData,
  });

  if (session.isLoading) return <section className={styles.loadingState}>Checking session…</section>;
  if (!session.data?.authenticated) {
    return (
      <section className={styles.loginPage}>
        <form className={styles.loginPanel} onSubmit={(event) => { event.preventDefault(); loginMutation.mutate(); }}>
          <header><span><LogIn /> OWNER SESSION</span><small>XIAYH.COM.CN / SECURE ACCESS</small></header>
          <div className={styles.loginIdentity}><UserRound /><div><strong>Welcome back.</strong><span>Authenticate to publish and manage the archive.</span></div></div>
          <label className={styles.field}><span>USERNAME</span><input autoComplete="username" value={login.username} onChange={(event) => setLogin((value) => ({ ...value, username: event.target.value }))} /></label>
          <label className={styles.field}><span>PASSWORD</span><input type="password" autoComplete="current-password" value={login.password} onChange={(event) => setLogin((value) => ({ ...value, password: event.target.value }))} /></label>
          {loginMutation.error ? <p className={styles.errorMessage} role="alert">{loginMutation.error.message}</p> : null}
          <button className={styles.primaryButton} disabled={loginMutation.isPending || !login.username.trim() || !login.password}>{loginMutation.isPending ? <RefreshCw className={styles.spinning} /> : <LogIn />} {loginMutation.isPending ? "Authenticating…" : "Login"}</button>
        </form>
      </section>
    );
  }

  const filteredNotes = (notes.data?.items ?? []).filter((note) => `${note.title} ${note.path}`.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <section className={styles.adminPage}>
      <header className={styles.adminHeader}>
        <div><span className={styles.ownerMark}><UserRound /></span><span><small>OWNER WORKSPACE</small><strong>{profile.data?.username ?? session.data.username}</strong></span></div>
        <nav aria-label="Admin sections">
          {(["profile", "publish", "manage"] as const).map((item) => <button key={item} className={activeView === item ? styles.activeNav : ""} onClick={() => setActiveView(item)}>{item}</button>)}
        </nav>
        <button className={styles.headerAction} onClick={() => logoutMutation.mutate()}><LogOut /> Logout</button>
      </header>

      {activeView === "profile" ? (
        <section className={styles.profileView}>
          <header><span>PROFILE / CONTENT STATUS</span><small>AUTHENTICATED OWNER</small></header>
          <div className={styles.metricGrid}>
            <Metric label="TOTAL" value={profile.data?.total} />
            <Metric label="PUBLISHED" value={profile.data?.published} />
            <Metric label="DRAFTS" value={profile.data?.drafts} />
            <Metric label="VIEWS" value={profile.data?.views} />
          </div>
          <div className={styles.profileActions}>
            <button onClick={() => { setDraft(emptyDraft); setActiveView("publish"); }}><FilePlus2 /> New article</button>
            <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}><RefreshCw className={syncMutation.isPending ? styles.spinning : ""} /> Sync repository</button>
            <button onClick={() => setActiveView("manage")}><Database /> Manage archive</button>
          </div>
          {syncMutation.data ? <p className={styles.successMessage}>Scanned {syncMutation.data.scanned} files · {syncMutation.data.changed} changed</p> : null}
        </section>
      ) : activeView === "publish" ? (
        <form className={styles.editorView} onSubmit={(event: FormEvent) => { event.preventDefault(); saveDraftMutation.mutate(); }}>
          <header><span>{draft.id ? "EDIT ARTICLE" : "NEW ARTICLE"}</span><small>{draft.id ? `DOCUMENT / ${draft.id}` : "MARKDOWN SOURCE"}</small></header>
          <div className={styles.editorToolbar}>
            <label><span>PATH</span><input value={draft.path} disabled={Boolean(draft.id)} placeholder="section/article-name.md" onChange={(event) => setDraft((value) => ({ ...value, path: event.target.value }))} /></label>
            <label><span>VISIBILITY</span><select value={draft.visibility} onChange={(event) => setDraft((value) => ({ ...value, visibility: event.target.value as Draft["visibility"] }))}><option value="private">private</option><option value="unlisted">unlisted</option><option value="public">public</option></select></label>
            <label className={styles.publishToggle}><input type="checkbox" checked={draft.published} onChange={(event) => setDraft((value) => ({ ...value, published: event.target.checked }))} /><span>PUBLISHED</span></label>
            <button className={styles.primaryButton} disabled={saveDraftMutation.isPending || !draft.path.trim()}>{saveDraftMutation.isPending ? <RefreshCw className={styles.spinning} /> : <Save />} Save</button>
          </div>
          <textarea aria-label="Markdown content" value={draft.content} onChange={(event) => setDraft((value) => ({ ...value, content: event.target.value }))} placeholder="# Start writing…" spellCheck={false} />
          {saveDraftMutation.isSuccess ? <p className={styles.successMessage}>Article source and publication metadata saved.</p> : null}
          {saveDraftMutation.error ? <p className={styles.errorMessage} role="alert">{saveDraftMutation.error.message}</p> : null}
        </form>
      ) : (
        <section className={styles.manageView}>
          <header><span>CONTENT MANAGEMENT</span><small>{filteredNotes.length} DOCUMENTS</small></header>
          <div className={styles.manageToolbar}><label><Search /><input aria-label="Filter articles" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter by title or path" /></label><button onClick={() => { setDraft(emptyDraft); setActiveView("publish"); }}><FilePlus2 /> New</button><button onClick={() => syncMutation.mutate()}><RefreshCw /> Sync</button></div>
          <div className={styles.noteList}>{filteredNotes.map((note) => <AdminNoteRow key={note.id} note={note} onEdit={() => sourceMutation.mutate(note.id)} onDelete={() => { if (window.confirm(`Delete ${note.path}? This removes the source file.`)) deleteMutation.mutate(note.id); }} />)}</div>
          {notes.isLoading ? <p className={styles.emptyMessage}>Loading documents…</p> : null}
          {!notes.isLoading && filteredNotes.length === 0 ? <p className={styles.emptyMessage}>No matching documents.</p> : null}
        </section>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value?: number }) { return <div><small>{label}</small><strong>{value ?? "—"}</strong></div>; }

function AdminNoteRow({ note, onEdit, onDelete }: { note: NoteSummary; onEdit: () => void; onDelete: () => void }) {
  const queryClient = useQueryClient();
  const [visibility, setVisibility] = useState(note.visibility);
  const [published, setPublished] = useState(note.published);
  const mutation = useMutation({ mutationFn: () => api.updateVisibility(note.id, visibility, published), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }) });
  return <article className={styles.noteRow}>
    <div className={styles.noteIdentity}><strong>{note.title || note.path}</strong><span>{note.path}</span></div>
    <span className={styles.viewCount}><Eye />{note.viewCount}</span>
    <select aria-label={`Visibility for ${note.title}`} value={visibility} onChange={(event) => setVisibility(event.target.value as NoteSummary["visibility"])}><option value="private">private</option><option value="unlisted">unlisted</option><option value="public">public</option></select>
    <label className={styles.rowPublished}><input aria-label={`Published ${note.title}`} type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /><span>Published</span></label>
    <div className={styles.rowActions}><button aria-label={`Save ${note.title}`} onClick={() => mutation.mutate()}><Save /></button><button aria-label={`Edit ${note.title}`} onClick={onEdit}><Edit3 /></button><button aria-label={`Delete ${note.title}`} className={styles.dangerButton} onClick={onDelete}><Trash2 /></button></div>
  </article>;
}
