import { Bell, Check, CheckCheck, Info, Trash2, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import styles from "./SystemNotifications.module.css";

export type NotificationTone = "success" | "info";
export type NotificationInput = { title: string; message: string; tone?: NotificationTone; archive?: boolean };
type SystemNotification = NotificationInput & { id: string; createdAt: number; read: boolean; visible: boolean; exiting: boolean; archive: boolean };

const STORAGE_KEY = "xiayh.system-notifications";
const NotificationContext = createContext<(input: NotificationInput) => void>(() => undefined);

function loadNotifications(): SystemNotification[] {
  try {
    const stored = JSON.parse(window.localStorage?.getItem(STORAGE_KEY) ?? "[]") as SystemNotification[];
    return stored.slice(0, 40).map((item) => ({ ...item, archive: true, visible: false, exiting: false }));
  } catch {
    return [];
  }
}

export function useSystemNotificationController() {
  const [items, setItems] = useState<SystemNotification[]>(loadNotifications);
  const [centerOpen, setCenterOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(items.filter((item) => item.archive).map((item) => ({ ...item, visible: false, exiting: false }))));
    } catch {
      // Notifications remain available in memory when storage is blocked.
    }
  }, [items]);

  const notify = useCallback((input: NotificationInput) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item: SystemNotification = { ...input, tone: input.tone ?? "info", archive: input.archive ?? true, id, createdAt: Date.now(), read: false, visible: true, exiting: false };
    setItems((current) => [item, ...current].slice(0, 40));
    window.setTimeout(() => setItems((current) => current.map((entry) => entry.id === id ? { ...entry, exiting: true } : entry)), 3300);
    window.setTimeout(() => setItems((current) => current.flatMap((entry) => entry.id === id ? (entry.archive ? [{ ...entry, visible: false }] : []) : [entry])), 3600);
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, exiting: true, read: true } : item));
    window.setTimeout(() => setItems((current) => current.flatMap((item) => item.id === id ? (item.archive ? [{ ...item, visible: false, exiting: false }] : []) : [item])), 220);
  }, []);
  const toggleCenter = useCallback(() => {
    setCenterOpen((open) => !open);
    setItems((current) => current.map((item) => item.archive ? { ...item, read: true } : item));
  }, []);
  const markAllRead = useCallback(() => setItems((current) => current.map((item) => item.archive ? { ...item, read: true } : item)), []);
  const clear = useCallback(() => setItems((current) => current.filter((item) => !item.archive)), []);
  const unread = items.reduce((count, item) => count + (item.archive && !item.read ? 1 : 0), 0);

  return useMemo(() => ({ items, unread, centerOpen, notify, dismiss, toggleCenter, markAllRead, clear }), [items, unread, centerOpen, notify, dismiss, toggleCenter, markAllRead, clear]);
}

export type SystemNotificationController = ReturnType<typeof useSystemNotificationController>;

export function SystemNotificationProvider({ controller, children }: { controller: SystemNotificationController; children: ReactNode }) {
  return <NotificationContext.Provider value={controller.notify}>{children}</NotificationContext.Provider>;
}

export function useNotify() {
  return useContext(NotificationContext);
}

export function SystemNotificationHost({ controller }: { controller: SystemNotificationController }) {
  const history = controller.items.filter((item) => item.archive);
  return (
    <>
      <div className={styles.viewport} aria-live="polite" aria-atomic="false">
        {controller.items.filter((item) => item.visible).slice(0, 3).map((item) => (
          <article key={item.id} className={`${styles.toast} ${styles[item.tone ?? "info"]}${item.exiting ? ` ${styles.exiting}` : ""}`} role="status">
            <NotificationIcon tone={item.tone} />
            <div><strong>{item.title}</strong><p>{item.message}</p><small>SYS.NOTIFY / {formatTime(item.createdAt)}</small></div>
            <button type="button" onClick={() => controller.dismiss(item.id)} aria-label="Dismiss notification"><X /></button>
            <i aria-hidden="true" />
          </article>
        ))}
      </div>
      {controller.centerOpen ? (
        <aside className={styles.center} aria-label="Notification center">
          <header><span><Bell /> Notifications</span><b>{history.length.toString().padStart(2, "0")}</b></header>
          <div className={styles.actions}>
            <button type="button" onClick={controller.markAllRead}><CheckCheck /> Mark all read</button>
            <button type="button" onClick={controller.clear}><Trash2 /> Clear</button>
          </div>
          <div className={styles.history}>
            {history.length ? history.map((item) => (
              <article key={item.id} className={!item.read ? styles.unread : ""}>
                <NotificationIcon tone={item.tone} />
                <div><strong>{item.title}</strong><p>{item.message}</p><small>{formatTime(item.createdAt)}</small></div>
              </article>
            )) : <p className={styles.empty}>NO NOTIFICATIONS</p>}
          </div>
        </aside>
      ) : null}
    </>
  );
}

function NotificationIcon({ tone }: { tone?: NotificationTone }) {
  return tone === "success" ? <Check aria-hidden="true" /> : <Info aria-hidden="true" />;
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
