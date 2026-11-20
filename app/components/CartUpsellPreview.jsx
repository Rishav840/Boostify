import { useCallback, useEffect, useRef, useState } from "react";
import upsellCss from "../cart-upsell.generated.css?raw";
import { formatMoney } from "../cartprogress";
import { salePercent } from "../cartupsell";

const MONEY = "₹{{amount_no_decimals}}";
const FONTS = {
  inherit: "inherit",
  serif: 'Georgia, "Times New Roman", serif',
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

// Prices aren't loaded in the dashboard, so the preview uses sample products and prices,
// with the merchant's picked products' names and images when there are any.
const SAMPLE = [
  { title: "Hand Lotion", price: 8000, compare: 24900, emoji: "🧴" },
  { title: "Ginger Mist", price: 10000, compare: 29000, emoji: "🌿" },
  { title: "Lip Balm", price: 19900, compare: 0, emoji: "💄" },
  { title: "Sunscreen SPF 50", price: 34900, compare: 49900, emoji: "☀️" },
];

const ARROW = { prev: "M10 3 5 8l5 5", next: "M6 3l5 5-5 5" };

// Same markup and CSS as the storefront script, inside a stand-in for the cart drawer.
export function CartUpsellPreview({ cfg }) {
  const listRef = useRef(null);
  const [edges, setEdges] = useState({ show: false, start: true, end: false });
  const update = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const max = list.scrollWidth - list.clientWidth;
    const next = { show: max > 2, start: list.scrollLeft <= 2, end: list.scrollLeft >= max - 2 };
    setEdges((e) =>
      e.show === next.show && e.start === next.start && e.end === next.end ? e : next,
    );
  }, []);
  useEffect(() => {
    update();
  });
  const move = (dir) => {
    const list = listRef.current;
    const first = list?.firstElementChild;
    if (!first) return;
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    list.scrollBy({ left: dir * (first.getBoundingClientRect().width + gap), behavior: "smooth" });
  };
  const scroller = cfg.layout !== "grid";
  const count = Math.min(cfg.maxItems, 8);
  const items = Array.from({ length: count }, (_, n) => {
    const sample = SAMPLE[n % SAMPLE.length];
    const picked = cfg.products[n];
    return picked
      ? { ...sample, title: picked.title, image: picked.image }
      : sample;
  });
  const money = (c) => formatMoney(c, MONEY);

  const vars = {
    "--up-bg": cfg.bg,
    "--up-card": cfg.cardBg,
    "--up-text": cfg.textColor,
    "--up-price": cfg.priceColor,
    "--up-compare": cfg.compareColor,
    "--up-btn-bg": cfg.btnBg,
    "--up-btn-text": cfg.btnText,
    "--up-badge-bg": cfg.badgeBg,
    "--up-badge-text": cfg.badgeTextColor,
    "--up-promo-bg": cfg.promoBg,
    "--up-promo-text": cfg.promoTextColor,
    "--up-radius": `${cfg.radius}px`,
    "--up-size": `${cfg.fontSize}px`,
    "--up-font": FONTS[cfg.fontFamily] || "inherit",
  };

  return (
    <div
      style={{
        width: 420,
        maxWidth: "100%",
        borderRadius: 10,
        border: "1px solid #e1e3e5",
        background: "#ffffff",
        overflow: "hidden",
      }}
    >
      <style>{upsellCss}</style>
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #e1e3e5",
          fontWeight: 600,
        }}
      >
        Your cart
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          padding: "12px 16px",
          color: "#6d7175",
          fontSize: 13,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            background: "#f1f2f4",
            display: "grid",
            placeItems: "center",
            fontSize: 22,
          }}
        >
          🧴
        </div>
        Items in the cart…
      </div>
      <div className="boostify-up-wrap boostify-up-wrap--drawer">
        <div
          className={`boostify-up${cfg.layout === "grid" ? " boostify-up--grid" : ""}`}
          style={vars}
        >
          {cfg.promoText ? (
            <p className="boostify-up__promo">{cfg.promoText}</p>
          ) : null}
          {cfg.heading || scroller ? (
            <div className="boostify-up__head">
              {cfg.heading ? (
                <p className="boostify-up__heading">{cfg.heading}</p>
              ) : null}
              {scroller ? (
                <div className="boostify-up__arrows" hidden={!edges.show}>
                  {["prev", "next"].map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      className={`boostify-up__arrow boostify-up__arrow--${dir}`}
                      aria-label={dir === "prev" ? "Previous products" : "Next products"}
                      disabled={dir === "prev" ? edges.start : edges.end}
                      onClick={() => move(dir === "prev" ? -1 : 1)}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d={ARROW[dir]} />
                      </svg>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="boostify-up__list" ref={listRef} onScroll={update}>
            {items.map((it, n) => {
              const pct = salePercent(it.price, it.compare);
              return (
                <div className="boostify-up__card" key={n}>
                  <span className="boostify-up__media">
                    {it.image ? (
                      <img className="boostify-up__img" src={it.image} alt="" />
                    ) : (
                      <span
                        className="boostify-up__img"
                        style={{
                          display: "grid",
                          placeItems: "center",
                          fontSize: 28,
                        }}
                      >
                        {it.emoji}
                      </span>
                    )}
                    {cfg.showBadge && pct > 0 && cfg.badgeText ? (
                      <span className="boostify-up__badge">
                        {cfg.badgeText.replace(/\{percent\}/g, pct)}
                      </span>
                    ) : null}
                  </span>
                  <div className="boostify-up__body">
                    <span className="boostify-up__title">{it.title}</span>
                    <div className="boostify-up__prices">
                      {cfg.showCompare && it.compare > it.price ? (
                        <s className="boostify-up__compare">
                          {money(it.compare)}
                        </s>
                      ) : null}
                      <span className="boostify-up__price">
                        {money(it.price)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="boostify-up__add"
                      tabIndex={-1}
                    >
                      {cfg.buttonText}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ padding: "12px 16px", borderTop: "1px solid #e1e3e5" }}>
        <div
          style={{
            background: "#111",
            color: "#fff",
            borderRadius: 8,
            padding: 10,
            textAlign: "center",
            fontSize: 13,
          }}
        >
          Check out
        </div>
      </div>
    </div>
  );
}
