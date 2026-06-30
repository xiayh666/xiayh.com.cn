import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import styles from "./AppLayout.module.css";

export type TopMenuItem = {
  label: string;
  shortcut?: string;
  action?: () => void;
  disabled?: boolean;
  checked?: boolean;
  separatorBefore?: boolean;
};

export type TopMenuDefinition = {
  label: string;
  items: TopMenuItem[];
};

export function TopMenu({ menus }: { menus: TopMenuDefinition[] }) {
  const [openIndex, setOpenIndex] = useState<number>();
  const rootRef = useRef<HTMLElement>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (openIndex === undefined) return;
    const close = (event?: Event) => {
      if (event?.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setOpenIndex(undefined);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      const index = openIndex;
      setOpenIndex(undefined);
      buttonRefs.current[index]?.focus();
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
  }, [openIndex]);

  const focusMenuItem = (menuIndex: number, edge: "first" | "last" = "first") => {
    window.requestAnimationFrame(() => {
      const items = rootRef.current?.querySelectorAll<HTMLButtonElement>(`[data-menu-index="${menuIndex}"] [role^="menuitem"]:not(:disabled)`);
      const target = edge === "first" ? items?.[0] : items?.[Math.max(0, (items?.length ?? 1) - 1)];
      target?.focus();
    });
  };

  const switchMenu = (current: number, direction: -1 | 1, focusItems: boolean) => {
    const next = (current + direction + menus.length) % menus.length;
    setOpenIndex(next);
    if (focusItems) focusMenuItem(next);
    else window.requestAnimationFrame(() => buttonRefs.current[next]?.focus());
  };

  const onTopKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      switchMenu(index, event.key === "ArrowRight" ? 1 : -1, openIndex !== undefined);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpenIndex(index);
      focusMenuItem(index);
      return;
    }
    if (event.key === "Escape") setOpenIndex(undefined);
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>, menuIndex: number) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role^='menuitem']:not(:disabled)")];
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const offset = event.key === "ArrowDown" ? 1 : -1;
      items[(current + offset + items.length) % items.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      switchMenu(menuIndex, event.key === "ArrowRight" ? 1 : -1, true);
    } else if (event.key === "Tab") {
      setOpenIndex(undefined);
    }
  };

  return (
    <nav ref={rootRef} className={styles.menu} aria-label="Application menu">
      {menus.map((menu, index) => {
        const open = openIndex === index;
        return (
          <div key={menu.label} className={styles.menuGroup} data-menu-index={index}>
            <button
              ref={(node) => { buttonRefs.current[index] = node; }}
              type="button"
              className={`${styles.menuButton}${open ? ` ${styles.menuButtonOpen}` : ""}`}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => {
                setOpenIndex((value) => value === index ? undefined : index);
                if (!open) focusMenuItem(index);
              }}
              onMouseEnter={() => { if (openIndex !== undefined) setOpenIndex(index); }}
              onKeyDown={(event) => onTopKeyDown(event, index)}
            >
              {menu.label}
            </button>
            {open ? (
              <div className={styles.topMenuPopup} role="menu" aria-label={`${menu.label} menu`} onKeyDown={(event) => onMenuKeyDown(event, index)}>
                {menu.items.map((item, itemIndex) => (
                  <span key={`${item.label}:${itemIndex}`} className={styles.topMenuItemHost}>
                    {item.separatorBefore ? <i className={styles.topMenuSeparator} aria-hidden="true" /> : null}
                    <button
                      type="button"
                      role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                      aria-checked={item.checked === undefined ? undefined : item.checked}
                      disabled={item.disabled}
                      onClick={() => {
                        setOpenIndex(undefined);
                        item.action?.();
                      }}
                    >
                      <span className={styles.topMenuCheck}>{item.checked ? "✓" : ""}</span>
                      <span>{item.label}</span>
                      {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
