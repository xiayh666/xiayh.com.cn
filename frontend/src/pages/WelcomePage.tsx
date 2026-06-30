import { useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, BookOpen, FolderGit2, Github, Mail, MessageCircle, MessageSquareText, Music2, Pause, Terminal, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, type NoteSummary, type SiteStats } from "../api";
import { PixelAssembly } from "./PixelAssembly";
import styles from "./WelcomePage.module.css";

const commands = ["whoami", "ls ./notes", "cat ./current-focus.md"];
const commandOutput = ["xiayh — developer / builder / writer", "C++   backend   web", "building systems that remain understandable"];
const modelNames = ["ARCH LINUX", "MINECRAFT", "REDSTONE", "STM32"];
const profile = {
  name: import.meta.env.VITE_PROFILE_NAME?.trim() || "Xiayh",
  avatar: import.meta.env.VITE_PROFILE_AVATAR?.trim() || "https://github.com/xiayh666.png?size=160",
  email: import.meta.env.VITE_PROFILE_EMAIL?.trim() || "NOT PUBLIC",
  qq: import.meta.env.VITE_PROFILE_QQ?.trim() || "NOT PUBLIC",
  wechat: import.meta.env.VITE_PROFILE_WECHAT?.trim() || "NOT PUBLIC",
};

function useTerminalTyping(active: boolean) {
  const [state, setState] = useState({ command: 0, length: active ? 0 : commands[0].length, deleting: false });

  useEffect(() => {
    if (!active || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const text = commands[state.command];
    const complete = state.length === text.length;
    const empty = state.length === 0;
    const delay = complete && !state.deleting ? 1450 : empty && state.deleting ? 260 : state.deleting ? 32 : 72;
    const timer = window.setTimeout(() => {
      if (complete && !state.deleting) setState((value) => ({ ...value, deleting: true }));
      else if (empty && state.deleting) setState({ command: (state.command + 1) % commands.length, length: 0, deleting: false });
      else setState((value) => ({ ...value, length: value.length + (value.deleting ? -1 : 1) }));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [active, state]);

  return {
    text: commands[state.command].slice(0, state.length),
    output: state.length === commands[state.command].length && !state.deleting ? commandOutput[state.command] : "\u00a0",
  };
}

function useClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const readPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  const year = Number(readPart("year"));
  const month = Number(readPart("month"));
  const day = Number(readPart("day"));
  const hours = Number(readPart("hour"));
  const minutes = Number(readPart("minute"));
  const seconds = Number(readPart("second"));
  const secondsInDay = hours * 3600 + minutes * 60 + seconds;
  const dayProgress = secondsInDay / 86_400;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const daysInYear = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000;
  const dayOfYear = Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86_400_000) + 1;
  const progress = [
    { label: "YEAR", value: ((dayOfYear - 1 + dayProgress) / daysInYear) * 100 },
    { label: "MONTH", value: ((day - 1 + dayProgress) / daysInMonth) * 100 },
    { label: "DAY", value: (secondsInDay / 86_400) * 100 },
    { label: "HOUR", value: ((minutes * 60 + seconds) / 3600) * 100 },
    { label: "MIN", value: (seconds / 60) * 100 },
  ];
  return {
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
    year: readPart("year"),
    month: readPart("month"),
    day: readPart("day"),
    weekday: new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", weekday: "short" }).format(now).toUpperCase(),
    progress,
  };
}

function useAmbientMusic() {
  const [playing, setPlaying] = useState(false);
  const contextRef = useRef<AudioContext>();
  const timerRef = useRef<number>();

  const stop = () => {
    window.clearInterval(timerRef.current);
    timerRef.current = undefined;
    const context = contextRef.current;
    contextRef.current = undefined;
    if (context) void context.close();
    setPlaying(false);
  };

  const start = async () => {
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = 0.035;
    master.connect(context.destination);
    contextRef.current = context;

    const scheduleCycle = () => {
      if (context.state === "closed") return;
      const startAt = context.currentTime + 0.04;
      [220, 277.18, 329.63, 415.3].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        const noteAt = startAt + index * 0.72;
        oscillator.type = index % 2 ? "triangle" : "sine";
        oscillator.frequency.value = frequency;
        envelope.gain.setValueAtTime(0.0001, noteAt);
        envelope.gain.exponentialRampToValueAtTime(0.18, noteAt + 0.08);
        envelope.gain.exponentialRampToValueAtTime(0.0001, noteAt + 1.05);
        oscillator.connect(envelope);
        envelope.connect(master);
        oscillator.start(noteAt);
        oscillator.stop(noteAt + 1.08);
      });
    };

    await context.resume();
    scheduleCycle();
    timerRef.current = window.setInterval(scheduleCycle, 3200);
    setPlaying(true);
  };

  useEffect(() => () => {
    window.clearInterval(timerRef.current);
    if (contextRef.current) void contextRef.current.close();
  }, []);

  return {
    playing,
    toggle: () => {
      if (playing) stop();
      else void start().catch(stop);
    },
  };
}

