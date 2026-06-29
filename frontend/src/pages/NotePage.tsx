import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useSetEditorStatus } from "../shell/EditorStatusContext";
import { ArticleBreadcrumbs, type ArticleHeading } from "./ArticleBreadcrumbs";
import styles from "./NotePage.module.css";

export function NotePage({ slug: slugOverride, reportStatus = true }: { slug?: string; reportStatus?: boolean } = {}) {
  const params = useParams();
  const navigate = useNavigate();
  const slug = slugOverride ?? params["*"] ?? "";
  const noteQuery = useQuery({ queryKey: ["note", slug], queryFn: ({ signal }) => api.note(slug, signal), enabled: slug.length > 0 });
  const notesQuery = useQuery({ queryKey: ["notes"], queryFn: api.notes });
  const [headings, setHeadings] = useState<ArticleHeading[]>([]);
  const [activeHeadingId, setActiveHeadingId] = useState("");
  const [viewCount, setViewCount] = useState<number>();
  const articleRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const setEditorStatus = useSetEditorStatus();

  const note = noteQuery.data;
  const articleHtml = useMemo(() => note ? replaceArticleAnchors(note.html) : "", [note]);
  const summary = notesQuery.data?.items.find((item) => item.slug === slug);
  const pendingPath = summary?.path ?? `${slug}.md`;

  useEffect(() => {
    if (!note) return;
    setViewCount(note.viewCount);
    const storageKey = `viewed:${note.slug}`;
    let shouldRecord = true;
    try {
      shouldRecord = sessionStorage.getItem(storageKey) !== "1";
      if (shouldRecord) sessionStorage.setItem(storageKey, "1");
    } catch {
      // Storage may be unavailable in privacy-restricted contexts.
    }
    if (shouldRecord) {
      void api.recordView(note.slug).then((result) => setViewCount(result.viewCount)).catch(() => undefined);
    }
  }, [note]);

  useEffect(() => {
    if (!note || !articleRef.current || !scrollerRef.current) return;
    const elements = [...articleRef.current.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")];
    const nextHeadings = elements.map((element, index) => {
      const text = element.textContent?.trim() || `Section ${index + 1}`;
      const suffix = text.toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-|-$/g, "") || "heading";
      const id = `section-${index}-${suffix}`;
      element.id = id;
      return { id, text, level: Number(element.tagName.slice(1)) };
    });
    setHeadings(nextHeadings);

    const scroller = scrollerRef.current;
    const content = articleRef.current.textContent ?? "";
    const cjkCount = content.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)?.length ?? 0;
    const wordCount = cjkCount + (content.match(/[\p{Letter}\p{Number}]+/gu)?.filter((word) => !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(word)).length ?? 0);
    const readingMinutes = Math.max(1, Math.ceil(wordCount / 300));
    let frame = 0;
    const updateActiveHeading = () => {
      frame = 0;
      const threshold = scroller.scrollTop + 72;
      let current = nextHeadings[0]?.id ?? "";
      for (const [index, element] of elements.entries()) {
        if (element.offsetTop > threshold) break;
        current = nextHeadings[index]?.id ?? current;
      }
      setActiveHeadingId((value) => value === current ? value : current);
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      const progress = maxScroll > 0 ? Math.round((scroller.scrollTop / maxScroll) * 100) : 100;
      const currentHeading = nextHeadings.find((heading) => heading.id === current)?.text ?? note.title;
      if (reportStatus) {
        setEditorStatus({
          label: currentHeading,
          publishedAt: note.publishedAt,
          viewCount: viewCount ?? note.viewCount,
          progress,
          words: wordCount,
          readingMinutes,
          language: "Markdown",
        });
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(updateActiveHeading);
    };
    frame = requestAnimationFrame(updateActiveHeading);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [note, reportStatus, setEditorStatus, viewCount]);

  const selectHeading = (id: string) => {
    if (articleRef.current) scrollArticleHeading(articleRef.current, id);
    setActiveHeadingId(id);
  };

  const handleArticleNavigation = (event: MouseEvent<HTMLDivElement>) => {
    const target = (event.target as Element).closest<HTMLButtonElement>("button[data-article-href]");
    const href = target?.dataset.articleHref;
    if (!href) return;
    if (href.startsWith("#")) {
      if (articleRef.current) scrollArticleHeading(articleRef.current, href.slice(1));
      return;
    }
    const url = new URL(href, window.location.href);
    if (url.origin === window.location.origin) navigate(`${url.pathname}${url.search}${url.hash}`);
    else window.open(url.href, "_blank", "noopener,noreferrer");
  };

  if (noteQuery.isError) return <div className={styles.message}>Note not found.</div>;

  return (
    <article className={styles.page} aria-busy={!note}>
      <ArticleBreadcrumbs
        path={note?.path ?? pendingPath}
        notes={notesQuery.data?.items ?? []}
        headings={headings}
        activeHeadingId={activeHeadingId}
        onSelectHeading={selectHeading}
      />
      <div ref={scrollerRef} className={styles.scroller} data-article-scroller>
        {note ? (
          <div
            key={note.slug}
            ref={articleRef}
            className={`prose-view ${styles.article} ${styles.articleEnter}`}
            onClick={handleArticleNavigation}
            dangerouslySetInnerHTML={{ __html: articleHtml }}
          />
        ) : (
          <div className={styles.loadingDocument} role="status" aria-label="Loading article">
            <span className={styles.loadingBar} />
            <div className={styles.loadingFile}>
              <FileText />
              <span>{pendingPath.split("/").at(-1)}</span>
            </div>
            <div className={styles.skeletonTitle} />
            <div className={styles.skeletonLine} />
            <div className={styles.skeletonLine} />
            <div className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
            <div className={styles.skeletonBlock} />
            <div className={styles.skeletonLine} />
            <div className={`${styles.skeletonLine} ${styles.skeletonMedium}`} />
          </div>
        )}
      </div>
    </article>
  );
}

function replaceArticleAnchors(html: string) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  for (const anchor of parsed.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const button = parsed.createElement("button");
    button.type = "button";
    button.className = "article-link";
    button.dataset.articleHref = anchor.getAttribute("href") ?? "";
    button.innerHTML = anchor.innerHTML;
    if (anchor.title) button.title = anchor.title;
    anchor.replaceWith(button);
  }
  return parsed.body.innerHTML;
}

export function scrollArticleHeading(root: ParentNode, id: string) {
  const target = root.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
  const scroller = target?.closest<HTMLElement>("[data-article-scroller]");
  if (!target || !scroller) return;
  const targetRect = target.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const top = Math.max(0, scroller.scrollTop + targetRect.top - scrollerRect.top - 16);
  scroller.scrollTop = top;
}
