import { Command, FileText, Search } from "lucide-react";
import styles from "./WelcomePage.module.css";

export function WelcomePage() {
  return (
    <section className={styles.page}>
      <div className={styles.content}>
        <div className={styles.hero}>
          <Command className={styles.logo} />
          <div>
            <h1>xiayh.com.cn</h1>
            <p>Personal knowledge base</p>
          </div>
        </div>
        <div className={styles.actions}>
          <div className={styles.action}>
            <FileText />
            <div>
              <strong>Browse articles</strong>
              <span>Expand a section in Explorer and select an article.</span>
            </div>
          </div>
          <div className={styles.action}>
            <Search />
            <div>
              <strong>Search</strong>
              <span>Press Ctrl+K to search the knowledge base.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
