import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CheckSquare } from "lucide-react";
import { intlLocale } from "../lib/format.js";

// Point 3 (2026-10-25) — calendrier type Google Agenda, 4 vues (Jour,
// Semaine, Mois, Année). Composant purement d'affichage : il reçoit les
// événements déjà chargés par Agenda.jsx (mêmes endpoints qu'avant, donc
// même visibilité par rôle) et remonte les clics :
//   - onSlotClick(date)  : créneau vide (Jour/Semaine) → création de RDV ;
//   - onEventClick(ev)   : RDV ou tâche → détail.
// Événement attendu : { id, kind: "rdv" | "task", start: Date, title,
// accountName, done }. Les tâches n'ont pas d'heure significative : elles
// s'affichent dans la ligne "Échéances" en haut des vues Jour/Semaine, avec
// un style distinct (pointillés), jamais dans la grille horaire.

const HOUR_PX = 48;
const RDV_MINUTES = 60; // durée d'affichage d'un RDV (aucune heure de fin en base)
const VIEWS = ["day", "week", "month", "year"];
const VIEW_STORAGE_KEY = "moken_agenda_view";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeek(d) {
  const x = startOfDay(d);
  return addDays(x, -((x.getDay() + 6) % 7)); // semaine du lundi au dimanche
}
function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function sameDay(a, b) {
  return dayKey(a) === dayKey(b);
}

function defaultView() {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (VIEWS.includes(stored)) return stored;
  } catch {
    // stockage indisponible — repli sur la valeur par défaut.
  }
  // Mobile d'abord : vue Jour sur téléphone, Semaine sur écran large.
  return typeof window !== "undefined" && window.innerWidth < 860 ? "day" : "week";
}

// Répartit les RDV d'une journée en colonnes quand ils se chevauchent.
function layoutDay(events) {
  const sorted = [...events].sort((a, b) => a.start - b.start);
  const out = [];
  let cluster = [];
  let clusterEnd = 0;
  const flush = () => {
    const lanes = [];
    for (const ev of cluster) {
      let lane = lanes.findIndex((end) => end <= ev.start.getTime());
      if (lane === -1) lane = lanes.length;
      lanes[lane] = ev.start.getTime() + RDV_MINUTES * 60000;
      out.push({ ev, lane });
    }
    for (const item of out.slice(out.length - cluster.length)) item.lanes = lanes.length;
    cluster = [];
  };
  for (const ev of sorted) {
    if (cluster.length && ev.start.getTime() >= clusterEnd) flush();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.start.getTime() + RDV_MINUTES * 60000);
  }
  if (cluster.length) flush();
  return out;
}

