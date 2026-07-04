import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useNotify } from "../shell/SystemNotifications";

export function useCodeCopyFeedback(rootRef: RefObject<HTMLElement | null>) {
  const resetTimerRef = useRef<number>();
  const buttonRef = useRef<HTMLButtonElement>();
  const notify = useNotify();

  const handleCopy = useCallback(() => {
    const focused = document.activeElement;
    const button = focused instanceof HTMLButtonElement && focused.classList.contains("copy-button") && rootRef.current?.contains(focused)
      ? focused
      : rootRef.current?.querySelector<HTMLButtonElement>(".copy-button:hover");

    if (buttonRef.current && buttonRef.current !== button) delete buttonRef.current.dataset.copyState;
    if (button) {
      button.dataset.copyState = "success";
      buttonRef.current = button;
    }
    notify({ title: "Copied", message: "Code copied to clipboard", tone: "success", archive: false });
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => {
      if (buttonRef.current) delete buttonRef.current.dataset.copyState;
      buttonRef.current = undefined;
    }, 1800);
  }, [notify, rootRef]);

  useEffect(() => () => {
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    if (buttonRef.current) delete buttonRef.current.dataset.copyState;
  }, []);

  return { handleCopy };
}
