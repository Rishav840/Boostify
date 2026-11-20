import { useState } from "react";
import bundleCss from "../bundle.generated.css?raw";
import { formatMoney } from "../cartprogress";
import { savingsLine } from "../bundles";

const MONEY = "₹{{amount_no_decimals}}";
const FONTS = {
  inherit: "inherit",
  serif: 'Georgia, "Times New Roman", serif',
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};
const MAX_ITEMS = 6; // same as bundle.js

// Prices aren't loaded in the dashboard, so the preview uses sample prices.
const SAMPLE = [
  { title: "Ceramide Lotion - 200 ml", price: 99900, compare: 199600, emoji: "🧴" },
  { title: "Vitamin C Serum with Aloe", price: 139900, compare: 199900, emoji: "🍊" },
  { title: "Hand Lotion", price: 8000, compare: 24900, emoji: "🖐️" },
  { title: "Ginger Mist", price: 10000, compare: 29000, emoji: "🌿" },
  { title: "Lip Balm", price: 19900, compare: 0, emoji: "💄" },
  { title: "Sunscreen SPF 50", price: 34900, compare: 49900, emoji: "☀️" },
];

function Item({ it, cfg, money, toggle, inBundle }) {
  return (
    <div className="boostify-bd__item">
      {cfg.checkboxes && !toggle ? (
        <label className="boostify-bd__tick">
          <input
            type="checkbox"
            className="boostify-bd__check"
            checked
            readOnly
            tabIndex={-1}
            aria-label={it.title}
          />
        </label>
      ) : null}
      {it.image ? (
        <img className="boostify-bd__img" src={it.image} alt="" />
      ) : (
        <div
          className="boostify-bd__img"
          style={{ display: "grid", placeItems: "center", fontSize: inBundle ? 26 : 20 }}
        >
          {it.emoji}
        </div>
      )}
      <div className="boostify-bd__info">
        <span className="boostify-bd__title">{it.title}</span>
        <div className="boostify-bd__price">
          <span className="boostify-bd__now">{money(it.price)}</span>
          {cfg.showCompare && it.compare ? (
            <s className="boostify-bd__compare">{money(it.compare)}</s>
          ) : null}
        </div>
      </div>
      {toggle}
    </div>
  );
}

