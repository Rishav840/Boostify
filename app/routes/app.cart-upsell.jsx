import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  MAX_UPSELL_PRODUCTS,
  UPSELL_DEFAULTS,
  sanitizeCartUpsell,
} from "../cartupsell";
import { CartUpsellPreview } from "../components/CartUpsellPreview";
import { Check, Color, Select, Text } from "../components/controls";

const QUERY = `#graphql
  query BoostifyCartUpsellConfig {
    currentAppInstallation {
      id
      metafield(namespace: "boostify", key: "cart_upsell") { value }
    }
  }`;

const MUTATION = `#graphql
  mutation BoostifyCartUpsellSave($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }`;

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const res = await admin.graphql(QUERY);
  const json = await res.json();
  let config = sanitizeCartUpsell(UPSELL_DEFAULTS);
  try {
    const raw = json.data?.currentAppInstallation?.metafield?.value;
    if (raw) config = sanitizeCartUpsell(JSON.parse(raw));
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
    config = sanitizeCartUpsell(JSON.parse(String(form.get("config") || "{}")));
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
          key: "cart_upsell",
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

export default function CartUpsell() {
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

  const pickProducts = async () => {
    const picked = await shopify.resourcePicker({
      type: "product",
      multiple: MAX_UPSELL_PRODUCTS,
      action: "select",
      filter: { variants: false, draft: false, archived: false },
      selectionIds: cfg.products.map((p) => ({ id: p.gid })),
    });
    if (!picked) return;
    set({
      products: picked.slice(0, MAX_UPSELL_PRODUCTS).map((p) => ({
        gid: p.id,
        id: Number(String(p.id).split("/").pop()),
        handle: p.handle,
        title: p.title,
        image: p.images?.[0]?.originalSrc || p.images?.[0]?.url || "",
      })),
    });
  };

  const editor = `https://${shop}/admin/themes/current/editor?context=apps&template=cart&activateAppId=${apiKey}/cart-upsell`;
  const manualEmpty = cfg.source === "manual" && !cfg.products.length;

  return (
    <s-page heading="Cart Recommendations">
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
        <CartUpsellPreview cfg={cfg} />
        <div style={{ marginTop: 10 }}>
          <s-text color="subdued">
            On your store this shows under the items in the cart drawer and on
            the cart page while the cart has something in it. Prices here are
            samples.
          </s-text>
        </div>
      </s-section>

      <s-section heading="Turn it on">
        <s-stack gap="base">
          <Check
            label="Show product recommendations in the cart"
            checked={cfg.enabled}
            onValue={(v) => set({ enabled: v })}
          />
          <s-paragraph>
            It also needs the Boostify Cart Upsell app embed switched
            on in your theme (one time). To put it somewhere else on the cart
            page, add the Boostify Recommendations block there.
          </s-paragraph>
          <div>
            <s-button href={editor} target="_blank">
              Open theme editor
            </s-button>
          </div>
        </s-stack>
      </s-section>

      <s-section heading="Which products">
        <s-stack gap="base">
          <Select
            label="Recommend"
            value={cfg.source}
            onValue={(v) => set({ source: v })}
            options={[
              [
                "auto",
                "Smart: products that go with what's in the cart, then my picks",
              ],
              ["manual", "Only the products I pick"],
            ]}
          />
          {cfg.source === "auto" ? (
            <s-text color="subdued">
              Uses Shopify&apos;s product recommendations. To choose exactly which
              products go with which, set up complementary products in the
              Search & Discovery app.
            </s-text>
          ) : null}
          {manualEmpty ? (
            <s-banner tone="warning">
              Pick at least one product, or nothing will show.
            </s-banner>
          ) : null}

          {cfg.products.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {cfg.products.map((p) => (
                <div
                  key={p.gid}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  {p.image ? (
                    <img
                      src={p.image}
                      alt=""
                      width={40}
                      height={40}
                      style={{ objectFit: "cover", borderRadius: 6 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 6,
                        background: "#f1f2f4",
                      }}
                    />
                  )}
                  <span style={{ flex: 1 }}>{p.title}</span>
                  <s-button
                    variant="tertiary"
                    onClick={() =>
                      set({
                        products: cfg.products.filter((x) => x.gid !== p.gid),
                      })
                    }
                  >
                    Remove
                  </s-button>
                </div>
              ))}
            </div>
          ) : null}
          <div>
            <s-button onClick={pickProducts}>
              {cfg.products.length ? "Change my picks" : "Pick products"}
            </s-button>
          </div>

          <Select
            label="How many to show"
            value={cfg.maxItems}
            onValue={(v) => set({ maxItems: Number(v) })}
            options={[1, 2, 3, 4, 5, 6, 8].map((n) => [n, String(n)])}
          />
          <Check
            label="Don't recommend products already in the cart"
            checked={cfg.hideInCart}
            onValue={(v) => set({ hideInCart: v })}
          />
        </s-stack>
      </s-section>

      <s-section heading="Where it shows">
        <s-stack gap="base">
          <Check
            label="Cart drawer"
            checked={cfg.showDrawer}
            onValue={(v) => set({ showDrawer: v })}
          />
          <Check
            label="Cart page"
            checked={cfg.showCartPage}
            onValue={(v) => set({ showCartPage: v })}
          />
        </s-stack>
      </s-section>

      <s-section heading="Text">
        <s-stack gap="base">
          <Text
            label="Promo line (optional)"
            placeholder="Glow like a baby! Anti-aging serum at Rs. 299"
            value={cfg.promoText}
            onValue={(v) => set({ promoText: v })}
          />
          <Text
            label="Heading"
            value={cfg.heading}
            onValue={(v) => set({ heading: v })}
          />
          <Text
            label="Button text"
            value={cfg.buttonText}
            onValue={(v) => set({ buttonText: v })}
          />
          <Text
            label="“Added” text"
            value={cfg.addedText}
            onValue={(v) => set({ addedText: v })}
          />
          <Check
            label="Sale badge on products that are on sale"
            checked={cfg.showBadge}
            onValue={(v) => set({ showBadge: v })}
          />
          {cfg.showBadge ? (
            <Text
              label="Sale badge text"
              details="{percent} = how much the product is reduced"
              value={cfg.badgeText}
              onValue={(v) => set({ badgeText: v })}
            />
          ) : null}
          <Check
            label="Original price (crossed out, when on sale)"
            checked={cfg.showCompare}
            onValue={(v) => set({ showCompare: v })}
          />
        </s-stack>
      </s-section>

      <s-section heading="Look">
        <s-stack gap="base">
          <Select
            label="Layout"
            value={cfg.layout}
            onValue={(v) => set({ layout: v })}
            options={[
              ["scroll", "One row, swipe sideways"],
              ["grid", "Grid"],
            ]}
          />
          <Color label="Background" value={cfg.bg} onValue={(v) => set({ bg: v })} />
          <Color
            label="Card background"
            value={cfg.cardBg}
            onValue={(v) => set({ cardBg: v })}
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
          <Color
            label="Sale badge color"
            value={cfg.badgeBg}
            onValue={(v) => set({ badgeBg: v })}
          />
          <Color
            label="Sale badge text color"
            value={cfg.badgeTextColor}
            onValue={(v) => set({ badgeTextColor: v })}
          />
          <Color
            label="Promo line background"
            value={cfg.promoBg}
            onValue={(v) => set({ promoBg: v })}
          />
          <Color
            label="Promo line text color"
            value={cfg.promoTextColor}
            onValue={(v) => set({ promoTextColor: v })}
          />
          <Select
            label="Corners"
            value={cfg.radius}
            onValue={(v) => set({ radius: Number(v) })}
            options={[
              [0, "Square"],
              [6, "Slightly rounded"],
              [12, "Rounded"],
              [20, "Very rounded"],
            ]}
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
            options={[11, 12, 13, 14, 15, 16].map((n) => [n, `${n}px`])}
          />
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
