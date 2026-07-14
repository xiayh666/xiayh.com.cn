import type { NoteSummary } from "../api";
import { buildBlogArchiveActivity, formatWordCount } from "./blogActivity";
import styles from "./WelcomePage.module.css";

export function BlogArchiveOverview({ notes, onOpenNote }: {
  notes: NoteSummary[];
  onOpenNote: (slug: string) => void;
}) {
  const activity = buildBlogArchiveActivity(notes);
  const readTrace = [...notes]
    .sort((left, right) => right.viewCount - left.viewCount || Date.parse(right.publishedAt || right.updatedAt) - Date.parse(left.publishedAt || left.updatedAt))
    .slice(0, 6);

  return (
    <section className={styles.blogArchive} aria-label="博客概览">
      <header className={styles.blogArchiveHeader}>
        <span>BLOG ARCHIVE.</span>
        <small>INDEX / PUBLIC NOTES</small>
      </header>
      <div className={styles.blogArchiveIndex}>
        <span>READ TRACE.</span>
        <ol>
          {readTrace.map((note, index) => (
            <li key={note.id}>
              <button type="button" onClick={() => onOpenNote(note.slug)}>
                <i>{String(index + 1).padStart(2, "0")}</i>
                <b>{note.title}</b>
                <small>{formatWordCount(note.viewCount)}</small>
              </button>
            </li>
          ))}
          {!readTrace.length ? <li><span><i>00</i><b>WAITING FOR DATA</b><small>—</small></span></li> : null}
        </ol>
      </div>
      <div className={styles.blogArchiveActivity}>
        <header>
          <span>WRITING ACTIVITY.</span>
          <small>{formatWordCount(activity.totalWords)} WORDS / LAST 12 MONTHS</small>
        </header>
        <div className={styles.activityCalendar} aria-label="最近十二个月文章发布频率热力图">
          <div
            className={styles.activityMonths}
            style={{ gridTemplateColumns: `repeat(${activity.weeks.length}, minmax(0, 1fr))` }}
            aria-hidden="true"
          >
            {activity.months.map((month) => <span key={`${month.label}-${month.column}`} style={{ gridColumn: `${month.column + 1} / span ${month.span}` }}>{month.label}</span>)}
          </div>
          <div className={styles.activityWeekdays} aria-hidden="true">
            <span />
            <span>Mon</span>
            <span />
            <span>Wed</span>
            <span />
            <span>Fri</span>
            <span />
          </div>
          <div
            className={styles.activityGrid}
            style={{ gridTemplateColumns: `repeat(${activity.weeks.length}, minmax(0, 1fr))` }}
          >
            {activity.weeks.map((week) => (
              <div key={week.key} className={styles.activityWeek}>
                {week.days.map((day) => (
                  <span
                    key={day.date}
                    data-level={day.level}
                    data-empty={day.empty ? "true" : undefined}
                    title={`${day.label}: ${formatWordCount(day.words)} words`}
                    aria-label={`${day.label}: ${formatWordCount(day.words)} words`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <footer className={styles.activityLegend} aria-hidden="true">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => <i key={level} data-level={level} />)}
          <span>More</span>
        </footer>
      </div>
    </section>
  );
}
