import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AdminPage } from "../pages/AdminPage";
import { NewArticlePage } from "../pages/ArticleEditor";
import { NotePage } from "../pages/NotePage";
import { WelcomePage } from "../pages/WelcomePage";
import { EditorTabs, type EditorTabModel } from "./EditorTabs";
import { type EditorGroupModel, type EditorLayoutNode, useEditorGroups } from "./useEditorGroups";
import styles from "./AppLayout.module.css";

type EditorActions = ReturnType<typeof useEditorGroups>;

export function EditorArea({ node, groups, focusedGroupId, actions, onBrowse, onHome }: {
  node: EditorLayoutNode;
  groups: Record<string, EditorGroupModel>;
  focusedGroupId: string;
  actions: EditorActions;
  onBrowse: () => void;
  onHome: () => void;
}) {
  return (
    <div className={styles.editorWorkspace}>
      <EditorLayout node={node} groups={groups} focusedGroupId={focusedGroupId} actions={actions} onBrowse={onBrowse} onHome={onHome} />
    </div>
  );
}

function EditorLayout({ node, groups, focusedGroupId, actions, onBrowse, onHome }: {
  node: EditorLayoutNode;
  groups: Record<string, EditorGroupModel>;
  focusedGroupId: string;
  actions: EditorActions;
  onBrowse: () => void;
  onHome: () => void;
}) {
  if (node.kind === "split") {
    return (
      <div className={`${styles.layoutSplit} ${node.orientation === "horizontal" ? styles.layoutHorizontal : styles.layoutVertical}`}>
        <div className={styles.layoutPane} style={{ flex: `0 0 ${node.ratio}%` }}>
          <EditorLayout node={node.children[0]} groups={groups} focusedGroupId={focusedGroupId} actions={actions} onBrowse={onBrowse} onHome={onHome} />
        </div>
        <SplitResizeHandle orientation={node.orientation} ratio={node.ratio} onResize={(ratio) => actions.resize(node.id, ratio)} />
        <div className={styles.layoutPane}>
          <EditorLayout node={node.children[1]} groups={groups} focusedGroupId={focusedGroupId} actions={actions} onBrowse={onBrowse} onHome={onHome} />
        </div>
      </div>
    );
  }
  const group = groups[node.groupId];
  if (!group) return null;
  const activeTab = group.tabs.find((tab) => tab.id === group.activeId);
  const focused = group.id === focusedGroupId;
  return (
    <section className={styles.editorGroup} aria-label={`Editor group ${group.id}`} data-editor-group={group.id}>
      <EditorTabs
        tabs={group.tabs}
        activeId={group.activeId}
        onActivate={(tabId) => actions.activate(group.id, tabId)}
        onClose={(tabId) => actions.close(group.id, tabId)}
        onCloseOthers={(tabId) => actions.closeOthers(group.id, tabId)}
        onCloseRight={(tabId) => actions.closeRight(group.id, tabId)}
        onCloseAll={() => actions.closeAll(group.id)}
        onKeepOpen={(tabId) => actions.keepOpen(group.id, tabId)}
        onTogglePin={(tabId) => actions.togglePin(group.id, tabId)}
        onSplit={(tabId, direction) => actions.split(group.id, tabId, direction)}
        onMove={(tabId, direction) => actions.move(group.id, tabId, direction)}
      />
      <main className={styles.editorGroupContent}>
        {activeTab ? <EditorContentPlane tab={activeTab} reportStatus={focused} onBrowse={onBrowse} onHome={onHome} /> : <div className={styles.emptyEditor}>No open editors</div>}
      </main>
    </section>
  );
}

function SplitResizeHandle({ orientation, ratio, onResize }: {
  orientation: "horizontal" | "vertical";
  ratio: number;
  onResize: (ratio: number) => void;
}) {
  const beginResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const container = event.currentTarget.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cursor = orientation === "horizontal" ? "col-resize" : "row-resize";
    const size = orientation === "horizontal" ? rect.width : rect.height;
    const minimumPaneSize = orientation === "horizontal" ? 180 : 120;
    beginPointerResize(cursor, (pointerEvent) => {
      const position = orientation === "horizontal" ? pointerEvent.clientX - rect.left : pointerEvent.clientY - rect.top;
      if (size > 0) onResize(clampSplitRatio(position / size * 100, size, minimumPaneSize));
    });
  };

  return (
    <div
      className={`${styles.splitResizeHandle} ${orientation === "horizontal" ? styles.splitResizeHorizontal : styles.splitResizeVertical}`}
      role="separator"
      aria-label="Resize editor groups"
      aria-orientation={orientation === "horizontal" ? "vertical" : "horizontal"}
      aria-valuenow={Math.round(ratio)}
      tabIndex={0}
      onPointerDown={beginResize}
      onDoubleClick={() => onResize(50)}
      onKeyDown={(event) => {
        const decrease = orientation === "horizontal" ? event.key === "ArrowLeft" : event.key === "ArrowUp";
        const increase = orientation === "horizontal" ? event.key === "ArrowRight" : event.key === "ArrowDown";
        if (!decrease && !increase) return;
        event.preventDefault();
        const container = event.currentTarget.parentElement;
        const size = orientation === "horizontal" ? container?.clientWidth ?? 0 : container?.clientHeight ?? 0;
        const minimumPaneSize = orientation === "horizontal" ? 180 : 120;
        onResize(clampSplitRatio(ratio + (increase ? 2 : -2), size, minimumPaneSize));
      }}
    />
  );
}

