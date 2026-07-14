import { FileText, ListTree, LogIn, Search, Settings } from "lucide-react";
import styles from "./AppLayout.module.css";

type SidebarView = "explorer" | "search" | "outline";
type SessionInfo = { authenticated: boolean; username: string | null };

export function ActivityBar({ sidebarView, pathname, session, setSidebarView, navigate }: {
  sidebarView: SidebarView;
  pathname: string;
  session?: SessionInfo;
  setSidebarView: (view: SidebarView) => void;
  navigate: (path: string) => void;
}) {
  return (
    <aside className={styles.activitybar} aria-label="Activity Bar">
      <button className={`${styles.action}${sidebarView === "explorer" ? ` ${styles.actionActive}` : ""}`} onClick={() => setSidebarView("explorer")} title="Explorer"><FileText /></button>
      <button className={`${styles.action}${sidebarView === "search" ? ` ${styles.actionActive}` : ""}`} onClick={() => setSidebarView("search")} title="Search"><Search /></button>
      <button className={`${styles.action}${sidebarView === "outline" ? ` ${styles.actionActive}` : ""}`} onClick={() => setSidebarView("outline")} title="Outline"><ListTree /></button>
      <div className={styles.activitySpacer} />
      <button className={`${styles.action}${pathname === "/login" ? ` ${styles.actionActive}` : ""}`} onClick={() => navigate("/login")} title={session?.authenticated ? "Owner profile and article management" : "Login"}>
        {session?.authenticated ? <img className={styles.activityAvatar} src={import.meta.env.VITE_PROFILE_AVATAR?.trim() || "https://github.com/xiayh666.png?size=96"} alt="Owner avatar" /> : <LogIn />}
      </button>
      <button className={`${styles.action}${pathname === "/settings" ? ` ${styles.actionActive}` : ""}`} onClick={() => navigate("/settings")} title="Settings"><Settings /></button>
    </aside>
  );
}
