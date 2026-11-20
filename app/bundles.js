// Settings for Product Bundles. Shared by the dashboard and its live preview; the storefront
// reads the same shape from the app metafield boostify.bundles, and the bundle-discount function
// gets the discount part of it (see discountMetafields) on its own discount metafields.

// There's no fixed number of bundles; this ceiling only keeps the saved data inside Shopify's size
// limits (128 KB for the settings, 10 KB per discount metafield, see discountMetafields)
export const MAX_BUNDLES = 300;
export const MAX_BUNDLE_PRODUCTS = 4;

export const BUNDLE_DEFAULTS = {
  version: 1,
  enabled: false,

  bundles: [],

  // Smart bundles: on a product page without one of the merchant's own bundles, the product plus
  // Shopify's recommendations for it, at this discount
  smartEnabled: false,
  smartPercent: 10,
  smartTitle: "Bundle discount", // the discount name shown in the cart and at checkout
  smartMin: 3, // products needed for the smart discount (and, with the builder, to add the bundle)
  // Build your own: customers remove products (x) and add more from a row of suggestions
  smartBuilder: false,
  moreHeading: "Add more to your bundle",
  builderHint: "Add {count} more to get {percent} off",

  // Text. {percent} = the bundle's discount, {amount} = what the customer saves
  heading: "Frequently bought together",
  buttonText: "Add bundle to cart",
  savingsText: "Save {amount}",
  totalLabel: "Bundle price:",
  addedText: "Added ✓",
  soldOutText: "Bundle sold out",
  afterAdd: "drawer", // drawer = open the theme's cart drawer (cart page if it has none) | cart | checkout | stay

  // Look
  showCompare: true, // original prices crossed out
  showPlus: true, // "+" between the products
  checkboxes: true, // a tick box per product, so customers can leave some out
  bg: "#ffffff",
  textColor: "#111111",
  priceColor: "#111111",
  compareColor: "#8a8a8a",
  btnBg: "#111111",
  btnText: "#ffffff",
  badgeBg: "#d1f2e4",
  badgeText: "#0b6b45",
  border: true,
  radius: 12,
  btnRadius: 8,
  fontFamily: "inherit",
  fontSize: 14,

  // Where the box shows when it isn't placed with the theme editor block
  position: "after_form", // after_form | before_form
};