function clampSplitRatio(ratio: number, containerSize: number, minimumPaneSize: number) {
  if (containerSize <= 0) return Math.min(100, Math.max(0, ratio));
  if (containerSize <= minimumPaneSize * 2) return 50;
  const minimumRatio = minimumPaneSize / containerSize * 100;
  return Math.min(100 - minimumRatio, Math.max(minimumRatio, ratio));
}

function beginPointerResize(cursor: string, onMove: (event: PointerEvent) => void) {
  const previousCursor = document.body.style.cursor;
  const previousUserSelect = document.body.style.userSelect;
  document.body.style.cursor = cursor;
  document.body.style.userSelect = "none";
  const stop = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
    document.body.style.cursor = previousCursor;
    document.body.style.userSelect = previousUserSelect;
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
}

function EditorTabContent({ tab, reportStatus, onBrowse, onHome }: {
  tab: EditorTabModel;
  reportStatus: boolean;
  onBrowse: () => void;
  onHome: () => void;
}) {
  if (tab.kind === "welcome") return <WelcomePage workspace onBrowse={onBrowse} onHome={onHome} />;
  if (tab.kind === "login") return <AdminPage view="login" />;
  if (tab.kind === "settings") return <AdminPage view="settings" />;
  if (tab.kind === "new-article") return <NewArticlePage />;
  const slug = decodeURIComponent(tab.href.replace(/^\/notes\//, ""));
  return <NotePage slug={slug} reportStatus={reportStatus} />;
}

function EditorContentPlane({ tab, reportStatus, onBrowse, onHome }: {
  tab: EditorTabModel;
  reportStatus: boolean;
  onBrowse: () => void;
  onHome: () => void;
}) {
  const [displayedTab, setDisplayedTab] = useState(tab);
  const [flip, setFlip] = useState<{ front: EditorTabModel; back: EditorTabModel }>();
  const cachedTabsRef = useRef(new Map<string, EditorTabModel>([[tab.id, tab]]));

  useEffect(() => {
    cachedTabsRef.current.set(tab.id, tab);
  }, [tab]);

  useEffect(() => {
    if (tab.id === displayedTab.id) return;
    const shouldFlip = displayedTab.kind === "welcome"
      && tab.kind === "article"
      && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!shouldFlip) {
      setFlip(undefined);
      setDisplayedTab(tab);
      return;
    }
    setFlip({ front: displayedTab, back: tab });
    const timer = window.setTimeout(() => {
      setDisplayedTab(tab);
      setFlip(undefined);
    }, 440);
    return () => window.clearTimeout(timer);
  }, [displayedTab, tab]);

  const waitingForWelcomeFlip = !flip
    && displayedTab.id !== tab.id
    && displayedTab.kind === "welcome"
    && tab.kind === "article"
    && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const visibleId = flip?.back.id ?? (waitingForWelcomeFlip ? displayedTab.id : tab.id);
  const cachedContent = <div className={styles.editorContentCache}>
      {[...cachedTabsRef.current.values()].map((cachedTab) => (
        <div key={cachedTab.id} className={styles.editorCachedPlane} hidden={cachedTab.id !== visibleId}>
          <EditorTabContent tab={cachedTab} reportStatus={!flip && cachedTab.id === visibleId && reportStatus} onBrowse={onBrowse} onHome={onHome} />
        </div>
      ))}
    </div>;

  if (!flip) return <div className={styles.editorContentStack}>{cachedContent}</div>;
  return (
    <div className={styles.editorContentStack}>
      {cachedContent}
      <div className={styles.editorFlipScene} aria-hidden="true">
        <div className={styles.editorFlipCard}>
          <div className={`${styles.editorFlipFace} ${styles.editorFlipFront}`}>
          <EditorTabContent tab={flip.front} reportStatus={false} onBrowse={onBrowse} onHome={onHome} />
          </div>
          <div className={`${styles.editorFlipFace} ${styles.editorFlipBack}`} data-editor-flip-face="back">
            <EditorTabContent tab={flip.back} reportStatus={false} onBrowse={onBrowse} onHome={onHome} />
          </div>
        </div>
      </div>
    </div>
  );
}
