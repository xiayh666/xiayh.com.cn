import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, PanelsTopLeft, Search } from "lucide-react";
import { TopMenu, type TopMenuDefinition } from "./TopMenu";
import styles from "./AppLayout.module.css";

export function TitleBar({ menus, layoutMenuOpen, setLayoutMenuOpen, activityBarVisible, setActivityBarVisible, sideBarVisible, setSideBarVisible, statusBarVisible, setStatusBarVisible, openPalette }: {
  menus: TopMenuDefinition[];
  layoutMenuOpen: boolean;
  setLayoutMenuOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  activityBarVisible: boolean;
  setActivityBarVisible: (value: boolean | ((current: boolean) => boolean)) => void;
  sideBarVisible: boolean;
  setSideBarVisible: (value: boolean | ((current: boolean) => boolean)) => void;
  statusBarVisible: boolean;
  setStatusBarVisible: (value: boolean | ((current: boolean) => boolean)) => void;
  openPalette: () => void;
}) {
  const navigate = useNavigate();
  const layoutMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!layoutMenuOpen) return;
    const close = (event?: Event) => {
      if (event?.target instanceof Node && layoutMenuRef.current?.contains(event.target)) return;
      setLayoutMenuOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setLayoutMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [layoutMenuOpen, setLayoutMenuOpen]);

  return (
    <header className={styles.titlebar}>
      <div className={styles.titlebarStart}>
        <TopMenu menus={menus} />
      </div>
      <div className={styles.titlebarCenter}>
        <button type="button" className={styles.titlebarNavButton} title="Go Back" aria-label="Go Back" onClick={() => navigate(-1)}>
          <ChevronLeft />
        </button>
        <button type="button" className={styles.titlebarNavButton} title="Go Forward" aria-label="Go Forward" onClick={() => navigate(1)}>
          <ChevronRight />
        </button>
        <button className={styles.addressButton} onClick={openPalette}>
          <Search />
          xiayh.com.cn
        </button>
      </div>
      <div className={styles.titlebarActions}>
        <div className={styles.layoutMenuHost} ref={layoutMenuRef}>
          <button
            className={`${styles.titlebarButton}${layoutMenuOpen ? ` ${styles.titlebarButtonActive}` : ""}`}
            type="button"
            title="Customize Layout"
            aria-label="Customize Layout"
            aria-haspopup="menu"
            aria-expanded={layoutMenuOpen}
            onClick={() => setLayoutMenuOpen((value) => !value)}
          >
            <PanelsTopLeft />
          </button>
          {layoutMenuOpen ? (
            <div className={styles.layoutMenu} role="menu" aria-label="Customize Layout">
              <button type="button" role="menuitemcheckbox" aria-checked={activityBarVisible} onClick={() => setActivityBarVisible((value) => !value)}>
                <span>{activityBarVisible ? "✓" : ""}</span>
                <b>Activity Bar</b>
              </button>
              <button type="button" role="menuitemcheckbox" aria-checked={sideBarVisible} onClick={() => setSideBarVisible((value) => !value)}>
                <span>{sideBarVisible ? "✓" : ""}</span>
                <b>Side Bar</b>
              </button>
              <button type="button" role="menuitemcheckbox" aria-checked={statusBarVisible} onClick={() => setStatusBarVisible((value) => !value)}>
                <span>{statusBarVisible ? "✓" : ""}</span>
                <b>Status Bar</b>
              </button>
              <i aria-hidden="true" />
              <button type="button" role="menuitem" onClick={() => {
                setActivityBarVisible(true);
                setSideBarVisible(true);
                setStatusBarVisible(true);
                setLayoutMenuOpen(false);
              }}>
                <span />
                <b>Reset Layout</b>
              </button>
            </div>
          ) : null}
        </div>
        <button className={styles.titlebarButton} onClick={openPalette} title="Search"><Search /></button>
      </div>
    </header>
  );
}
