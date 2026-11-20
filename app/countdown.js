// Settings, templates and time maths for the Countdown Timer. Shared by the dashboard and its
// live preview; the storefront (extensions/boostify-theme/assets/countdown.js) reads the same shape
// from the app metafield boostify.countdown.

export const MAX_TIMERS = 5;

export const TIMER_MODES = [
  { value: "fixed", label: "Fixed deadline (same end time for everyone)" },
  {
    value: "evergreen",
    label: "Evergreen (each visitor gets their own countdown)",
  },
  { value: "daily", label: "Daily reset (ends at the same time every day)" },
];

export const LAYOUTS = [
  { value: "inline", label: "In a row (compact)" },
  { value: "boxes", label: "Boxes (big numbers)" },
  { value: "text", label: "Plain text" },
];

export const TEMPLATE_GROUPS = [
  {
    place: "bar",
    title: "Top-of-page bar",
    blurb: "A strip at the top of every page, below your announcement bars",
  },
  {
    place: "block",
    title: "Product page / anywhere",
    blurb: "Add it with the Boostify Timer block wherever you like",
  },
];

const T = (id, name, place, style) => ({ id, name, place, style });

export const TEMPLATES = [
  // ---------- top-of-page bars ----------
  T("flash-red", "Flash sale", "bar", {
    layout: "inline",
    title: "🔥 Flash sale ends in",
    buttonText: "Shop now",
    buttonLink: "/collections/all",
    bgFrom: "#d4161c",
    bgTo: "#ff4d2e",
    angle: 90,
    textColor: "#ffffff",
    digitBg: "#ffffff22",
    digitColor: "#ffffff",
    labelColor: "#ffffffcc",
    accentColor: "#fff176",
    btnBg: "#ffffff",
    btnText: "#d4161c",
    fontWeight: 700,
  }),
  T("black-friday", "Black Friday", "bar", {
    layout: "inline",
    title: "BLACK FRIDAY ENDS IN",
    buttonText: "Shop deals",
    buttonLink: "/collections/all",
    bgFrom: "#000000",
    bgTo: "#000000",
    textColor: "#ffffff",
    digitBg: "#ffd24a",
    digitColor: "#000000",
    labelColor: "#ffffffaa",
    accentColor: "#ff3b3b",
    btnBg: "#ffd24a",
    btnText: "#000000",
    fontWeight: 800,
    uppercase: true,
  }),
  T("soft-cream", "Soft cream", "bar", {
    layout: "text",
    title: "Free gift with every order, ends in",
    buttonText: "",
    buttonLink: "",
    bgFrom: "#f3efe7",
    bgTo: "#f3efe7",
    textColor: "#1d1d1b",
    digitBg: "#1d1d1b11",
    digitColor: "#1d1d1b",
    labelColor: "#1d1d1b99",
    accentColor: "#c2410c",
    btnBg: "#1d1d1b",
    btnText: "#ffffff",
    fontWeight: 600,
  }),
  T("neon-bar", "Neon", "bar", {
    layout: "inline",
    title: "⚡ Drop ends in",
    buttonText: "Grab it",
    buttonLink: "/collections/all",
    bgFrom: "#0b1026",
    bgTo: "#0b1026",
    textColor: "#e8ecff",
    digitBg: "#b6ff3b",
    digitColor: "#0b1026",
    labelColor: "#e8ecffaa",
    accentColor: "#ff4d8d",
    btnBg: "#b6ff3b",
    btnText: "#0b1026",
    fontWeight: 700,
  }),

  // ---------- product page / block ----------
  T("boxes-dark", "Dark boxes", "block", {
    layout: "boxes",
    title: "Hurry! Offer ends in",
    buttonText: "",
    buttonLink: "",
    showLabels: true,
    bgFrom: "#ffffff",
    bgTo: "#ffffff",
    textColor: "#111111",
    digitBg: "#111111",
    digitColor: "#ffffff",
    labelColor: "#555555",
    accentColor: "#d4161c",
    border: true,
    radius: 12,
    inset: 0,
    fontWeight: 700,
    align: "left",
  }),
  T("boxes-light", "Light cards", "block", {
    layout: "boxes",
    title: "Sale ends in",
    buttonText: "",
    buttonLink: "",
    showLabels: true,
    bgFrom: "#fff7ed",
    bgTo: "#fff7ed",
    textColor: "#7c2d12",
    digitBg: "#ffffff",
    digitColor: "#c2410c",
    labelColor: "#9a3412",
    accentColor: "#dc2626",
    border: true,
    radius: 14,
    inset: 0,
    fontWeight: 800,
    align: "center",
  }),
  T("gradient-card", "Gradient card", "block", {
    layout: "boxes",
    title: "⏳ Limited time offer",
    buttonText: "",
    buttonLink: "",
    showLabels: true,
    bgFrom: "#5b2bff",
    bgTo: "#ff2b8a",
    angle: 135,
    textColor: "#ffffff",
    digitBg: "#ffffff22",
    digitColor: "#ffffff",
    labelColor: "#ffffffcc",
    accentColor: "#fff176",
    radius: 16,
    inset: 0,
    shadow: true,
    fontWeight: 800,
    align: "center",
  }),
  T("minimal-text", "Minimal text", "block", {
    layout: "text",
    title: "Offer ends in",
    buttonText: "",
    buttonLink: "",
    showLabels: true,
    bgFrom: "#ffffff",
    bgTo: "#ffffff",
    textColor: "#111111",
    digitBg: "#00000000",
    digitColor: "#d4161c",
    labelColor: "#444444",
    accentColor: "#d4161c",
    border: false,
    radius: 0,
    inset: 0,
    fontWeight: 600,
    align: "left",
  }),
];

