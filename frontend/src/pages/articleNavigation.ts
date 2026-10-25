export function scrollArticleHeading(root: ParentNode, id: string) {
  const target = root.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
  const scroller = target?.closest<HTMLElement>("[data-article-scroller]");
  if (!target || !scroller) return;
  const targetRect = target.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const top = Math.max(0, scroller.scrollTop + targetRect.top - scrollerRect.top - 16);
  scroller.scrollTop = top;
}
