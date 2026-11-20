import { useEffect, useMemo, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  CP_DEFAULTS,
  GOAL_ICONS,
  MAX_GOALS,
  sanitizeCartProgress,
} from "../cartprogress";
import { CartProgressPreview } from "../components/CartProgressPreview";
import { blastConfetti } from "../confetti";
import { Check, Color, Select, Text } from "../components/controls";

const QUERY = `#graphql
  query BoostifyCartProgressConfig {
    currentAppInstallation {
      id
      metafield(namespace: "boostify", key: "cart_progress") { value }
    }
  }`;

const MUTATION = `#graphql
  mutation BoostifyCartProgressSave($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }`;

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const res = await admin.graphql(QUERY);
  const json = await res.json();
  let config = sanitizeCartProgress(CP_DEFAULTS);
  try {
    const raw = json.data?.currentAppInstallation?.metafield?.value;
    if (raw) config = sanitizeCartProgress(JSON.parse(raw));
  } catch {
    // Corrupt value: fall back to defaults rather than crash the page.
  }
  return {
    config,
    shop: session.shop,
    // eslint-disable-next-line no-undef
    apiKey: process.env.SHOPIFY_API_KEY || "",
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  let config;
  try {
    config = sanitizeCartProgress(
      JSON.parse(String(form.get("config") || "{}")),
    );
  } catch {
    return { ok: false, error: "Invalid data" };
  }

  const idRes = await admin.graphql(
    `#graphql
      query BoostifyInstallation {
        currentAppInstallation { id }
      }`,
  );
  const ownerId = (await idRes.json()).data.currentAppInstallation.id;

  const res = await admin.graphql(MUTATION, {
    variables: {
      metafields: [
        {
          ownerId,
          namespace: "boostify",
          key: "cart_progress",
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

export default function CartProgress() {
  const { config: initial, shop, apiKey } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [cfg, setCfg] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [previewTotal, setPreviewTotal] = useState("0");
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

  const set = (patch) => {
    setCfg((c) => ({ ...c, ...patch }));
    setDirty(true);
  };
  const setGoal = (i, patch) =>
    set({ goals: cfg.goals.map((g, j) => (j === i ? { ...g, ...patch } : g)) });
  const save = () =>
    fetcher.submit({ config: JSON.stringify(cfg) }, { method: "POST" });

  // The preview uses the same cleaning as saving, so half-typed amounts don't break it.
  const clean = useMemo(() => sanitizeCartProgress(cfg), [cfg]);

  const stops = useMemo(() => {
    const amounts = clean.goals.map((g) => g.amount);
    const last = amounts[amounts.length - 1] || 0;
    const opts = [[0, "Empty cart"]];
    amounts.forEach((a, i) => {
      opts.push([Math.round(a / 2), `About halfway to goal ${i + 1}`]);
      opts.push([a, `Exactly at goal ${i + 1} (₹${a})`]);
    });
    opts.push([Math.round(last * 1.2), "Past every goal"]);
    return opts.filter(([v], i, arr) => arr.findIndex(([x]) => x === v) === i);
  }, [clean]);

  const editor = (extra) =>
    `https://${shop}/admin/themes/current/editor?context=apps${extra}&activateAppId=${apiKey}/cart-progress`;

  return (
    <s-page heading="Cart Progress Bar">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={save}
        {...(saving ? { loading: true } : {})}
        {...(!dirty ? { disabled: true } : {})}
      >
        Save
      </s-button>

      <s-section heading="Preview">
        <s-stack gap="base">
          <Select
            label="Pretend the customer's cart is…"
            value={String(Math.round(Number(previewTotal)) || 0)}
            onValue={(v) => setPreviewTotal(v)}
            options={stops}
          />
          <CartProgressPreview
            cfg={clean}
            totalCents={Number(previewTotal) * 100}
          />
          <div>
            <s-button
              onClick={() =>
                blastConfetti(document.querySelector("[data-cp-preview]"), [
                  clean.fillColor,
                  clean.fillColor2,
                ])
              }
            >
              🎉 Test the confetti (it bursts inside the box above, like the
              cart drawer)
            </s-button>
          </div>
          <s-text color="subdued">
            On your store the bar fills up live as the customer adds or removes
            items, and the confetti fires inside the cart drawer each time a
            goal is reached.
          </s-text>
        </s-stack>
      </s-section>

      <s-section heading="Turn it on">
        <s-stack gap="base">
          <Check
            label="Show the cart progress bar on my store"
            checked={cfg.enabled}
            onValue={(v) => set({ enabled: v })}
          />
          <s-paragraph>
            Switch on the Boostify Cart Progress app embed in your theme (one
            time). The bar then appears in your cart drawer and on your cart
            page only. If your theme needs a hand, add the{" "}
            <strong>Boostify Progress Bar</strong> block to your cart page in
            the theme editor.
          </s-paragraph>
          <div>
            <s-button href={editor("&template=cart")} target="_blank">
              Open theme editor
            </s-button>
          </div>
        </s-stack>
      </s-section>

      <s-section heading="Goals">
        <s-stack gap="base">
          {cfg.goals.map((g, i) => (
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
                  label={`Goal ${i + 1}: spend at least (in your store's currency)`}
                  value={String(g.amount)}
                  onValue={(v) => setGoal(i, { amount: v })}
                />
                <Text
                  label="Reward name - e.g. Free shipping, 10% off, a free gift"
                  value={g.label}
                  onValue={(v) => setGoal(i, { label: v })}
                />
                <Text
                  label="Icon - type any emoji, symbol or a few letters (e.g. 🎁 ★ VIP)"
                  value={g.icon}
                  onValue={(v) => setGoal(i, { icon: v })}
                />
                <Select
                  label="…or pick one (line icons look cleanest)"
                  value=""
                  onValue={(v) => v && setGoal(i, { icon: v })}
                  options={[["", "Choose…"], ...GOAL_ICONS]}
                />
                <Text
                  label="Or use your own icon image (optional, https://… - replaces the icon above)"
                  value={g.iconImage || ""}
                  onValue={(v) => setGoal(i, { iconImage: v })}
                />
                <Text
                  label="Tooltip (optional) - shown when a shopper hovers or taps this marker. Leave empty for e.g. “Free shipping at ₹500”"
                  value={g.tip || ""}
                  onValue={(v) => setGoal(i, { tip: v })}
                />
                {cfg.goals.length > 1 ? (
                  <div>
                    <s-button
                      tone="critical"
                      variant="tertiary"
                      onClick={() =>
                        set({ goals: cfg.goals.filter((_, j) => j !== i) })
                      }
                    >
                      Remove goal
                    </s-button>
                  </div>
                ) : null}
              </s-stack>
            </div>
          ))}
          {cfg.goals.length < MAX_GOALS ? (
            <div>
              <s-button
                onClick={() =>
                  set({
                    goals: [
                      ...cfg.goals,
                      {
                        amount:
                          (Number(cfg.goals[cfg.goals.length - 1]?.amount) ||
                            0) + 500,
                        label: "a surprise reward",
                        icon: "⭐",
                      },
                    ],
                  })
                }
              >
                Add goal
              </s-button>
            </div>
          ) : null}
          <s-text color="subdued">
            Goals sort themselves from lowest to highest. The bar only shows
            progress. Create the matching free-shipping or discount rule in
            Shopify (Discounts) so the reward is really applied.
          </s-text>
        </s-stack>
      </s-section>

      <s-section heading="Messages">
        <s-stack gap="base">
          <Text
            label="While the customer is working towards a goal"
            value={cfg.progressText}
            onValue={(v) => set({ progressText: v })}
          />
          <Text
            label="Message while the cart is empty"
            value={cfg.emptyText}
            onValue={(v) => set({ emptyText: v })}
          />
          <Text
            label="When every goal is reached"
            value={cfg.allReachedText}
            onValue={(v) => set({ allReachedText: v })}
          />
          <s-text color="subdued">
            Use {"{amount}"} for how much is still needed, {"{goal}"} for the
            next reward and {"{threshold}"} for the amount needed for it.
          </s-text>
        </s-stack>
      </s-section>

      <s-section heading="Where it shows">
        <s-stack gap="base">
          <Check
            label="Inside the cart drawer (works with most themes)"
            checked={cfg.showDrawer}
            onValue={(v) => set({ showDrawer: v })}
          />
          <Check
            label="At the top of the cart page"
            checked={cfg.showCartPage}
            onValue={(v) => set({ showCartPage: v })}
          />
          <Check
            label="Also show it when the cart is empty (appears at the top)"
            checked={cfg.showEmpty}
            onValue={(v) => set({ showEmpty: v })}
          />
        </s-stack>
      </s-section>

      <s-section heading="Goal markers">
        <s-stack gap="base">
          <Check
            label="Show a marker for each goal on the bar"
            checked={cfg.showMilestones}
            onValue={(v) => set({ showMilestones: v })}
          />
          <Check
            label="Show the offer in a tooltip when a shopper hovers or taps a marker"
            checked={cfg.tooltips}
            onValue={(v) => set({ tooltips: v })}
          />
          <Check
            label="Show the next reward's icon before the message"
            checked={cfg.iconInMessage}
            onValue={(v) => set({ iconInMessage: v })}
          />
          {cfg.showMilestones ? (
            <>
              <Check
                label="Show the amount above each marker (e.g. ₹2,499)"
                checked={cfg.showAmounts}
                onValue={(v) => set({ showAmounts: v })}
              />
              <Check
                label="Show the reward name under each marker"
                checked={cfg.showLabels}
                onValue={(v) => set({ showLabels: v })}
              />
            </>
          ) : null}
          <Check
            label="🎉 Party-popper confetti inside the cart drawer each time a goal is reached"
            checked={cfg.confetti}
            onValue={(v) => set({ confetti: v })}
          />
        </s-stack>
      </s-section>

      <s-section heading="Bar">
        <s-stack gap="base">
          <Select
            label="Style"
            value={cfg.layout}
            onValue={(v) => set({ layout: v })}
            options={[
              [
                "clean",
                "Clean - soft markers in the bar, details in tooltips (recommended)",
              ],
              [
                "classic",
                "Classic - amounts and reward names around the markers",
              ],
            ]}
          />
          <Color
            label="Bar color"
            value={cfg.fillColor}
            onValue={(v) => set({ fillColor: v, fillColor2: v })}
          />
          <Color
            label="Bar color at the end (optional, only change it for a gradient)"
            value={cfg.fillColor2}
            onValue={(v) => set({ fillColor2: v })}
          />
          <Color
            label="Empty part of the bar"
            value={cfg.trackColor}
            onValue={(v) => set({ trackColor: v })}
          />
          <Select
            label="Bar thickness"
            value={cfg.height}
            onValue={(v) => set({ height: Number(v) })}
            options={[
              [2, "Hairline (2px)"],
              [4, "Thin (4px)"],
              [6, "Normal (6px)"],
              [8, "Medium (8px)"],
              [12, "Thick (12px)"],
              [16, "Extra thick (16px)"],
              [20, "Heavy (20px)"],
            ]}
          />
          <Select
            label="Bar ends"
            value={cfg.barShape}
            onValue={(v) => set({ barShape: v })}
            options={[
              ["square", "Square"],
              ["rounded", "Rounded"],
            ]}
          />
        </s-stack>
      </s-section>

      <s-section heading="Markers">
        <s-stack gap="base">
          <Select
            label="Marker shape"
            value={cfg.markerShape}
            onValue={(v) => set({ markerShape: v })}
            options={[
              ["circle", "Circle"],
              ["square", "Square"],
            ]}
          />
          <Select
            label="Marker size"
            value={cfg.markerSize}
            onValue={(v) => set({ markerSize: Number(v) })}
            options={[
              [18, "Small"],
              [22, "Normal"],
              [28, "Large"],
              [34, "Extra large"],
            ]}
          />
          <Color
            label="Marker fill (behind the icon)"
            value={cfg.markerBg}
            onValue={(v) => set({ markerBg: v })}
          />
          <Color
            label="Icon color"
            value={cfg.markerIconColor}
            onValue={(v) => set({ markerIconColor: v })}
          />
          <Color
            label="Gap around the markers - set it to your cart's background color"
            value={cfg.gapColor}
            onValue={(v) => set({ gapColor: v })}
          />
        </s-stack>
      </s-section>

      <s-section heading="Text and background">
        <s-stack gap="base">
          <Color
            label="Text color"
            value={cfg.textColor}
            onValue={(v) => set({ textColor: v })}
          />
          <Select
            label="Font"
            value={cfg.fontFamily}
            onValue={(v) => set({ fontFamily: v })}
            options={[
              ["inherit", "Match my theme"],
              ["serif", "Serif"],
              ["mono", "Monospace"],
            ]}
          />
          <Select
            label="Font size"
            value={cfg.fontSize}
            onValue={(v) => set({ fontSize: Number(v) })}
            options={[12, 13, 14, 15, 16, 18].map((n) => [n, `${n}px`])}
          />
          <Select
            label="Message weight"
            value={cfg.fontWeight}
            onValue={(v) => set({ fontWeight: Number(v) })}
            options={[
              [400, "Regular"],
              [500, "Medium"],
              [600, "Semi-bold"],
              [700, "Bold"],
            ]}
          />
          <Select
            label="Spacing"
            value={cfg.density}
            onValue={(v) => set({ density: v })}
            options={[
              ["compact", "Compact (small, recommended)"],
              ["roomy", "Roomy (bigger bar)"],
            ]}
          />
          <Select
            label="Background"
            value={cfg.backgroundMode}
            onValue={(v) => set({ backgroundMode: v })}
            options={[
              ["none", "None (flat, no box)"],
              ["solid", "A solid color box"],
            ]}
          />
          {cfg.backgroundMode === "solid" ? (
            <>
              <Color
                label="Box color"
                value={cfg.bg}
                onValue={(v) => set({ bg: v })}
              />
              <Select
                label="Box corners"
                value={cfg.radius}
                onValue={(v) => set({ radius: Number(v) })}
                options={[
                  [0, "Square"],
                  [8, "Slightly rounded"],
                  [14, "Rounded"],
                ]}
              />
              <Check
                label="Thin outline"
                checked={cfg.border}
                onValue={(v) => set({ border: v })}
              />
              <Check
                label="Drop shadow"
                checked={cfg.shadow}
                onValue={(v) => set({ shadow: v })}
              />
            </>
          ) : null}
          <Check
            label="Thin line under the bar"
            checked={cfg.divider}
            onValue={(v) => set({ divider: v })}
          />
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