const DEFAULTS = {
  mode: "fixed",
  place: "bar", // bar = top of every page, block = via the Boostify Timer block
  deadline: "", // "YYYY-MM-DD HH:MM" in the store's time zone
  deadlineUtc: null,
  durationMin: 120, // evergreen
  dailyTime: "23:59", // daily reset, visitor's local time
  showFrom: "",
  showFromUtc: null,

  layout: "inline",
  title: "Sale ends in",
  expiredText: "This offer has ended",
  expiredAction: "message", // message | hide
  showDays: true,
  showSeconds: true,
  showLabels: true,
  labels: { days: "Days", hours: "Hrs", minutes: "Mins", seconds: "Secs" },
  urgentMinutes: 60, // digits switch to the accent colour in the last N minutes
  buttonText: "",
  buttonLink: "",
  showOn: "all", // bar only: all | home | product

  bgFrom: "#111111",
  bgTo: "#111111",
  angle: 90,
  textColor: "#ffffff",
  digitBg: "#ffffff22",
  digitColor: "#ffffff",
  labelColor: "#ffffffaa",
  accentColor: "#ffd24a",
  btnBg: "#ffffff",
  btnText: "#111111",
  btnRadius: 999,
  fontFamily: "inherit",
  fontSize: 15,
  fontWeight: 700,
  uppercase: false,
  align: "center",
  padding: 10,
  radius: 0,
  inset: 0,
  border: false,
  shadow: false,
  sticky: false,
};

export const FONT_STACKS = {
  inherit: "inherit",
  serif: 'Georgia, "Times New Roman", serif',
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function timerFromTemplate(templateId) {
  const t = TEMPLATES.find((x) => x.id === templateId) || TEMPLATES[0];
  return {
    ...DEFAULTS,
    labels: { ...DEFAULTS.labels },
    ...t.style,
    id: newId(),
    name: t.name,
    template: t.id,
    enabled: false,
    place: t.place,
  };
}

// ---------- time zones ----------
const LOCAL = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;

function tzOffsetMs(utcMs, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    +v.year,
    +v.month - 1,
    +v.day,
    +v.hour,
    +v.minute,
    +v.second,
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

// "2026-11-30 23:59" in a store time zone -> UTC milliseconds (null when it isn't a valid date)
export function zonedToUtc(str, tz) {
  const m = LOCAL.exec(String(str || "").trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Reject dates that don't exist (e.g. 31 November), which would silently roll into the next month
  const check = new Date(guess);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  let zone = tz || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
  } catch {
    zone = "UTC";
  }
  const off1 = tzOffsetMs(guess, zone);
  let utc = guess - off1;
  const off2 = tzOffsetMs(utc, zone);
  if (off2 !== off1) utc = guess - off2;
  return utc;
}

const clamp = (n, min, max, fallback) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
};
// 8-digit hex (with alpha) is allowed so the digit boxes can be translucent
const color = (v, fallback) =>
  typeof v === "string" &&
  /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.trim())
    ? v.trim()
    : fallback;
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const bool = (v, fallback) => (typeof v === "boolean" ? v : fallback);
const safeUrl = (v) => {
  const s = str(v, 500).trim();
  return /^(https?:\/\/|\/)/i.test(s) ? s : "";
};

