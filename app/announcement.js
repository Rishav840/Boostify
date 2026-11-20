import { zonedToUtc } from "./countdown.js";

// Shared by the admin dashboard and its live preview.
// The storefront script (extensions/boostify-theme/assets/announcement-bar.js)
// reads the same shape from the shop's app metafield.

export const MAX_BARS = 5;
export const MAX_MESSAGES = 8;

// Three bar types, named the way merchants think about them.
export const BAR_TYPES = [
  { value: "static", label: "Regular" },
  { value: "marquee", label: "Moving line" },
  { value: "rotate", label: "Carousel" },
];

export const TEMPLATE_GROUPS = [
  {
    type: "static",
    title: "Regular",
    blurb: "One message with an optional button",
  },
  {
    type: "marquee",
    title: "Moving line",
    blurb: "A continuously scrolling ticker",
  },
  {
    type: "rotate",
    title: "Carousel",
    blurb: "Several messages that slide or fade",
  },
];

const msg = (text, link = "", buttonText = "") => ({ text, link, buttonText });

export const TEMPLATES = [
  // ---------- Regular ----------
  {
    id: "lime-pop",
    name: "Lime pop",
    type: "static",
    style: {
      bgFrom: "#c6f432",
      bgTo: "#c6f432",
      textColor: "#111111",
      accentColor: "#111111",
      btnBg: "#1a1a1a",
      btnText: "#ffffff",
      btnRadius: 8,
      fontSize: 18,
      fontWeight: 700,
      padding: 14,
      letterSpacing: 0,
    },
    messages: [
      msg(
        "Enjoy a 20% discount on all our products!",
        "/collections/all",
        "Shop now!",
      ),
    ],
  },
  {
    id: "purple-promo",
    name: "Purple promo",
    type: "static",
    style: {
      bgFrom: "#3b0a8a",
      bgTo: "#7b2fe0",
      angle: 90,
      textColor: "#ffffff",
      accentColor: "#ff2b7a",
      btnBg: "#ff2b7a",
      btnText: "#ffffff",
      btnRadius: 6,
      fontSize: 17,
      fontWeight: 700,
      padding: 12,
      radius: 14,
      inset: 10,
      shadow: true,
      dismissible: true,
    },
    messages: [
      msg(
        "Hurry, enjoy a 20% discount on all our products!",
        "/collections/all",
        "Shop now!",
      ),
    ],
  },
  {
    id: "clean-white",
    name: "Clean white",
    type: "static",
    style: {
      bgFrom: "#ffffff",
      bgTo: "#ffffff",
      textColor: "#111111",
      accentColor: "#111111",
      btnBg: "#111111",
      btnText: "#ffffff",
      btnRadius: 10,
      fontSize: 15,
      fontWeight: 600,
      padding: 12,
      radius: 12,
      inset: 10,
      border: true,
    },
    messages: [
      msg(
        "Complimentary gift wrapping on every order",
        "/collections/all",
        "Learn more",
      ),
    ],
  },
  {
    id: "flash-red",
    name: "Flash sale",
    type: "static",
    style: {
      bgFrom: "#d4161c",
      bgTo: "#ff4d2e",
      angle: 90,
      textColor: "#ffffff",
      accentColor: "#ffffff",
      btnBg: "#ffffff",
      btnText: "#d4161c",
      btnRadius: 999,
      fontSize: 15,
      fontWeight: 800,
      padding: 12,
      uppercase: true,
      letterSpacing: 1,
    },
    messages: [
      msg("⚡ Flash sale - up to 50% off", "/collections/all", "Shop now"),
    ],
  },

  // ---------- Moving line ----------
  {
    id: "black-friday",
    name: "Black Friday",
    type: "marquee",
    style: {
      bgFrom: "#5ee7f5",
      bgTo: "#b3a7ff",
      angle: 90,
      textColor: "#0b1a5c",
      accentColor: "#0b1a5c",
      fontSize: 20,
      fontWeight: 800,
      padding: 12,
      uppercase: true,
      radius: 14,
      inset: 10,
      separator: "🔥",
      speed: 25,
    },
    messages: [msg("Black Friday sale!")],
  },
  {
    id: "news-ticker",
    name: "News ticker",
    type: "marquee",
    style: {
      bgFrom: "#111111",
      bgTo: "#111111",
      textColor: "#ffffff",
      accentColor: "#ffd24a",
      fontSize: 14,
      fontWeight: 600,
      padding: 10,
      uppercase: true,
      letterSpacing: 1.5,
      separator: "•",
      speed: 30,
    },
    messages: [
      msg("Free shipping over ₹500"),
      msg("Easy 30-day returns"),
      msg("New arrivals every week"),
      msg("Secure checkout"),
    ],
  },
  {
    id: "neon-ticker",
    name: "Neon ticker",
    type: "marquee",
    style: {
      bgFrom: "#0b1026",
      bgTo: "#0b1026",
      textColor: "#b6ff3b",
      accentColor: "#b6ff3b",
      fontSize: 16,
      fontWeight: 700,
      padding: 12,
      letterSpacing: 1,
      separator: "✦",
      edgeFade: true,
      speed: 22,
    },
    messages: [
      msg("Drop 03 is live"),
      msg("Limited stock"),
      msg("Free shipping over ₹999"),
    ],
  },
  {
    id: "candy-ticker",
    name: "Candy pill",
    type: "marquee",
    style: {
      bgFrom: "#ffd1e8",
      bgTo: "#ffe9c9",
      angle: 90,
      textColor: "#7a1346",
      accentColor: "#7a1346",
      fontSize: 16,
      fontWeight: 700,
      padding: 11,
      radius: 999,
      inset: 10,
      separator: "♥",
      speed: 28,
    },
    messages: [msg("Buy 2 get 1 free"), msg("This weekend only")],
  },

  // ---------- Carousel ----------
  {
    id: "soft-carousel",
    name: "Soft carousel",
    type: "rotate",
    style: {
      bgFrom: "#ffffff",
      bgTo: "#ffffff",
      textColor: "#111111",
      accentColor: "#111111",
      btnBg: "#111111",
      btnText: "#ffffff",
      fontSize: 17,
      fontWeight: 700,
      padding: 14,
      radius: 12,
      inset: 10,
      border: true,
      edgeFade: true,
      animation: "fade",
      interval: 4,
      arrows: true,
    },
    messages: [
      msg("🚚 Free shipping on all orders over ₹500"),
      msg("↩️ Easy 30-day returns"),
      msg("🎁 Free gift on orders over ₹1999"),
    ],
  },
  {
    id: "midnight-carousel",
    name: "Midnight",
    type: "rotate",
    style: {
      bgFrom: "#111111",
      bgTo: "#111111",
      textColor: "#ffffff",
      accentColor: "#ffd24a",
      btnBg: "#ffd24a",
      btnText: "#111111",
      btnRadius: 6,
      fontSize: 14,
      fontWeight: 600,
      padding: 11,
      animation: "slide",
      interval: 4,
      arrows: true,
    },
    messages: [
      msg("New arrivals just dropped", "/collections/all", "Shop"),
      msg("Free shipping on orders over ₹500"),
    ],
  },
  {
    id: "forest-carousel",
    name: "Forest card",
    type: "rotate",
    style: {
      bgFrom: "#16412f",
      bgTo: "#1f5a43",
      angle: 90,
      textColor: "#eafaf0",
      accentColor: "#b8f2c9",
      btnBg: "#b8f2c9",
      btnText: "#16412f",
      btnRadius: 999,
      fontSize: 15,
      fontWeight: 600,
      padding: 12,
      radius: 14,
      inset: 10,
      shadow: true,
      animation: "slide",
      interval: 5,
      arrows: true,
    },
    messages: [
      msg("🌿 Eco-friendly packaging on every order"),
      msg("Plant a tree with each purchase", "/pages/about", "Learn more"),
    ],
  },
  {
    id: "sunset-carousel",
    name: "Sunset pill",
    type: "rotate",
    style: {
      bgFrom: "#ff5f6d",
      bgTo: "#7a3cff",
      angle: 90,
      textColor: "#ffffff",
      accentColor: "#ffffff",
      btnBg: "#ffffff",
      btnText: "#7a3cff",
      btnRadius: 999,
      fontSize: 16,
      fontWeight: 700,
      padding: 12,
      radius: 999,
      inset: 10,
      animation: "fade",
      interval: 4,
      arrows: true,
    },
    messages: [
      msg("🔥 Big sale is live", "/collections/all", "Shop now"),
      msg("🚚 Free shipping over ₹500"),
    ],
  },
];

