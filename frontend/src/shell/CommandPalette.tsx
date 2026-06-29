import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import styles from "./CommandPalette.module.css";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const results = useQuery({
    queryKey: ["search", query],
    queryFn: () => api.search(query),
    enabled: open && query.trim().length > 0,
  });

  if (!open) return null;

  return (
    <div className={styles.backdrop} onMouseDown={() => onOpenChange(false)}>
      <Command
        className={styles.palette}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.inputRow}>
          <Search />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            autoFocus
            placeholder="Search notes"
            className={styles.input}
          />
        </div>
        <Command.List className={styles.results}>
          <Command.Empty className={styles.empty}>No results</Command.Empty>
          {(results.data?.items ?? []).map((note) => (
            <Command.Item
              key={note.id}
              value={`${note.title} ${note.path}`}
              className={styles.item}
              onSelect={() => {
                navigate(`/notes/${note.slug}`);
                onOpenChange(false);
              }}
            >
              <div className={styles.itemTitle}>{note.title || note.path}</div>
              <div className={styles.itemSummary}>{note.summary || note.path}</div>
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
