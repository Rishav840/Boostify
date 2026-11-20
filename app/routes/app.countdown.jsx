import { useEffect, useMemo, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  LAYOUTS,
  MAX_TIMERS,
  TEMPLATES,
  TEMPLATE_GROUPS,
  TIMER_MODES,
  sanitizeCountdown,
  timerFromTemplate,
  formatInZone,
  whyHidden,
  zonedToUtc,
} from "../countdown";
import { CountdownPreview } from "../components/CountdownPreview";
import { Check, Color, Select, Text } from "../components/controls";

const QUERY = `#graphql
  query BoostifyCountdownConfig {
    shop { ianaTimezone }
    currentAppInstallation {
      id
      metafield(namespace: "boostify", key: "countdown") { value }
    }
  }`;

const MUTATION = `#graphql
  mutation BoostifyCountdownSave($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }`;

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const res = await admin.graphql(QUERY);
  const json = await res.json();
  const tz = json.data?.shop?.ianaTimezone || "UTC";
  let config = { version: 1, timezone: tz, timers: [] };
  try {
    const raw = json.data?.currentAppInstallation?.metafield?.value;
    if (raw) config = sanitizeCountdown(JSON.parse(raw), tz);
  } catch {
    // Corrupt value: start fresh rather than crash the page.
  }
  return {
    config,
    tz,
    shop: session.shop,
    // eslint-disable-next-line no-undef
    apiKey: process.env.SHOPIFY_API_KEY || "",
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();

  // The time zone always comes from the store itself, never from the browser
  const infoRes = await admin.graphql(
    `#graphql
      query BoostifyInstallation {
        shop { ianaTimezone }
        currentAppInstallation { id }
      }`,
  );
  const info = (await infoRes.json()).data;
  const tz = info?.shop?.ianaTimezone || "UTC";
  const ownerId = info.currentAppInstallation.id;

  let config;
  try {
    config = sanitizeCountdown(
      JSON.parse(String(form.get("config") || "{}")),
      tz,
    );
  } catch {
    return { ok: false, error: "Invalid data" };
  }

  const res = await admin.graphql(MUTATION, {
    variables: {
      metafields: [
        {
          ownerId,
          namespace: "boostify",
          key: "countdown",
          type: "json",
          value: JSON.stringify(config),
        },
      ],
    },
  });
  const errors = (await res.json()).data?.metafieldsSet?.userErrors || [];
  if (errors.length) return { ok: false, error: errors[0].message };
  return { ok: true, config };
};

const DURATIONS = [
  [30, "30 minutes"],
  [60, "1 hour"],
  [120, "2 hours"],
  [360, "6 hours"],
  [720, "12 hours"],
  [1440, "24 hours"],
  [2880, "2 days"],
  [4320, "3 days"],
  [10080, "7 days"],
];

function describeLeft(ms) {
  if (ms <= 0) return "That time has already passed";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return `Ends in ${d} day${d === 1 ? "" : "s"} ${h} hour${h === 1 ? "" : "s"}`;
}

