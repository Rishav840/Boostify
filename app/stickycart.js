// Settings for the Sticky Add to Cart bar. Shared by the dashboard and its live preview;
// the storefront reads the same shape from the app metafield boostify.sticky_atc.

export const STICKY_DEFAULTS = {
  version: 1,
  enabled: false,

  // Where and when
  position: "bottom", // bottom | top
  devices: "both", // both | mobile | desktop
  appear: "scroll", // scroll = after the normal button scrolls out of view | always
  boxed: true, // false = edge to edge

  // What to show
  showImage: true,
  showTitle: true,
  showPrice: true,
  showCompare: true,
  showQuantity: true,

  // Button
  buttonText: "Add to cart",
  soldOutText: "Sold out",
  addedText: "Added ✓",
  afterAdd: "stay", // stay | cart | checkout
  btnBg: "#111111",
  btnText: "#ffffff",
  btnRadius: 8,

  // Look
  bg: "#ffffff",
  textColor: "#111111",
  priceColor: "#111111",
  compareColor: "#8a8a8a",
  radius: 12,
  inset: 12,
  shadow: true,
  border: false,
  fontFamily: "inherit",
  fontSize: 15,
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
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fallback;
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const bool = (v, fallback) => (typeof v === "boolean" ? v : fallback);

const D = STICKY_DEFAULTS;

// Run on the server before saving, so the storefront only ever sees clean data.
export function sanitizeSticky(input) {
  const i = input && typeof input === "object" ? input : {};
  return {
    version: 1,
    enabled: bool(i.enabled, D.enabled),
    position: oneOf(i.position, ["bottom", "top"], D.position),
    devices: oneOf(i.devices, ["both", "mobile", "desktop"], D.devices),
    appear: oneOf(i.appear, ["scroll", "always"], D.appear),
    boxed: bool(i.boxed, D.boxed),
    showImage: bool(i.showImage, D.showImage),
    showTitle: bool(i.showTitle, D.showTitle),
    showPrice: bool(i.showPrice, D.showPrice),
    showCompare: bool(i.showCompare, D.showCompare),
    showQuantity: bool(i.showQuantity, D.showQuantity),
    buttonText: text(i.buttonText, 30, D.buttonText),
    soldOutText: text(i.soldOutText, 30, D.soldOutText),
    addedText: text(i.addedText, 30, D.addedText),
    afterAdd: oneOf(i.afterAdd, ["stay", "cart", "checkout"], D.afterAdd),
    btnBg: color(i.btnBg, D.btnBg),
    btnText: color(i.btnText, D.btnText),
    btnRadius: clamp(i.btnRadius, 0, 999, D.btnRadius),
    bg: color(i.bg, D.bg),
    textColor: color(i.textColor, D.textColor),
    priceColor: color(i.priceColor, D.priceColor),
    compareColor: color(i.compareColor, D.compareColor),
    radius: clamp(i.radius, 0, 999, D.radius),
    inset: clamp(i.inset, 0, 32, D.inset),
    shadow: bool(i.shadow, D.shadow),
    border: bool(i.border, D.border),
    fontFamily: oneOf(i.fontFamily, ["inherit", "serif", "mono"], D.fontFamily),
    fontSize: clamp(i.fontSize, 12, 20, D.fontSize),
  };
}