// Same markup and CSS as the storefront snippet (boostify-bundle.liquid) and bundle.js.
// smart = a smart bundle: the product plus Shopify's recommendations (samples here). With the
// builder on, the preview works like the store: x removes a product, + Add puts a suggestion in.
export function BundlePreview({ cfg, bundle, smart = false }) {
  const builder = smart && cfg.smartBuilder;
  const min = smart ? cfg.smartMin : 0;
  const start = Math.min(MAX_ITEMS, Math.max(3, min));
  const [chosen, setChosen] = useState(() => SAMPLE.map((_, n) => n).slice(0, start));
  const ids = builder ? chosen : SAMPLE.map((_, n) => n).slice(0, smart ? start : 2);

  const picked = !smart && bundle?.products?.length >= 2 ? bundle.products : null;
  const items = picked
    ? picked.map((p, n) => ({ ...SAMPLE[n % SAMPLE.length], title: p.title, image: p.image }))
    : ids.map((n) => SAMPLE[n]);
  const suggestions = builder
    ? SAMPLE.map((it, n) => ({ ...it, n })).filter((it) => !chosen.includes(it.n))
    : [];

  const missing = builder ? Math.max(0, min - items.length) : 0;
  const pct = smart ? (items.length >= min ? cfg.smartPercent : 0) : bundle ? bundle.percent : 10;
  const total = items.reduce((s, i) => s + i.price, 0);
  const regular = items.reduce((s, i) => s + (i.compare || i.price), 0);
  const bundlePrice = Math.round((total * (100 - pct)) / 100);
  const saved = total - bundlePrice;
  const money = (c) => formatMoney(c, MONEY);

  const vars = {
    "--bd-bg": cfg.bg,
    "--bd-text": cfg.textColor,
    "--bd-price": cfg.priceColor,
    "--bd-compare": cfg.compareColor,
    "--bd-btn-bg": cfg.btnBg,
    "--bd-btn-text": cfg.btnText,
    "--bd-badge-bg": cfg.badgeBg,
    "--bd-badge-text": cfg.badgeText,
    "--bd-radius": `${cfg.radius}px`,
    "--bd-btn-radius": `${cfg.btnRadius}px`,
    "--bd-size": `${cfg.fontSize}px`,
    "--bd-font": FONTS[cfg.fontFamily] || "inherit",
  };
  const classes = [
    "boostify-bd",
    cfg.border ? "boostify-bd--border" : "",
    cfg.checkboxes && !builder ? "boostify-bd--checks" : "",
    builder ? "boostify-bd--builder" : "",
  ].filter(Boolean);

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 10,
        border: "1px solid #e1e3e5",
        background: "#f1f2f4",
      }}
    >
      <style>{bundleCss}</style>
      <div style={{ maxWidth: 440 }}>
        <div className={classes.join(" ")} style={{ ...vars, margin: 0 }}>
          {cfg.heading ? <p className="boostify-bd__heading">{cfg.heading}</p> : null}
          <div className="boostify-bd__items">
            {items.map((it, n) => (
              <div key={builder ? ids[n] : n} style={{ display: "contents" }}>
                {cfg.showPlus && n > 0 ? (
                  <div className="boostify-bd__plus" aria-hidden="true">
                    +
                  </div>
                ) : null}
                <Item
                  it={it}
                  cfg={cfg}
                  money={money}
                  inBundle
                  toggle={
                    builder && n > 0 ? (
                      <button
                        type="button"
                        className="boostify-bd__toggle boostify-bd__toggle--remove"
                        aria-label={`Remove ${it.title}`}
                        onClick={() => setChosen((c) => c.filter((x) => x !== ids[n]))}
                      >
                        ×
                      </button>
                    ) : null
                  }
                />
              </div>
            ))}
          </div>
          {builder && suggestions.length ? (
            <div className="boostify-bd__more">
              {cfg.moreHeading ? (
                <p className="boostify-bd__more-title">{cfg.moreHeading}</p>
              ) : null}
              <div className="boostify-bd__more-list">
                {suggestions.map((it) => (
                  <Item
                    key={it.n}
                    it={it}
                    cfg={cfg}
                    money={money}
                    toggle={
                      <button
                        type="button"
                        className="boostify-bd__toggle boostify-bd__toggle--add"
                        aria-label={`Add to bundle: ${it.title}`}
                        disabled={chosen.length >= MAX_ITEMS}
                        onClick={() => setChosen((c) => [...c, it.n])}
                      >
                        + Add
                      </button>
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}
          <div className="boostify-bd__footer">
            <div className="boostify-bd__total">
              {cfg.totalLabel ? (
                <span className="boostify-bd__label">{cfg.totalLabel}</span>
              ) : null}
              <strong className="boostify-bd__sum">{money(bundlePrice)}</strong>
              {cfg.showCompare && regular > bundlePrice ? (
                <s className="boostify-bd__was">{money(regular)}</s>
              ) : null}
              {pct > 0 && cfg.savingsText ? (
                <span className="boostify-bd__badge">
                  {savingsLine(cfg.savingsText, pct, money(saved))}
                </span>
              ) : null}
            </div>
            {missing ? (
              <p className="boostify-bd__hint">
                {cfg.builderHint
                  .replace(/\{count\}/g, String(missing))
                  .replace(/\{percent\}/g, `${cfg.smartPercent}%`)
                  .replace(/\{min\}/g, String(min))}
              </p>
            ) : null}
            <button
              type="button"
              className="boostify-bd__btn"
              tabIndex={-1}
              disabled={missing > 0}
            >
              {cfg.buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