export default function AgendaCalendar({ events, onSlotClick, onEventClick, t, locale }) {
  const [view, setView] = useState(defaultView);
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [now, setNow] = useState(() => new Date());
  const loc = intlLocale(locale);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  function changeView(next) {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // pas grave : la vue n'est simplement pas mémorisée.
    }
  }

  const byDay = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      const k = dayKey(ev.start);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(ev);
    }
    for (const list of map.values()) list.sort((a, b) => a.start - b.start);
    return map;
  }, [events]);
  const eventsOn = (d) => byDay.get(dayKey(d)) || [];

  function move(dir) {
    const d = new Date(cursor);
    if (view === "day") setCursor(addDays(d, dir));
    else if (view === "week") setCursor(addDays(d, 7 * dir));
    else if (view === "month") setCursor(new Date(d.getFullYear(), d.getMonth() + dir, 1));
    else setCursor(new Date(d.getFullYear() + dir, 0, 1));
  }

  function openDay(d) {
    setCursor(startOfDay(d));
    changeView("day");
  }

  function openMonth(year, month) {
    setCursor(new Date(year, month, 1));
    changeView("month");
  }

  let title;
  if (view === "day") {
    title = cursor.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } else if (view === "week") {
    const s = startOfWeek(cursor);
    const e = addDays(s, 6);
    title = `${s.toLocaleDateString(loc, { day: "numeric", month: "short" })} – ${e.toLocaleDateString(loc, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`;
  } else if (view === "month") {
    title = cursor.toLocaleDateString(loc, { month: "long", year: "numeric" });
  } else {
    title = String(cursor.getFullYear());
  }

  return (
    <div className="cal">
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button type="button" className="btn outline" onClick={() => setCursor(startOfDay(new Date()))}>
            {t("agenda.calToday")}
          </button>
          <button type="button" className="cal-icon-btn" aria-label={t("agenda.calPrev")} onClick={() => move(-1)}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" className="cal-icon-btn" aria-label={t("agenda.calNext")} onClick={() => move(1)}>
            <ChevronRight size={18} />
          </button>
          <h3 className="cal-title">{title}</h3>
        </div>
        <div className="cat-tabs cal-views">
          {VIEWS.map((v) => (
            <button key={v} type="button" className={`cat-tab ${view === v ? "active" : ""}`} onClick={() => changeView(v)}>
              {t(`agenda.calView_${v}`)}
            </button>
          ))}
        </div>
      </div>

      {(view === "day" || view === "week") && (
        <TimeGrid
          days={view === "day" ? [cursor] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))}
          eventsOn={eventsOn}
          now={now}
          loc={loc}
          t={t}
          onSlotClick={onSlotClick}
          onEventClick={onEventClick}
          onDayClick={view === "week" ? openDay : null}
        />
      )}
      {view === "month" && (
        <MonthGrid cursor={cursor} eventsOn={eventsOn} now={now} loc={loc} t={t} onDayClick={openDay} onEventClick={onEventClick} />
      )}
      {view === "year" && (
        <YearGrid year={cursor.getFullYear()} eventsOn={eventsOn} now={now} loc={loc} onDayClick={openDay} onMonthClick={openMonth} />
      )}

      <div className="cal-legend">
        <span>
          <i className="cal-swatch rdv" /> {t("agenda.calLegendRdv")}
        </span>
        <span>
          <i className="cal-swatch task" /> {t("agenda.calLegendTask")}
        </span>
      </div>
    </div>
  );
}

