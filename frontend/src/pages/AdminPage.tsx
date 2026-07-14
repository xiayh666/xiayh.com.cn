import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, LogIn, LogOut, RefreshCw, Save, Search, Settings, ShieldCheck, SlidersHorizontal, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { api, type NoteSummary } from "../api";
import styles from "./AdminPage.module.css";

export function AdminPage({ view = "settings" }: { view?: "login" | "settings" }) {
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ["session"], queryFn: api.session });
  const notes = useQuery({ queryKey: ["notes"], queryFn: api.notes, enabled: session.data?.authenticated === true });
  const profile = useQuery({ queryKey: ["admin-profile"], queryFn: api.adminProfile, enabled: session.data?.authenticated === true });
  const [login, setLogin] = useState({ username: "admin", password: "" });
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
  const deleteMutation = useMutation({
    mutationFn: api.deleteNote,
    onSuccess: refreshAdminData,
  });

  if (view === "settings") return <SettingsView authenticated={session.data?.authenticated === true} loading={session.isLoading} username={session.data?.username ?? null} />;

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
        <span className={styles.managementTitle}>ARTICLE DISPLAY MANAGEMENT</span>
        <button className={styles.headerAction} onClick={() => logoutMutation.mutate()}><LogOut /> Logout</button>
      </header>

        <section className={styles.manageView}>
          <header><span>CONTENT MANAGEMENT</span><small>{filteredNotes.length} DOCUMENTS</small></header>
          <div className={styles.manageToolbar}><label><Search /><input aria-label="Filter articles" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter by title or path" /></label><button onClick={() => syncMutation.mutate()}><RefreshCw /> Sync</button></div>
          <div className={styles.noteList}>{filteredNotes.map((note) => <AdminNoteRow key={note.id} note={note} onDelete={() => { if (window.confirm(`Delete ${note.path}? This removes the source file.`)) deleteMutation.mutate(note.id); }} />)}</div>
          {notes.isLoading ? <p className={styles.emptyMessage}>Loading documents…</p> : null}
          {!notes.isLoading && filteredNotes.length === 0 ? <p className={styles.emptyMessage}>No matching documents.</p> : null}
        </section>
    </section>
  );
}

function SettingsView({ authenticated, loading, username }: { authenticated: boolean; loading: boolean; username: string | null }) {
  return (
    <section className={styles.settingsPage}>
      <header className={styles.settingsHeader}>
        <span><Settings /> SETTINGS</span>
        <small>READER WORKSPACE / LOCAL PREFERENCES</small>
      </header>
      <div className={styles.settingsGrid}>
        <article className={styles.settingsCard}>
          <header><SlidersHorizontal /><span>Layout</span></header>
          <p>右上角 Customize Layout 控制 Activity Bar、Side Bar 和 Status Bar。这里保留为运行时布局偏好，不和登录入口混在一起。</p>
        </article>
        <article className={styles.settingsCard}>
          <header><ShieldCheck /><span>Owner Session</span></header>
          <p>{loading ? "Checking session…" : authenticated ? `Authenticated as ${username ?? "owner"}. 文章管理请从 Login / Owner 入口进入。` : "Not authenticated. 登录只通过 Login 入口进行。"}</p>
        </article>
        <article className={styles.settingsCard}>
          <header><UserRound /><span>Display</span></header>
          <p>界面使用固定浅色 Catppuccin Latte 视觉系统；不再提供夜间模式切换。</p>
        </article>
      </div>
    </section>
  );
}

function AdminNoteRow({ note, onDelete }: { note: NoteSummary; onDelete: () => void }) {
  const queryClient = useQueryClient();
  const [visibility, setVisibility] = useState(note.visibility);
  const [published, setPublished] = useState(note.published);
  const [tags, setTags] = useState((note.tags ?? []).join(", "));
  const mutation = useMutation({ mutationFn: () => Promise.all([api.updateVisibility(note.id, visibility, published), api.setTags(note.id, tags.split(",").map((tag) => tag.trim()).filter(Boolean))]), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }) });
  return <article className={styles.noteRow}>
    <div className={styles.noteIdentity}><strong>{note.title || note.path}</strong><span>{note.path}</span></div>
    <span className={styles.viewCount}><Eye />{note.viewCount}</span>
    <input aria-label={`Tags for ${note.title}`} className={styles.tagInput} value={tags} onChange={(event) => setTags(event.target.value)} placeholder="tag, tag" />
    <select aria-label={`Visibility for ${note.title}`} value={visibility} onChange={(event) => setVisibility(event.target.value as NoteSummary["visibility"])}><option value="private">private</option><option value="unlisted">unlisted</option><option value="public">public</option></select>
    <label className={styles.rowPublished}><input aria-label={`Published ${note.title}`} type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /><span>Published</span></label>
    <div className={styles.rowActions}><button aria-label={`Save ${note.title}`} onClick={() => mutation.mutate()}><Save /></button><button aria-label={`Delete ${note.title}`} className={styles.dangerButton} onClick={onDelete}><Trash2 /></button></div>
  </article>;
}
