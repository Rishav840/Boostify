// Settings and maths for the Cart Progress Bar. Shared by the dashboard and its live preview;
// the storefront reads the same shape from the app metafield boostify.cart_progress
// (extensions/boostify-theme/assets/cart-progress.js has its own copy of computeProgress).

export const MAX_GOALS = 4;

// Simple one-colour line icons (they take the marker's icon colour). Keys are stored as "svg:<name>".
// The storefront script (extensions/boostify-theme/assets/cart-progress.js) has the same set.
export const LINE_ICONS = {
  truck:
    '<path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  percent:
    '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8"/><path d="M12 8v12"/><path d="M12 8C10 4 6 4 6 6.5S9.5 8 12 8zM12 8c2-4 6-4 6-1.5S14.5 8 12 8z"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  heart:
    '<path d="M12 20s-7-4.4-9-9a4.5 4.5 0 0 1 9-3.2A4.5 4.5 0 0 1 21 11c-2 4.6-9 9-9 9z"/>',
};

// Quick picks: line icons first (cleanest look), then emoji. The icon box also accepts any text.
export const GOAL_ICONS = [
  ["svg:truck", "Truck (line icon)"],
  ["svg:percent", "Percent (line icon)"],
  ["svg:gift", "Gift (line icon)"],
  ["svg:tag", "Tag (line icon)"],
  ["svg:star", "Star (line icon)"],
  ["svg:heart", "Heart (line icon)"],
  ["🚚", "🚚 Delivery"],
  ["🎁", "🎁 Gift"],
  ["🏷️", "🏷️ Discount"],
  ["⭐", "⭐ Star"],
  ["🔥", "🔥 Fire"],
  ["💝", "💝 Heart"],
  ["👑", "👑 Crown"],
  ["🎉", "🎉 Party"],
  ["💎", "💎 Diamond"],
];

export const CP_DEFAULTS = {
  version: 2,
  enabled: false,

  goals: [
    {
      amount: 500,
      label: "free shipping",
      icon: "svg:truck",
      iconImage: "",
      tip: "",
    },
    {
      amount: 1000,
      label: "10% off",
      icon: "svg:percent",
      iconImage: "",
      tip: "",
    },
    {
      amount: 2000,
      label: "a free gift",
      icon: "svg:gift",
      iconImage: "",
      tip: "",
    },
  ],

  // Tokens: {amount} = still to spend, {goal} = next goal's name, {threshold} = next goal's amount
  progressText: "Spend {amount} more for {goal}",
  allReachedText: "You've unlocked every reward!",
  emptyText: "Spend {threshold} for {goal}", // shown while the cart is empty

  showMilestones: true,
  showLabels: false, // reward name under each marker (the Clean style shows it in a tooltip instead)
  showAmounts: false, // the amount above each marker
  tooltips: true, // hover / tap a marker to see the offer
  iconInMessage: true, // the next reward's icon before the message
  confetti: true, // party-popper blast inside the cart drawer each time a goal is reached
  showEmpty: true, // show the bar when the cart is empty

  // Where it shows (cart drawer and cart page only)
  showDrawer: true,
  showCartPage: true,

  // Look: "clean" = soft markers with a gap in the bar and tooltips; "classic" = amounts/names/check badges
  layout: "clean",
  backgroundMode: "none", // none | solid
  bg: "#ffffff",
  textColor: "#111111",
  fillColor: "#111111", // the bar colour
  fillColor2: "#111111", // same as fillColor = solid, different = gradient
  trackColor: "#e5e7eb",
  markerBg: "#ebebeb",
  markerIconColor: "#111111",
  gapColor: "#ffffff", // the small gap around each marker; match your cart's background
  height: 8, // bar thickness in px
  barShape: "rounded", // square | rounded
  markerShape: "circle", // circle | square
  markerSize: 28,
  radius: 0, // corners of the card, only visible with a solid background
  divider: false, // thin line under the bar
  border: false,
  shadow: false,
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 400,
  density: "compact", // compact | roomy
};

