import { useEffect, useLayoutEffect, useRef, useState } from "react";
import barCss from "../announcement-bar.generated.css?raw";
import {
  FONT_STACKS,
  animateSwap,
  barBackground,
  effectiveSize,
} from "../announcement";

// Renders the same markup and CSS the storefront script builds, so the preview matches the real bar.
// `scale` renders the bar at a realistic desktop width (~880px) shrunk to fit a thumbnail.
export function BarPreview({ bar, scale }) {
  const messages = bar.messages.filter((m) => m.text.trim());
  const [index, setIndex] = useState(0);
  const msgRefs = useRef([]);
  const prevIndex = useRef(0);
  const swap = useRef({ dir: 1, ms: 450 });

  const canRotate = bar.type === "rotate" && messages.length > 1;
  useEffect(() => {
    setIndex(0);
    prevIndex.current = 0;
    if (!canRotate) return undefined;
    const t = setInterval(
      () => {
        swap.current = { dir: 1, ms: 450 };
        setIndex((i) => (i + 1) % messages.length);
      },
      (bar.interval || 4) * 1000,
    );
    return () => clearInterval(t);
  }, [canRotate, messages.length, bar.interval]);

  const go = (dir) => {
    swap.current = { dir, ms: 220 };
    setIndex((i) => (i + dir + messages.length) % messages.length);
  };
  useLayoutEffect(() => {
    const from = prevIndex.current;
    prevIndex.current = index;
    if (from !== index) {
      animateSwap(
        msgRefs.current[from],
        msgRefs.current[index],
        swap.current.dir,
        bar.animation,
        swap.current.ms,
      );
    }
  }, [index, bar.animation]);

  if (!messages.length) {
    return (
      <div style={{ padding: 16, color: "#6d7175", fontSize: 13 }}>
        Add a message to see the preview.
      </div>
    );
  }

  const eff = effectiveSize(bar);
  const classes = [
    "boostify-ab",
    `boostify-ab--${bar.type}`,
    bar.size !== "normal" && "boostify-ab--compact",
    bar.uppercase && "boostify-ab--upper",
    bar.border && "boostify-ab--border",
    bar.shadow && "boostify-ab--shadow",
    bar.edgeFade && "boostify-ab--edge",
    bar.dismissible && "boostify-ab--dismissible",
    bar.btnStyle === "outline" && "boostify-ab--btn-outline",
  ]
    .filter(Boolean)
    .join(" ");

  const align =
    bar.align === "left"
      ? "flex-start"
      : bar.align === "right"
        ? "flex-end"
        : "center";
  const vars = {
    "--bab-bg": barBackground(bar),
    "--bab-from": bar.bgFrom,
    "--bab-text": bar.textColor,
    "--bab-accent": bar.accentColor,
    "--bab-btn-bg": bar.btnBg,
    "--bab-btn-text": bar.btnText,
    "--bab-btn-radius": `${bar.btnRadius}px`,
    "--bab-radius": `${bar.radius}px`,
    "--bab-font": FONT_STACKS[bar.fontFamily] || "inherit",
    "--bab-size": `${eff.fontSize}px`,
    "--bab-weight": bar.fontWeight,
    "--bab-space": `${bar.letterSpacing}px`,
    "--bab-pad": `${eff.pad}px`,
    "--bab-align": align,
    "--bab-speed": `${bar.speed}s`,
  };

  const content = (m) => (
    <>
      <span className="boostify-ab__text">{m.text}</span>
      {m.link && m.buttonText ? (
        <a
          className="boostify-ab__btn"
          href="#preview"
          onClick={(e) => e.preventDefault()}
        >
          {m.buttonText}
        </a>
      ) : null}
    </>
  );

  let body;
  if (bar.type === "marquee") {
    const reps = Math.max(2, Math.ceil(8 / messages.length));
    const half = Array.from({ length: reps }).flatMap(() => messages);
    const sep = bar.separator || "";
    body = (
      <div className="boostify-ab__marquee">
        <div className="boostify-ab__lane">
          {[...half, ...half].flatMap((m, i) => [
            <span
              className="boostify-ab__item"
              key={`i${i}`}
              style={sep ? undefined : { paddingRight: 36 }}
            >
              {content(m)}
            </span>,
            sep ? (
              <span className="boostify-ab__sep" key={`s${i}`}>
                {sep}
              </span>
            ) : null,
          ])}
        </div>
      </div>
    );
  } else {
    body = (
      <>
        {canRotate && bar.arrows ? (
          <button
            type="button"
            className="boostify-ab__nav boostify-ab__nav--prev"
            aria-label="Previous"
            onClick={() => go(-1)}
          >
            ‹
          </button>
        ) : null}
        <div className="boostify-ab__track">
          {messages.map((m, i) => (
            <div
              key={i}
              ref={(node) => {
                msgRefs.current[i] = node;
              }}
              className={`boostify-ab__msg${i === index ? " is-active" : ""}`}
            >
              {content(m)}
            </div>
          ))}
        </div>
        {canRotate && bar.arrows ? (
          <button
            type="button"
            className="boostify-ab__nav boostify-ab__nav--next"
            aria-label="Next"
            onClick={() => go(1)}
          >
            ›
          </button>
        ) : null}
      </>
    );
  }

  return (
    <div
      style={{
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid #e1e3e5",
        background: "#f1f2f4",
        ...(scale ? { width: Math.round(880 * scale) + 2 } : null),
      }}
    >
      <div style={scale ? { zoom: scale, width: 880 } : undefined}>
        <style>{barCss}</style>
        <div
          className="boostify-ab-wrap"
          style={{ "--bab-inset": `${eff.inset}px` }}
        >
          <div className={classes} style={vars}>
            {body}
            {bar.dismissible ? (
              <button
                type="button"
                className="boostify-ab__close"
                aria-label="Close"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