const DEFAULTS = {
  type: "rotate",
  placement: "top",
  bgFrom: "#111111",
  bgTo: "#111111",
  angle: 90,
  bgImage: "",
  textColor: "#ffffff",
  accentColor: "#ffd24a",
  btnStyle: "solid",
  btnBg: "#ffffff",
  btnText: "#111111",
  btnRadius: 999,
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 0.5,
  uppercase: false,
  align: "center",
  padding: 8,
  size: "compact", // compact | normal
  radius: 0,
  inset: 0,
  border: false,
  shadow: false,
  edgeFade: false,
  separator: "•",
  animation: "slide",
  interval: 4,
  speed: 25,
  arrows: true,
  sticky: false,
  dismissible: false,
  showOn: "all",
  start: "",
  end: "",
};

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyMessage(text = "") {
  return { text, link: "", buttonText: "" };
}

export function barFromTemplate(templateId) {
  const t = TEMPLATES.find((x) => x.id === templateId) || TEMPLATES[0];
  return {
    ...DEFAULTS,
    ...t.style,
    id: newId(),
    name: t.name,
    template: t.id,
    enabled: false,
    type: t.type,
    messages: t.messages.map((m) => ({ ...m })),
  };
}

const clamp = (n, min, max, fallback) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
};
const color = (v, fallback) =>
  typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v.trim())
    ? v.trim()
    : fallback;
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const safeUrl = (v) => {
  const s = str(v, 500).trim();
  return /^(https?:\/\/|\/)/i.test(s) ? s : "";
};