const clamp = (n, min, max, fallback) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
};
const color = (v, fallback) =>
  typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v.trim())
    ? v.trim()
    : fallback;
const text = (v, max, fallback) =>
  typeof v === "string" ? v.trim().slice(0, max) : fallback;
const safeUrl = (v) => {
  const u = typeof v === "string" ? v.trim().slice(0, 500) : "";
  return /^(https?:\/\/|\/)/i.test(u) ? u : "";
};
const bool = (v, fallback) => (typeof v === "boolean" ? v : fallback);
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);

const D = CP_DEFAULTS;

// Run on the server before saving, so the storefront only ever sees clean data.
export function sanitizeCartProgress(input) {
  const i = input && typeof input === "object" ? input : {};
  const goals = (Array.isArray(i.goals) ? i.goals : D.goals)
    .slice(0, MAX_GOALS)
    .map((g) => ({
      amount: clamp(g?.amount, 1, 10000000, 0),
      label: text(g?.label, 30, "") || "your reward",
      icon: text(g?.icon, 12, "🎁") || "🎁",
      tip: text(g?.tip, 80, ""),
      iconImage: safeUrl(g?.iconImage),
    }))
    .filter((g) => g.amount > 0)
    .sort((a, b) => a.amount - b.amount);

  return {
    version: 2,
    enabled: bool(i.enabled, D.enabled),
    goals: goals.length ? goals : D.goals.map((g) => ({ ...g })),
    progressText: text(i.progressText, 150, D.progressText) || D.progressText,
    allReachedText:
      text(i.allReachedText, 150, D.allReachedText) || D.allReachedText,
    emptyText: text(i.emptyText, 150, D.emptyText),
    showMilestones: bool(i.showMilestones, D.showMilestones),
    showLabels: bool(i.showLabels, D.showLabels),
    showAmounts: bool(i.showAmounts, D.showAmounts),
    tooltips: bool(i.tooltips, D.tooltips),
    iconInMessage: bool(i.iconInMessage, D.iconInMessage),
    layout: oneOf(i.layout, ["clean", "classic"], D.layout),
    markerIconColor: color(i.markerIconColor, D.markerIconColor),
    gapColor: color(i.gapColor, D.gapColor),
    confetti: bool(i.confetti, D.confetti),
    showEmpty: bool(i.showEmpty, D.showEmpty),
    showDrawer: bool(i.showDrawer, D.showDrawer),
    showCartPage: bool(i.showCartPage, D.showCartPage),
    backgroundMode: oneOf(
      i.backgroundMode,
      ["none", "solid"],
      D.backgroundMode,
    ),
    bg: color(i.bg, D.bg),
    textColor: color(i.textColor, D.textColor),
    fillColor: color(i.fillColor, D.fillColor),
    fillColor2: color(i.fillColor2, color(i.fillColor, D.fillColor2)),
    trackColor: color(i.trackColor, D.trackColor),
    markerBg: color(i.markerBg, D.markerBg),
    height: clamp(i.height, 2, 24, D.height),
    barShape: oneOf(i.barShape, ["square", "rounded"], D.barShape),
    markerShape: oneOf(i.markerShape, ["circle", "square"], D.markerShape),
    markerSize: clamp(i.markerSize, 16, 44, D.markerSize),
    radius: clamp(i.radius, 0, 999, D.radius),
    divider: bool(i.divider, D.divider),
    border: bool(i.border, D.border),
    shadow: bool(i.shadow, D.shadow),
    fontFamily: oneOf(i.fontFamily, ["inherit", "serif", "mono"], D.fontFamily),
    fontSize: clamp(i.fontSize, 12, 20, D.fontSize),
    fontWeight: oneOf(Number(i.fontWeight), [400, 500, 600, 700], D.fontWeight),
    density: oneOf(i.density, ["compact", "roomy"], D.density),
  };
}

