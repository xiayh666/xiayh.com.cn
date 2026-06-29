import { useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, BookOpen, FolderGit2, Github, MessageSquareText, Terminal, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, type NoteSummary, type SiteStats } from "../api";
import { PixelAssembly } from "./PixelAssembly";
import styles from "./WelcomePage.module.css";

const commands = ["whoami", "ls ./notes", "cat ./current-focus.md"];
const commandOutput = ["xiayh — developer / builder / writer", "C++   backend   web", "building systems that remain understandable"];
const modelNames = ["ARCH LINUX", "MINECRAFT", "REDSTONE", "STM32"];
const modelDetails = ["OPERATING SYSTEM", "GRASS BLOCK", "ITEM SPRITE", "EMBEDDED SYSTEM"];

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

  const twoDigits = (value: number) => String(value).padStart(2, "0");
  return {
    hours: twoDigits(now.getHours()),
    minutes: twoDigits(now.getMinutes()),
    seconds: twoDigits(now.getSeconds()),
    date: new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(now),
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(now).toUpperCase(),
  };
}

type WelcomePageProps = {
  intro?: boolean;
  onBrowse?: () => void;
};

export function WelcomePage({ intro = false, onBrowse }: WelcomePageProps = {}) {
  const terminal = useTerminalTyping(intro);
  const clock = useClock();
  const navigate = useNavigate();
  const [activeModel, setActiveModel] = useState(0);
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [stats, setStats] = useState<SiteStats>();
  const [updatesPulse, setUpdatesPulse] = useState(0);
  const updatesRef = useRef<HTMLElement>(null);
  const openExternal = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

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
    <section className={styles.page}>
      <div className={styles.terminalField} aria-hidden="true">
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
      </div>

      <div className={styles.quadrantFrame}>
        <div className={styles.topRule} aria-hidden="true" />
        <div className={styles.focusGuide} aria-hidden="true"><span /><i /></div>

        <section className={`${styles.quadrant} ${styles.introQuadrant}`}>
          <div className={styles.pageIndex} aria-hidden="true"><b>00</b><span>HOME / INDEX</span></div>
          <header className={styles.heading}>
            <span className={styles.eyebrow}>XIAYH / HOME PORTAL</span>
            <h1>欢迎来到</h1>
            <strong>— XIAYH 的个人网站 —</strong>
            <p>Developer · Builder · Writer</p>
          </header>
        </section>

        <section className={`${styles.quadrant} ${styles.clockQuadrant}`}>
          <dl className={styles.homeStats} aria-label="站点数据">
            <div><dt>BLOGS</dt><dd>{stats?.blogCount ?? "—"}</dd></div>
            <div><dt>READS</dt><dd>{stats?.totalViews ?? "—"}</dd></div>
            <div><dt>VISITS</dt><dd>{stats?.visits ?? "—"}</dd></div>
          </dl>

          <section key={updatesPulse} ref={updatesRef} tabIndex={-1} className={styles.recentUpdates} aria-label="最近更新">
            <header><span>RECENT UPDATE.</span><small>{recentNotes.length ? "LATEST PUBLICATIONS" : "WAITING FOR DATA"}</small></header>
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
            <span className={styles.moduleTag}>LOCAL TIME.</span>
            <div className={styles.clockFace}>
              <strong>{clock.hours}<i>:</i>{clock.minutes}</strong>
              <b>{clock.seconds}</b>
            </div>
            <div className={styles.clockMeta}><span>{clock.date}</span><span>{clock.weekday} / UTC+08</span></div>
          </aside>

          <div className={styles.navigation}>
            <div className={styles.navigationHeader}><span>MODULE INDEX.</span><small>06 / SELECT DESTINATION</small></div>
            <LabCard index="01" label="博客" detail="NOTES / THINKING" icon={<BookOpen />} onClick={onBrowse} />
            <LabCard index="02" label="动态" detail="RECENT ACTIVITY" icon={<Activity />} onClick={focusUpdates} />
            <LabCard index="03" label="仓库" detail="PROJECT ARCHIVE" icon={<FolderGit2 />} onClick={() => openExternal("https://github.com/xiayh666?tab=repositories")} />
            <LabCard index="04" label="留言" detail="GUESTBOOK / SOON" icon={<MessageSquareText />} disabled />
            <LabCard index="05" label="关于" detail="ABOUT XIAYH" icon={<UserRound />} disabled />
            <LabCard index="06" label="GitHub" detail="CODE / OPEN SOURCE" icon={<Github />} onClick={() => openExternal("https://github.com/xiayh666")} />
          </div>
        </section>

        <section className={`${styles.quadrant} ${styles.modelArea}`}>
          <button type="button" className={styles.modelDisplay} aria-label="进入工作区" onClick={onBrowse}>
            <span className={styles.modelBackplate} aria-hidden="true" />
            <svg className={styles.modelFrame} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect x="0.3" y="0.3" width="99.4" height="99.4" pathLength="1" /></svg>
            <span className={styles.modelLabel}>MODEL DISPLAY.</span>
            <span className={`${styles.corner} ${styles.cornerTopLeft}`} aria-hidden="true" />
            <span className={`${styles.corner} ${styles.cornerTopRight}`} aria-hidden="true" />
            <span className={`${styles.corner} ${styles.cornerBottomLeft}`} aria-hidden="true" />
            <span className={`${styles.corner} ${styles.cornerBottomRight}`} aria-hidden="true" />
            <span className={styles.modelContent}><span className={styles.modelGrid} aria-hidden="true" />{intro ? <PixelAssembly onShapeChange={setActiveModel} /> : null}</span>
            <span className={styles.modelCaption}>SELECTED OBJECT / PARTICLE ASSEMBLY</span>
            <span className={styles.enterHint}>CLICK TO ENTER</span>
          </button>

          <span key={activeModel} className={styles.annotationLabel}><b>{String(activeModel + 1).padStart(2, "0")} / {modelNames[activeModel]}</b><small>{modelDetails[activeModel]}</small></span>
          <svg className={styles.annotationLine} viewBox="0 0 360 150" preserveAspectRatio="none" aria-hidden="true"><path d="M4 102H190L256 30H356" /><circle cx="4" cy="102" r="4" /></svg>
          <div className={styles.modelTelemetry} aria-hidden="true">
            <span><small>ROTATION</small><b>0.00034 RAD/MS</b></span><span><small>CYCLE</small><b>18.48 SEC</b></span><span><small>PROJECTION</small><b>3-AXIS / CANVAS</b></span>
          </div>
          <div className={styles.axisOrnament} aria-hidden="true"><span>AXIS / XYZ</span><i /><i /><i /></div>
          <div className={styles.registrationMark} aria-hidden="true"><i /><span>VIEW / 01</span></div>
        </section>

        <div className={styles.edgeRuler} aria-hidden="true"><span>Y</span><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
        <div className={styles.systemStatus} aria-hidden="true"><i /><span>SYSTEM READY</span><b>5000 PTS</b><b>04 FORMS</b></div>
        <div className={styles.footerMark} aria-hidden="true"><b>DATA.</b><span>XIAYH.COM.CN / 2026</span></div>
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
