import { FileText } from "lucide-react";
import styles from "./NotePage.module.css";

// Shared by route, reader and data boundaries so slow connections show one visual state.
export function LoadingDocument({ pendingPath }: { pendingPath: string }) {
  return <div className={styles.loadingDocument} role="status" aria-label="Loading article">
    <span className={styles.loadingBar} />
    <div className={styles.loadingFile}><FileText /><span>{pendingPath.split("/").at(-1)}</span></div>
    <div className={styles.skeletonTitle} />
    <div className={styles.skeletonLine} />
    <div className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
    <div className={styles.skeletonBlock} />
    <div className={styles.skeletonLine} />
    <div className={`${styles.skeletonLine} ${styles.skeletonMedium}`} />
  </div>;
}