// Formats cents using a Shopify money format such as "Rs. {{amount}}" or "${{amount_no_decimals}}".
export function formatMoney(cents, format) {
  const fmt = format || "{{amount}}";
  const num = (c, decimals, thousands, decimal) => {
    const v = (c / 100).toFixed(decimals);
    const [whole, frac] = v.split(".");
    const w = whole.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
    return frac ? w + decimal + frac : w;
  };
  return fmt.replace(/\{\{\s*(\w+)\s*\}\}/, (_, name) => {
    switch (name) {
      case "amount_no_decimals":
        return num(Math.round(cents / 100) * 100, 0, ",", ".");
      case "amount_with_comma_separator":
        return num(cents, 2, ".", ",");
      case "amount_no_decimals_with_comma_separator":
        return num(Math.round(cents / 100) * 100, 0, ".", ",");
      case "amount_with_apostrophe_separator":
        return num(cents, 2, "'", ".");
      default:
        return num(cents, 2, ",", ".");
    }
  });
}

// Splits a message template into plain and bold pieces: {amount}, {goal} and {threshold} are bold.
export function messageParts(tpl, goal, remaining, moneyFormat) {
  return String(tpl || "")
    .split(/(\{amount\}|\{goal\}|\{threshold\})/)
    .filter(Boolean)
    .map((tok) => {
      if (tok === "{amount}")
        return { text: formatMoney(remaining, moneyFormat), bold: true };
      if (tok === "{goal}") return { text: goal ? goal.label : "", bold: true };
      if (tok === "{threshold}")
        return {
          text: goal ? formatMoney(goal.cents, moneyFormat) : "",
          bold: true,
        };
      return { text: tok, bold: false };
    });
}

// Tooltip for a marker: the merchant's own text, or "Free shipping at ₹500" / "✓ Free shipping unlocked"
export function tooltipText(goal, reached, moneyFormat) {
  if (goal.tip) {
    const t = goal.tip
      .replace(/\{threshold\}/g, formatMoney(goal.cents, moneyFormat))
      .replace(/\{goal\}/g, goal.label);
    return (reached ? "✓ " : "") + t;
  }
  const name = goal.label
    ? goal.label.charAt(0).toUpperCase() + goal.label.slice(1)
    : "Reward";
  return reached
    ? `✓ ${name} unlocked`
    : `${name} at ${formatMoney(goal.cents, moneyFormat)}`;
}

// What the bar should show for a given cart total (in cents). `rate` converts store currency to
// the shopper's currency on multi-currency stores.
export function computeProgress(cfg, totalCents, moneyFormat, rate = 1) {
  const goals = cfg.goals.map((g) => ({
    ...g,
    cents: Math.round(g.amount * 100 * rate),
  }));
  const max = goals.length ? goals[goals.length - 1].cents : 0;
  const reachedCount = goals.filter((g) => totalCents >= g.cents).length;
  const next = goals[reachedCount] || null;
  const pct = max > 0 ? Math.min(100, (totalCents / max) * 100) : 0;

  const fill = (tpl, goal, remaining) =>
    tpl
      .replace(/\{amount\}/g, formatMoney(remaining, moneyFormat))
      .replace(/\{goal\}/g, goal ? goal.label : "")
      .replace(
        /\{threshold\}/g,
        goal ? formatMoney(goal.cents, moneyFormat) : "",
      );

  let message;
  let state;
  let parts;
  if (!next) {
    state = "all";
    message = cfg.allReachedText;
    parts = [{ text: cfg.allReachedText, bold: false }];
  } else if (totalCents <= 0 && cfg.emptyText) {
    state = "empty";
    message = fill(cfg.emptyText, next, next.cents);
    parts = messageParts(cfg.emptyText, next, next.cents, moneyFormat);
  } else {
    state = "progress";
    message = fill(cfg.progressText, next, next.cents - totalCents);
    parts = messageParts(
      cfg.progressText,
      next,
      next.cents - totalCents,
      moneyFormat,
    );
  }
  return { goals, pct, reachedCount, next, state, message, parts };
}
