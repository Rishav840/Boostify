import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { STICKY_DEFAULTS, sanitizeSticky } from "../stickycart";
import { StickyPreview } from "../components/StickyPreview";
import { Check, Color, Select, Text } from "../components/controls";

const QUERY = `#graphql
  query BoostifyStickyConfig {
    currentAppInstallation {
      id
      metafield(namespace: "boostify", key: "sticky_atc") { value }
    }
  }`;

const MUTATION = `#graphql
  mutation BoostifyStickySave($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }`;

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const res = await admin.graphql(QUERY);
  const json = await res.json();
  let config = { ...STICKY_DEFAULTS };
  try {
    const raw = json.data?.currentAppInstallation?.metafield?.value;
    if (raw) config = sanitizeSticky(JSON.parse(raw));
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
    config = sanitizeSticky(JSON.parse(String(form.get("config") || "{}")));
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
          key: "sticky_atc",
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

export default function StickyCart() {
  const { config: initial, shop, apiKey } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [cfg, setCfg] = useState(initial);
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

  const set = (patch) => {
    setCfg((c) => ({ ...c, ...patch }));
    setDirty(true);
  };
  const save = () =>
    fetcher.submit({ config: JSON.stringify(cfg) }, { method: "POST" });

  const editor = `https://${shop}/admin/themes/current/editor?context=apps&template=product&activateAppId=${apiKey}/sticky-add-to-cart`;

  return (
    <s-page heading="Sticky Add to Cart">
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
        <StickyPreview cfg={cfg} />
        <div style={{ marginTop: 10 }}>
          <s-text color="subdued">
            On your store this bar slides in on product pages once the visitor
            scrolls past the normal Add to Cart button.
          </s-text>
        </div>
      </s-section>

      <s-section heading="Turn it on">
        <s-stack gap="base">
          <Check
            label="Show the sticky Add to Cart bar on product pages"
            checked={cfg.enabled}
            onValue={(v) => set({ enabled: v })}
          />
          <s-paragraph>
            The bar also needs the Boostify app embed switched on in your theme
            (one time).
          </s-paragraph>
          <div>
            <s-button href={editor} target="_blank">
              Open theme editor
            </s-button>
          </div>
        </s-stack>
      </s-section>

      <s-section heading="What to show">
        <s-stack gap="base">
          <Check
            label="Product image"
            checked={cfg.showImage}
            onValue={(v) => set({ showImage: v })}
          />
          <Check
            label="Product title"
            checked={cfg.showTitle}
            onValue={(v) => set({ showTitle: v })}
          />
          <Check
            label="Price"
            checked={cfg.showPrice}
            onValue={(v) => set({ showPrice: v })}
          />
          <Check
            label="Original price (crossed out, when on sale)"
            checked={cfg.showCompare}
            onValue={(v) => set({ showCompare: v })}
          />
          <Check
            label="Quantity selector"
            checked={cfg.showQuantity}
            onValue={(v) => set({ showQuantity: v })}
          />
        </s-stack>
      </s-section>

      <s-section heading="Button">
        <s-stack gap="base">
          <Text
            label="Button text"
            value={cfg.buttonText}
            onValue={(v) => set({ buttonText: v })}
          />
          <Text
            label="Sold-out text"
            value={cfg.soldOutText}
            onValue={(v) => set({ soldOutText: v })}
          />
          <Text
            label="“Added” text"
            value={cfg.addedText}
            onValue={(v) => set({ addedText: v })}
          />
          <Select
            label="After the customer adds to cart"
            value={cfg.afterAdd}
            onValue={(v) => set({ afterAdd: v })}
            options={[
              ["stay", "Stay on the page and show “Added”"],
              ["cart", "Go to the cart page"],
              ["checkout", "Go straight to checkout"],
            ]}
          />
          <Color
            label="Button color"
            value={cfg.btnBg}
            onValue={(v) => set({ btnBg: v })}
          />
          <Color
            label="Button text color"
            value={cfg.btnText}
            onValue={(v) => set({ btnText: v })}
          />
          <Select
            label="Button corners"
            value={cfg.btnRadius}
            onValue={(v) => set({ btnRadius: Number(v) })}
            options={[
              [0, "Square"],
              [6, "Slightly rounded"],
              [10, "Rounded"],
              [999, "Pill"],
            ]}
          />
        </s-stack>
      </s-section>

      <s-section heading="Look">
        <s-stack gap="base">
          <Color
            label="Bar background"
            value={cfg.bg}
            onValue={(v) => set({ bg: v })}
          />
          <Color
            label="Text color"
            value={cfg.textColor}
            onValue={(v) => set({ textColor: v })}
          />
          <Color
            label="Price color"
            value={cfg.priceColor}
            onValue={(v) => set({ priceColor: v })}
          />
          <Color
            label="Original price color"
            value={cfg.compareColor}
            onValue={(v) => set({ compareColor: v })}
          />
          <Select
            label="Corners"
            value={cfg.radius}
            onValue={(v) => set({ radius: Number(v) })}
            options={[
              [0, "Square"],
              [8, "Slightly rounded"],
              [12, "Rounded"],
              [24, "Very rounded"],
            ]}
          />
          <Select
            label="Space around the bar"
            value={cfg.inset}
            onValue={(v) => set({ inset: Number(v) })}
            options={[
              [0, "None (edge to edge)"],
              [8, "Small"],
              [12, "Medium"],
              [20, "Large"],
            ]}
          />
          <Check
            label="Limit the width on large screens"
            checked={cfg.boxed}
            onValue={(v) => set({ boxed: v })}
          />
          <Check
            label="Drop shadow"
            checked={cfg.shadow}
            onValue={(v) => set({ shadow: v })}
          />
          <Check
            label="Thin outline"
            checked={cfg.border}
            onValue={(v) => set({ border: v })}
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
            options={[13, 14, 15, 16, 17, 18].map((n) => [n, `${n}px`])}
          />
        </s-stack>
      </s-section>

      <s-section heading="Position and devices">
        <s-stack gap="base">
          <Select
            label="Position"
            value={cfg.position}
            onValue={(v) => set({ position: v })}
            options={[
              ["bottom", "Bottom of the screen"],
              ["top", "Top of the screen"],
            ]}
          />
          <Select
            label="Show on"
            value={cfg.devices}
            onValue={(v) => set({ devices: v })}
            options={[
              ["both", "Phones and computers"],
              ["mobile", "Phones only"],
              ["desktop", "Computers only"],
            ]}
          />
          <Select
            label="When to show"
            value={cfg.appear}
            onValue={(v) => set({ appear: v })}
            options={[
              [
                "scroll",
                "After the normal Add to Cart button scrolls out of view",
              ],
              ["always", "Always visible"],
            ]}
          />
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
