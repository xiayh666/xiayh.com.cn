import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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

export function ExplorerTree({ notes, onOpenNote }: { notes: NoteSummary[]; onOpenNote?: (href: string) => void }) {
  const tree = useMemo(() => buildTree(notes), [notes]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
        onClick={() => {
          if (onOpenNote) onOpenNote(href);
          else navigate(href);
        }}
        onPointerEnter={() => void queryClient.prefetchQuery({
          queryKey: ["note", node.note.slug],
          queryFn: ({ signal }) => api.note(node.note.slug, signal),
          staleTime: 30_000,
        })}
      >
        <span className={styles.treeIndent} />
        <FileText className={styles.accentIcon} />
        <span className={styles.truncate}>{node.name}</span>
      </button>
    );
  });

  return <>{renderNodes(tree, 0)}</>;
}
