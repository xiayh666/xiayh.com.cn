import { useEffect, useRef, useState } from "react";
import type { NavigateFunction } from "react-router-dom";

export type IntroPhase = "intro" | "positioning" | "assembling" | "returning" | "ready";
type LayoutRect = { top: number; right: number; bottom: number; left: number; width: number; height: number };
export type IntroTarget = LayoutRect & {
  sourceTop: number;
  sourceLeft: number;
  sourceWidth: number;
  sourceHeight: number;
  deltaX: number;
  deltaY: number;
  scaleX: number;
  scaleY: number;
};

export function useIntroTransition({ pathname, navigate, focusedGroupId }: {
  pathname: string;
  navigate: NavigateFunction;
  focusedGroupId: string;
}) {
  const [introPhase, setIntroPhase] = useState<IntroPhase>("intro");
  const [fastIntroExit, setFastIntroExit] = useState(false);
  const [introArticleSlug, setIntroArticleSlug] = useState("");
  const [introTarget, setIntroTarget] = useState<IntroTarget>();
  const [homeReturnExpanded, setHomeReturnExpanded] = useState(false);
  const pendingIntroRoute = useRef<string>();

  useEffect(() => {
    if (introPhase !== "intro" || pathname === "/") return;
    navigate("/", { replace: true });
  }, [introPhase, navigate, pathname]);

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
    if (introPhase !== "returning") return;
    const expandTimer = window.setTimeout(() => setHomeReturnExpanded(true), 20);
    const completeTimer = window.setTimeout(() => {
      setIntroPhase("intro");
      setIntroTarget(undefined);
      setHomeReturnExpanded(false);
    }, 920);
    return () => {
      window.clearTimeout(expandTimer);
      window.clearTimeout(completeTimer);
    };
  }, [introPhase]);

  useEffect(() => {
    if (introPhase === "intro" || !pendingIntroRoute.current) return;
    const route = pendingIntroRoute.current;
    pendingIntroRoute.current = undefined;
    navigate(route);
  }, [introPhase, navigate]);

  const enterWorkspace = (fast = false) => {
    const isMobile = window.matchMedia?.("(max-width: 820px)").matches;
    setFastIntroExit(fast || isMobile);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setIntroPhase("ready");
      return;
    }
    setIntroPhase("assembling");
  };

  const closeWorkspace = () => {
    pendingIntroRoute.current = undefined;
    setIntroArticleSlug("");
    setFastIntroExit(false);
    navigate("/", { replace: true });
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setIntroTarget(undefined);
      setIntroPhase("intro");
      return;
    }
    const content = document.querySelector<HTMLElement>(`[data-editor-group="${CSS.escape(focusedGroupId)}"] > main`);
    const source = content ? measureLayoutRect(content) : undefined;
    setIntroTarget(source ? {
      ...source,
      sourceTop: source.top,
      sourceLeft: source.left,
      sourceWidth: source.width,
      sourceHeight: source.height,
      deltaX: 0,
      deltaY: 0,
      scaleX: 1,
      scaleY: 1,
    } : undefined);
    setHomeReturnExpanded(false);
    setIntroPhase("returning");
  };

  const beginHomepageCardTransition = () => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      enterWorkspace(true);
      return;
    }
    const content = document.querySelector<HTMLElement>(`[data-editor-group="${CSS.escape(focusedGroupId)}"] > main`);
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
    if (introPhase === "ready") {
      navigate(route);
      return;
    }
    setIntroArticleSlug(slug);
    pendingIntroRoute.current = route;
    beginHomepageCardTransition();
  };

  return {
    introPhase,
    fastIntroExit,
    introArticleSlug,
    introTarget,
    homeReturnExpanded,
    enterWorkspace,
    closeWorkspace,
    openHomepageNote,
  };
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
