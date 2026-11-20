// Settings for Cart Recommendations ("What about these?"). Shared by the dashboard and its live
// preview; the storefront reads the same shape from the app metafield boostify.cart_upsell.

import { sanitizeProduct } from "./bundles.js";

export const MAX_UPSELL_PRODUCTS = 12;

export const UPSELL_DEFAULTS = {
  version: 1,
  enabled: false,

  // Which products: "auto" = Shopify's recommendations for what's in the cart, topped up with
  // the picked products; "manual" = only the picked products
  source: "auto",
  products: [],
  maxItems: 4,
  hideInCart: true, // skip products the customer already has in the cart

  // Text. {percent} in the badge = the product's own sale discount
  heading: "What about these?",
  promoText: "", // optional line above the products, e.g. "Glow like a baby! Anti-aging serum at Rs. 299"
  buttonText: "+Add",
  addedText: "Added ✓",
  badgeText: "{percent}% off",
  showBadge: true,
  showCompare: true,

  // Where it shows
  showDrawer: true,
  showCartPage: true,

  // Look
  layout: "scroll", // scroll = one row that scrolls sideways | grid = two columns
  bg: "#f6f6f7",
  cardBg: "#ffffff",
  textColor: "#111111",
  priceColor: "#111111",
  compareColor: "#8a8a8a",
  btnBg: "#ffffff",
  btnText: "#111111",
  badgeBg: "#7dd3b0",
  badgeTextColor: "#0b3d2a",
  promoBg: "#f1f2f4",
  promoTextColor: "#111111",
  radius: 12,
  fontFamily: "inherit",
  fontSize: 13,
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
const optional = (v, max, fallback) =>
  typeof v === "string" ? v.trim().slice(0, max) : fallback;
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const bool = (v, fallback) => (typeof v === "boolean" ? v : fallback);

const D = UPSELL_DEFAULTS;

// Run on the server before saving, so the storefront only ever sees clean data.
export function sanitizeCartUpsell(input) {
  const i = input && typeof input === "object" ? input : {};
  const seen = new Set();
  const products = (Array.isArray(i.products) ? i.products : [])
    .map(sanitizeProduct)
    .filter((p) => p && !seen.has(p.id) && seen.add(p.id))
    .slice(0, MAX_UPSELL_PRODUCTS);

  return {
    version: 1,
    enabled: bool(i.enabled, D.enabled),
    source: oneOf(i.source, ["auto", "manual"], D.source),
    products,
    maxItems: Math.round(clamp(i.maxItems, 1, 8, D.maxItems)),
    hideInCart: bool(i.hideInCart, D.hideInCart),
    heading: optional(i.heading, 80, D.heading),
    promoText: optional(i.promoText, 150, D.promoText),
    buttonText: text(i.buttonText, 20, D.buttonText),
    addedText: text(i.addedText, 20, D.addedText),
    badgeText: optional(i.badgeText, 30, D.badgeText),
    showBadge: bool(i.showBadge, D.showBadge),
    showCompare: bool(i.showCompare, D.showCompare),
    showDrawer: bool(i.showDrawer, D.showDrawer),
    showCartPage: bool(i.showCartPage, D.showCartPage),
    layout: oneOf(i.layout, ["scroll", "grid"], D.layout),
    bg: color(i.bg, D.bg),
    cardBg: color(i.cardBg, D.cardBg),
    textColor: color(i.textColor, D.textColor),
    priceColor: color(i.priceColor, D.priceColor),
    compareColor: color(i.compareColor, D.compareColor),
    btnBg: color(i.btnBg, D.btnBg),
    btnText: color(i.btnText, D.btnText),
    badgeBg: color(i.badgeBg, D.badgeBg),
    badgeTextColor: color(i.badgeTextColor, D.badgeTextColor),
    promoBg: color(i.promoBg, D.promoBg),
    promoTextColor: color(i.promoTextColor, D.promoTextColor),
    radius: clamp(i.radius, 0, 40, D.radius),
    fontFamily: oneOf(i.fontFamily, ["inherit", "serif", "mono"], D.fontFamily),
    fontSize: clamp(i.fontSize, 11, 18, D.fontSize),
  };
}

// Sale percentage from a price and compare-at price (both in cents), or 0
export function salePercent(price, compare) {
  return compare > price ? Math.round(((compare - price) / compare) * 100) : 0;
}
