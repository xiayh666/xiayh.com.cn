import { useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, BookOpen, FolderGit2, Github, Mail, MessageCircle, MessageSquareText, Music2, Pause, Terminal, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, type NoteSummary, type SiteStats } from "../api";
import { PixelAssembly } from "./PixelAssembly";
import profileAvatar from "../assets/profile-avatar.jpg";
import styles from "./WelcomePage.module.css";

const commands = ["uptime -p", "journalctl -p warning -n 3", "ss -Hlt state listening"];
const commandOutput = [
  ["up 7 days, 4 hours", "load average: 0.08, 0.11, 0.09", "friday deploy lock: engaged"],
  ["-- No entries --", "dns blame check: inconclusive", "works-on-my-machine flag: ignored"],
  ["LISTEN 0 511 loopback:**** 0.0.0.0:* users:((\"naming-things\"))", "LISTEN 0 128 loopback:**** 0.0.0.0:* users:((\"cache-invalidator\"))", "LISTEN 0  64 loopback:****    [::]:* users:((\"off-by-one\"))"],
];
const profile = {
  name: import.meta.env.VITE_PROFILE_NAME?.trim() || "Xiayh",
  avatar: import.meta.env.VITE_PROFILE_AVATAR?.trim() || profileAvatar,
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
    const delay = complete && !state.deleting ? 2300 : empty && state.deleting ? 260 : state.deleting ? 32 : 72;
    const timer = window.setTimeout(() => {
      if (complete && !state.deleting) setState((value) => ({ ...value, deleting: true }));
      else if (empty && state.deleting) setState({ command: (state.command + 1) % commands.length, length: 0, deleting: false });
      else setState((value) => ({ ...value, length: value.length + (value.deleting ? -1 : 1) }));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [active, state]);

  return {
    text: commands[state.command].slice(0, state.length),
    output: state.length === commands[state.command].length && !state.deleting ? commandOutput[state.command] : ["\u00a0"],
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
    { label: "年", value: ((dayOfYear - 1 + dayProgress) / daysInYear) * 100 },
    { label: "月", value: ((day - 1 + dayProgress) / daysInMonth) * 100 },
    { label: "日", value: (secondsInDay / 86_400) * 100 },
    { label: "时", value: ((minutes * 60 + seconds) / 3600) * 100 },
    { label: "分", value: (seconds / 60) * 100 },
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
  onHome?: () => void;
  onOpenNote?: (slug: string) => void;
  initialNotes?: NoteSummary[];
};

export function WelcomePage({ intro = false, workspace, onBrowse, onOpenNote, initialNotes = [] }: WelcomePageProps = {}) {
  const workspaceMode = workspace ?? !intro;
  const terminal = useTerminalTyping(intro && !workspaceMode);
  const clock = useClock();
  const music = useAmbientMusic();
  const navigate = useNavigate();
  const leaveTimerRef = useRef<number>();
  const [modelRotationEnabled, setModelRotationEnabled] = useState(!intro);
  const [notes, setNotes] = useState<NoteSummary[]>(initialNotes);
  const [stats, setStats] = useState<SiteStats>();
  const [updatesPulse] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const pageRef = useRef<HTMLElement>(null);
  const updatesRef = useRef<HTMLElement>(null);
  const blogContext = leaving || !intro;
  const openExternal = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  useEffect(() => () => window.clearTimeout(leaveTimerRef.current), []);

  useEffect(() => {
    if (!intro) {
      setModelRotationEnabled(true);
      return;
    }
    setModelRotationEnabled(false);
    const timer = window.setTimeout(() => setModelRotationEnabled(true), 2100);
    return () => window.clearTimeout(timer);
  }, [intro]);

  useEffect(() => {
    if (initialNotes.length) setNotes(initialNotes);
  }, [initialNotes]);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const media = window.matchMedia?.("(max-width: 820px)");
    if (!media?.matches) return;

    let locked = false;
    let startY = 0;
    let moveY = 0;
    let hasMoved = false;
    let nestedScroll = false;
    let touchTarget: EventTarget | null = null;

    const getTargets = () => Array.from(page.querySelectorAll<HTMLElement>("[data-mobile-snap='true']"))
      .sort((left, right) => left.offsetTop - right.offsetTop);

    const getCurrentIndex = (targets: HTMLElement[]) => {
      const top = page.scrollTop;
      let index = 0;
      let distance = Number.POSITIVE_INFINITY;
      targets.forEach((target, candidate) => {
        const nextDistance = Math.abs(target.offsetTop - top);
        if (nextDistance < distance) {
          distance = nextDistance;
          index = candidate;
        }
      });
      return index;
    };

    const snapBy = (direction: 1 | -1) => {
      if (locked) return;
      const targets = getTargets();
      if (targets.length < 2) return;
      const current = getCurrentIndex(targets);
      const next = Math.max(0, Math.min(targets.length - 1, current + direction));
      if (next === current) return;
      locked = true;
      page.scrollTo({ top: targets[next].offsetTop, behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      window.setTimeout(() => { locked = false; }, 620);
    };

    const canScrollWithinPage = (target: EventTarget | null, delta: number) => {
      let element = target instanceof Element ? target : null;
      while (element && element !== page) {
        if (element instanceof HTMLElement && /auto|scroll/.test(getComputedStyle(element).overflowY)) {
          const remaining = element.scrollHeight - element.clientHeight;
          if (remaining > 1 && (delta > 0 ? element.scrollTop < remaining - 1 : element.scrollTop > 1)) return true;
        }
        element = element.parentElement;
      }
      return false;
    };

    const onWheel = (event: WheelEvent) => {
      if (!media.matches || Math.abs(event.deltaY) < 12) return;
      if (canScrollWithinPage(event.target, event.deltaY)) return;
      event.preventDefault();
      snapBy(event.deltaY > 0 ? 1 : -1);
    };

    const onTouchStart = (event: TouchEvent) => {
      touchTarget = event.target;
      nestedScroll = false;
      startY = event.touches[0]?.clientY ?? 0;
      moveY = startY;
      hasMoved = false;
    };

    const onTouchMove = (event: TouchEvent) => {
      moveY = event.touches[0]?.clientY ?? moveY;
      if (Math.abs(moveY - startY) < 10) return;
      if (nestedScroll || canScrollWithinPage(touchTarget, startY - moveY)) {
        nestedScroll = true;
        return;
      }
      hasMoved = true;
      event.preventDefault();
    };

    const onTouchEnd = () => {
      if (!hasMoved || nestedScroll) return;
      const delta = startY - moveY;
      if (Math.abs(delta) < 36) return;
      snapBy(delta > 0 ? 1 : -1);
    };

    page.addEventListener("wheel", onWheel, { passive: false });
    page.addEventListener("touchstart", onTouchStart, { passive: true });
    page.addEventListener("touchmove", onTouchMove, { passive: false });
    page.addEventListener("touchend", onTouchEnd);

    return () => {
      page.removeEventListener("wheel", onWheel);
      page.removeEventListener("touchstart", onTouchStart);
      page.removeEventListener("touchmove", onTouchMove);
      page.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  const runAfterIntro = (action: () => void) => {
    if (leaving) return;
    if (
      !intro
      || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      || window.matchMedia?.("(max-width: 820px)").matches
    ) {
      action();
      return;
    }
    setLeaving(true);
    leaveTimerRef.current = window.setTimeout(action, 620);
  };

  const beginBrowse = () => {
    if (onBrowse) runAfterIntro(onBrowse);
  };

  const openNote = (slug: string) => {
    const action = () => {
      if (onOpenNote) onOpenNote(slug);
      else navigate(`/notes/${slug}`);
    };
    if (intro && onOpenNote) action();
    else runAfterIntro(action);
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

  return (
    <section
      ref={pageRef}
      className={`${styles.page} ${intro ? styles.introActive : ""} ${workspaceMode ? styles.workspacePage : ""} ${leaving ? styles.pageLeaving : ""}`}
      data-welcome-mode={workspaceMode ? "workspace" : "homepage"}
    >
      {!workspaceMode ? <div className={styles.terminalField} data-welcome-environment="true" aria-hidden="true">
        <section className={`${styles.terminalGhost} ${styles.terminalGhostPrimary}`}>
          <div className={styles.terminalGhostBar}><Terminal /><span>operator@node-01: ~</span></div>
          <p><span className={styles.green}>operator</span>@<span className={styles.blue}>node-01</span> ~&gt; <b>{terminal.text}</b><i /></p>
          <small>{terminal.output.map((line) => <span key={line}>{line}</span>)}</small>
        </section>

        <section className={`${styles.terminalGhost} ${styles.terminalGhostMonitor}`}>
          <header>SERVICE HEALTH / 03</header>
          <div><span>edge-gateway</span><i /><b>ACTIVE</b></div>
          <div><span>app-runtime</span><i /><b>ACTIVE</b></div>
          <div><span>data-store</span><i /><b>READY</b></div>
        </section>

        <section className={`${styles.terminalGhost} ${styles.terminalGhostTicker}`}>
          <div><span>bug</span><b>→</b><span>fix</span><b>→</b><span>test</span><b>→</b><span>fix</span><b>→</b><span>bug</span><b>→</b><span>fix</span><b>→</b><span>test</span><b>→</b><span>fix</span><b>→</b><span>bug</span><b>→</b></div>
        </section>

        <section className={`${styles.terminalGhost} ${styles.terminalGhostLog}`}>
          <header>JOURNAL TAIL.</header>
          <div>
            <span>[09:57] dns / there is no way it is dns</span>
            <span>[09:58] dns / it was dns</span>
            <span>[09:59] regex / now there are two problems</span>
            <span>[10:00] recursion / see recursion</span>
          </div>
        </section>
      </div> : null}

      <div className={styles.quadrantFrame} data-welcome-card="true">
        <div className={styles.topRule} aria-hidden="true" />

        <section className={`${styles.quadrant} ${styles.introQuadrant}`} data-mobile-snap="true">
          <div className={styles.pageIndex} aria-hidden="true">
            <b>{blogContext ? "01" : "00"}</b>
            <span key={blogContext ? "blog" : "home"} className={styles.pageIndexRoute}>{blogContext ? "BLOG" : "WELCOME"}</span>
          </div>
          <header className={styles.heading}>
            {/* <span className={styles.eyebrow}>HOME PORTAL</span> */}
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

        <section className={`${styles.quadrant} ${styles.clockQuadrant}`} data-mobile-snap="true">
          <section className={styles.identityStrip} aria-label="站点数据与个人信息">
            <div className={styles.siteStatsBlock}>
              <span className={styles.stripLabel}>站点数据</span>
              <dl>
                <div><dt>文章</dt><dd>{stats?.blogCount ?? "—"}</dd></div>
                <div><dt>阅读量</dt><dd>{stats?.totalViews ?? "—"}</dd></div>
                <div><dt>访客量</dt><dd>{stats?.visits ?? "—"}</dd></div>
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
              <span><strong>{profile.name}</strong><b>西南大学</b><b>计算机科学与技术</b></span>
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
            <header><span>近期更新</span></header>
            <div>
              {recentNotes.map((note, index) => (
                <button key={note.id} type="button" onClick={() => openNote(note.slug)}>
                  <i>{String(index + 1).padStart(2, "0")}</i><strong>{note.title}</strong><time>{formatUpdateDate(note.publishedAt || note.updatedAt)}</time>
                </button>
              ))}
              {!recentNotes.length ? <p>暂无可显示的公开更新</p> : null}
            </div>
          </section>
        </section>

        <section className={`${styles.quadrant} ${styles.navigationQuadrant}`}>
          <aside className={styles.clockPanel} aria-label={`当前时间 ${clock.hours}:${clock.minutes}:${clock.seconds}`}>
            <div className={styles.clockBody}>
              <section className={styles.clockTime}>
                <div className={styles.clockFace}>
                  <strong>{clock.hours}<i>:</i>{clock.minutes}</strong>
                  <span><b>{clock.seconds}</b></span>
                </div>
              </section>
              <section className={styles.clockDate}>
                <div><b>{clock.weekday}</b></div>
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
            <LabCard index="01" label="博客" detail="" icon={<BookOpen />} onClick={beginBrowse} />
            <LabCard index="02" label="动态" detail="" icon={<Activity />} disabled />
            <LabCard index="03" label="仓库" detail="" icon={<FolderGit2 />} disabled />
            <LabCard index="04" label="留言" detail="" icon={<MessageSquareText />} disabled />
            <LabCard index="05" label="关于" detail="" icon={<UserRound />} disabled />
            <LabCard index="06" label="GitHub" detail="" icon={<Github />} onClick={() => openExternal("https://github.com/xiayh666")} />
          </div>
        </section>

        <section className={`${styles.quadrant} ${styles.modelArea}`} data-mobile-snap="true">
          {intro ? (
            <>
          <div className={styles.modelDisplay}>
                <span className={styles.modelBackplate} aria-hidden="true" />
                <svg className={styles.modelFrame} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect x="0.3" y="0.3" width="99.4" height="99.4" pathLength="1" /></svg>
                <span className={styles.modelLabel}>模型展示</span>
                <span className={`${styles.corner} ${styles.cornerTopLeft}`} aria-hidden="true" />
                <span className={`${styles.corner} ${styles.cornerTopRight}`} aria-hidden="true" />
                <span className={`${styles.corner} ${styles.cornerBottomLeft}`} aria-hidden="true" />
                <span className={`${styles.corner} ${styles.cornerBottomRight}`} aria-hidden="true" />
                <PixelAssembly active={!leaving} rotationEnabled={modelRotationEnabled} />
          </div>

          <span className={styles.blogLoadingMark} aria-hidden="true">
            <span><BookOpen /></span>
            <b>OPENING BLOG</b>
            <small>01 / NOTES</small>
          </span>

          <div className={styles.axisOrnament} aria-hidden="true"><span>AXIS  XYZ</span><i /><i /><i /></div>
          <div className={styles.registrationMark} aria-hidden="true"><i /><span>VIEW 01</span></div>

          <aside className={styles.projectPanel} aria-label="项目">
            <header><span>项目</span><FolderGit2 aria-hidden="true" /></header>
            <ul className={styles.projectList}>
              <li><button type="button" onClick={() => openExternal("https://github.com/xiayh666/xiayh.com.cn")}>
                <small>01</small><span><strong>个人网站</strong><small>xiayh.com.cn</small></span><span aria-hidden="true">↗</span>
              </button></li>
            </ul>
            <button type="button" className={styles.projectMore} onClick={() => openExternal("https://github.com/xiayh666?tab=repositories")}>GitHub 项目列表 <span aria-hidden="true">↗</span></button>
          </aside>
            </>
          ) : (
            <BlogArchiveOverview
              notes={notes}
              stats={stats}
              onOpenNote={openNote}
            />
          )}
        </section>

        {!workspaceMode ? <>
          <div className={styles.edgeRuler} aria-hidden="true"><span>Y</span><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          {/* <div className={styles.footerMark} aria-hidden="true"><b>DATA.</b><span>XIAYH.COM.CN / 2026</span></div> */}
        </> : null}
      </div>
    </section>
  );
}

function BlogArchiveOverview({ notes, stats, onOpenNote }: {
  notes: NoteSummary[];
  stats?: SiteStats;
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
      </header>
      <div className={styles.blogArchiveSummary}>
        <dl>
          <div><dt>ARTICLES</dt><dd>{(stats?.blogCount ?? notes.length) || "—"}</dd></div>
          <div><dt>TOTAL READS</dt><dd>{stats?.totalViews ?? "—"}</dd></div>
          <div><dt>WORDS</dt><dd>{formatWordCount(activity.totalWords)}</dd></div>
        </dl>
      </div>
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
          <small>过去12个月: {formatWordCount(activity.totalWords)} 字</small>
        </header>
        <div className={styles.activityCalendar} aria-label="最近十二个月文章发布频率热力图">
          <div
            className={styles.activityMonths}
            style={{ gridTemplateColumns: `repeat(${activity.weeks.length}, var(--activity-cell))` }}
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
            style={{ gridTemplateColumns: `repeat(${activity.weeks.length}, var(--activity-cell))` }}
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

type BlogActivityDay = { date: string; label: string; words: number; level: number; empty: boolean };
type BlogActivityWeek = { key: string; days: BlogActivityDay[] };
type BlogActivityMonth = { label: string; column: number; span: number };

function buildBlogArchiveActivity(notes: NoteSummary[]): { weeks: BlogActivityWeek[]; months: BlogActivityMonth[]; totalWords: number } {
  const today = startOfLocalDay(new Date());
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

function formatWordCount(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value);
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
        {detail ? <small>{detail}</small> : null}
      </span>
    </button>
  );
}

function formatUpdateDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}
