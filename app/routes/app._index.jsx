import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  BAR_TYPES,
  MAX_BARS,
  MAX_MESSAGES,
  TEMPLATES,
  TEMPLATE_GROUPS,
  barFromTemplate,
  emptyMessage,
  sanitizeConfig,
} from "../announcement";
import { BarPreview } from "../components/BarPreview";
import { Check, Color, Select, Text } from "../components/controls";

const QUERY = `#graphql
  query BoostifyConfig {
    shop { ianaTimezone }
    currentAppInstallation {
      id
      metafield(namespace: "boostify", key: "announcement") { value }
    }
  }`;

const MUTATION = `#graphql
  mutation BoostifySave($metafields: [MetafieldsSetInput!]!) {
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
  let config = { version: 1, bars: [] };
  try {
    const raw = json.data?.currentAppInstallation?.metafield?.value;
    if (raw) config = sanitizeConfig(JSON.parse(raw), tz);
  } catch {
    // Corrupt value: start fresh rather than crash the dashboard.
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
  const idRes = await admin.graphql(
    `#graphql
      query BoostifyInstallation {
        shop { ianaTimezone }
        currentAppInstallation { id }
      }`,
  );
  const info = (await idRes.json()).data;
  const ownerId = info.currentAppInstallation.id;
  const tz = info.shop?.ianaTimezone || "UTC";

  let config;
  try {
    config = sanitizeConfig(JSON.parse(String(form.get("config") || "{}")), tz);
  } catch {
    return { ok: false, error: "Invalid data" };
  }

  const res = await admin.graphql(MUTATION, {
    variables: {
      metafields: [
        {
          ownerId,
          namespace: "boostify",
          key: "announcement",
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

export default function Index() {
  const { config: initial, tz, shop, apiKey } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [config, setConfig] = useState(initial);
  const [view, setView] = useState("list"); // list | templates | edit
  const [editingId, setEditingId] = useState(null);
  const [dirty, setDirty] = useState(false);

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

  const persist = (next) => {
    fetcher.submit({ config: JSON.stringify(next) }, { method: "POST" });
  };

  const editor = `https://${shop}/admin/themes/current/editor?context=apps&activateAppId=${apiKey}/announcement-bar`;

  const bar = config.bars.find((b) => b.id === editingId);
  const barNumber = config.bars.findIndex((b) => b.id === editingId) + 1;
  const update = (patch) => {
    setConfig((c) => ({
      ...c,
      bars: c.bars.map((b) => (b.id === editingId ? { ...b, ...patch } : b)),
    }));
    setDirty(true);
  };
  const setMessage = (i, patch) =>
    update({
      messages: bar.messages.map((m, j) => (j === i ? { ...m, ...patch } : m)),
    });

  const createFrom = (templateId) => {
    const next = {
      ...config,
      bars: [...config.bars, barFromTemplate(templateId)],
    };
    setConfig(next);
    setEditingId(next.bars[next.bars.length - 1].id);
    setView("edit");
    setDirty(true);
  };

  const toggleEnabled = (id, enabled) => {
    const next = {
      ...config,
      bars: config.bars.map((b) => (b.id === id ? { ...b, enabled } : b)),
    };
    setConfig(next);
    persist(next);
  };

  const removeBar = (id) => {
    const next = { ...config, bars: config.bars.filter((b) => b.id !== id) };
    setConfig(next);
    persist(next);
  };

  // ---------- Template gallery ----------
  if (view === "templates") {
    return (
      <s-page heading="Choose a template">
        <s-button slot="primary-action" onClick={() => setView("list")}>
          Cancel
        </s-button>
        {TEMPLATE_GROUPS.map((g) => (
          <s-section key={g.type} heading={`${g.title} - ${g.blurb}`}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(430px, 1fr))",
                gap: 16,
              }}
            >
              {TEMPLATES.filter((t) => t.type === g.type).map((t) => {
                const sample = barFromTemplate(t.id);
                return (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => createFrom(t.id)}
                    onKeyDown={(e) => e.key === "Enter" && createFrom(t.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <BarPreview bar={sample} scale={0.48} />
                    <div
                      style={{ marginTop: 6, fontSize: 13, fontWeight: 600 }}
                    >
                      {t.name}
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

  // ---------- Editor ----------
  if (view === "edit" && bar) {
    return (
      <s-page heading={bar.name} back-action="true">
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
          Back to bars
        </s-button>

        <s-section heading="Preview">
          <BarPreview bar={bar} />
          <div style={{ marginTop: 8 }}>
            <s-text color="subdued">
              The bar appears on your storefront once it is turned on and the
              app embed is enabled.
            </s-text>
          </div>
        </s-section>

        <s-section heading="General">
          <s-stack gap="base">
            <Text
              label="Bar name (only you see this)"
              value={bar.name}
              onValue={(v) => update({ name: v })}
            />
            <Select
              label="Type"
              value={bar.type}
              onValue={(v) => update({ type: v })}
              options={BAR_TYPES.map((t) => [t.value, t.label])}
            />
            <Select
              label="Where should this bar appear?"
              value={bar.placement}
              onValue={(v) => update({ placement: v })}
              options={[
                ["top", "Top of every page"],
                ["inline", "Anywhere I choose (inside a page section)"],
              ]}
            />
            {bar.placement === "inline" ? (
              <s-banner tone="info" heading={`This is Bar #${barNumber}`}>
                <s-paragraph>
                  In the theme editor, open the page you want, click{" "}
                  <strong>Add block</strong> (or Add section) →{" "}
                  <strong>Apps</strong> → <strong>Boostify Bar</strong>, then
                  choose <strong>Bar #{barNumber}</strong>. Drag it wherever you
                  like, for example between two sections.
                </s-paragraph>
                <s-button href={editor} target="_blank">
                  Open theme editor
                </s-button>
              </s-banner>
            ) : null}
            <Check
              label="Turn this bar on"
              checked={bar.enabled}
              onValue={(v) => update({ enabled: v })}
            />
          </s-stack>
        </s-section>

        <s-section heading="Messages">
          <s-stack gap="base">
            {bar.messages.map((m, i) => (
              <div
                key={i}
                style={{
                  border: "1px solid #e1e3e5",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <s-stack gap="small">
                  <Text
                    label={`Message ${i + 1} (emoji welcome 🎉)`}
                    value={m.text}
                    onValue={(v) => setMessage(i, { text: v })}
                  />
                  <Text
                    label="Link (optional) - e.g. /collections/sale"
                    value={m.link}
                    onValue={(v) => setMessage(i, { link: v })}
                  />
                  <Text
                    label="Button text (optional, needs a link) - e.g. Shop now"
                    value={m.buttonText}
                    onValue={(v) => setMessage(i, { buttonText: v })}
                  />
                  {bar.messages.length > 1 ? (
                    <div>
                      <s-button
                        tone="critical"
                        variant="tertiary"
                        onClick={() =>
                          update({
                            messages: bar.messages.filter((_, j) => j !== i),
                          })
                        }
                      >
                        Remove message
                      </s-button>
                    </div>
                  ) : null}
                </s-stack>
              </div>
            ))}
            {bar.messages.length < MAX_MESSAGES ? (
              <div>
                <s-button
                  onClick={() =>
                    update({ messages: [...bar.messages, emptyMessage()] })
                  }
                >
                  Add message
                </s-button>
              </div>
            ) : null}
          </s-stack>
        </s-section>

        <s-section heading="Colors">
          <s-stack gap="base">
            <Color
              label="Background (start)"
              value={bar.bgFrom}
              onValue={(v) => update({ bgFrom: v })}
            />
            <Color
              label="Background (end) - same as start for a solid color"
              value={bar.bgTo}
              onValue={(v) => update({ bgTo: v })}
            />
            <Select
              label="Gradient direction"
              value={bar.angle}
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
              value={bar.textColor}
              onValue={(v) => update({ textColor: v })}
            />
            <Color
              label="Accent color (separators, outline buttons)"
              value={bar.accentColor}
              onValue={(v) => update({ accentColor: v })}
            />
            <Text
              label="Background image URL (optional, https://…)"
              value={bar.bgImage}
              onValue={(v) => update({ bgImage: v })}
            />
          </s-stack>
        </s-section>

        <s-section heading="Button">
          <s-stack gap="base">
            <Select
              label="Button style"
              value={bar.btnStyle}
              onValue={(v) => update({ btnStyle: v })}
              options={[
                ["solid", "Solid"],
                ["outline", "Outline"],
              ]}
            />
            <Color
              label="Button background"
              value={bar.btnBg}
              onValue={(v) => update({ btnBg: v })}
            />
            <Color
              label="Button text color"
              value={bar.btnText}
              onValue={(v) => update({ btnText: v })}
            />
            <Select
              label="Button corners"
              value={bar.btnRadius}
              onValue={(v) => update({ btnRadius: Number(v) })}
              options={[
                [0, "Square"],
                [6, "Slightly rounded"],
                [10, "Rounded"],
                [999, "Pill"],
              ]}
            />
            <s-text color="subdued">
              Buttons show on messages that have both a link and button text.
            </s-text>
          </s-stack>
        </s-section>

        <s-section heading="Shape and style">
          <s-stack gap="base">
            <Select
              label="Corners"
              value={bar.radius}
              onValue={(v) => update({ radius: Number(v) })}
              options={[
                [0, "Square (full width)"],
                [8, "Slightly rounded"],
                [14, "Rounded card"],
                [999, "Pill"],
              ]}
            />
            <Select
              label="Space around the bar"
              value={bar.inset}
              onValue={(v) => update({ inset: Number(v) })}
              options={[
                [0, "None (edge to edge)"],
                [8, "Small"],
                [10, "Medium"],
                [16, "Large"],
              ]}
            />
            <Check
              label="Drop shadow"
              checked={bar.shadow}
              onValue={(v) => update({ shadow: v })}
            />
            <Check
              label="Thin outline"
              checked={bar.border}
              onValue={(v) => update({ border: v })}
            />
            {bar.type !== "static" ? (
              <Check
                label="Fade the text out at both edges"
                checked={bar.edgeFade}
                onValue={(v) => update({ edgeFade: v })}
              />
            ) : null}
          </s-stack>
        </s-section>

        <s-section heading="Typography">
          <s-stack gap="base">
            <Select
              label="Font"
              value={bar.fontFamily}
              onValue={(v) => update({ fontFamily: v })}
              options={[
                ["inherit", "Match my theme"],
                ["serif", "Serif"],
                ["mono", "Monospace"],
              ]}
            />
            <Select
              label="Font size"
              value={bar.fontSize}
              onValue={(v) => update({ fontSize: Number(v) })}
              options={[12, 13, 14, 15, 16, 17, 18, 20, 22, 24].map((n) => [
                n,
                `${n}px`,
              ])}
            />
            <Select
              label="Font weight"
              value={bar.fontWeight}
              onValue={(v) => update({ fontWeight: Number(v) })}
              options={[
                [400, "Regular"],
                [500, "Medium"],
                [600, "Semi-bold"],
                [700, "Bold"],
                [800, "Extra bold"],
              ]}
            />
            <Select
              label="Letter spacing"
              value={bar.letterSpacing}
              onValue={(v) => update({ letterSpacing: Number(v) })}
              options={[
                [0, "None"],
                [0.5, "Small"],
                [1, "Medium"],
                [2, "Wide"],
              ]}
            />
            <Select
              label="Size"
              value={bar.size}
              onValue={(v) => update({ size: v })}
              options={[
                ["compact", "Compact (smaller bar, recommended)"],
                ["normal", "Normal (exactly the sizes below)"],
              ]}
            />
            <Select
              label="Bar height"
              value={bar.padding}
              onValue={(v) => update({ padding: Number(v) })}
              options={[
                [7, "Compact"],
                [11, "Normal"],
                [14, "Tall"],
                [20, "Extra tall"],
              ]}
            />
            {bar.type !== "marquee" ? (
              <Select
                label="Text alignment"
                value={bar.align}
                onValue={(v) => update({ align: v })}
                options={[
                  ["left", "Left"],
                  ["center", "Center"],
                  ["right", "Right"],
                ]}
              />
            ) : null}
            <Check
              label="Uppercase text"
              checked={bar.uppercase}
              onValue={(v) => update({ uppercase: v })}
            />
          </s-stack>
        </s-section>

        <s-section heading="Behavior">
          <s-stack gap="base">
            {bar.type === "rotate" ? (
              <>
                <Select
                  label="Transition"
                  value={bar.animation}
                  onValue={(v) => update({ animation: v })}
                  options={[
                    ["slide", "Slide up / down (vertical)"],
                    ["slide-x", "Slide left / right (horizontal)"],
                    ["fade", "Fade"],
                  ]}
                />
                <Select
                  label="Time per message"
                  value={bar.interval}
                  onValue={(v) => update({ interval: Number(v) })}
                  options={[2, 3, 4, 5, 6, 8, 10].map((n) => [
                    n,
                    `${n} seconds`,
                  ])}
                />
                <Check
                  label="Show previous / next arrows"
                  checked={bar.arrows}
                  onValue={(v) => update({ arrows: v })}
                />
              </>
            ) : null}
            {bar.type === "marquee" ? (
              <>
                <Select
                  label="Scroll speed"
                  value={bar.speed}
                  onValue={(v) => update({ speed: Number(v) })}
                  options={[
                    [45, "Slow"],
                    [25, "Normal"],
                    [14, "Fast"],
                  ]}
                />
                <Select
                  label="Symbol between messages"
                  value={bar.separator}
                  onValue={(v) => update({ separator: v })}
                  options={[
                    ["•", "• Dot"],
                    ["✦", "✦ Star"],
                    ["★", "★ Solid star"],
                    ["♥", "♥ Heart"],
                    ["🔥", "🔥 Fire"],
                    ["⚡", "⚡ Bolt"],
                    ["|", "| Line"],
                    ["", "None"],
                  ]}
                />
              </>
            ) : null}
            {bar.placement === "top" ? (
              <Check
                label="Keep the bar visible while scrolling (sticky)"
                checked={bar.sticky}
                onValue={(v) => update({ sticky: v })}
              />
            ) : null}
            <Check
              label="Let visitors close the bar"
              checked={bar.dismissible}
              onValue={(v) => update({ dismissible: v })}
            />
          </s-stack>
        </s-section>

        <s-section heading="Where and when">
          <s-stack gap="base">
            <Select
              label="Show on"
              value={bar.showOn}
              onValue={(v) => update({ showOn: v })}
              options={[
                ["all", "All pages"],
                ["home", "Home page only"],
              ]}
            />
            <Text
              label={`Start (optional) - format 2026-11-25 09:00, store time zone ${tz}`}
              value={bar.start}
              onValue={(v) => update({ start: v })}
            />
            <Text
              label={`End (optional) - format 2026-11-30 23:59, store time zone ${tz}`}
              value={bar.end}
              onValue={(v) => update({ end: v })}
            />
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  // ---------- List ----------
  return (
    <s-page heading="Announcement bars">
      {config.bars.length < MAX_BARS ? (
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={() => setView("templates")}
        >
          Create bar
        </s-button>
      ) : null}

      <s-section heading="Turn on the app embed">
        <s-paragraph>
          Bars only show on your store when the Boostify app embed is switched
          on in your theme.
        </s-paragraph>
        <s-button href={editor} target="_blank">
          Open theme editor
        </s-button>
      </s-section>

      {config.bars.length === 0 ? (
        <s-section heading="Create your first bar">
          <s-paragraph>
            Pick one of {TEMPLATES.length} ready-made designs, then change the
            text, colors and behavior.
          </s-paragraph>
          <s-button variant="primary" onClick={() => setView("templates")}>
            Browse templates
          </s-button>
        </s-section>
      ) : (
        <s-section heading={`Your bars (${config.bars.length}/${MAX_BARS})`}>
          <s-stack gap="base">
            {config.bars.map((b, n) => (
              <div
                key={b.id}
                style={{
                  border: "1px solid #e1e3e5",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <BarPreview bar={b} />
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
                    <s-text type="strong">{`Bar #${n + 1} · ${b.name}`}</s-text>
                    <s-badge>
                      {b.placement === "inline"
                        ? "Placed in a section"
                        : "Top of page"}
                    </s-badge>
                    <s-badge tone={b.enabled ? "success" : "neutral"}>
                      {b.enabled ? "On" : "Off"}
                    </s-badge>
                  </s-stack>
                  <s-stack direction="inline" gap="small">
                    <s-button
                      onClick={() => {
                        setEditingId(b.id);
                        setView("edit");
                      }}
                    >
                      Edit
                    </s-button>
                    <s-button onClick={() => toggleEnabled(b.id, !b.enabled)}>
                      {b.enabled ? "Turn off" : "Turn on"}
                    </s-button>
                    <s-button
                      tone="critical"
                      variant="tertiary"
                      onClick={() => removeBar(b.id)}
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
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