// Used by the server before saving, so the storefront only ever sees clean data.

// `tz` is the store's time zone: start/end are typed in store time and saved as exact moments
export function sanitizeConfig(input, tz) {
  const bars = Array.isArray(input?.bars) ? input.bars.slice(0, MAX_BARS) : [];
  return {
    version: 2,
    bars: bars.map((b) => ({
      id: str(b.id, 24) || newId(),
      name: str(b.name, 60) || "Untitled bar",
      template: str(b.template, 40),
      enabled: !!b.enabled,
      type: oneOf(b.type, ["static", "rotate", "marquee"], DEFAULTS.type),
      placement: oneOf(b.placement, ["top", "inline"], DEFAULTS.placement),
      messages: (Array.isArray(b.messages) ? b.messages : [])
        .slice(0, MAX_MESSAGES)
        .map((m) => ({
          text: str(m?.text, 200),
          link: safeUrl(m?.link),
          buttonText: str(m?.buttonText, 30),
        }))
        .filter((m) => m.text.trim()),
      bgFrom: color(b.bgFrom, DEFAULTS.bgFrom),
      bgTo: color(b.bgTo, DEFAULTS.bgTo),
      angle: clamp(b.angle, 0, 360, DEFAULTS.angle),
      bgImage: safeUrl(b.bgImage),
      textColor: color(b.textColor, DEFAULTS.textColor),
      accentColor: color(b.accentColor, DEFAULTS.accentColor),
      btnStyle: oneOf(b.btnStyle, ["solid", "outline"], DEFAULTS.btnStyle),
      btnBg: color(b.btnBg, DEFAULTS.btnBg),
      btnText: color(b.btnText, DEFAULTS.btnText),
      btnRadius: clamp(b.btnRadius, 0, 999, DEFAULTS.btnRadius),
      fontFamily: oneOf(
        b.fontFamily,
        ["inherit", "serif", "mono"],
        DEFAULTS.fontFamily,
      ),
      fontSize: clamp(b.fontSize, 11, 28, DEFAULTS.fontSize),
      fontWeight: oneOf(
        Number(b.fontWeight),
        [400, 500, 600, 700, 800],
        DEFAULTS.fontWeight,
      ),
      letterSpacing: clamp(b.letterSpacing, 0, 3, DEFAULTS.letterSpacing),
      uppercase: !!b.uppercase,
      align: oneOf(b.align, ["left", "center", "right"], DEFAULTS.align),
      padding: clamp(b.padding, 4, 28, DEFAULTS.padding),
      size: oneOf(b.size, ["compact", "normal"], DEFAULTS.size),
      radius: clamp(b.radius, 0, 999, DEFAULTS.radius),
      inset: clamp(b.inset, 0, 32, DEFAULTS.inset),
      border: !!b.border,
      shadow: !!b.shadow,
      edgeFade: !!b.edgeFade,
      separator: str(b.separator, 4),
      animation: oneOf(
        b.animation,
        ["slide", "slide-x", "fade"],
        DEFAULTS.animation,
      ),
      interval: clamp(b.interval, 2, 10, DEFAULTS.interval),
      speed: clamp(b.speed, 10, 60, DEFAULTS.speed),
      arrows: !!b.arrows,
      sticky: !!b.sticky,
      dismissible: !!b.dismissible,
      showOn: oneOf(b.showOn, ["all", "home"], DEFAULTS.showOn),
      start: str(b.start, 20),
      end: str(b.end, 20),
      startUtc: zonedToUtc(str(b.start, 20), tz || "UTC"),
      endUtc: zonedToUtc(str(b.end, 20), tz || "UTC"),
    })),
  };
}