// Run on the server before saving, so the storefront only ever sees clean data.
export function sanitizeCountdown(input, tz) {
  const list = Array.isArray(input?.timers)
    ? input.timers.slice(0, MAX_TIMERS)
    : [];
  const D = DEFAULTS;
  return {
    version: 1,
    timezone: str(tz, 60) || "UTC",
    timers: list.map((t) => {
      const deadline = str(t.deadline, 20).trim();
      const showFrom = str(t.showFrom, 20).trim();
      const labels = t.labels && typeof t.labels === "object" ? t.labels : {};
      const dailyOk = /^([01]\d|2[0-3]):[0-5]\d$/.test(str(t.dailyTime, 5));
      return {
        id: str(t.id, 24) || newId(),
        name: str(t.name, 60) || "Untitled timer",
        template: str(t.template, 40),
        enabled: bool(t.enabled, false),
        mode: oneOf(t.mode, ["fixed", "evergreen", "daily"], D.mode),
        place: oneOf(t.place, ["bar", "block"], D.place),
        deadline,
        deadlineUtc: zonedToUtc(deadline, tz),
        durationMin: clamp(t.durationMin, 1, 60 * 24 * 30, D.durationMin),
        dailyTime: dailyOk ? str(t.dailyTime, 5) : D.dailyTime,
        showFrom,
        showFromUtc: zonedToUtc(showFrom, tz),
        layout: oneOf(t.layout, ["inline", "boxes", "text"], D.layout),
        title: str(t.title, 80),
        expiredText: str(t.expiredText, 120),
        expiredAction: oneOf(
          t.expiredAction,
          ["message", "hide"],
          D.expiredAction,
        ),
        showDays: bool(t.showDays, D.showDays),
        showSeconds: bool(t.showSeconds, D.showSeconds),
        showLabels: bool(t.showLabels, D.showLabels),
        labels: {
          days: str(labels.days, 12) || D.labels.days,
          hours: str(labels.hours, 12) || D.labels.hours,
          minutes: str(labels.minutes, 12) || D.labels.minutes,
          seconds: str(labels.seconds, 12) || D.labels.seconds,
        },
        urgentMinutes: clamp(t.urgentMinutes, 0, 60 * 24, D.urgentMinutes),
        buttonText: str(t.buttonText, 30),
        buttonLink: safeUrl(t.buttonLink),
        showOn: oneOf(t.showOn, ["all", "home", "product"], D.showOn),
        bgFrom: color(t.bgFrom, D.bgFrom),
        bgTo: color(t.bgTo, D.bgTo),
        angle: clamp(t.angle, 0, 360, D.angle),
        textColor: color(t.textColor, D.textColor),
        digitBg: color(t.digitBg, D.digitBg),
        digitColor: color(t.digitColor, D.digitColor),
        labelColor: color(t.labelColor, D.labelColor),
        accentColor: color(t.accentColor, D.accentColor),
        btnBg: color(t.btnBg, D.btnBg),
        btnText: color(t.btnText, D.btnText),
        btnRadius: clamp(t.btnRadius, 0, 999, D.btnRadius),
        fontFamily: oneOf(
          t.fontFamily,
          ["inherit", "serif", "mono"],
          D.fontFamily,
        ),
        fontSize: clamp(t.fontSize, 12, 28, D.fontSize),
        fontWeight: oneOf(
          Number(t.fontWeight),
          [400, 500, 600, 700, 800],
          D.fontWeight,
        ),
        uppercase: bool(t.uppercase, D.uppercase),
        align: oneOf(t.align, ["left", "center", "right"], D.align),
        padding: clamp(t.padding, 4, 28, D.padding),
        radius: clamp(t.radius, 0, 999, D.radius),
        inset: clamp(t.inset, 0, 32, D.inset),
        border: bool(t.border, D.border),
        shadow: bool(t.shadow, D.shadow),
        sticky: bool(t.sticky, D.sticky),
      };
    }),
  };
}

export function timerBackground(t) {
  return t.bgFrom === t.bgTo
    ? t.bgFrom
    : `linear-gradient(${t.angle}deg, ${t.bgFrom}, ${t.bgTo})`;
}

// Splits a number of milliseconds into the units shown on the timer
export function splitRemaining(ms, showDays) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600) + (showDays ? 0 : days * 24);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days: showDays ? days : 0, hours, minutes, seconds };
}

export const pad2 = (n) => String(n).padStart(2, "0");

// "YYYY-MM-DD HH:MM" for a moment in time, as the clock reads in the store's time zone
export function formatInZone(ms, tz) {
  let zone = tz || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
  } catch {
    zone = "UTC";
  }
  const v = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  return `${v.year}-${v.month}-${v.day} ${v.hour}:${v.minute}`;
}

// Why a timer would not appear on the store right now (null = it will show)
export function whyHidden(t, tz, now = Date.now()) {
  if (!t.enabled) return "It is turned off.";
  if (t.mode === "fixed") {
    const end = zonedToUtc(t.deadline, tz);
    if (!t.deadline)
      return "It has no end time. Add one under Timer → Ends at.";
    if (end === null)
      return "The end time isn't a valid date. Use the format 2026-11-30 23:59.";
    if (end <= now) return "Its end time has already passed.";
  }
  if (
    t.mode === "daily" &&
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(t.dailyTime || "")
  ) {
    return "The daily reset time isn't valid. Use 24-hour time, e.g. 23:59.";
  }
  const from = zonedToUtc(t.showFrom, tz);
  if (t.showFrom && from !== null && from > now)
    return "Its start time is still in the future.";
  return null;
}