type WelcomePageProps = {
  intro?: boolean;
  workspace?: boolean;
  onBrowse?: () => void;
};

export function WelcomePage({ intro = false, workspace, onBrowse }: WelcomePageProps = {}) {
  const workspaceMode = workspace ?? !intro;
  const terminal = useTerminalTyping(intro && !workspaceMode);
  const clock = useClock();
  const music = useAmbientMusic();
  const navigate = useNavigate();
  const leaveTimerRef = useRef<number>();
  const [activeModel, setActiveModel] = useState(0);
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [stats, setStats] = useState<SiteStats>();
  const [updatesPulse, setUpdatesPulse] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const updatesRef = useRef<HTMLElement>(null);
  const blogContext = leaving || !intro;
  const openExternal = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  useEffect(() => () => window.clearTimeout(leaveTimerRef.current), []);

  const beginBrowse = () => {
    if (!onBrowse || leaving) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      onBrowse();
      return;
    }
    setLeaving(true);
    leaveTimerRef.current = window.setTimeout(onBrowse, 620);
  };

  useEffect(() => {
    if (import.meta.env.MODE === "test") return;
    let cancelled = false;
    const loadHomepage = async () => {
      const [notesResult, statsResult] = await Promise.allSettled([api.notes(), api.stats()]);
      if (cancelled) return;
      if (notesResult.status === "fulfilled") setNotes(notesResult.value.items);
      if (statsResult.status === "fulfilled") setStats(statsResult.value);

      if (!intro) return;
      const visitKey = `site-visit:${new Date().toISOString().slice(0, 10)}`;
      try {
        if (window.localStorage.getItem(visitKey)) return;
        window.localStorage.setItem(visitKey, "1");
      } catch {
        return;
      }
      const visit = await api.recordVisit().catch(() => undefined);
      if (!cancelled && visit) setStats((value) => value ? { ...value, visits: visit.visits } : value);
    };
    void loadHomepage();
    return () => { cancelled = true; };
  }, [intro]);

  const recentNotes = [...notes]
    .sort((left, right) => Date.parse(right.publishedAt || right.updatedAt) - Date.parse(left.publishedAt || left.updatedAt))
    .slice(0, 3);

  const focusUpdates = () => {
    setUpdatesPulse((value) => value + 1);
    updatesRef.current?.focus();
  };

  return (
    <section
      className={`${styles.page} ${intro ? styles.introActive : ""} ${workspaceMode ? styles.workspacePage : ""} ${leaving ? styles.pageLeaving : ""}`}
      data-welcome-mode={workspaceMode ? "workspace" : "homepage"}
    >
      {!workspaceMode ? <div className={styles.terminalField} data-welcome-environment="true" aria-hidden="true">
        <section className={`${styles.terminalGhost} ${styles.terminalGhostPrimary}`}>
          <div className={styles.terminalGhostBar}><Terminal /><span>xiayh@xiarch: ~</span></div>
          <p><span className={styles.green}>xiayh</span>@<span className={styles.blue}>xiarch</span> ~&gt; <b>{terminal.text}</b><i /></p>
          <small>{terminal.output}</small>
        </section>

        <section className={`${styles.terminalGhost} ${styles.terminalGhostMonitor}`}>
          <header>PROCESS MONITOR / 06</header>
          <div><span>web.frontend</span><i /><b>RUN</b></div>
          <div><span>fastify.api</span><i /><b>RUN</b></div>
          <div><span>sqlite.cache</span><i /><b>IDLE</b></div>
        </section>

        <section className={`${styles.terminalGhost} ${styles.terminalGhostTicker}`}>
          <div><span>pnpm build</span><b>✓ 1703 modules</b><span>xmake project -k compile_commands</span><b>✓ ready</b><span>git status --short</span><b>working tree</b></div>
        </section>

        <section className={`${styles.terminalGhost} ${styles.terminalGhostLog}`}>
          <header>LIVE LOG.</header>
          <div>
            <span>[00:01] model.target / arch</span>
            <span>[00:02] particle.count / 5000</span>
            <span>[00:03] render.canvas / ready</span>
            <span>[00:04] workspace / waiting</span>
          </div>
        </section>
      </div> : null}

      <div className={styles.quadrantFrame}>
        <div className={styles.topRule} aria-hidden="true" />
        <div className={styles.focusGuide} aria-hidden="true"><span /><i /></div>

        <section className={`${styles.quadrant} ${styles.introQuadrant}`}>
          <div className={styles.pageIndex} aria-hidden="true">
            <b>{blogContext ? "01" : "00"}</b>
            <span key={blogContext ? "blog" : "home"} className={styles.pageIndexRoute}>{blogContext ? "HOME / BLOG" : "HOME / INDEX"}</span>
          </div>
          <header className={styles.heading}>
            <span className={styles.eyebrow}>HOME PORTAL</span>
            <h1 aria-label="欢迎来到">
              {["欢", "迎", "来", "到"].map((glyph) => <span key={glyph} className={styles.welcomeGlyph} aria-hidden="true">{glyph}</span>)}
            </h1>
            <strong aria-label="— Xiayh 的个人网站 —">
              <span aria-hidden="true">— </span>
              <span className={styles.siteName} aria-hidden="true">
                {["X", "i", "a", "y", "h"].map((glyph) => <span key={glyph}>{glyph}</span>)}
              </span>
              <span aria-hidden="true"> 的个人网站 —</span>
            </strong>
          </header>
        </section>

        <section className={`${styles.quadrant} ${styles.clockQuadrant}`}>
          <section className={styles.identityStrip} aria-label="站点数据与个人信息">
            <div className={styles.siteStatsBlock}>
              <span className={styles.stripLabel}>SITE DATA.</span>
              <dl>
                <div><dt>BLOGS</dt><dd>{stats?.blogCount ?? "—"}</dd></div>
                <div><dt>READS</dt><dd>{stats?.totalViews ?? "—"}</dd></div>
                <div><dt>VISITS</dt><dd>{stats?.visits ?? "—"}</dd></div>
              </dl>
            </div>

            <div className={styles.contactBlock}>
              <div className={styles.contactList}>
                <span><Mail /><small>EMAIL</small><b title={profile.email}>{profile.email}</b></span>
                <span><MessageCircle /><small>QQ</small><b title={profile.qq}>{profile.qq}</b></span>
                <span><MessageSquareText /><small>WECHAT</small><b title={profile.wechat}>{profile.wechat}</b></span>
              </div>
            </div>

            <div className={styles.profileBlock}>
              <span className={styles.avatarFrame}>
                {avatarFailed ? <b>{profile.name.slice(0, 1)}</b> : <img src={profile.avatar} alt={`${profile.name} 的头像`} onError={() => setAvatarFailed(true)} />}
              </span>
              <span><small>PROFILE</small><strong>{profile.name}</strong><b>SWU</b><b>Computer Science</b></span>
            </div>

            <button type="button" className={styles.musicControl} aria-pressed={music.playing} onClick={music.toggle}>
              {music.playing ? <Pause /> : <Music2 />}
              <span><small>HOME AUDIO</small><b>{music.playing ? "PLAYING" : "PLAY MUSIC"}</b></span>
              <i aria-hidden="true"><i /><i /><i /><i /></i>
            </button>
          </section>

          <section
            key={updatesPulse}
            ref={updatesRef}
            tabIndex={-1}
            className={`${styles.recentUpdates} ${updatesPulse ? styles.recentUpdatesPulse : ""}`}
            aria-label="最近更新"
          >
            <header><span>RECENT UPDATE.</span></header>
            <div>
              {recentNotes.map((note, index) => (
                <button key={note.id} type="button" onClick={() => navigate(`/notes/${note.slug}`)}>
                  <i>{String(index + 1).padStart(2, "0")}</i><strong>{note.title}</strong><time>{formatUpdateDate(note.publishedAt || note.updatedAt)}</time>
                </button>
              ))}
              {!recentNotes.length ? <p>暂无可显示的公开更新</p> : null}
            </div>
          </section>
        </section>

        <section className={`${styles.quadrant} ${styles.navigationQuadrant}`}>
          <aside className={styles.clockPanel} aria-label={`当前时间 ${clock.hours}:${clock.minutes}:${clock.seconds}`}>
            <header className={styles.clockHeader}>
              <span>LOCAL TIME.</span>
            </header>
            <div className={styles.clockBody}>
              <section className={styles.clockTime}>
                <small>CLOCK</small>
                <div className={styles.clockFace}>
                  <strong>{clock.hours}<i>:</i>{clock.minutes}</strong>
                  <span><small>SEC</small><b>{clock.seconds}</b></span>
                </div>
              </section>
              <section className={styles.clockDate}>
                <div><small>CALENDAR</small><b>{clock.weekday}</b></div>
                <strong><span>{clock.month}</span><i>/</i><span>{clock.day}</span></strong>
                <footer><b>{clock.year}</b><small>UTC+08</small></footer>
              </section>
            </div>
            <div className={styles.clockCycles} aria-label="时间周期进度">
              {clock.progress.map((cycle) => (
                <span key={cycle.label} className={styles.clockCycle} aria-label={`${cycle.label} ${Math.floor(cycle.value)}%`}>
                  <span><small>{cycle.label}</small><b>{String(Math.floor(cycle.value)).padStart(2, "0")}%</b></span>
                  <i aria-hidden="true"><i style={{ width: `${cycle.value}%` }} /></i>
                </span>
              ))}
            </div>
          </aside>

          <div className={styles.navigation}>
            <div className={styles.navigationHeader}><span>MODULE INDEX.</span></div>
            <LabCard index="01" label="博客" detail="" icon={<BookOpen />} onClick={beginBrowse} />
            <LabCard index="02" label="动态" detail="" icon={<Activity />} onClick={focusUpdates} />
            <LabCard index="03" label="仓库" detail="" icon={<FolderGit2 />} onClick={() => openExternal("https://github.com/xiayh666?tab=repositories")} />
            <LabCard index="04" label="留言" detail="" icon={<MessageSquareText />} disabled />
            <LabCard index="05" label="关于" detail="" icon={<UserRound />} disabled />
            <LabCard index="06" label="GitHub" detail="" icon={<Github />} onClick={() => openExternal("https://github.com/xiayh666")} />
          </div>
        </section>

        <section className={`${styles.quadrant} ${styles.modelArea}`}>
          {intro ? (
            <>
          <button type="button" className={styles.modelDisplay} aria-label="进入工作区" data-intro-dismiss="true" onClick={beginBrowse}>
                <span className={styles.modelBackplate} aria-hidden="true" />
                <svg className={styles.modelFrame} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect x="0.3" y="0.3" width="99.4" height="99.4" pathLength="1" /></svg>
                <span className={styles.modelLabel}>MODEL DISPLAY.</span>
                <span className={`${styles.corner} ${styles.cornerTopLeft}`} aria-hidden="true" />
                <span className={`${styles.corner} ${styles.cornerTopRight}`} aria-hidden="true" />
                <span className={`${styles.corner} ${styles.cornerBottomLeft}`} aria-hidden="true" />
                <span className={`${styles.corner} ${styles.cornerBottomRight}`} aria-hidden="true" />
                <span className={styles.modelContent}><span className={styles.modelGrid} aria-hidden="true" /><PixelAssembly active={!leaving} onShapeChange={setActiveModel} /></span>
                <span className={styles.modelCaption}>SELECTED OBJECT / PARTICLE ASSEMBLY</span>
            <span className={styles.enterHint}>CLICK TO ENTER</span>
          </button>

          <span className={styles.blogLoadingMark} aria-hidden="true">
            <span><BookOpen /></span>
            <b>OPENING BLOG</b>
            <small>01 / NOTES</small>
          </span>

          <span key={activeModel} className={styles.annotationLabel}><b>{String(activeModel + 1).padStart(2, "0")} / {modelNames[activeModel]}</b></span>
              <svg className={styles.annotationLine} viewBox="0 0 360 150" preserveAspectRatio="none" aria-hidden="true"><path d="M4 102H190L256 30H356" /><circle cx="4" cy="102" r="4" /></svg>
              <div className={styles.modelTelemetry} aria-hidden="true">
                <span><small>ROTATION</small><b>0.00034 RAD/MS</b></span><span><small>CYCLE</small><b>18.48 SEC</b></span><span><small>PROJECTION</small><b>3-AXIS / CANVAS</b></span>
              </div>
              <div className={styles.axisOrnament} aria-hidden="true"><span>AXIS / XYZ</span><i /><i /><i /></div>
              <div className={styles.registrationMark} aria-hidden="true"><i /><span>VIEW / 01</span></div>
            </>
          ) : (
            <BlogArchiveOverview
              notes={notes}
              stats={stats}
              onOpenExplorer={onBrowse}
              onOpenNote={(slug) => navigate(`/notes/${slug}`)}
            />
          )}
        </section>

        {!workspaceMode ? <>
          <div className={styles.edgeRuler} aria-hidden="true"><span>Y</span><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <div className={styles.systemStatus} aria-hidden="true"><i /><span>SYSTEM READY</span><b>5000 PTS</b><b>04 FORMS</b></div>
          <div className={styles.footerMark} aria-hidden="true"><b>DATA.</b><span>XIAYH.COM.CN / 2026</span></div>
        </> : null}
      </div>
    </section>
  );
}

