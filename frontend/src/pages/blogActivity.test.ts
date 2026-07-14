import { describe, expect, it } from "vitest";
import type { NoteSummary } from "../api";
import { buildBlogArchiveActivity } from "./blogActivity";

function note(id: number, date: string, words: number): NoteSummary {
  return {
    id,
    path: `notes/${id}.md`,
    slug: `notes-${id}`,
    title: `Note ${id}`,
    summary: "",
    type: "markdown",
    visibility: "public",
    published: true,
    pinned: false,
    status: "active",
    updatedAt: date,
    publishedAt: date,
    viewCount: 0,
    wordCount: words,
    previewPath: "",
  };
}

describe("buildBlogArchiveActivity", () => {
  // 验证同一天多篇文章会按字数合并，并按最大字数映射热力等级。
  it("aggregates word counts by day and maps heat levels", () => {
    const activity = buildBlogArchiveActivity([
      note(1, "2026-07-14T04:00:00.000Z", 400),
      note(2, "2026-07-14T08:00:00.000Z", 600),
      note(3, "2026-07-13T08:00:00.000Z", 250),
      note(4, "2025-01-01T08:00:00.000Z", 9999),
    ], new Date("2026-07-14T12:00:00"));

    const days = activity.weeks.flatMap((week) => week.days);
    expect(activity.totalWords).toBe(1250);
    expect(days.find((day) => day.date === "2026-07-14")).toMatchObject({ words: 1000, level: 4, empty: false });
    expect(days.find((day) => day.date === "2026-07-13")).toMatchObject({ words: 250, level: 1, empty: false });
    expect(days.find((day) => day.date === "2025-01-01")).toBeUndefined();
  });
});