function EventChip({ ev, onEventClick, loc, compact }) {
  const time = ev.kind === "rdv" ? ev.start.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <button
      type="button"
      className={`cal-chip ${ev.kind} ${ev.done ? "done" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onEventClick(ev);
      }}
      title={[time, ev.accountName, ev.title].filter(Boolean).join(" · ")}
    >
      {ev.kind === "task" && <CheckSquare size={11} />}
      {time && <span className="cal-chip-time">{time}</span>}
      <span className="cal-chip-text">{compact ? ev.accountName || ev.title : [ev.accountName, ev.title].filter(Boolean).join(" — ")}</span>
    </button>
  );
}

function TimeGrid({ days, eventsOn, now, loc, t, onSlotClick, onEventClick, onDayClick }) {
  const scrollRef = useRef(null);
  const single = days.length === 1;

  // Ouvre la grille vers 7h (ou plus tôt si un RDV commence avant), comme
  // Google Agenda, plutôt qu'à minuit.
  const firstKey = dayKey(days[0]);
  useEffect(() => {
    if (!scrollRef.current) return;
    const earliest = days
      .flatMap((d) => eventsOn(d).filter((e) => e.kind === "rdv"))
      .reduce((min, e) => Math.min(min, e.start.getHours()), 7);
    scrollRef.current.scrollTop = Math.max(0, earliest - 0.5) * HOUR_PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstKey, days.length]);

  const hasTasks = days.some((d) => eventsOn(d).some((e) => e.kind === "task"));

  return (
    <div className={`cal-timegrid ${single ? "single" : ""}`}>
      <div className="cal-tg-head">
        <div className="cal-gutter" />
        {days.map((d) => {
          const isToday = sameDay(d, now);
          return (
            <div
              key={dayKey(d)}
              className={`cal-tg-dayhead ${isToday ? "today" : ""} ${onDayClick ? "clickable" : ""}`}
              onClick={() => onDayClick && onDayClick(d)}
            >
              <span className="cal-wd">{d.toLocaleDateString(loc, { weekday: single ? "long" : "short" })}</span>
              <span className="cal-dn">{d.getDate()}</span>
            </div>
          );
        })}
      </div>
      {hasTasks && (
        <div className="cal-tg-allday">
          <div className="cal-gutter cal-allday-label">{t("agenda.calAllDay")}</div>
          {days.map((d) => (
            <div key={dayKey(d)} className="cal-allday-cell">
              {eventsOn(d)
                .filter((e) => e.kind === "task")
                .map((ev) => (
                  <EventChip key={ev.id} ev={ev} onEventClick={onEventClick} loc={loc} compact={!single} />
                ))}
            </div>
          ))}
        </div>
      )}
      <div className="cal-tg-body" ref={scrollRef}>
        <div className="cal-gutter">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="cal-hour-label" style={{ height: HOUR_PX }}>
              {h > 0 ? `${String(h).padStart(2, "0")}:00` : ""}
            </div>
          ))}
        </div>
        {days.map((d) => {
          const isToday = sameDay(d, now);
          const placed = layoutDay(eventsOn(d).filter((e) => e.kind === "rdv"));
          return (
            <div key={dayKey(d)} className={`cal-tg-col ${isToday ? "today" : ""}`} style={{ height: 24 * HOUR_PX }}>
              {Array.from({ length: 24 }, (_, h) => (
                <div
                  key={h}
                  className="cal-slot"
                  style={{ height: HOUR_PX }}
                  role="button"
                  aria-label={`${d.toLocaleDateString(loc)} ${String(h).padStart(2, "0")}:00`}
                  onClick={() => {
                    const slot = new Date(d);
                    slot.setHours(h, 0, 0, 0);
                    onSlotClick(slot);
                  }}
                />
              ))}
              {placed.map(({ ev, lane, lanes }) => {
                const minutes = ev.start.getHours() * 60 + ev.start.getMinutes();
                return (
                  <div
                    key={ev.id}
                    className="cal-event-pos"
                    style={{
                      top: (minutes / 60) * HOUR_PX,
                      height: (RDV_MINUTES / 60) * HOUR_PX - 2,
                      left: `${(lane / lanes) * 100}%`,
                      width: `${100 / lanes}%`,
                    }}
                  >
                    <EventChip ev={ev} onEventClick={onEventClick} loc={loc} compact={!single} />
                  </div>
                );
              })}
              {isToday && (
                <div className="cal-now" style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_PX }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthGrid({ cursor, eventsOn, now, loc, t, onDayClick, onEventClick }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const weekdays = Array.from({ length: 7 }, (_, i) => addDays(start, i).toLocaleDateString(loc, { weekday: "short" }));
  const MAX = 3;
  return (
    <div className="cal-month">
      {weekdays.map((w) => (
        <div key={w} className="cal-month-wd">
          {w}
        </div>
      ))}
      {cells.map((d) => {
        const list = eventsOn(d);
        const inMonth = d.getMonth() === cursor.getMonth();
        return (
          <div
            key={dayKey(d)}
            className={`cal-month-cell ${inMonth ? "" : "out"} ${sameDay(d, now) ? "today" : ""}`}
            onClick={() => onDayClick(d)}
            role="button"
            aria-label={d.toLocaleDateString(loc)}
          >
            <span className="cal-dn">{d.getDate()}</span>
            {list.slice(0, MAX).map((ev) => (
              <EventChip key={ev.id} ev={ev} onEventClick={onEventClick} loc={loc} compact />
            ))}
            {list.length > MAX && <span className="cal-more">{t("agenda.calMore", { count: list.length - MAX })}</span>}
          </div>
        );
      })}
    </div>
  );
}

function YearGrid({ year, eventsOn, now, loc, onDayClick, onMonthClick }) {
  return (
    <div className="cal-year">
      {Array.from({ length: 12 }, (_, m) => {
        const first = new Date(year, m, 1);
        const start = startOfWeek(first);
        const last = new Date(year, m + 1, 0);
        const count = Math.ceil(((last - start) / 86400000 + 1) / 7) * 7;
        return (
          <div key={m} className="cal-mini">
            <button type="button" className="cal-mini-title" onClick={() => onMonthClick(year, m)}>
              {first.toLocaleDateString(loc, { month: "long" })}
            </button>
            <div className="cal-mini-grid">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={`h${i}`} className="cal-mini-wd">
                  {addDays(start, i).toLocaleDateString(loc, { weekday: "narrow" })}
                </span>
              ))}
              {Array.from({ length: count }, (_, i) => {
                const d = addDays(start, i);
                if (d.getMonth() !== m) return <span key={i} />;
                const has = eventsOn(d).length > 0;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`cal-mini-day ${sameDay(d, now) ? "today" : ""} ${has ? "has" : ""}`}
                    onClick={() => onDayClick(d)}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
