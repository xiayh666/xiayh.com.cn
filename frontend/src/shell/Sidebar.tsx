import type { Dispatch, SetStateAction } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Command, FilePlus2, FileText, Hash, LogIn, MoreHorizontal, Search, Settings } from "lucide-react";
import type { Note, NoteSummary } from "../api";
import { ExplorerTree } from "./ExplorerTree";
import type { EditorTabModel } from "./EditorTabs";
import type { EditorGroupModel } from "./useEditorGroups";
import styles from "./AppLayout.module.css";

type SidebarView = "explorer" | "search" | "outline";
type OutlineHeading = { id: string; text: string; level: number };
type OpenEditorEntry = { group: EditorGroupModel; tab: EditorTabModel };

export function Sidebar({ sidebarView, authenticated, openTabsExpanded, setOpenTabsExpanded, blogExpanded, setBlogExpanded, blogScrollReady, setBlogScrollReady, openEditorEntries, focusedGroupId, activateTab, navigate, notes, searchText, setSearchText, searchResults, currentSlug, outlineNote, outlineHeadings, scrollHeading, openNoteFromSidebar }: {
  sidebarView: SidebarView;
  authenticated: boolean;
  openTabsExpanded: boolean;
  setOpenTabsExpanded: Dispatch<SetStateAction<boolean>>;
  blogExpanded: boolean;
  setBlogExpanded: Dispatch<SetStateAction<boolean>>;
  blogScrollReady: boolean;
  setBlogScrollReady: Dispatch<SetStateAction<boolean>>;
  openEditorEntries: OpenEditorEntry[];
  focusedGroupId: string;
  activateTab: (groupId: string, tabId: string) => void;
  navigate: (path: string) => void;
  notes: UseQueryResult<{ items: NoteSummary[] }>;
  searchText: string;
  setSearchText: Dispatch<SetStateAction<string>>;
  searchResults: UseQueryResult<{ items: NoteSummary[] }>;
  currentSlug: string;
  outlineNote: UseQueryResult<Note>;
  outlineHeadings: OutlineHeading[];
  scrollHeading: (headingId: string) => void;
  openNoteFromSidebar: (href: string) => void;
}) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.paneHeader}>
        <span>{sidebarView === "explorer" ? "Explorer" : sidebarView === "search" ? "Search" : "Outline"}</span>
        {sidebarView === "explorer" && authenticated ? <button type="button" className={styles.paneHeaderAction} onClick={() => navigate("/new")} title="New article"><FilePlus2 /></button> : <MoreHorizontal />}
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
                  activateTab(group.id, tab.id);
                  navigate(tab.href);
                }}
                className={`${styles.treeRow} ${styles.treeButton}${group.id === focusedGroupId && tab.id === group.activeId ? ` ${styles.treeRowActive}` : ""}`}
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
          {notes.data ? <ExplorerTree notes={notes.data.items} onOpenNote={openNoteFromSidebar} /> : null}
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
              <button key={note.id} type="button" onClick={() => openNoteFromSidebar(`/notes/${note.slug}`)} className={styles.searchResult}>
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
              onClick={() => scrollHeading(heading.id)}
            >
              <Hash />
              <span>{heading.text}</span>
            </button>
          ))}
          {currentSlug && !outlineNote.isLoading && outlineHeadings.length === 0 ? <div className={styles.treeMessage}>No headings</div> : null}
        </nav>
      )}
    </aside>
  );
}
