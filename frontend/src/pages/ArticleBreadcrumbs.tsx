import { ChevronLeft, ChevronRight, FileText, Folder, Hash } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { NoteSummary } from "../api";
import styles from "./ArticleBreadcrumbs.module.css";

export type ArticleHeading = { id: string; text: string; level: number };

type PickerState =
  | { kind: "files"; prefix: string[]; left: number }
  | { kind: "symbols"; left: number };

type FileEntry = { kind: "folder"; name: string } | { kind: "file"; name: string; note: NoteSummary };

export function ArticleBreadcrumbs({
  path,
  notes,
  headings,
  activeHeadingId,
  onSelectHeading,
}: {
  path: string;
  notes: NoteSummary[];
  headings: ArticleHeading[];
  activeHeadingId: string;
  onSelectHeading: (id: string) => void;
}) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const parts = path.split("/").filter(Boolean);
  const activeHeading = headings.find((heading) => heading.id === activeHeadingId) ?? headings[0];

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setPicker(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, []);

  const entries = useMemo<FileEntry[]>(() => {
    if (picker?.kind !== "files") return [];
    const folders = new Set<string>();
    const files: FileEntry[] = [];
    for (const note of notes) {
      const noteParts = note.path.split("/").filter(Boolean);
      if (!picker.prefix.every((part, index) => noteParts[index] === part)) continue;
      const child = noteParts[picker.prefix.length];
      if (!child) continue;
      if (noteParts.length > picker.prefix.length + 1) folders.add(child);
      else files.push({ kind: "file", name: child, note });
    }
    return [
      ...[...folders].sort().map((name): FileEntry => ({ kind: "folder", name })),
      ...files.sort((left, right) => left.name.localeCompare(right.name)),
    ];
  }, [notes, picker]);

  const openFiles = (event: MouseEvent<HTMLButtonElement>, prefix: string[]) => {
    setPicker({ kind: "files", prefix, left: event.currentTarget.offsetLeft });
  };

  const openSymbols = (event: MouseEvent<HTMLButtonElement>) => {
    setPicker({ kind: "symbols", left: event.currentTarget.offsetLeft });
  };

  return (
    <div ref={rootRef} className={styles.breadcrumbs} aria-label="Article breadcrumbs">
      <button type="button" className={styles.crumb} onClick={(event) => openFiles(event, [])}>
        <Folder />
        <span>notes</span>
      </button>
      {parts.map((part, index) => {
        const isFile = index === parts.length - 1;
        const prefix = isFile ? parts.slice(0, -1) : parts.slice(0, index + 1);
        return (
          <span key={`${part}:${index}`} className={styles.crumbGroup}>
            <ChevronRight className={styles.separator} />
            <button type="button" className={styles.crumb} onClick={(event) => openFiles(event, prefix)}>
              {isFile ? <FileText /> : <Folder />}
              <span>{part}</span>
            </button>
          </span>
        );
      })}
      {activeHeading ? (
        <span className={styles.crumbGroup}>
          <ChevronRight className={styles.separator} />
          <button type="button" className={styles.crumb} onClick={openSymbols}>
            <Hash />
            <span>{activeHeading.text}</span>
          </button>
        </span>
      ) : null}

      {picker ? (
        <div className={styles.picker} style={{ left: Math.min(picker.left, 420) }} role="menu">
          {picker.kind === "files" ? (
            <>
              <div className={styles.pickerHeader}>
                {picker.prefix.length > 0 ? (
                  <button type="button" aria-label="Parent folder" onClick={() => setPicker({ ...picker, prefix: picker.prefix.slice(0, -1) })}>
                    <ChevronLeft />
                  </button>
                ) : null}
                <span>{picker.prefix.length ? picker.prefix.join(" / ") : "notes"}</span>
              </div>
              <div className={styles.pickerList}>
                {entries.map((entry) => entry.kind === "folder" ? (
                  <button key={`folder:${entry.name}`} type="button" role="menuitem" onClick={() => setPicker({ ...picker, prefix: [...picker.prefix, entry.name] })}>
                    <Folder className={styles.folderIcon} />
                    <span>{entry.name}</span>
                    <ChevronRight />
                  </button>
                ) : (
                  <button key={entry.note.slug} type="button" role="menuitem" onClick={() => {
                    setPicker(null);
                    navigate(`/notes/${entry.note.slug}`);
                  }}>
                    <FileText className={styles.fileIcon} />
                    <span>{entry.name}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className={styles.pickerList}>
              {headings.map((heading) => (
                <button
                  key={heading.id}
                  type="button"
                  role="menuitem"
                  className={heading.id === activeHeadingId ? styles.selected : undefined}
                  style={{ paddingLeft: `${0.75 + (heading.level - 1) * 0.75}rem` }}
                  onClick={() => {
                    setPicker(null);
                    onSelectHeading(heading.id);
                  }}
                >
                  <Hash />
                  <span>{heading.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