export function barBackground(bar) {
  const base =
    bar.bgFrom === bar.bgTo
      ? bar.bgFrom
      : `linear-gradient(${bar.angle}deg, ${bar.bgFrom}, ${bar.bgTo})`;
  return bar.bgImage
    ? `url("${bar.bgImage}") center / cover no-repeat, ${bar.bgFrom}`
    : base;
}

export const FONT_STACKS = {
  inherit: "inherit",
  serif: 'Georgia, "Times New Roman", serif',
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

// The sizes actually used on the storefront. Compact (the default) trims height, text and spacing.
// The storefront script (extensions/boostify-theme/assets/announcement-bar.js) has the same formula.
export function effectiveSize(bar) {
  if (bar.size === "normal")
    return { pad: bar.padding, fontSize: bar.fontSize, inset: bar.inset };
  return {
    pad: Math.max(4, Math.round(bar.padding * 0.7)),
    fontSize: Math.max(11, Math.round(bar.fontSize * 0.9 * 10) / 10),
    inset: Math.round(bar.inset * 0.6),
  };
}

// Moves from one message to the next straight away; direction aware. The storefront script
// (extensions/boostify-theme/assets/announcement-bar.js) has the same function.
export function animateSwap(cur, nxt, dir, mode, ms) {
  if (!cur || !nxt || cur === nxt || !nxt.animate) return;
  const axis = mode === "slide-x" ? "X" : "Y";
  cur.getAnimations?.().forEach((a) => a.finish());
  nxt.getAnimations?.().forEach((a) => a.finish());
  cur.classList.add("is-leaving");
  const out =
    mode === "fade"
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [
          { transform: `translate${axis}(0)`, opacity: 1 },
          { transform: `translate${axis}(${-dir * 100}%)`, opacity: 0 },
        ];
  const inn =
    mode === "fade"
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { transform: `translate${axis}(${dir * 100}%)`, opacity: 0 },
          { transform: `translate${axis}(0)`, opacity: 1 },
        ];
  const opts = {
    duration: ms,
    easing: mode === "fade" ? "ease" : "cubic-bezier(.3,.7,.2,1)",
  };
  const a = cur.animate(out, opts);
  nxt.animate(inn, opts);
  const done = () => cur.classList.remove("is-leaving");
  a.onfinish = done;
  a.oncancel = done;
}
