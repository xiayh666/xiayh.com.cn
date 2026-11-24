import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { preloadArticle } from "../pages/lazyRoutes";
import { api, type NoteSummary } from "../api";
import styles from "./AppLayout.module.css";

type FileNode = { kind: "file"; name: string; path: string; note: NoteSummary };
type FolderNode = { kind: "folder"; name: string; path: string; children: TreeNode[] };
type TreeNode = FileNode | FolderNode;

type MutableFolder = { kind: "folder"; name: string; path: string; children: Map<string, MutableFolder | FileNode> };

function buildTree(notes: NoteSummary[]): TreeNode[] {
  const root: MutableFolder = { kind: "folder", name: "", path: "", children: new Map() };

  for (const note of notes) {
    const parts = note.path.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    let folder = root;
    for (const [index, part] of parts.entries()) {
      const path = parts.slice(0, index + 1).join("/");
      if (index === parts.length - 1) {
        folder.children.set(`file:${part}`, { kind: "file", name: part, path, note });
        continue;
      }
      const key = `folder:${part}`;
      const existing = folder.children.get(key);
      if (existing?.kind === "folder") {
        folder = existing;
      } else {
        const child: MutableFolder = { kind: "folder", name: part, path, children: new Map() };
        folder.children.set(key, child);
        folder = child;
      }
    }
  }

  const finalize = (folder: MutableFolder): TreeNode[] =>
    [...folder.children.values()]
      .map((node): TreeNode => node.kind === "folder" ? { ...node, children: finalize(node) } : node)
      .sort((left, right) => {
        if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
        return left.name.localeCompare(right.name, undefined, { numeric: true });
      });

  return finalize(root);
}

export function ExplorerTree({ notes, onOpenNote, authenticated = false }: { notes: NoteSummary[]; onOpenNote?: (href: string) => void; authenticated?: boolean }) {
  const tree = useMemo(() => buildTree(notes), [notes]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menu, setMenu] = useState<{ node: TreeNode; left: number; top: number }>();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(undefined);
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", key);
    window.addEventListener("blur", close);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", key); window.removeEventListener("blur", close); };
  }, [menu]);

  const openMenu = (event: MouseEvent, node: TreeNode) => {
    if (!authenticated) return;
    event.preventDefault();
    setMenu({ node, left: Math.max(4, Math.min(event.clientX, window.innerWidth - 200)), top: Math.max(4, Math.min(event.clientY, window.innerHeight - 120)) });
  };

  const toggle = (path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderNodes = (nodes: TreeNode[], depth: number): ReactNode => nodes.map((node) => {
    const rowStyle = { "--tree-depth": depth } as CSSProperties;
    if (node.kind === "folder") {
      const isExpanded = expanded.has(node.path);
      return (
        <div key={`folder:${node.path}`}>
          <button
            type="button"
            className={`${styles.treeRow} ${styles.treeButton}`}
            style={rowStyle}
            aria-expanded={isExpanded}
            onContextMenu={(event) => openMenu(event, node)}
            onClick={() => toggle(node.path)}
          >
            {isExpanded ? <ChevronDown /> : <ChevronRight />}
            {isExpanded ? <FolderOpen className={styles.folderIcon} /> : <Folder className={styles.folderIcon} />}
            <span className={styles.truncate}>{node.name}</span>
          </button>
          {isExpanded ? renderNodes(node.children, depth + 1) : null}
        </div>
      );
    }

    const href = `/notes/${node.note.slug}`;
    const active = decodeURIComponent(location.pathname) === href;
    return (
      <button
        type="button"
        key={`file:${node.path}`}
        className={`${styles.treeRow} ${styles.treeButton}${active ? ` ${styles.treeRowActive}` : ""}`}
        style={rowStyle}
        title={node.path}
        onContextMenu={(event) => openMenu(event, node)}
        onClick={() => {
          preloadArticle(queryClient, node.note.slug);
          if (onOpenNote) onOpenNote(href);
          else navigate(href);
        }}
        onPointerEnter={(event) => { if (event.pointerType !== "touch") preloadArticle(queryClient, node.note.slug); }}
        onPointerDown={() => preloadArticle(queryClient, node.note.slug)}
        onFocus={() => preloadArticle(queryClient, node.note.slug)}
      >
        <span className={styles.treeIndent} />
        <FileText className={styles.accentIcon} />
        <span className={styles.truncate}>{node.name}</span>
      </button>
    );
  });

  return <>{renderNodes(tree, 0)}
    {error ? <div className={styles.treeMessage} role="alert">{error}</div> : null}
    {menu ? createPortal(<div className={styles.tabContextMenu} role="menu" aria-label="File actions" style={{ left: menu.left, top: menu.top }} onPointerDown={(event) => event.stopPropagation()}>
      {menu.node.kind === "folder" ? <button type="button" role="menuitem" onClick={() => { navigate(`/new?path=${encodeURIComponent(`${menu.node.path}/`)}`); setMenu(undefined); }}>New article here</button> : <>
        <button type="button" role="menuitem" onClick={() => { const href = `/notes/${menu.node.kind === "file" ? menu.node.note.slug : ""}`; setMenu(undefined); if (onOpenNote) onOpenNote(href); else navigate(href); }}>Open</button>
        <button type="button" role="menuitem" onClick={() => {
          if (menu.node.kind !== "file") return;
          const note = menu.node.note;
          setMenu(undefined);
          if (!window.confirm(`Delete ${note.path}? This permanently removes the source file.`)) return;
          setError("");
          void api.deleteNote(note.id).then(() => queryClient.invalidateQueries({ queryKey: ["notes"] })).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Delete failed"));
        }}>Delete…</button>
      </>}
    </div>, document.body) : null}
  </>;
}
