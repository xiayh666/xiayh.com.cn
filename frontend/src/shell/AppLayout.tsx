import { useQuery } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, ChevronLeft, ChevronRight, Clock3, Command, FileText, Hash, ListTree, LogIn, Maximize2, Moon, MoreHorizontal, Search, Settings, ShieldCheck, SplitSquareHorizontal, Sun, UserRound } from "lucide-react";
import { api, type NoteSummary } from "../api";
import { AdminPage } from "../pages/AdminPage";
import { NotePage, scrollArticleHeading } from "../pages/NotePage";
import { WelcomePage } from "../pages/WelcomePage";
import { CommandPalette } from "./CommandPalette";
import { EditorTabs, type EditorTabModel } from "./EditorTabs";
import { EditorStatusContext, type EditorStatus } from "./EditorStatusContext";
import { ExplorerTree } from "./ExplorerTree";
import { SystemNotificationHost, SystemNotificationProvider, useSystemNotificationController } from "./SystemNotifications";
import { TopMenu, type TopMenuDefinition } from "./TopMenu";
import { useEditorGroups, type EditorGroupModel, type EditorLayoutNode } from "./useEditorGroups";
import { VscodeScrollbars } from "./VscodeScrollbars";
import styles from "./AppLayout.module.css";

const welcomeTab: EditorTabModel = { id: "welcome", kind: "welcome", label: "Welcome", href: "/", kept: true };
type SidebarView = "explorer" | "search" | "outline";
type IntroPhase = "intro" | "positioning" | "assembling" | "ready";
type LayoutRect = { top: number; right: number; bottom: number; left: number; width: number; height: number };
type IntroTarget = LayoutRect & {
  sourceTop: number;
  sourceLeft: number;
  sourceWidth: number;
  sourceHeight: number;
  deltaX: number;
  deltaY: number;
  scaleX: number;
  scaleY: number;
};

