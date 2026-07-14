import type { NoteSummary } from "../api";

export type BlogActivityDay = { date: string; label: string; words: number; level: number; empty: boolean };
export type BlogActivityWeek = { key: string; days: BlogActivityDay[] };
export type BlogActivityMonth = { label: string; column: number; span: number };
export type BlogActivity = { weeks: BlogActivityWeek[]; months: BlogActivityMonth[]; totalWords: number };

export function buildBlogArchiveActivity(notes: NoteSummary[], todayInput = new Date()): BlogActivity {
  const today = startOfLocalDay(todayInput);
  const rangeStart = addLocalDays(today, -364);
  const calendarStart = addLocalDays(rangeStart, -rangeStart.getDay());
  const calendarEnd = addLocalDays(today, 6 - today.getDay());
  const counts = new Map<string, number>();

  for (const note of notes) {
    const timestamp = Date.parse(note.publishedAt || note.updatedAt);
    if (!Number.isFinite(timestamp)) continue;
    const date = startOfLocalDay(new Date(timestamp));
    if (date < rangeStart || date > today) continue;
    const key = localDateKey(date);
    counts.set(key, (counts.get(key) ?? 0) + Math.max(0, note.wordCount ?? 0));
  }

  const maxWords = Math.max(0, ...counts.values());
  const weeks: BlogActivityWeek[] = [];
  const months: BlogActivityMonth[] = [];
  const monthFormatter = new Intl.DateTimeFormat("en", { month: "short" });
  let current = new Date(calendarStart);
  let lastMonth = "";
  let column = 0;

  while (current <= calendarEnd) {
    const weekStart = new Date(current);
    const days = Array.from({ length: 7 }, (_, dayIndex): BlogActivityDay => {
      const date = addLocalDays(weekStart, dayIndex);
      const key = localDateKey(date);
      const inRange = date >= rangeStart && date <= today;
      const words = inRange ? counts.get(key) ?? 0 : 0;
      return {
        date: key,
        label: formatActivityDate(date),
        words,
        level: inRange ? activityLevel(words, maxWords) : 0,
        empty: !inRange,
      };
    });
    const firstVisibleDay = days.find((day) => !day.empty);
    if (firstVisibleDay) {
      const firstDate = new Date(`${firstVisibleDay.date}T00:00:00`);
      const monthKey = `${firstDate.getFullYear()}-${firstDate.getMonth()}`;
      if (monthKey !== lastMonth) {
        months.push({ label: monthFormatter.format(firstDate), column, span: 4 });
        lastMonth = monthKey;
      }
    }
    weeks.push({ key: localDateKey(weekStart), days });
    current = addLocalDays(current, 7);
    column += 1;
  }

  return { weeks, months, totalWords: [...counts.values()].reduce((sum, count) => sum + count, 0) };
}

export function formatWordCount(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value);
}

function activityLevel(words: number, maxWords: number) {
  if (words <= 0 || maxWords <= 0) return 0;
  const ratio = words / maxWords;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addLocalDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function localDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatActivityDate(value: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(value);
}
