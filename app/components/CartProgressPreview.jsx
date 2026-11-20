import cartCss from "../cart-progress.generated.css?raw";
import { FONT_STACKS } from "../announcement";
import {
  LINE_ICONS,
  computeProgress,
  formatMoney,
  tooltipText,
} from "../cartprogress";

const MONEY = "₹{{amount_no_decimals}}";

// A goal's icon: uploaded image, one of the fixed line icons, or the text/emoji typed in
function GoalIcon({ goal }) {
  if (goal.iconImage)
    return <img className="boostify-cp__img" src={goal.iconImage} alt="" />;
  const key =
    typeof goal.icon === "string" && goal.icon.startsWith("svg:")
      ? goal.icon.slice(4)
      : "";
  if (key && Object.prototype.hasOwnProperty.call(LINE_ICONS, key)) {
    return (
      <svg
        className="boostify-cp__svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        // a fixed icon from LINE_ICONS, never merchant input
        dangerouslySetInnerHTML={{ __html: LINE_ICONS[key] }}
      />
    );
  }
  return goal.icon;
}

// Same markup and CSS as the storefront script, using a sample money format. The box it sits in
// stands in for the cart drawer: it is what the "Test the confetti" button bursts inside.
export function CartProgressPreview({ cfg, totalCents }) {
  const c = computeProgress(cfg, totalCents, MONEY);
  const hiddenWhenEmpty = totalCents <= 0 && !cfg.showEmpty;
  const solid = cfg.backgroundMode === "solid";

  const classes = [
    "boostify-cp",
    cfg.layout !== "classic" && "boostify-cp--clean",
    solid && "boostify-cp--solid",
    cfg.density === "roomy" && "boostify-cp--roomy",
    cfg.divider && "boostify-cp--divider",
    cfg.border && "boostify-cp--border",
    cfg.shadow && "boostify-cp--shadow",
    cfg.showMilestones && cfg.showLabels && "boostify-cp--labels",
    cfg.showMilestones && cfg.showAmounts && "boostify-cp--amounts",
  ]
    .filter(Boolean)
    .join(" ");

  const vars = {
    "--cp-bg": solid ? cfg.bg : "transparent",
    "--cp-text": cfg.textColor,
    "--cp-fill": cfg.fillColor,
    "--cp-fill2": cfg.fillColor2,
    "--cp-track": cfg.trackColor,
    "--cp-marker-bg": cfg.markerBg,
    "--cp-icon": cfg.markerIconColor,
    "--cp-gap": cfg.gapColor,
    "--cp-radius": `${solid ? cfg.radius : 0}px`,
    "--cp-bar-radius": cfg.barShape === "rounded" ? "999px" : "0px",
    "--cp-marker-radius": cfg.markerShape === "square" ? "0px" : "50%",
    "--cp-marker-size": `${cfg.markerSize}px`,
    "--cp-height": `${cfg.height}px`,
    "--cp-weight": cfg.fontWeight,
    "--cp-size": `${cfg.fontSize}px`,
    "--cp-font": FONT_STACKS[cfg.fontFamily] || "inherit",
  };

  const max = c.goals.length ? c.goals[c.goals.length - 1].cents : 0;

  return (
    <div
      data-cp-preview
      style={{
        borderRadius: 4,
        border: "1px solid #e1e3e5",
        background: cfg.gapColor || "#ffffff",
        overflow: "hidden",
      }}
    >
      <style>{cartCss}</style>
      <div
        className="boostify-cp-wrap boostify-cp-wrap--drawer"
        style={{ paddingLeft: 20 }}
      >
        {hiddenWhenEmpty ? (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              color: "#6d7175",
              fontSize: 13,
            }}
          >
            The bar is hidden while the cart is empty. Turn on “Also show it
            when the cart is empty” to show it.
          </div>
        ) : (
          <div className={classes} style={vars}>
            <p className="boostify-cp__msg">
              {cfg.iconInMessage !== false && c.next ? (
                <span className="boostify-cp__msg-icon" aria-hidden="true">
                  <GoalIcon goal={c.next} />
                </span>
              ) : null}
              {c.parts.map((x, i) =>
                x.bold ? <strong key={i}>{x.text}</strong> : x.text,
              )}
            </p>
            <div className="boostify-cp__rail">
              <div className="boostify-cp__track">
                <div
                  className="boostify-cp__fill"
                  style={{ width: `${c.pct}%` }}
                />
              </div>
              {cfg.showMilestones
                ? c.goals.map((g, i) => {
                    const done = i < c.reachedCount;
                    const pos =
                      max > 0 ? Math.min(100, (g.cents / max) * 100) : 100;
                    const tip =
                      cfg.tooltips !== false
                        ? tooltipText(g, done, MONEY)
                        : null;
                    return (
                      <div
                        key={i}
                        className={[
                          "boostify-cp__marker",
                          done && "is-reached",
                          pos < 15 && "is-start",
                          pos > 85 && "is-end",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        style={{ left: `${pos}%` }}
                        {...(tip
                          ? { tabIndex: 0, role: "img", "aria-label": tip }
                          : {})}
                      >
                        {cfg.showAmounts ? (
                          <div className="boostify-cp__amount">
                            {formatMoney(g.cents, MONEY)}
                          </div>
                        ) : null}
                        <div className="boostify-cp__dot">
                          <GoalIcon goal={g} />
                        </div>
                        {cfg.showLabels ? (
                          <div className="boostify-cp__label">{g.label}</div>
                        ) : null}
                        {tip ? (
                          <span className="boostify-cp__tip" aria-hidden="true">
                            {tip}
                          </span>
                        ) : null}
                      </div>
                    );
                  })
                : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
