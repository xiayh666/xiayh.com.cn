import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, RefreshCw, Save, Settings } from "lucide-react";
import { FormEvent, useState } from "react";
import { api, NoteSummary } from "../api";
import styles from "./AdminPage.module.css";

export function AdminPage({ view = "settings" }: { view?: "login" | "settings" }) {
  const queryClient = useQueryClient();
  const notes = useQuery({ queryKey: ["notes"], queryFn: api.notes });
  const [login, setLogin] = useState({ username: "admin", password: "" });
  const [loggedIn, setLoggedIn] = useState(false);

  const loginMutation = useMutation({
    mutationFn: () => api.login(login.username, login.password),
    onSuccess: () => {
      setLoggedIn(true);
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: api.sync,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    loginMutation.mutate();
  }

  return (
    <section className={styles.page}>
      <div className={`${styles.workspace}${view === "login" ? ` ${styles.workspaceSingle}` : ""}`}>
      {view === "login" ? (
      <form onSubmit={submit} className={styles.sessionPane}>
        <div className={styles.paneHeader}>
          <span>Session</span>
          <Settings />
        </div>
        <div className={styles.formBody}>
        <label className={styles.field}>
          <span>Username</span>
          <input
            className={styles.input}
            value={login.username}
            onChange={(event) => setLogin((value) => ({ ...value, username: event.target.value }))}
          />
        </label>
        <label className={styles.field}>
          <span>Password</span>
          <input
            className={styles.input}
            type="password"
            value={login.password}
            onChange={(event) => setLogin((value) => ({ ...value, password: event.target.value }))}
          />
        </label>
        <button className={`${styles.button} ${styles.primaryButton}`}>
          <Save />
          Login
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => syncMutation.mutate()}
          disabled={!loggedIn}
        >
          <RefreshCw />
          Sync repository
        </button>
        {syncMutation.data ? (
          <p className={styles.syncResult}>
            Scanned {syncMutation.data.scanned}, changed {syncMutation.data.changed}
          </p>
        ) : null}
        </div>
      </form>
      ) : (
      <div className={styles.metadataPane}>
        <div className={styles.paneHeader}>
          <span>Document Metadata</span>
          <Database />
        </div>
        <div className={styles.tableHeader}>
          <span>Note</span>
          <span>Visibility</span>
          <span>Published</span>
          <span>Action</span>
        </div>
        <div className={styles.tableBody}>
          {(notes.data?.items ?? []).map((note) => (
            <AdminNoteRow key={note.id} note={note} />
          ))}
        </div>
      </div>
      )}
      </div>
    </section>
  );
}

function AdminNoteRow({ note }: { note: NoteSummary }) {
  const queryClient = useQueryClient();
  const [visibility, setVisibility] = useState(note.visibility);
  const [published, setPublished] = useState(note.published);
  const mutation = useMutation({
    mutationFn: () => api.updateVisibility(note.id, visibility, published),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });

  return (
    <div className={styles.noteRow}>
      <div className={styles.noteIdentity}>
        <div className={styles.noteTitle}>{note.title || note.path}</div>
        <div className={styles.notePath}>{note.path}</div>
      </div>
      <select className={styles.select} value={visibility} onChange={(event) => setVisibility(event.target.value as NoteSummary["visibility"])}>
        <option value="private">private</option>
        <option value="unlisted">unlisted</option>
        <option value="public">public</option>
      </select>
      <input className={styles.checkbox} type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
      <button className={`${styles.button} ${styles.primaryButton} ${styles.rowButton}`} onClick={() => mutation.mutate()}>
        <Save />
        Save
      </button>
    </div>
  );
}
