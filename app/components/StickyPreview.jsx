import stickyCss from "../sticky-cart.generated.css?raw";

const FONTS = {
  inherit: "inherit",
  serif: 'Georgia, "Times New Roman", serif',
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

// Same markup and CSS as the storefront block, with a sample product.
function Bar({ cfg, compact }) {
  const classes = [
    "boostify-satc",
    "boostify-satc--preview",
    `boostify-satc--${cfg.position}`,
    cfg.boxed && "boostify-satc--boxed",
    cfg.shadow && "boostify-satc--shadow",
    cfg.border && "boostify-satc--border",
    compact && "is-compact",
  ]
    .filter(Boolean)
    .join(" ");

  const vars = {
    "--satc-bg": cfg.bg,
    "--satc-text": cfg.textColor,
    "--satc-price": cfg.priceColor,
    "--satc-compare": cfg.compareColor,
    "--satc-btn-bg": cfg.btnBg,
    "--satc-btn-text": cfg.btnText,
    "--satc-btn-radius": `${cfg.btnRadius}px`,
    "--satc-radius": `${cfg.radius}px`,
    "--satc-inset": `${cfg.inset}px`,
    "--satc-size": `${cfg.fontSize}px`,
    "--satc-font": FONTS[cfg.fontFamily] || "inherit",
  };

  return (
    <div className={classes} style={vars}>
      <div className="boostify-satc__card">
        {cfg.showImage ? (
          <div
            className="boostify-satc__img"
            style={{
              display: "grid",
              placeItems: "center",
              fontSize: 22,
              background: "linear-gradient(135deg, #e8e8ee, #d4d4de)",
            }}
          >
            👟
          </div>
        ) : null}
        <div className="boostify-satc__info">
          {cfg.showTitle ? (
            <div className="boostify-satc__title">Classic Runner Sneakers</div>
          ) : null}
          {cfg.showPrice ? (
            <div className="boostify-satc__price">
              <span>₹1,499</span>
              {cfg.showCompare ? (
                <s className="boostify-satc__compare">₹1,999</s>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="boostify-satc__controls">
          {cfg.showQuantity ? (
            <div className="boostify-satc__qty">
              <button type="button" tabIndex={-1}>
                −
              </button>
              <input type="number" value={1} readOnly aria-label="Quantity" />
              <button type="button" tabIndex={-1}>
                +
              </button>
            </div>
          ) : null}
          <button type="button" className="boostify-satc__btn" tabIndex={-1}>
            {cfg.buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StickyPreview({ cfg }) {
  const frame = {
    borderRadius: 10,
    border: "1px solid #e1e3e5",
    background: "#f1f2f4",
    overflow: "hidden",
  };
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <style>{stickyCss}</style>
      <div>
        <div style={{ fontSize: 12, color: "#6d7175", marginBottom: 6 }}>
          Desktop
        </div>
        <div style={frame}>
          <Bar cfg={cfg} compact={false} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: "#6d7175", marginBottom: 6 }}>
          Phone
        </div>
        <div style={{ ...frame, width: 380, maxWidth: "100%" }}>
          <Bar cfg={cfg} compact />
        </div>
      </div>
    </div>
  );
}