export default function Countdown() {
  const { config: initial, tz, shop, apiKey } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [config, setConfig] = useState(initial);
  const [view, setView] = useState("list"); // list | templates | edit
  const [editingId, setEditingId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [previewState, setPreviewState] = useState("running");
  const saving = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Saved");
      setDirty(false);
    } else if (fetcher.data && fetcher.data.ok === false) {
      shopify.toast.show(fetcher.data.error || "Could not save", {
        isError: true,
      });
    }
  }, [fetcher.data, shopify]);

  const persist = (next) =>
    fetcher.submit({ config: JSON.stringify(next) }, { method: "POST" });
  const editor = `https://${shop}/admin/themes/current/editor?context=apps&activateAppId=${apiKey}/countdown-bar`;

  const t = config.timers.find((x) => x.id === editingId);
  const timerNumber = config.timers.findIndex((x) => x.id === editingId) + 1;
  const update = (patch) => {
    setConfig((c) => ({
      ...c,
      timers: c.timers.map((x) =>
        x.id === editingId ? { ...x, ...patch } : x,
      ),
    }));
    setDirty(true);
  };
  const setLabel = (key, v) => update({ labels: { ...t.labels, [key]: v } });

  const createFrom = (id) => {
    const nt = timerFromTemplate(id);
    if (nt.mode === "fixed" && !nt.deadline) {
      nt.deadline = formatInZone(Date.now() + 3 * 86400000, tz);
    }
    setConfig((c) => ({ ...c, timers: [...c.timers, nt] }));
    setEditingId(nt.id);
    setView("edit");
    setDirty(true);
  };
  const toggle = (id, enabled) => {
    const next = {
      ...config,
      timers: config.timers.map((x) => (x.id === id ? { ...x, enabled } : x)),
    };
    setConfig(next);
    persist(next);
  };
  const remove = (id) => {
    const next = {
      ...config,
      timers: config.timers.filter((x) => x.id !== id),
    };
    setConfig(next);
    persist(next);
  };

  // What the typed deadline means, so mistakes are obvious before saving
  const deadlineUtc = useMemo(
    () => (t ? zonedToUtc(t.deadline, tz) : null),
    [t, tz],
  );
  const showFromUtc = useMemo(
    () => (t ? zonedToUtc(t.showFrom, tz) : null),
    [t, tz],
  );

  // ---------- template gallery ----------
  if (view === "templates") {
    return (
      <s-page heading="Choose a design">
        <s-button slot="primary-action" onClick={() => setView("list")}>
          Cancel
        </s-button>
        {TEMPLATE_GROUPS.map((g) => (
          <s-section key={g.place} heading={`${g.title} - ${g.blurb}`}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(430px, 1fr))",
                gap: 16,
              }}
            >
              {TEMPLATES.filter((x) => x.place === g.place).map((tpl) => {
                const sample = timerFromTemplate(tpl.id);
                const virtual = g.place === "bar" ? 880 : 520;
                const zoom = g.place === "bar" ? 0.48 : 0.8;
                return (
                  <div
                    key={tpl.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => createFrom(tpl.id)}
                    onKeyDown={(e) => e.key === "Enter" && createFrom(tpl.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <div style={{ width: Math.round(virtual * zoom) + 2 }}>
                      <div style={{ zoom, width: virtual }}>
                        <CountdownPreview timer={sample} state="running" />
                      </div>
                    </div>
                    <div
                      style={{ marginTop: 6, fontSize: 13, fontWeight: 600 }}
                    >
                      {tpl.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </s-section>
        ))}
      </s-page>
    );
  }

  // ---------- editor ----------
  if (view === "edit" && t) {
    return (
      <s-page heading={t.name} back-action="true">
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={() => persist(config)}
          {...(saving ? { loading: true } : {})}
          {...(!dirty ? { disabled: true } : {})}
        >
          Save
        </s-button>
        <s-button slot="secondary-actions" onClick={() => setView("list")}>
          Back to timers
        </s-button>

        {whyHidden(t, tz) ? (
          <s-banner
            tone="warning"
            heading="This timer is not showing on your store"
          >
            <s-paragraph>{whyHidden(t, tz)}</s-paragraph>
          </s-banner>
        ) : null}

        <s-section heading="Preview">
          <s-stack gap="base">
            <Select
              label="Show the preview as"
              value={previewState}
              onValue={setPreviewState}
              options={[
                ["running", "Counting down"],
                ["urgent", "Last minutes (urgent colors)"],
                ["expired", "Ended (shows your end message)"],
              ]}
            />
            <CountdownPreview
              timer={t}
              state={previewState}
              realEnd={t.mode === "fixed" ? deadlineUtc : null}
            />
          </s-stack>
        </s-section>

        <s-section heading="Timer">
          <s-stack gap="base">
            <Text
              label="Timer name (only you see this)"
              value={t.name}
              onValue={(v) => update({ name: v })}
            />
            <Select
              label="Type"
              value={t.mode}
              onValue={(v) => update({ mode: v })}
              options={TIMER_MODES.map((m) => [m.value, m.label])}
            />
            {t.mode === "fixed" ? (
              <>
                <Text
                  label={`Ends at - format 2026-11-30 23:59 (store time zone: ${tz})`}
                  value={t.deadline}
                  onValue={(v) => update({ deadline: v })}
                />
                <s-text color="subdued">
                  {t.deadline
                    ? deadlineUtc === null
                      ? "That doesn't look like a date. Use the format 2026-11-30 23:59."
                      : describeLeft(deadlineUtc - Date.now())
                    : "Enter the date and time the sale ends. Everyone sees the same end time."}
                </s-text>
              </>
            ) : null}
            {t.mode === "evergreen" ? (
              <Select
                label="Each visitor's countdown lasts"
                value={t.durationMin}
                onValue={(v) => update({ durationMin: Number(v) })}
                options={DURATIONS}
              />
            ) : null}
            {t.mode === "daily" ? (
              <Text
                label="Resets every day at (24-hour time, visitor's local time) - e.g. 23:59"
                value={t.dailyTime}
                onValue={(v) => update({ dailyTime: v })}
              />
            ) : null}
            <Check
              label="Turn this timer on"
              checked={t.enabled}
              onValue={(v) => update({ enabled: v })}
            />
          </s-stack>
        </s-section>

        <s-section heading="Where it shows">
          <s-stack gap="base">
            <Select
              label="Placement"
              value={t.place}
              onValue={(v) => update({ place: v })}
              options={[
                ["bar", "Top of the page (a bar below your announcement bars)"],
                [
                  "block",
                  "Anywhere I choose - product page, cart, any section",
                ],
              ]}
            />
            {t.place === "bar" ? (
              <>
                <Select
                  label="Show the bar on"
                  value={t.showOn}
                  onValue={(v) => update({ showOn: v })}
                  options={[
                    ["all", "All pages"],
                    ["home", "Home page only"],
                    ["product", "Product pages only"],
                  ]}
                />
                <Check
                  label="Keep the bar visible while scrolling (sticky)"
                  checked={t.sticky}
                  onValue={(v) => update({ sticky: v })}
                />
                <s-paragraph>
                  The Boostify Countdown app embed must be on in your theme (one
                  time).
                </s-paragraph>
                <div>
                  <s-button href={editor} target="_blank">
                    Open theme editor
                  </s-button>
                </div>
              </>
            ) : (
              <s-banner tone="info" heading={`This is Timer #${timerNumber}`}>
                <s-paragraph>
                  In the theme editor, open the page you want (for example a
                  product page), click <strong>Add block</strong> (or Add
                  section) → <strong>Apps</strong> →{" "}
                  <strong>Boostify Timer</strong>, then choose{" "}
                  <strong>Timer #{timerNumber}</strong>. Place it under the
                  price or above the Add to cart button.
                </s-paragraph>
              </s-banner>
            )}
            <Text
              label="Start showing at (optional) - format 2026-11-25 09:00"
              value={t.showFrom}
              onValue={(v) => update({ showFrom: v })}
            />
            {t.showFrom ? (
              <s-text color="subdued">
                {showFromUtc === null
                  ? "That doesn't look like a date."
                  : `Appears ${showFromUtc > Date.now() ? "in the future" : "now (already past)"}, store time zone ${tz}.`}
              </s-text>
            ) : null}
          </s-stack>
        </s-section>

        <s-section heading="Words">
          <s-stack gap="base">
            <Text
              label="Title shown with the timer"
              value={t.title}
              onValue={(v) => update({ title: v })}
            />
            <Select
              label="When the timer ends"
              value={t.expiredAction}
              onValue={(v) => update({ expiredAction: v })}
              options={[
                ["message", "Show an end message"],
                ["hide", "Hide it"],
              ]}
            />
            {t.expiredAction === "message" ? (
              <Text
                label="End message"
                value={t.expiredText}
                onValue={(v) => update({ expiredText: v })}
              />
            ) : null}
            <Text
              label="Button text (optional)"
              value={t.buttonText}
              onValue={(v) => update({ buttonText: v })}
            />
            <Text
              label="Button link - e.g. /collections/sale"
              value={t.buttonLink}
              onValue={(v) => update({ buttonLink: v })}
            />
          </s-stack>
        </s-section>

        <s-section heading="What it shows">
          <s-stack gap="base">
            <Select
              label="Layout"
              value={t.layout}
              onValue={(v) => update({ layout: v })}
              options={LAYOUTS.map((l) => [l.value, l.label])}
            />
            <Check
              label="Show days"
              checked={t.showDays}
              onValue={(v) => update({ showDays: v })}
            />
            <Check
              label="Show seconds"
              checked={t.showSeconds}
              onValue={(v) => update({ showSeconds: v })}
            />
            <Check
              label="Show the unit names"
              checked={t.showLabels}
              onValue={(v) => update({ showLabels: v })}
            />
            {t.showLabels ? (
              <>
                <Text
                  label="Name for days"
                  value={t.labels.days}
                  onValue={(v) => setLabel("days", v)}
                />
                <Text
                  label="Name for hours"
                  value={t.labels.hours}
                  onValue={(v) => setLabel("hours", v)}
                />
                <Text
                  label="Name for minutes"
                  value={t.labels.minutes}
                  onValue={(v) => setLabel("minutes", v)}
                />
                <Text
                  label="Name for seconds"
                  value={t.labels.seconds}
                  onValue={(v) => setLabel("seconds", v)}
                />
              </>
            ) : null}
            <Select
              label="Urgent colors and pulse in the last…"
              value={t.urgentMinutes}
              onValue={(v) => update({ urgentMinutes: Number(v) })}
              options={[
                [0, "Never"],
                [10, "10 minutes"],
                [30, "30 minutes"],
                [60, "1 hour"],
                [180, "3 hours"],
                [1440, "24 hours"],
              ]}
            />
          </s-stack>
        </s-section>

        <s-section heading="Colors">
          <s-stack gap="base">
            <Color
              label="Background (start)"
              value={t.bgFrom}
              onValue={(v) => update({ bgFrom: v })}
            />
            <Color
              label="Background (end) - same as start for a solid color"
              value={t.bgTo}
              onValue={(v) => update({ bgTo: v })}
            />
            <Select
              label="Gradient direction"
              value={t.angle}
              onValue={(v) => update({ angle: Number(v) })}
              options={[
                [90, "Left → right"],
                [270, "Right → left"],
                [180, "Top → bottom"],
                [135, "Diagonal"],
              ]}
            />
            <Color
              label="Text color"
              value={t.textColor}
              onValue={(v) => update({ textColor: v })}
            />
            <Color
              alpha
              label="Number box color"
              value={t.digitBg}
              onValue={(v) => update({ digitBg: v })}
            />
            <Color
              label="Number color"
              value={t.digitColor}
              onValue={(v) => update({ digitColor: v })}
            />
            <Color
              alpha
              label="Unit name color"
              value={t.labelColor}
              onValue={(v) => update({ labelColor: v })}
            />
            <Color
              label="Urgent color (last minutes)"
              value={t.accentColor}
              onValue={(v) => update({ accentColor: v })}
            />
            <Color
              label="Button color"
              value={t.btnBg}
              onValue={(v) => update({ btnBg: v })}
            />
            <Color
              label="Button text color"
              value={t.btnText}
              onValue={(v) => update({ btnText: v })}
            />
          </s-stack>
        </s-section>

        <s-section heading="Shape and type">
          <s-stack gap="base">
            <Select
              label="Corners"
              value={t.radius}
              onValue={(v) => update({ radius: Number(v) })}
              options={[
                [0, "Square (full width)"],
                [8, "Slightly rounded"],
                [14, "Rounded card"],
                [999, "Pill"],
              ]}
            />
            <Select
              label="Space around it"
              value={t.inset}
              onValue={(v) => update({ inset: Number(v) })}
              options={[
                [0, "None"],
                [8, "Small"],
                [12, "Medium"],
                [20, "Large"],
              ]}
            />
            <Check
              label="Drop shadow"
              checked={t.shadow}
              onValue={(v) => update({ shadow: v })}
            />
            <Check
              label="Thin outline"
              checked={t.border}
              onValue={(v) => update({ border: v })}
            />
            <Select
              label="Font"
              value={t.fontFamily}
              onValue={(v) => update({ fontFamily: v })}
              options={[
                ["inherit", "Match my theme"],
                ["serif", "Serif"],
                ["mono", "Monospace"],
              ]}
            />
            <Select
              label="Font size"
              value={t.fontSize}
              onValue={(v) => update({ fontSize: Number(v) })}
              options={[13, 14, 15, 16, 18, 20, 24].map((n) => [n, `${n}px`])}
            />
            <Select
              label="Font weight"
              value={t.fontWeight}
              onValue={(v) => update({ fontWeight: Number(v) })}
              options={[
                [400, "Regular"],
                [600, "Semi-bold"],
                [700, "Bold"],
                [800, "Extra bold"],
              ]}
            />
            <Select
              label="Alignment"
              value={t.align}
              onValue={(v) => update({ align: v })}
              options={[
                ["left", "Left"],
                ["center", "Center"],
                ["right", "Right"],
              ]}
            />
            <Select
              label="Height"
              value={t.padding}
              onValue={(v) => update({ padding: Number(v) })}
              options={[
                [6, "Compact"],
                [10, "Normal"],
                [16, "Tall"],
                [24, "Extra tall"],
              ]}
            />
            <Check
              label="Uppercase title"
              checked={t.uppercase}
              onValue={(v) => update({ uppercase: v })}
            />
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  // ---------- list ----------
  return (
    <s-page heading="Countdown timers">
      {config.timers.length < MAX_TIMERS ? (
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={() => setView("templates")}
        >
          Create timer
        </s-button>
      ) : null}

      {config.timers.length === 0 ? (
        <s-section heading="Create your first timer">
          <s-paragraph>
            Pick a design, set when the sale ends, and the timer counts down
            live on your store. Show it as a bar at the top of the page, or on
            your product pages.
          </s-paragraph>
          <s-button variant="primary" onClick={() => setView("templates")}>
            Browse designs
          </s-button>
        </s-section>
      ) : (
        <s-section
          heading={`Your timers (${config.timers.length}/${MAX_TIMERS})`}
        >
          <s-stack gap="base">
            {config.timers.map((x, n) => (
              <div
                key={x.id}
                style={{
                  border: "1px solid #e1e3e5",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    width: x.place === "bar" ? undefined : 520,
                    maxWidth: "100%",
                  }}
                >
                  <CountdownPreview
                    timer={x}
                    state="running"
                    realEnd={
                      x.mode === "fixed" ? zonedToUtc(x.deadline, tz) : null
                    }
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginTop: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <s-stack direction="inline" gap="small" align-items="center">
                    <s-text type="strong">{`Timer #${n + 1} · ${x.name}`}</s-text>
                    <s-badge tone={x.enabled ? "success" : "neutral"}>
                      {x.enabled ? "On" : "Off"}
                    </s-badge>
                    {x.enabled && whyHidden(x, tz) ? (
                      <s-badge tone="critical">
                        Not showing, open it to see why
                      </s-badge>
                    ) : null}
                    <s-badge>
                      {x.place === "bar"
                        ? "Top of page"
                        : "Placed with a block"}
                    </s-badge>
                  </s-stack>
                  <s-stack direction="inline" gap="small">
                    <s-button
                      onClick={() => {
                        setEditingId(x.id);
                        setView("edit");
                      }}
                    >
                      Edit
                    </s-button>
                    <s-button onClick={() => toggle(x.id, !x.enabled)}>
                      {x.enabled ? "Turn off" : "Turn on"}
                    </s-button>
                    <s-button
                      tone="critical"
                      variant="tertiary"
                      onClick={() => remove(x.id)}
                    >
                      Delete
                    </s-button>
                  </s-stack>
                </div>
              </div>
            ))}
          </s-stack>
        </s-section>
      )}

      <s-section heading="Turn on the app embed">
        <s-paragraph>
          Top-of-page timers need the Boostify Countdown app embed switched on
          in your theme (one time). Timers placed with the Boostify Timer block
          do not need it.
        </s-paragraph>
        <s-button href={editor} target="_blank">
          Open theme editor
        </s-button>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