export function AppLayout() {
  const [introPhase, setIntroPhase] = useState<IntroPhase>("intro");
  const [fastIntroExit, setFastIntroExit] = useState(false);
  const [introArticleSlug, setIntroArticleSlug] = useState("");
  const [introTarget, setIntroTarget] = useState<IntroTarget>();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<SidebarView>("explorer");
  const [searchText, setSearchText] = useState("");
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [openTabsExpanded, setOpenTabsExpanded] = useState(true);
  const [blogExpanded, setBlogExpanded] = useState(true);
  const [blogScrollReady, setBlogScrollReady] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [editorStatus, setEditorStatus] = useState<EditorStatus>({ label: "Ready" });
  const [now, setNow] = useState(() => new Date());
  const notifications = useSystemNotificationController();
  const pendingIntroRoute = useRef<string>();
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
    if (introPhase !== "intro" || location.pathname === "/") return;
    navigate("/", { replace: true });
  }, [introPhase, location.pathname, navigate]);

  useEffect(() => {
    if (introPhase !== "positioning") return;
    const timer = window.setTimeout(() => setIntroPhase("assembling"), 440);
    return () => window.clearTimeout(timer);
  }, [introPhase]);

  useEffect(() => {
    if (introPhase !== "assembling") return;
    const timer = window.setTimeout(() => {
      setIntroPhase("ready");
    }, fastIntroExit ? 420 : 1000);
    return () => window.clearTimeout(timer);
  }, [fastIntroExit, introPhase]);

  useEffect(() => {
    if (introPhase === "intro" || !pendingIntroRoute.current) return;
    const route = pendingIntroRoute.current;
    pendingIntroRoute.current = undefined;
    navigate(route);
  }, [introPhase, navigate]);

  const enterWorkspace = (fast = false) => {
    setFastIntroExit(fast);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setIntroPhase("ready");
      return;
    }
    setIntroPhase("assembling");
  };

  const openExplorer = () => {
    setSidebarView("explorer");
    if (introPhase !== "ready") enterWorkspace(false);
  };

  const beginHomepageCardTransition = () => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      enterWorkspace(true);
      return;
    }
    const content = document.querySelector<HTMLElement>(`[data-editor-group="${CSS.escape(editorGroups.workspace.focusedGroupId)}"] > main`);
    const card = document.querySelector<HTMLElement>("[data-welcome-card=\"true\"]");
    if (content && card) {
      const target = measureLayoutRect(content);
      const source = card.getBoundingClientRect();
      setIntroTarget({
        ...target,
        sourceTop: source.top,
        sourceLeft: source.left,
        sourceWidth: source.width,
        sourceHeight: source.height,
        deltaX: target.left + target.width / 2 - (source.left + source.width / 2),
        deltaY: target.top + target.height / 2 - (source.top + source.height / 2),
        scaleX: source.width > 0 ? target.width / source.width : 1,
        scaleY: source.height > 0 ? target.height / source.height : 1,
      });
    }
    setFastIntroExit(true);
    setIntroPhase("positioning");
  };

  const openHomepageNote = (slug: string) => {
    const route = `/notes/${slug}`;
    setSidebarView("explorer");
    if (introPhase === "ready") {
      navigate(route);
      return;
    }
    setIntroArticleSlug(slug);
    pendingIntroRoute.current = route;
    beginHomepageCardTransition();
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
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

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
    editorGroups.syncRoute(tab);
  }, [activeNote, location.pathname]);

  useEffect(() => {
    if (location.pathname === "/") setEditorStatus({ label: "Welcome" });
    else if (location.pathname === "/login") setEditorStatus({ label: "Login" });
    else if (location.pathname === "/settings") setEditorStatus({ label: "Settings" });
    else if (currentSlug) setEditorStatus({ label: "Loading article…", language: "Markdown" });
  }, [currentSlug, location.pathname]);

  const copyText = (value: string, label: string) => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(value).then(() => setEditorStatus({ label }));
  };

  const selectEditorContent = () => {
    const group = document.querySelector<HTMLElement>(`[data-editor-group="${CSS.escape(editorGroups.workspace.focusedGroupId)}"]`);
    const content = group?.querySelector<HTMLElement>("main");
    if (!content) return;
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(content);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

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
      label: "Edit",
      items: [
        { label: "Search Articles", shortcut: "Ctrl+Shift+F", action: () => setSidebarView("search") },
        { label: "Command Palette…", shortcut: "Ctrl+K", action: () => setPaletteOpen(true) },
        { label: "Copy Current Path", separatorBefore: true, action: () => copyText(location.pathname, "Path copied") },
        { label: dark ? "Use Light Theme" : "Use Dark Theme", action: () => setDark((value) => !value) },
      ],
    },
    {
      label: "Selection",
      items: [
        { label: "Select Editor Content", disabled: !activeEditorTab, action: selectEditorContent },
        { label: "Clear Selection", action: () => window.getSelection()?.removeAllRanges() },
        { label: "Focus Document Outline", separatorBefore: true, disabled: !currentSlug, action: () => setSidebarView("outline") },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Explorer", checked: sidebarView === "explorer", action: () => setSidebarView("explorer") },
        { label: "Search", checked: sidebarView === "search", action: () => setSidebarView("search") },
        { label: "Outline", checked: sidebarView === "outline", action: () => setSidebarView("outline") },
        { label: "Command Palette…", separatorBefore: true, action: () => setPaletteOpen(true) },
        { label: "Toggle Color Theme", action: () => setDark((value) => !value) },
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
    {
      label: "Run",
      items: [
        { label: "Refresh Blog Data", action: () => { void notes.refetch(); } },
        { label: "Refresh Document Outline", disabled: !currentSlug, action: () => { void outlineNote.refetch(); } },
        { label: "Reader workspace has no build task", separatorBefore: true, disabled: true },
      ],
    },
    {
      label: "Terminal",
      items: [
        { label: "Copy Current Route", action: () => copyText(location.pathname, "Route copied") },
        { label: "Copy Project Command", action: () => copyText("cd ~/xiayh.com.cn", "Project command copied") },
        { label: "Integrated terminal unavailable in reader mode", separatorBefore: true, disabled: true },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Welcome", action: () => navigate("/") },
        { label: "Search Articles", action: () => setPaletteOpen(true) },
        { label: "Open Source Repository", separatorBefore: true, action: () => window.open("https://github.com/xiayh666", "_blank", "noopener,noreferrer") },
        { label: "About Xiayh", disabled: true },
      ],
    },
  ];

  return (
    <SystemNotificationProvider controller={notifications}>
    <EditorStatusContext.Provider value={setEditorStatus}>
    <div
      className={`${styles.shell}${introPhase === "intro" || introPhase === "positioning" ? ` ${styles.shellIntro}` : introPhase === "assembling" ? ` ${styles.shellAssembling}` : ""}${fastIntroExit ? ` ${styles.shellFastIntroExit}` : ""}`}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      {introPhase !== "ready" ? (
        <div
          className={`${styles.introOverlay}${introPhase === "positioning" ? ` ${styles.introOverlayPositioning}` : introPhase === "assembling" ? ` ${styles.introOverlayAssembling}` : ""}${introArticleSlug ? ` ${styles.introOverlayArticleFlip}` : ""}`}
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
          <WelcomePage intro workspace={introPhase === "assembling"} initialNotes={notes.data?.items ?? []} onBrowse={openExplorer} onOpenNote={openHomepageNote} />
          {introArticleSlug ? (
            <div className={styles.introArticleBack} data-editor-flip-face="back">
              <NotePage slug={introArticleSlug} reportStatus={false} />
            </div>
          ) : null}
        </div>
      ) : null}
      <header className={styles.titlebar}>
        <div className={styles.titlebarStart}>
          <Command className={styles.brandIcon} />
          <TopMenu menus={menuDefinitions} />
        </div>
        <div className={styles.titlebarCenter}>
          <ChevronLeft />
          <ChevronRight />
          <button className={styles.addressButton} onClick={() => setPaletteOpen(true)}>
            <Search />
            xiayh.com.cn
          </button>
        </div>
        <div className={styles.titlebarActions}>
          <SplitSquareHorizontal />
          <Maximize2 />
          <button className={styles.titlebarButton} onClick={() => setPaletteOpen(true)} title="Search"><Search /></button>
          <button className={styles.titlebarButton} onClick={() => setDark((value) => !value)} title="Toggle theme">
            {dark ? <Sun /> : <Moon />}
          </button>
        </div>
      </header>

      <div className={styles.workbench}>
        <aside className={styles.activitybar} aria-label="Activity Bar">
          <button className={`${styles.action}${sidebarView === "explorer" ? ` ${styles.actionActive}` : ""}`} onClick={() => setSidebarView("explorer")} title="Explorer"><FileText /></button>
          <button className={`${styles.action}${sidebarView === "search" ? ` ${styles.actionActive}` : ""}`} onClick={() => setSidebarView("search")} title="Search"><Search /></button>
          <button className={`${styles.action}${sidebarView === "outline" ? ` ${styles.actionActive}` : ""}`} onClick={() => setSidebarView("outline")} title="Outline"><ListTree /></button>
          <div className={styles.activitySpacer} />
          <button className={`${styles.action}${location.pathname === "/login" ? ` ${styles.actionActive}` : ""}`} onClick={() => navigate("/login")} title="Login"><LogIn /></button>
          <button className={`${styles.action}${location.pathname === "/settings" ? ` ${styles.actionActive}` : ""}`} onClick={() => navigate("/settings")} title="Settings"><Settings /></button>
        </aside>

        <aside className={styles.sidebar}>
          <div className={styles.paneHeader}>
            <span>{sidebarView === "explorer" ? "Explorer" : sidebarView === "search" ? "Search" : "Outline"}</span>
            <MoreHorizontal />
          </div>
          {sidebarView === "explorer" ? (
          <>
          <button
            type="button"
            className={`${styles.paneHeader} ${styles.sectionToggle}`}
            aria-expanded={openTabsExpanded}
            onClick={() => setOpenTabsExpanded((value) => !value)}
          >
            {openTabsExpanded ? <ChevronDown /> : <ChevronRight />}
            <span>Open Tab</span>
            <span className={styles.sectionCount}>{openEditorEntries.length}</span>
          </button>
          <div className={`${styles.collapsiblePanel} ${openTabsExpanded ? styles.collapsiblePanelOpen : ""}`}>
            <div className={styles.collapsibleInner}>
              <nav className={styles.openEditors} aria-label="Open tab">
                {openEditorEntries.map(({ group, tab }) => (
                  <button
                    type="button"
                    key={`${group.id}:${tab.id}`}
                    onClick={() => {
                      editorGroups.activate(group.id, tab.id);
                      navigate(tab.href);
                    }}
                    className={`${styles.treeRow} ${styles.treeButton}${group.id === editorGroups.workspace.focusedGroupId && tab.id === group.activeId ? ` ${styles.treeRowActive}` : ""}`}
                  >
                    {tab.kind === "settings" ? <Settings /> : tab.kind === "login" ? <LogIn /> : tab.kind === "welcome" ? <Command /> : <FileText className={styles.accentIcon} />}
                    <span className={styles.truncate}>{tab.label}</span>
                    <span className={`${styles.truncate} ${styles.treeMeta}`}>{tab.detail ?? ""}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
          <button
            type="button"
            className={`${styles.paneHeader} ${styles.sectionToggle}`}
            aria-expanded={blogExpanded}
            onClick={() => {
              if (blogExpanded) setBlogScrollReady(false);
              setBlogExpanded((value) => !value);
            }}
          >
            {blogExpanded ? <ChevronDown /> : <ChevronRight />}
            <span>Blog</span>
            <span className={styles.sectionCount}>{notes.data?.items.length ?? 0}</span>
          </button>
          <div className={`${styles.blogPanel} ${blogExpanded ? styles.blogPanelOpen : ""}`}>
            <nav className={`${styles.fileTree}${blogScrollReady ? ` ${styles.fileTreeScrollable}` : ""}`} aria-label="Article explorer">
              {notes.isLoading ? <div className={styles.treeMessage}>Loading…</div> : null}
              {notes.isError ? <div className={styles.treeMessage}>Unable to load notes</div> : null}
              {notes.data ? <ExplorerTree notes={notes.data.items} /> : null}
            </nav>
          </div>
          </>
          ) : sidebarView === "search" ? (
            <div className={styles.sidePanelBody}>
              <label className={styles.sideSearchBox}>
                <Search />
                <input autoFocus value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search articles" aria-label="Search articles" />
              </label>
              <nav className={styles.sideResults} aria-label="Search results">
                {!searchText.trim() ? <div className={styles.treeMessage}>Type to search articles</div> : null}
                {searchResults.isLoading ? <div className={styles.treeMessage}>Searching…</div> : null}
                {searchResults.isError ? <div className={styles.treeMessage}>Search unavailable</div> : null}
                {searchResults.data?.items.map((note) => (
                  <button key={note.id} type="button" onClick={() => navigate(`/notes/${note.slug}`)} className={styles.searchResult}>
                    <FileText className={styles.accentIcon} />
                    <span>
                      <strong>{note.title || note.path}</strong>
                      <small>{note.path}</small>
                    </span>
                  </button>
                ))}
                {searchResults.data && searchResults.data.items.length === 0 ? <div className={styles.treeMessage}>No results</div> : null}
              </nav>
            </div>
          ) : (
            <nav className={styles.outlinePanel} aria-label="Document outline">
              {!currentSlug ? <div className={styles.treeMessage}>Open an article to view its outline</div> : null}
              {outlineNote.isLoading ? <div className={styles.treeMessage}>Loading outline…</div> : null}
              {outlineHeadings.map((heading) => (
                <button
                  key={heading.id}
                  type="button"
                  className={styles.outlineRow}
                  style={{ paddingLeft: `${0.75 + (heading.level - 1) * 0.75}rem` }}
                  onClick={() => {
                    const group = document.querySelector<HTMLElement>(`[data-editor-group="${CSS.escape(editorGroups.workspace.focusedGroupId)}"]`);
                    if (group) scrollArticleHeading(group, heading.id);
                  }}
                >
                  <Hash />
                  <span>{heading.text}</span>
                </button>
              ))}
              {currentSlug && !outlineNote.isLoading && outlineHeadings.length === 0 ? <div className={styles.treeMessage}>No headings</div> : null}
            </nav>
          )}
        </aside>

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

        <section className={styles.center}>
          <div className={styles.editorWorkspace}>
            <EditorLayout
              node={editorGroups.workspace.layout}
              groups={editorGroups.workspace.groups}
              focusedGroupId={editorGroups.workspace.focusedGroupId}
              actions={editorGroups}
              onBrowse={openExplorer}
            />
          </div>
        </section>
      </div>

      <footer className={styles.statusbar}>
        <div className={styles.statusStart}>
          <span className={styles.statusItem} title="Current user"><UserRound />{session.data?.username ?? "Guest"}</span>
          <span className={styles.statusItem} title="Session status"><ShieldCheck />{session.data?.authenticated ? "Authenticated" : "Visitor"}</span>
          <span className={styles.statusItem} title="Theme preference">{dark ? <Moon /> : <Sun />}{dark ? "Dark" : "Light"}</span>
          <span className={styles.statusItem} title="Local time"><Clock3 />{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div className={styles.statusRight}>
          {editorStatus.publishedAt ? <span className={styles.statusItem} title="Published at">Published {new Date(editorStatus.publishedAt).toLocaleDateString()}</span> : null}
          {editorStatus.viewCount !== undefined ? <span className={styles.statusItem} title="Article views">{editorStatus.viewCount} views</span> : null}
          {editorStatus.progress !== undefined ? <span className={styles.statusItem} title="Reading progress">{editorStatus.progress}%</span> : null}
          {editorStatus.words !== undefined ? <span className={styles.statusItem} title="Word count">{editorStatus.words} words</span> : null}
          {editorStatus.readingMinutes !== undefined ? <span className={styles.statusItem} title="Estimated reading time"><Clock3 />{editorStatus.readingMinutes} min</span> : null}
          {editorStatus.language ? <span className={styles.statusItem}>{editorStatus.language}</span> : null}
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

type EditorActions = ReturnType<typeof useEditorGroups>;

function EditorLayout({ node, groups, focusedGroupId, actions, onBrowse }: {
  node: EditorLayoutNode;
  groups: Record<string, EditorGroupModel>;
  focusedGroupId: string;
  actions: EditorActions;
  onBrowse: () => void;
}) {
  if (node.kind === "split") {
    return (
      <div className={`${styles.layoutSplit} ${node.orientation === "horizontal" ? styles.layoutHorizontal : styles.layoutVertical}`}>
        <div className={styles.layoutPane} style={{ flex: `0 0 ${node.ratio}%` }}>
          <EditorLayout node={node.children[0]} groups={groups} focusedGroupId={focusedGroupId} actions={actions} onBrowse={onBrowse} />
        </div>
        <SplitResizeHandle orientation={node.orientation} ratio={node.ratio} onResize={(ratio) => actions.resize(node.id, ratio)} />
        <div className={styles.layoutPane}>
          <EditorLayout node={node.children[1]} groups={groups} focusedGroupId={focusedGroupId} actions={actions} onBrowse={onBrowse} />
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
        {activeTab ? <EditorContentPlane tab={activeTab} reportStatus={focused} onBrowse={onBrowse} /> : <div className={styles.emptyEditor}>No open editors</div>}
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

function beginSidebarResize(event: ReactPointerEvent<HTMLDivElement>, width: number, setWidth: (width: number) => void) {
  event.preventDefault();
  const startX = event.clientX;
  const workbenchWidth = event.currentTarget.parentElement?.getBoundingClientRect().width || window.innerWidth;
  const maximum = Math.max(180, workbenchWidth - 48 - 240);
  beginPointerResize("col-resize", (pointerEvent) => {
    setWidth(Math.min(maximum, Math.max(180, width + pointerEvent.clientX - startX)));
  });
}

function clampSplitRatio(ratio: number, containerSize: number, minimumPaneSize: number) {
  if (containerSize <= 0) return Math.min(100, Math.max(0, ratio));
  if (containerSize <= minimumPaneSize * 2) return 50;
  const minimumRatio = minimumPaneSize / containerSize * 100;
  return Math.min(100 - minimumRatio, Math.max(minimumRatio, ratio));
}

function measureLayoutRect(element: HTMLElement): LayoutRect {
  let left = 0;
  let top = 0;
  let current: HTMLElement | null = element;
  while (current) {
    left += current.offsetLeft;
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  return {
    top,
    left,
    right: Math.max(0, viewportWidth - left - element.offsetWidth),
    bottom: Math.max(0, viewportHeight - top - element.offsetHeight),
    width: element.offsetWidth,
    height: element.offsetHeight,
  };
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

function EditorTabContent({ tab, reportStatus, onBrowse }: {
  tab: EditorTabModel;
  reportStatus: boolean;
  onBrowse: () => void;
}) {
  if (tab.kind === "welcome") return <WelcomePage workspace onBrowse={onBrowse} />;
  if (tab.kind === "login") return <AdminPage view="login" />;
  if (tab.kind === "settings") return <AdminPage view="settings" />;
  const slug = decodeURIComponent(tab.href.replace(/^\/notes\//, ""));
  return <NotePage slug={slug} reportStatus={reportStatus} />;
}

function EditorContentPlane({ tab, reportStatus, onBrowse }: {
  tab: EditorTabModel;
  reportStatus: boolean;
  onBrowse: () => void;
}) {
  const [displayedTab, setDisplayedTab] = useState(tab);
  const [flip, setFlip] = useState<{ front: EditorTabModel; back: EditorTabModel }>();
  const cachedTabsRef = useRef(new Map<string, EditorTabModel>([[tab.id, tab]]));
  cachedTabsRef.current.set(tab.id, tab);

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
          <EditorTabContent tab={cachedTab} reportStatus={!flip && cachedTab.id === visibleId && reportStatus} onBrowse={onBrowse} />
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
          <EditorTabContent tab={flip.front} reportStatus={false} onBrowse={onBrowse} />
          </div>
          <div className={`${styles.editorFlipFace} ${styles.editorFlipBack}`} data-editor-flip-face="back">
            <EditorTabContent tab={flip.back} reportStatus={false} onBrowse={onBrowse} />
          </div>
        </div>
      </div>
    </div>
  );
}