export function newBundle(n) {
  return {
    id: `b${Date.now().toString(36)}${n}`,
    title: "",
    enabled: true,
    percent: 10,
    products: [],
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
const text = (v, max, fallback) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fallback;
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const bool = (v, fallback) => (typeof v === "boolean" ? v : fallback);
const safeUrl = (v) => {
  const u = typeof v === "string" ? v.trim().slice(0, 500) : "";
  return /^https:\/\//i.test(u) ? u : "";
};

// A product picked with the resource picker, cut down to what the storefront needs
export function sanitizeProduct(p) {
  // Saved data keeps only the numeric id (see storedBundles); the picker gives a gid
  const gid =
    typeof p?.gid === "string"
      ? p.gid
      : typeof p?.id === "number"
        ? `gid://shopify/Product/${p.id}`
        : p?.id;
  const m = /^gid:\/\/shopify\/Product\/(\d+)$/.exec(String(gid || ""));
  if (!m) return null;
  const handle = text(p?.handle, 255, "");
  if (!/^[a-z0-9][a-z0-9-_]*$/i.test(handle)) return null;
  return {
    gid: m[0],
    id: Number(m[1]),
    handle,
    title: text(p?.title, 255, handle),
    image: safeUrl(p?.image),
  };
}

const D = BUNDLE_DEFAULTS;

// Run on the server before saving, so the storefront only ever sees clean data.
export function sanitizeBundles(input) {
  const i = input && typeof input === "object" ? input : {};
  const bundles = (Array.isArray(i.bundles) ? i.bundles : [])
    .slice(0, MAX_BUNDLES)
    .map((b, n) => {
      const seen = new Set();
      const products = (Array.isArray(b?.products) ? b.products : [])
        .map(sanitizeProduct)
        .filter((p) => p && !seen.has(p.id) && seen.add(p.id))
        .slice(0, MAX_BUNDLE_PRODUCTS);
      return {
        id: /^[a-z0-9]{1,24}$/i.test(String(b?.id)) ? String(b.id) : `b${n}`,
        title: typeof b?.title === "string" ? b.title.trim().slice(0, 30) : "",
        enabled: bool(b?.enabled, true),
        percent: Math.round(clamp(b?.percent, 0, 90, 10)),
        products,
      };
    });

  return {
    version: 1,
    enabled: bool(i.enabled, D.enabled),
    bundles,
    smartEnabled: bool(i.smartEnabled, D.smartEnabled),
    smartPercent: Math.round(clamp(i.smartPercent, 0, 90, D.smartPercent)),
    smartTitle: text(i.smartTitle, 30, D.smartTitle),
    smartMin: Math.round(clamp(i.smartMin, 2, 5, D.smartMin)),
    smartBuilder: bool(i.smartBuilder, D.smartBuilder),
    moreHeading: typeof i.moreHeading === "string" ? i.moreHeading.trim().slice(0, 60) : D.moreHeading,
    builderHint: text(i.builderHint, 80, D.builderHint),
    heading: typeof i.heading === "string" ? i.heading.trim().slice(0, 80) : D.heading,
    buttonText: text(i.buttonText, 40, D.buttonText),
    savingsText:
      typeof i.savingsText === "string" ? i.savingsText.trim().slice(0, 60) : D.savingsText,
    totalLabel:
      typeof i.totalLabel === "string" ? i.totalLabel.trim().slice(0, 40) : D.totalLabel,
    addedText: text(i.addedText, 30, D.addedText),
    soldOutText: text(i.soldOutText, 40, D.soldOutText),
    afterAdd: oneOf(i.afterAdd, ["drawer", "cart", "checkout", "stay"], D.afterAdd),
    showCompare: bool(i.showCompare, D.showCompare),
    showPlus: bool(i.showPlus, D.showPlus),
    checkboxes: bool(i.checkboxes, D.checkboxes),
    bg: color(i.bg, D.bg),
    textColor: color(i.textColor, D.textColor),
    priceColor: color(i.priceColor, D.priceColor),
    compareColor: color(i.compareColor, D.compareColor),
    btnBg: color(i.btnBg, D.btnBg),
    btnText: color(i.btnText, D.btnText),
    badgeBg: color(i.badgeBg, D.badgeBg),
    badgeText: color(i.badgeText, D.badgeText),
    border: bool(i.border, D.border),
    radius: clamp(i.radius, 0, 40, D.radius),
    btnRadius: clamp(i.btnRadius, 0, 999, D.btnRadius),
    fontFamily: oneOf(i.fontFamily, ["inherit", "serif", "mono"], D.fontFamily),
    fontSize: clamp(i.fontSize, 12, 20, D.fontSize),
    position: oneOf(i.position, ["after_form", "before_form"], D.position),
  };
}

// What the storefront metafield keeps of each product: the storefront only needs the id and handle,
// and the dashboard looks titles and images up again when it loads (see app.bundles.jsx).
export function storedBundles(cfg) {
  return {
    ...cfg,
    bundles: cfg.bundles.map((b) => ({
      ...b,
      products: b.products.map((p) => ({ id: p.id, handle: p.handle })),
    })),
  };
}

// A function only receives metafield values up to 10 KB, so the bundles are split over
// DISCOUNT_KEYS (the bundle-discount function reads all of them). Each bundle is compact:
// [percent, title, [productId, ...]]. Only live bundles with a discount and 2+ products go in;
// with the feature off everything is empty, so the checkout discount stops too.
export const DISCOUNT_KEYS = ["bundles", "bundles_2", "bundles_3", "bundles_4"];
const SHARD_BYTES = 9500;

export function discountMetafields(cfg) {
  const on = cfg.enabled;
  const live = on
    ? cfg.bundles
        .filter((b) => b.enabled && b.percent > 0 && b.products.length >= 2)
        .map((b) => [b.percent, b.title || "Bundle discount", b.products.map((p) => p.id)])
    : [];
  const shards = [[]];
  let size = 2;
  for (const entry of live) {
    const bytes = JSON.stringify(entry).length + 1;
    if (size + bytes > SHARD_BYTES) {
      shards.push([]);
      size = 2;
    }
    shards[shards.length - 1].push(entry);
    size += bytes;
  }
  if (shards.length > DISCOUNT_KEYS.length) {
    return { error: "Too many discounted bundles for Shopify's discount data. Remove some bundles or turn their discount off." };
  }
  const values = DISCOUNT_KEYS.map((key, n) => ({ key, value: JSON.stringify(shards[n] || []) }));
  values.push({
    key: "smart",
    value: JSON.stringify(
      on && cfg.smartEnabled && cfg.smartPercent > 0
        ? { p: cfg.smartPercent, t: cfg.smartTitle, m: cfg.smartMin }
        : {},
    ),
  });
  return { values, any: live.length > 0 || (on && cfg.smartEnabled && cfg.smartPercent > 0) };
}

// "Save {amount}" / "Save {percent}" with the values filled in
export function savingsLine(tpl, percent, amountText) {
  return String(tpl || "")
    .replace(/\{percent\}/g, `${percent}%`)
    .replace(/\{amount\}/g, amountText);
}
