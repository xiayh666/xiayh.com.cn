import { describe, expect, it } from "vitest";
import { scrollArticleHeading } from "./NotePage";

describe("scrollArticleHeading", () => {
  it("scrolls only the article scroller", () => {
    const editor = document.createElement("div");
    const scroller = document.createElement("div");
    const article = document.createElement("div");
    const heading = document.createElement("h2");
    scroller.dataset.articleScroller = "";
    heading.id = "target";
    article.append(heading);
    scroller.append(article);
    editor.append(scroller);
    document.body.append(editor);
    scroller.scrollTop = 120;
    scroller.getBoundingClientRect = () => ({ top: 40 } as DOMRect);
    heading.getBoundingClientRect = () => ({ top: 340 } as DOMRect);
    scrollArticleHeading(editor, "target");

    expect(scroller.scrollTop).toBe(404);
    editor.remove();
  });
});
