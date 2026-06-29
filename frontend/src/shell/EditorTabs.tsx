import { Command, FileText, LogIn, Settings, X } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent, type WheelEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import styles from "./AppLayout.module.css";

export type EditorTabModel = {
  id: string;
  kind: "welcome" | "login" | "settings" | "article";
  label: string;
  href: string;
  detail?: string;
  kept?: boolean;
  pinned?: boolean;
};

type ContextMenu = { tabId: string; left: number; top: number };

export function EditorTabs({ tabs, activeId, onActivate, onClose, onCloseOthers, onCloseRight, onCloseAll, onKeepOpen, onTogglePin, onSplit, onMove }: {
  tabs: EditorTabModel[];
  activeId: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onCloseOthers: (id: string) => void;
  onCloseRight: (id: string) => void;
  onCloseAll: () => void;
  onKeepOpen: (id: string) => void;
  onTogglePin: (id: string) => void;
  onSplit: (id: string, direction: "left" | "right" | "up" | "down") => void;
  onMove: (id: string, direction: "left" | "right" | "up" | "down") => void;
}) {
  const navigate = useNavigate();
  const stripRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);

  useEffect(() => {
    const active = stripRef.current?.querySelector<HTMLElement>("[data-active='true']");
    if (active && typeof active.scrollIntoView === "function") {
      active.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [activeId]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => {
      setContextMenu(null);
      setMoveMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

  const scrollHorizontally = (event: WheelEvent<HTMLDivElement>) => {
    if (!stripRef.current || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    stripRef.current.scrollLeft += event.deltaY;
    event.preventDefault();
  };

  const openContextMenu = (event: MouseEvent, tabId: string) => {
    event.preventDefault();
    const menuWidth = 210;
    const menuHeight = 310;
    setContextMenu({
      tabId,
      left: Math.max(4, Math.min(event.clientX, window.innerWidth - menuWidth - 4)),
      top: Math.max(4, Math.min(event.clientY, window.innerHeight - menuHeight - 4)),
    });
    setMoveMenuOpen(false);
  };

  const runAction = (action: () => void) => {
    setContextMenu(null);
    setMoveMenuOpen(false);
    action();
  };

  const contextIndex = contextMenu ? tabs.findIndex((tab) => tab.id === contextMenu.tabId) : -1;
  const contextTab = contextIndex >= 0 ? tabs[contextIndex] : undefined;

  return (
    <>
      <div ref={stripRef} className={styles.editorTabs} aria-label="Editor tabs" onWheel={scrollHorizontally}>
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          const icon = tab.kind === "welcome"
            ? <Command />
            : tab.kind === "login"
              ? <LogIn />
            : tab.kind === "settings"
              ? <Settings />
              : <FileText className={styles.accentIcon} />;
          return (
            <div
              key={tab.id}
              className={`${styles.editorTab}${active ? ` ${styles.editorTabActive}` : ""}`}
              data-active={active}
              onContextMenu={(event) => openContextMenu(event, tab.id)}
            >
              <button type="button" className={styles.editorTabLink} title={tab.detail ?? tab.label} onClick={() => {
                onActivate(tab.id);
                navigate(tab.href);
              }}>
                {icon}
                <span>{tab.label}</span>
              </button>
              <button type="button" className={styles.editorTabClose} aria-label={`Close ${tab.label}`} onClick={() => onClose(tab.id)}>
                <X />
              </button>
            </div>
          );
        })}
      </div>
      {contextMenu ? createPortal(
        <div
          className={styles.tabContextMenu}
          style={{ left: contextMenu.left, top: contextMenu.top }}
          role="menu"
          aria-label="Tab actions"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" onClick={() => runAction(() => onClose(contextMenu.tabId))}>Close</button>
          <button type="button" role="menuitem" disabled={tabs.filter((tab) => !tab.pinned && tab.id !== contextMenu.tabId).length === 0} onClick={() => runAction(() => onCloseOthers(contextMenu.tabId))}>Close Others</button>
          <button type="button" role="menuitem" disabled={contextIndex < 0 || tabs.slice(contextIndex + 1).every((tab) => tab.pinned)} onClick={() => runAction(() => onCloseRight(contextMenu.tabId))}>Close to the Right</button>
          <button type="button" role="menuitem" disabled={tabs.every((tab) => tab.pinned)} onClick={() => runAction(onCloseAll)}>Close All</button>
          {contextTab?.kept === false ? (
            <>
              <div className={styles.contextMenuSeparator} />
              <button type="button" role="menuitem" onClick={() => runAction(() => onKeepOpen(contextMenu.tabId))}>Keep Open</button>
            </>
          ) : null}
          <div className={styles.contextMenuSeparator} />
          <button type="button" role="menuitem" onClick={() => runAction(() => onTogglePin(contextMenu.tabId))}>
            <span>{contextTab?.pinned ? "✓" : ""}</span>{contextTab?.pinned ? "Unpin" : "Pin"}
          </button>
          <div className={styles.contextMenuSeparator} />
          <button type="button" role="menuitem" onClick={() => runAction(() => onSplit(contextMenu.tabId, "right"))}>Split Right</button>
          <div className={styles.contextSubmenuHost} onPointerEnter={() => setMoveMenuOpen(true)} onPointerLeave={() => setMoveMenuOpen(false)}>
            <button type="button" role="menuitem" aria-haspopup="menu" aria-expanded={moveMenuOpen} onClick={() => setMoveMenuOpen((value) => !value)}>
              Split &amp; Move <span>›</span>
            </button>
            {moveMenuOpen ? (
              <div className={`${styles.contextSubmenu}${contextMenu.left > window.innerWidth - 380 ? ` ${styles.contextSubmenuLeft}` : ""}`} role="menu" aria-label="Split and Move">
                {(["up", "down", "left", "right"] as const).map((direction) => (
                  <button key={`split:${direction}`} type="button" role="menuitem" onClick={() => runAction(() => onSplit(contextMenu.tabId, direction))}>
                    Split {direction[0].toUpperCase() + direction.slice(1)}
                  </button>
                ))}
                <div className={styles.contextMenuSeparator} />
                {(["up", "down", "left", "right"] as const).map((direction) => (
                  <button key={`move:${direction}`} type="button" role="menuitem" onClick={() => runAction(() => onMove(contextMenu.tabId, direction))}>
                    Move {direction === "up" ? "Above" : direction === "down" ? "Below" : direction[0].toUpperCase() + direction.slice(1)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
