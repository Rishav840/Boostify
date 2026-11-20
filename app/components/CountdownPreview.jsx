import { useEffect, useState } from "react";
import cdCss from "../countdown.generated.css?raw";
import {
  FONT_STACKS,
  pad2,
  splitRemaining,
  timerBackground,
} from "../countdown";

const SAMPLE_MS = ((2 * 24 + 5) * 3600 + 30 * 60 + 12) * 1000; // 2d 5h 30m 12s
const URGENT_MS = (25 * 60 + 30) * 1000; // 25m 30s

// Same markup and CSS as the storefront script. `state` is running | urgent | expired.
// `realEnd` (a UTC timestamp) makes a fixed deadline count down for real.
export function CountdownPreview({ timer: t, state, realEnd }) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = now - start;
  let remaining;
  if (state === "expired") remaining = 0;
  else if (state === "urgent") remaining = Math.max(1000, URGENT_MS - elapsed);
  else if (realEnd && realEnd > now) remaining = realEnd - now;
  else remaining = Math.max(1000, SAMPLE_MS - elapsed);

  const expired = remaining <= 0;
  const urgent =
    !expired && t.urgentMinutes > 0 && remaining <= t.urgentMinutes * 60000;
  const parts = splitRemaining(remaining, t.showDays);

  const classes = [
    "boostify-cd",
    `boostify-cd--${t.layout}`,
    t.uppercase && "boostify-cd--upper",
    t.border && "boostify-cd--border",
    t.shadow && "boostify-cd--shadow",
    !t.showLabels && "boostify-cd--nolabels",
    expired && "is-expired",
    urgent && "is-urgent",
  ]
    .filter(Boolean)
    .join(" ");

  const vars = {
    "--cd-bg": timerBackground(t),
    "--cd-text": t.textColor,
    "--cd-digit-bg": t.digitBg,
    "--cd-digit": t.digitColor,
    "--cd-label": t.labelColor,
    "--cd-accent": t.accentColor,
    "--cd-btn-bg": t.btnBg,
    "--cd-btn-text": t.btnText,
    "--cd-btn-radius": `${t.btnRadius}px`,
    "--cd-radius": `${t.radius}px`,
    "--cd-font": FONT_STACKS[t.fontFamily] || "inherit",
    "--cd-size": `${t.fontSize}px`,
    "--cd-weight": t.fontWeight,
    "--cd-pad": `${t.padding}px`,
    "--cd-align":
      t.align === "left"
        ? "flex-start"
        : t.align === "right"
          ? "flex-end"
          : "center",
  };

  const units = [
    t.showDays && ["days", parts.days],
    ["hours", parts.hours],
    ["minutes", parts.minutes],
    t.showSeconds && ["seconds", parts.seconds],
  ].filter(Boolean);

  const hiddenByAction = expired && t.expiredAction === "hide";

  return (
    <div
      style={{
        borderRadius: 8,
        border: "1px solid #e1e3e5",
        background: "#f1f2f4",
        overflow: "hidden",
      }}
    >
      <style>{cdCss}</style>
      <div
        className="boostify-cd-wrap"
        style={{ "--cd-inset": `${t.inset || 12}px` }}
      >
        {hiddenByAction ? (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              color: "#6d7175",
              fontSize: 13,
            }}
          >
            When the timer ends it disappears from your store (you chose “Hide
            it”).
          </div>
        ) : (
          <div className={classes} style={vars}>
            {t.title ? (
              <div className="boostify-cd__title">{t.title}</div>
            ) : null}
            <div className="boostify-cd__units">
              {units.flatMap(([key, value], i) => [
                i > 0 ? (
                  <span className="boostify-cd__sep" key={`s${key}`}>
                    :
                  </span>
                ) : null,
                <div className="boostify-cd__unit" key={key}>
                  <span className="boostify-cd__num">{pad2(value)}</span>
                  {t.showLabels ? (
                    <span className="boostify-cd__label">{t.labels[key]}</span>
                  ) : null}
                </div>,
              ])}
            </div>
            {t.buttonText && t.buttonLink ? (
              <a
                className="boostify-cd__btn"
                href="#preview"
                onClick={(e) => e.preventDefault()}
              >
                {t.buttonText}
              </a>
            ) : null}
            <div className="boostify-cd__expired">{t.expiredText}</div>
          </div>
        )}
      </div>
    </div>
  );
}
