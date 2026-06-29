import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import styles from "./VscodeScrollbars.module.css";

type Thumb = { left: number; top: number; width: number; height: number };
type Metrics = { element: HTMLElement; vertical?: Thumb; horizontal?: Thumb };
type Drag = { axis: "vertical" | "horizontal"; start: number; scrollStart: number };

function isScrollable(element: HTMLElement) {
  const style = getComputedStyle(element);
  const vertical = /(auto|scroll|overlay)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
  const horizontal = /(auto|scroll|overlay)/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
  return vertical || horizontal;
}

function findScrollable(target: EventTarget | null) {
  let element = target instanceof HTMLElement ? target : null;
  while (element && element !== document.body) {
    if (isScrollable(element)) return element;
    element = element.parentElement;
  }
  return null;
}

function measure(element: HTMLElement): Metrics {
  const rect = element.getBoundingClientRect();
  const hasVertical = element.scrollHeight > element.clientHeight + 1;
  const hasHorizontal = element.scrollWidth > element.clientWidth + 1;
  const compactHorizontal = element.getAttribute("aria-label") === "Editor tabs";
  const verticalSize = 10;
  const horizontalSize = compactHorizontal ? 3 : 10;
  const verticalTrack = Math.max(0, rect.height - (hasHorizontal ? horizontalSize : 0));
  const horizontalTrack = Math.max(0, rect.width - (hasVertical ? verticalSize : 0));
  const verticalLength = Math.max(20, verticalTrack * element.clientHeight / element.scrollHeight);
  const horizontalLength = Math.max(20, horizontalTrack * element.clientWidth / element.scrollWidth);
  const verticalRange = Math.max(1, element.scrollHeight - element.clientHeight);
  const horizontalRange = Math.max(1, element.scrollWidth - element.clientWidth);
  return {
    element,
    vertical: hasVertical ? {
      left: rect.right - verticalSize,
      top: rect.top + (verticalTrack - verticalLength) * element.scrollTop / verticalRange,
      width: verticalSize,
      height: Math.min(verticalTrack, verticalLength),
    } : undefined,
    horizontal: hasHorizontal ? {
      left: rect.left + (horizontalTrack - horizontalLength) * element.scrollLeft / horizontalRange,
      top: rect.bottom - horizontalSize,
      width: Math.min(horizontalTrack, horizontalLength),
      height: horizontalSize,
    } : undefined,
  };
}

export function VscodeScrollbars() {
  const activeRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const hoveredRef = useRef(false);
  const hideTimerRef = useRef<number>();
  const unmountTimerRef = useRef<number>();
  const showFrameRef = useRef(0);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);

  const update = useCallback(() => {
    const element = activeRef.current;
    if (element?.isConnected && isScrollable(element)) setMetrics(measure(element));
  }, []);

  const reveal = useCallback(() => {
    window.clearTimeout(hideTimerRef.current);
    window.clearTimeout(unmountTimerRef.current);
    setRendered(true);
    cancelAnimationFrame(showFrameRef.current);
    showFrameRef.current = requestAnimationFrame(() => setVisible(true));
  }, []);

  const scheduleHide = useCallback(() => {
    window.clearTimeout(hideTimerRef.current);
    window.clearTimeout(unmountTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      unmountTimerRef.current = window.setTimeout(() => setRendered(false), 640);
    }, 500);
  }, []);

  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (dragRef.current) return;
      if ((event.target as Element | null)?.closest?.("[data-scrollbar-overlay]")) return;
      const next = findScrollable(event.target);
      if (!next) {
        if (hoveredRef.current) {
          hoveredRef.current = false;
          scheduleHide();
        }
        return;
      }
      if (!hoveredRef.current) {
        hoveredRef.current = true;
        reveal();
      }
      activeRef.current = next;
      schedule();
    };
    const onScroll = (event: Event) => {
      const element = event.target instanceof HTMLElement && isScrollable(event.target) ? event.target : activeRef.current;
      if (!element) return;
      activeRef.current = element;
      reveal();
      schedule();
      if (!hoveredRef.current && !dragRef.current) scheduleHide();
    };
    const onResize = () => schedule();
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(showFrameRef.current);
      window.clearTimeout(hideTimerRef.current);
      window.clearTimeout(unmountTimerRef.current);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [reveal, scheduleHide, update]);

  const beginDrag = (axis: Drag["axis"], event: ReactPointerEvent<HTMLDivElement>) => {
    const element = activeRef.current;
    if (!element) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      axis,
      start: axis === "vertical" ? event.clientY : event.clientX,
      scrollStart: axis === "vertical" ? element.scrollTop : element.scrollLeft,
    };
    document.body.style.userSelect = "none";
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const current = metrics;
    if (!drag || !current) return;
    const element = current.element;
    if (drag.axis === "vertical" && current.vertical) {
      const track = element.clientHeight - (current.horizontal?.height ?? 0);
      const ratio = (element.scrollHeight - element.clientHeight) / Math.max(1, track - current.vertical.height);
      element.scrollTop = drag.scrollStart + (event.clientY - drag.start) * ratio;
    } else if (drag.axis === "horizontal" && current.horizontal) {
      const track = element.clientWidth - (current.vertical?.width ?? 0);
      const ratio = (element.scrollWidth - element.clientWidth) / Math.max(1, track - current.horizontal.width);
      element.scrollLeft = drag.scrollStart + (event.clientX - drag.start) * ratio;
    }
    setMetrics(measure(element));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    document.body.style.userSelect = "";
  };

  const thumb = (axis: Drag["axis"], value: Thumb | undefined) => value && rendered ? (
    <div
      data-scrollbar-overlay
      className={`${styles.thumb}${visible ? ` ${styles.visible}` : ""}`}
      style={{ left: value.left, top: value.top, width: value.width, height: value.height } as CSSProperties}
      onPointerDown={(event) => beginDrag(axis, event)}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  ) : null;

  return (
    <div className={styles.layer} data-scrollbar-overlay aria-hidden="true">
      {thumb("vertical", metrics?.vertical)}
      {thumb("horizontal", metrics?.horizontal)}
    </div>
  );
}
