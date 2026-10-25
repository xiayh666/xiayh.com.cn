import { useQuery } from "@tanstack/react-query";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, Clock3, ShieldCheck, UserRound } from "lucide-react";
import { api, type NoteSummary } from "../api";
import { scrollArticleHeading } from "../pages/articleNavigation";
import { LazyNotePage, LazyWelcomePage } from "../pages/lazyRoutes";
import { ActivityBar } from "./ActivityBar";
import { CommandPalette } from "./CommandPalette";
import { EditorArea } from "./EditorArea";
import { type EditorTabModel } from "./EditorTabs";
import { EditorStatusContext, type EditorStatus } from "./EditorStatusContext";
import { Sidebar } from "./Sidebar";
import { SystemNotificationHost, SystemNotificationProvider, useSystemNotificationController } from "./SystemNotifications";
import { TitleBar } from "./TitleBar";
import { type TopMenuDefinition } from "./TopMenu";
import { useEditorGroups } from "./useEditorGroups";
import { useIntroTransition } from "./useIntroTransition";
import { VscodeScrollbars } from "./VscodeScrollbars";
import styles from "./AppLayout.module.css";

const welcomeTab: EditorTabModel = { id: "welcome", kind: "welcome", label: "Welcome", href: "/", kept: true };
type SidebarView = "explorer" | "search" | "outline";