function BlogArchiveOverview({ notes, stats, onOpenExplorer, onOpenNote }: {
  notes: NoteSummary[];
  stats?: SiteStats;
  onOpenExplorer?: () => void;
  onOpenNote: (slug: string) => void;
}) {
  const sections = Object.entries(notes.reduce<Record<string, number>>((result, note) => {
    const section = note.path.split("/").filter(Boolean)[0] || "ROOT";
    result[section] = (result[section] ?? 0) + 1;
    return result;
  }, {})).sort((left, right) => right[1] - left[1]).slice(0, 4);
  const latest = [...notes]
    .sort((left, right) => Date.parse(right.publishedAt || right.updatedAt) - Date.parse(left.publishedAt || left.updatedAt))
    .slice(0, 2);

  return (
    <section className={styles.blogArchive} aria-label="博客概览">
      <header className={styles.blogArchiveHeader}>
        <span>BLOG ARCHIVE.</span>
        <small>INDEX / PUBLIC NOTES</small>
      </header>
      <div className={styles.blogArchiveSummary}>
        <span>KNOWLEDGE BASE / 01</span>
        <strong>技术记录与长期思考</strong>
        <p>从工程实践到系统设计，以可检索的文章持续整理。</p>
        <dl>
          <div><dt>ARTICLES</dt><dd>{(stats?.blogCount ?? notes.length) || "—"}</dd></div>
          <div><dt>TOTAL READS</dt><dd>{stats?.totalViews ?? "—"}</dd></div>
        </dl>
        <button type="button" onClick={onOpenExplorer}>OPEN BLOG EXPLORER <span>↗</span></button>
      </div>
      <div className={styles.blogArchiveIndex}>
        <span>SECTION INDEX.</span>
        <ol>
          {sections.map(([section, count], index) => <li key={section}><i>{String(index + 1).padStart(2, "0")}</i><b>{section}</b><small>{count}</small></li>)}
          {!sections.length ? <li><i>00</i><b>WAITING FOR DATA</b><small>—</small></li> : null}
        </ol>
      </div>
      <div className={styles.blogArchiveLatest}>
        <span>LATEST NOTES.</span>
        {latest.map((note) => (
          <button key={note.id} type="button" onClick={() => onOpenNote(note.slug)}>
            <strong>{note.title}</strong><time>{formatUpdateDate(note.publishedAt || note.updatedAt)}</time>
          </button>
        ))}
      </div>
    </section>
  );
}

function LabCard({ index, label, detail, icon, onClick, disabled = false }: {
  index: string;
  label: string;
  detail: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className={styles.labCard} onClick={onClick} disabled={disabled}>
      <span className={styles.cardIndex}>{index}</span>
      <span className={styles.cardIcon}>{icon}</span>
      <span className={styles.cardCopy}>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <span className={styles.cardArrow} aria-hidden="true">↗</span>
    </button>
  );
}

function formatUpdateDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}