export function AppLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [activityBarVisible, setActivityBarVisible] = useState(true);
  const [sideBarVisible, setSideBarVisible] = useState(true);
  const [statusBarVisible, setStatusBarVisible] = useState(true);
  const [sidebarView, setSidebarView] = useState<SidebarView>("explorer");
  const [searchText, setSearchText] = useState("");
  const [openTabsExpanded, setOpenTabsExpanded] = useState(true);
  const [blogExpanded, setBlogExpanded] = useState(true);
  const [blogScrollReady, setBlogScrollReady] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [editorStatus, setEditorStatus] = useState<EditorStatus>({ label: "Ready" });
  const [now, setNow] = useState(() => new Date());
  const notifications = useSystemNotificationController();
  const notes = useQuery({ queryKey: ["notes"], queryFn: api.notes });
  const searchResults = useQuery({
    queryKey: ["search", searchText.trim()],
    queryFn: () => api.search(searchText.trim()),
    enabled: sidebarView === "search" && searchText.trim().length > 0,
  });
  const session = useQuery({ queryKey: ["session"], queryFn: api.session, staleTime: 60_000 });
  const location = useLocation();
  const navigate = useNavigate();
  const editorGroups = useEditorGroups(welcomeTab, navigate);
  const syncRouteRef = useRef(editorGroups.syncRoute);
  const { introPhase, fastIntroExit, introArticleSlug, introTarget, homeReturnExpanded, enterWorkspace, closeWorkspace, openHomepageNote: transitionHomepageNote } = useIntroTransition({
    pathname: location.pathname,
    navigate,
    focusedGroupId: editorGroups.workspace.focusedGroupId,
  });
  const currentSlug = location.pathname.startsWith("/notes/") ? decodeURIComponent(location.pathname.slice(7)) : "";
  const outlineNote = useQuery({
    queryKey: ["note", currentSlug],
    queryFn: ({ signal }) => api.note(currentSlug, signal),
    enabled: sidebarView === "outline" && currentSlug.length > 0,
  });
  const outlineHeadings = useMemo(() => {
    if (!outlineNote.data) return [];
    const container = document.createElement("div");
    container.innerHTML = outlineNote.data.html;
    return [...container.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")].map((element, index) => {
      const text = element.textContent?.trim() || `Section ${index + 1}`;
      const suffix = text.toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-|-$/g, "") || "heading";
      return { id: `section-${index}-${suffix}`, text, level: Number(element.tagName.slice(1)) };
    });
  }, [outlineNote.data]);
  const activeNote = notes.data?.items.find((note) => note.slug === currentSlug);
  const openEditorEntries = Object.values(editorGroups.workspace.groups).flatMap((group) => group.tabs.map((tab) => ({ group, tab })));
  const focusedEditorGroup = editorGroups.workspace.groups[editorGroups.workspace.focusedGroupId];
  const activeEditorTab = focusedEditorGroup?.tabs.find((tab) => tab.id === focusedEditorGroup.activeId);

  useEffect(() => {
    syncRouteRef.current = editorGroups.syncRoute;
  }, [editorGroups.syncRoute]);

  const openExplorer = () => {
    setSidebarView("explorer");
    setSideBarVisible(true);
    if (introPhase !== "ready") enterWorkspace(false);
  };

  const openHomepageNote = (slug: string) => {
    setSidebarView("explorer");
    transitionHomepageNote(slug);
  };

  const isMobileViewport = () => window.matchMedia?.("(max-width: 820px)").matches === true;

  const selectSidebarView = (view: SidebarView) => {
    if (sidebarView === view) {
      setSideBarVisible((visible) => !visible);
      return;
    }
    setSidebarView(view);
    setSideBarVisible(true);
  };

  const openNoteFromSidebar = (href: string) => {
    navigate(href);
    if (isMobileViewport()) setSideBarVisible(false);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      } else if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setSidebarView("search");
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "w" && activeEditorTab) {
        event.preventDefault();
        editorGroups.close(editorGroups.workspace.focusedGroupId, activeEditorTab.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeEditorTab, editorGroups]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!blogExpanded) return;
    const timer = window.setTimeout(() => setBlogScrollReady(true), 210);
    return () => window.clearTimeout(timer);
  }, [blogExpanded]);

  useLayoutEffect(() => {
    let tab: EditorTabModel | undefined;
    if (location.pathname === "/") {
      tab = welcomeTab;
    } else if (location.pathname === "/login") {
      tab = { id: "login", kind: "login", label: "Login", href: "/login", kept: true };
    } else if (location.pathname === "/settings") {
      tab = { id: "settings", kind: "settings", label: "Settings", href: "/settings", kept: true };
    } else if (location.pathname === "/new") {
      tab = { id: "new-article", kind: "new-article", label: "Untitled.md", href: "/new", kept: true };
    } else if (activeNote) {
      tab = {
        id: `article:${activeNote.slug}`,
        kind: "article",
        label: activeNote.path.split("/").at(-1) ?? activeNote.title,
        href: `/notes/${activeNote.slug}`,
        detail: activeNote.path,
        kept: true,
      };
    }
    if (!tab) return;
    syncRouteRef.current(tab);
  }, [activeNote, location.pathname]);

  useEffect(() => {
    if (location.pathname === "/") setEditorStatus({ label: "Welcome" });
    else if (location.pathname === "/login") setEditorStatus({ label: "Login" });
    else if (location.pathname === "/settings") setEditorStatus({ label: "Settings" });
    else if (currentSlug) setEditorStatus({ label: "Loading article…", language: "Markdown" });
  }, [currentSlug, location.pathname]);

  const latestNote = notes.data?.items.reduce<NoteSummary | undefined>((latest, note) => {
    if (!latest) return note;
    return Date.parse(note.publishedAt || note.updatedAt) > Date.parse(latest.publishedAt || latest.updatedAt) ? note : latest;
  }, undefined);

  const menuDefinitions: TopMenuDefinition[] = [
    {
      label: "File",
      items: [
        { label: "Open Home", action: () => navigate("/") },
        { label: "Open Blog Explorer", action: openExplorer },
        { label: "Open Settings", action: () => navigate("/settings") },
        { label: "Close Editor", shortcut: "Ctrl+W", separatorBefore: true, disabled: !activeEditorTab, action: () => activeEditorTab && editorGroups.close(editorGroups.workspace.focusedGroupId, activeEditorTab.id) },
        { label: "Close All Editors", disabled: !focusedEditorGroup?.tabs.length, action: () => focusedEditorGroup && editorGroups.closeAll(focusedEditorGroup.id) },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Explorer", checked: sidebarView === "explorer", action: () => setSidebarView("explorer") },
        { label: "Search", checked: sidebarView === "search", action: () => setSidebarView("search") },
        { label: "Outline", checked: sidebarView === "outline", action: () => setSidebarView("outline") },
        { label: "Command Palette…", separatorBefore: true, action: () => setPaletteOpen(true) },
      ],
    },
    {
      label: "Go",
      items: [
        { label: "Back", shortcut: "Alt+Left", action: () => navigate(-1) },
        { label: "Forward", shortcut: "Alt+Right", action: () => navigate(1) },
        { label: "Home", separatorBefore: true, action: () => navigate("/") },
        { label: "Latest Article", disabled: !latestNote, action: () => latestNote && navigate(`/notes/${latestNote.slug}`) },
        { label: "Settings", action: () => navigate("/settings") },
      ],
    },
  ];

  return (
    <SystemNotificationProvider controller={notifications}>
    <EditorStatusContext.Provider value={setEditorStatus}>
    <div
      className={`${styles.shell}${introPhase === "intro" || introPhase === "positioning" ? ` ${styles.shellIntro}` : introPhase === "assembling" ? ` ${styles.shellAssembling}` : introPhase === "returning" ? ` ${styles.shellReturning}` : ""}${fastIntroExit ? ` ${styles.shellFastIntroExit}` : ""}${activityBarVisible ? "" : ` ${styles.shellActivitybarHidden}`}${sideBarVisible ? "" : ` ${styles.shellSidebarHidden}`}${statusBarVisible ? "" : ` ${styles.shellStatusbarHidden}`}`}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      {introPhase !== "ready" ? (
        <div
          className={`${styles.introOverlay}${introPhase === "positioning" ? ` ${styles.introOverlayPositioning}` : introPhase === "assembling" ? ` ${styles.introOverlayAssembling}` : introPhase === "returning" ? ` ${styles.introOverlayReturning}${homeReturnExpanded ? ` ${styles.introOverlayReturningExpand}` : ""}` : ""}${introArticleSlug ? ` ${styles.introOverlayArticleFlip}` : ""}`}
          style={introTarget ? {
            "--intro-target-top": `${introTarget.top}px`,
            "--intro-target-right": `${introTarget.right}px`,
            "--intro-target-bottom": `${introTarget.bottom}px`,
            "--intro-target-left": `${introTarget.left}px`,
            "--intro-target-width": `${introTarget.width}px`,
            "--intro-target-height": `${introTarget.height}px`,
            "--intro-source-top": `${introTarget.sourceTop}px`,
            "--intro-source-left": `${introTarget.sourceLeft}px`,
            "--intro-source-width": `${introTarget.sourceWidth}px`,
            "--intro-source-height": `${introTarget.sourceHeight}px`,
            "--intro-card-x": `${introTarget.deltaX}px`,
            "--intro-card-y": `${introTarget.deltaY}px`,
            "--intro-card-scale-x": introTarget.scaleX,
            "--intro-card-scale-y": introTarget.scaleY,
          } as CSSProperties : undefined}
        >
          <Suspense fallback={<RouteLoading label="Loading workspace…" />}>
            <LazyWelcomePage intro workspace={introPhase === "assembling" || (introPhase === "returning" && !homeReturnExpanded)} initialNotes={notes.data?.items ?? []} onBrowse={openExplorer} onHome={closeWorkspace} onOpenNote={openHomepageNote} />
            {introArticleSlug ? (
              <div className={styles.introArticleBack} data-editor-flip-face="back">
                <LazyNotePage slug={introArticleSlug} reportStatus={false} />
              </div>
            ) : null}
          </Suspense>
        </div>
      ) : null}
      <TitleBar
        menus={menuDefinitions}
        layoutMenuOpen={layoutMenuOpen}
        setLayoutMenuOpen={setLayoutMenuOpen}
        activityBarVisible={activityBarVisible}
        setActivityBarVisible={setActivityBarVisible}
        sideBarVisible={sideBarVisible}
        setSideBarVisible={setSideBarVisible}
        statusBarVisible={statusBarVisible}
        setStatusBarVisible={setStatusBarVisible}
        openPalette={() => setPaletteOpen(true)}
      />

      <div className={styles.workbench}>
        <ActivityBar
          sidebarView={sidebarView}
          pathname={location.pathname}
          session={session.data}
          setSidebarView={selectSidebarView}
          navigate={navigate}
        />

        <Sidebar
          sidebarView={sidebarView}
          authenticated={session.data?.authenticated === true}
          openTabsExpanded={openTabsExpanded}
          setOpenTabsExpanded={setOpenTabsExpanded}
          blogExpanded={blogExpanded}
          setBlogExpanded={setBlogExpanded}
          blogScrollReady={blogScrollReady}
          setBlogScrollReady={setBlogScrollReady}
          openEditorEntries={openEditorEntries}
          focusedGroupId={editorGroups.workspace.focusedGroupId}
          activateTab={editorGroups.activate}
          navigate={navigate}
          notes={notes}
          searchText={searchText}
          setSearchText={setSearchText}
          searchResults={searchResults}
          currentSlug={currentSlug}
          outlineNote={outlineNote}
          outlineHeadings={outlineHeadings}
          openNoteFromSidebar={openNoteFromSidebar}
          scrollHeading={(headingId) => {
            const group = document.querySelector<HTMLElement>(`[data-editor-group="${CSS.escape(editorGroups.workspace.focusedGroupId)}"]`);
            if (group) scrollArticleHeading(group, headingId);
          }}
        />

        <div
          className={styles.sidebarResizeHandle}
          role="separator"
          aria-label="Resize Side Bar"
          aria-orientation="vertical"
          aria-valuemin={180}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onPointerDown={(event) => beginSidebarResize(event, sidebarWidth, setSidebarWidth)}
          onDoubleClick={() => setSidebarWidth(300)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const workbenchWidth = event.currentTarget.parentElement?.getBoundingClientRect().width || window.innerWidth;
            const maximum = Math.max(180, workbenchWidth - 48 - 240);
            setSidebarWidth((value) => Math.min(maximum, Math.max(180, value + (event.key === "ArrowRight" ? 10 : -10))));
          }}
        />

        <button
          type="button"
          className={styles.sidebarMask}
          aria-label="Close side bar overlay"
          onClick={() => setSideBarVisible(false)}
        />

        <section className={styles.center}>
          <EditorArea
            node={editorGroups.workspace.layout}
            groups={editorGroups.workspace.groups}
            focusedGroupId={editorGroups.workspace.focusedGroupId}
            actions={editorGroups}
            onBrowse={openExplorer}
            onHome={closeWorkspace}
          />
        </section>
      </div>

      <footer className={styles.statusbar}>
        <div className={styles.statusStart}>
          <span className={`${styles.statusItem} ${styles.statusMobileSecondary}`} title="Current user"><UserRound />{session.data?.username ?? "Guest"}</span>
          <span className={`${styles.statusItem} ${styles.statusMobileSecondary}`} title="Session status"><ShieldCheck />{session.data?.authenticated ? "Authenticated" : "Visitor"}</span>
          <span className={styles.statusItem} title="Local time"><Clock3 />{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div className={styles.statusRight}>
          {editorStatus.publishedAt ? <span className={`${styles.statusItem} ${styles.statusMobileSecondary}`} title="Published at">Published {new Date(editorStatus.publishedAt).toLocaleDateString()}</span> : null}
          {editorStatus.viewCount !== undefined ? <span className={`${styles.statusItem} ${styles.statusMobileSecondary}`} title="Article views">{editorStatus.viewCount} views</span> : null}
          {editorStatus.progress !== undefined ? <span className={styles.statusItem} title="Reading progress">{editorStatus.progress}%</span> : null}
          {editorStatus.words !== undefined ? <span className={`${styles.statusItem} ${styles.statusMobileSecondary}`} title="Word count">{editorStatus.words} words</span> : null}
          {editorStatus.readingMinutes !== undefined ? <span className={styles.statusItem} title="Estimated reading time"><Clock3 />{editorStatus.readingMinutes} min</span> : null}
          {editorStatus.language ? <span className={`${styles.statusItem} ${styles.statusMobileSecondary}`}>{editorStatus.language}</span> : null}
          <button className={`${styles.statusItem} ${styles.notificationButton}`} type="button" title="Notifications" aria-label={`${notifications.unread} unread notifications`} aria-expanded={notifications.centerOpen} onClick={notifications.toggleCenter}>
            <Bell />
            {notifications.unread ? <b>{notifications.unread > 99 ? "99+" : notifications.unread}</b> : null}
          </button>
        </div>
      </footer>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <SystemNotificationHost controller={notifications} />
      <VscodeScrollbars />
    </div>
    </EditorStatusContext.Provider>
    </SystemNotificationProvider>
  );
}

function RouteLoading({ label }: { label: string }) {
  return <div role="status" aria-live="polite">{label}</div>;
}

function beginSidebarResize(event: ReactPointerEvent<HTMLDivElement>, width: number, setWidth: (width: number) => void) {
  event.preventDefault();
  const startX = event.clientX;
  const workbenchWidth = event.currentTarget.parentElement?.getBoundingClientRect().width || window.innerWidth;
  const maximum = Math.max(180, workbenchWidth - 48 - 240);
  beginPointerResize("col-resize", (pointerEvent) => {
    setWidth(Math.min(maximum, Math.max(180, width + pointerEvent.clientX - startX)));
  });
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
