import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  BUNDLE_DEFAULTS,
  MAX_BUNDLES,
  MAX_BUNDLE_PRODUCTS,
  discountMetafields,
  newBundle,
  sanitizeBundles,
  storedBundles,
} from "../bundles";
import { BundlePreview } from "../components/BundlePreview";
import { Check, Color, Num, Select, Text } from "../components/controls";

const QUERY = `#graphql
  query BoostifyBundlesConfig {
    currentAppInstallation {
      id
      metafield(namespace: "boostify", key: "bundles") { value }
      discount: metafield(namespace: "boostify", key: "bundles_discount") { value }
    }
  }`;

const DISCOUNT_STATUS = `#graphql
  query BoostifyBundleDiscount($id: ID!) {
    discountNode(id: $id) {
      id
      discount {
        ... on DiscountAutomaticApp { status }
      }
    }
  }`;

const SET_METAFIELDS = `#graphql
  mutation BoostifyBundlesSave($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }`;

const CREATE_DISCOUNT = `#graphql
  mutation BoostifyBundleDiscountCreate($discount: DiscountAutomaticAppInput!) {
    discountAutomaticAppCreate(automaticAppDiscount: $discount) {
      automaticAppDiscount { discountId }
      userErrors { field message }
    }
  }`;

// The checkout discount is one automatic app discount (extensions/bundle-discount) whose
// $app:bundles metafield holds every bundle. Its id is kept in boostify.bundles_discount.
async function discountStatus(admin, id) {
  if (!id) return null;
  const res = await admin.graphql(DISCOUNT_STATUS, { variables: { id } });
  return (await res.json()).data?.discountNode?.discount?.status || null;
}

const PRODUCTS = `#graphql
  query BoostifyBundleProducts($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product { id handle title featuredMedia { preview { image { url } } } }
    }
  }`;

// Saved bundles only keep each product's id and handle (see storedBundles), so look the titles
// and pictures up for the dashboard. Deleted products drop out; renamed handles are picked up.
async function withProductDetails(admin, cfg) {
  const ids = [...new Set(cfg.bundles.flatMap((b) => b.products.map((p) => `gid://shopify/Product/${p.id}`)))];
  const found = new Map();
  for (let n = 0; n < ids.length; n += 250) {
    const res = await admin.graphql(PRODUCTS, { variables: { ids: ids.slice(n, n + 250) } });
    for (const node of (await res.json()).data?.nodes || []) {
      if (node?.id) found.set(node.id, node);
    }
  }
  return {
    ...cfg,
    bundles: cfg.bundles.map((b) => ({
      ...b,
      products: b.products
        .filter((p) => found.has(p.gid))
        .map((p) => {
          const node = found.get(p.gid);
          return {
            ...p,
            handle: node.handle,
            title: node.title,
            image: node.featuredMedia?.preview?.image?.url || "",
          };
        }),
    })),
  };
}

async function syncDiscount(admin, ownerId, storedId, cfg) {
  const { values, any, error } = discountMetafields(cfg);
  if (error) return error;
  const fields = values.map((v) => ({ namespace: "$app", type: "json", ...v }));

  if (storedId && (await discountStatus(admin, storedId))) {
    const res = await admin.graphql(SET_METAFIELDS, {
      variables: { metafields: fields.map((f) => ({ ownerId: storedId, ...f })) },
    });
    const errors = (await res.json()).data?.metafieldsSet?.userErrors || [];
    return errors.length ? errors[0].message : null;
  }

  // No discount yet (or the merchant deleted it): only create one once there's something to discount
  if (!any) return null;
  const res = await admin.graphql(CREATE_DISCOUNT, {
    variables: {
      discount: {
        title: "Boostify bundles",
        functionHandle: "bundle-discount",
        discountClasses: ["PRODUCT"],
        startsAt: new Date().toISOString(),
        combinesWith: {
          orderDiscounts: true,
          productDiscounts: false,
          shippingDiscounts: true,
        },
        metafields: fields,
      },
    },
  });
  const json = await res.json();
  const out = json.data?.discountAutomaticAppCreate;
  const err = out?.userErrors?.[0]?.message || json.errors?.[0]?.message;
  if (err || !out?.automaticAppDiscount) return err || "Could not create the discount";

  await admin.graphql(SET_METAFIELDS, {
    variables: {
      metafields: [
        {
          ownerId,
          namespace: "boostify",
          key: "bundles_discount",
          type: "single_line_text_field",
          value: out.automaticAppDiscount.discountId,
        },
      ],
    },
  });
  return null;
}

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const res = await admin.graphql(QUERY);
  const inst = (await res.json()).data?.currentAppInstallation;
  let config = sanitizeBundles(BUNDLE_DEFAULTS);
  try {
    if (inst?.metafield?.value) config = sanitizeBundles(JSON.parse(inst.metafield.value));
  } catch {
    // Corrupt value: fall back to defaults rather than crash the page.
  }
  try {
    config = await withProductDetails(admin, config);
  } catch {
    // Product lookup failed: the bundles still show, with handles as names.
  }
  let status = null;
  try {
    status = await discountStatus(admin, inst?.discount?.value);
  } catch {
    // Missing write_discounts scope or the discount is gone: shown as "not set up" below.
  }
  return {
    config,
    discountStatus: status,
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
    config = sanitizeBundles(JSON.parse(String(form.get("config") || "{}")));
  } catch {
    return { ok: false, error: "Invalid data" };
  }

  const idRes = await admin.graphql(QUERY);
  const inst = (await idRes.json()).data.currentAppInstallation;

  const res = await admin.graphql(SET_METAFIELDS, {
    variables: {
      metafields: [
        {
          ownerId: inst.id,
          namespace: "boostify",
          key: "bundles",
          type: "json",
          value: JSON.stringify(storedBundles(config)),
        },
      ],
    },
  });
  const errors = (await res.json()).data?.metafieldsSet?.userErrors || [];
  if (errors.length) return { ok: false, error: errors[0].message };

  // The storefront box is saved either way; a discount problem is reported separately
  let discountError = null;
  try {
    discountError = await syncDiscount(admin, inst.id, inst.discount?.value, config);
  } catch (e) {
    discountError = e?.message || "Could not update the discount";
  }
  return { ok: true, config, discountError };
};

export default function Bundles() {
  const { config: initial, discountStatus: status, shop, apiKey } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [cfg, setCfg] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [previewId, setPreviewId] = useState(initial.bundles[0]?.id || null);
  const saving = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.ok) {
      if (fetcher.data.discountError) {
        shopify.toast.show(
          `Saved, but the discount wasn't updated: ${fetcher.data.discountError}`,
          { isError: true, duration: 8000 },
        );
      } else {
        shopify.toast.show("Saved");
      }
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
  const setBundle = (id, patch) => {
    setCfg((c) => ({
      ...c,
      bundles: c.bundles.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
    setDirty(true);
  };
  const addBundle = () => {
    const b = newBundle(cfg.bundles.length);
    set({ bundles: [...cfg.bundles, b] });
    setPreviewId(b.id);
  };
  const removeBundle = (id) =>
    set({ bundles: cfg.bundles.filter((b) => b.id !== id) });

  const pickProducts = async (b) => {
    const picked = await shopify.resourcePicker({
      type: "product",
      multiple: MAX_BUNDLE_PRODUCTS,
      action: "select",
      filter: { variants: false, draft: false, archived: false },
      selectionIds: b.products.map((p) => ({ id: p.gid })),
    });
    if (!picked) return;
    setBundle(b.id, {
      products: picked.slice(0, MAX_BUNDLE_PRODUCTS).map((p) => ({
        gid: p.id,
        id: Number(String(p.id).split("/").pop()),
        handle: p.handle,
        title: p.title,
        image: p.images?.[0]?.originalSrc || p.images?.[0]?.url || "",
      })),
    });
    setPreviewId(b.id);
  };

  const save = () =>
    fetcher.submit({ config: JSON.stringify(cfg) }, { method: "POST" });

  const previewBundle =
    cfg.bundles.find((b) => b.id === previewId) || cfg.bundles[0] || null;
  const editor = `https://${shop}/admin/themes/current/editor?context=apps&template=product&activateAppId=${apiKey}/product-bundle`;
  const discounted =
    (cfg.smartEnabled && cfg.smartPercent > 0) ||
    cfg.bundles.some((b) => b.enabled && b.percent > 0 && b.products.length >= 2);
  const showSmart = previewId === "smart";

  return (
    <s-page heading="Product Bundles">
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
        <BundlePreview
          cfg={cfg}
          bundle={showSmart ? null : previewBundle}
          smart={showSmart}
        />
        <div style={{ marginTop: 10 }}>
          <s-text color="subdued">
            On your store the box shows on the product page of every product in
            a bundle, with that product listed first. Prices here are samples.
          </s-text>
        </div>
      </s-section>

      <s-section heading="Turn it on">
        <s-stack gap="base">
          <Check
            label="Show bundles on product pages"
            checked={cfg.enabled}
            onValue={(v) => set({ enabled: v })}
          />
          <s-paragraph>
            The box also needs the Boostify Bundles app embed switched on in
            your theme (one time). To put it somewhere else on the page, add
            the Boostify Bundle block to your product template instead.
          </s-paragraph>
          <div>
            <s-button href={editor} target="_blank">
              Open theme editor
            </s-button>
          </div>
          {discounted ? (
            status === "ACTIVE" ? (
              <s-banner tone="success">
                The bundle discount is live: it comes off automatically in the
                cart and at checkout when every product of a bundle is in the
                cart.
              </s-banner>
            ) : status ? (
              <s-banner tone="warning">
                {`The "Boostify bundles" discount is ${status.toLowerCase()}. Turn it on in Discounts so customers get the bundle price.`}
              </s-banner>
            ) : (
              <s-banner tone="info">
                The bundle discount is created in your Discounts when you save.
              </s-banner>
            )
          ) : null}
        </s-stack>
      </s-section>

      <s-section heading="Smart bundles">
        <s-stack gap="base">
          <Check
            label="Make bundles automatically"
            details="Every product page without one of your own bundles gets a bundle of that product and 2 products Shopify recommends with it."
            checked={cfg.smartEnabled}
            onValue={(v) => {
              set({ smartEnabled: v });
              if (v) setPreviewId("smart");
            }}
          />
          {cfg.smartEnabled ? (
            <>
              <Num
                label="Smart bundle discount (%)"
                details="0 = no discount, just sold together"
                min={0}
                max={90}
                step={1}
                value={cfg.smartPercent}
                onValue={(v) =>
                  set({
                    smartPercent: Math.max(0, Math.min(90, Math.round(Number(v) || 0))),
                  })
                }
              />
              <Select
                label="Minimum products in a smart bundle"
                details="The smart discount only applies from this many products."
                value={cfg.smartMin}
                onValue={(v) => set({ smartMin: Number(v) })}
                options={[2, 3, 4, 5].map((n) => [n, `${n} products`])}
              />
              <Check
                label="Let customers build their own bundle"
                details="Customers can remove products and add others from a row of suggestions (up to 6 products). The bundle can only be added once it has the minimum."
                checked={cfg.smartBuilder}
                onValue={(v) => {
                  set({ smartBuilder: v });
                  setPreviewId("smart");
                }}
              />
              {cfg.smartBuilder ? (
                <>
                  <Text
                    label="Suggestions heading"
                    value={cfg.moreHeading}
                    onValue={(v) => set({ moreHeading: v })}
                  />
                  <Text
                    label="Message while the bundle is too small"
                    details="{count} = products still needed, {percent} = the discount, {min} = the minimum"
                    value={cfg.builderHint}
                    onValue={(v) => set({ builderHint: v })}
                  />
                </>
              ) : null}
              <s-stack direction="inline" gap="small">
                <s-button onClick={() => setPreviewId("smart")}>Preview</s-button>
              </s-stack>
              <s-text color="subdued">
                Recommendations come from Shopify (products often bought or viewed
                together). Your own bundles below always come first.
              </s-text>
            </>
          ) : null}
        </s-stack>
      </s-section>

      <s-section heading={`Your bundles (${cfg.bundles.length})`}>
        <s-stack gap="base">
          {cfg.bundles.length === 0 ? (
            <s-paragraph>
              No bundles yet. A bundle is 2 to {MAX_BUNDLE_PRODUCTS} products
              sold together, with an optional discount.
            </s-paragraph>
          ) : null}
          {cfg.bundles.map((b, n) => (
            <div
              key={b.id}
              style={{
                border: "1px solid #e1e3e5",
                borderRadius: 8,
                padding: 12,
                outline:
                  !showSmart && previewBundle?.id === b.id ? "2px solid #005bd3" : "none",
              }}
            >
              <s-stack gap="base">
                <s-stack direction="inline" gap="small" align-items="center">
                  <s-text type="strong">{`Bundle #${n + 1}`}</s-text>
                  <s-badge tone={b.enabled ? "success" : "neutral"}>
                    {b.enabled ? "On" : "Off"}
                  </s-badge>
                  {b.products.length < 2 ? (
                    <s-badge tone="critical">Pick at least 2 products</s-badge>
                  ) : null}
                </s-stack>

                {b.products.length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {b.products.map((p) => (
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
                            setBundle(b.id, {
                              products: b.products.filter((x) => x.gid !== p.gid),
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
                  <s-button onClick={() => pickProducts(b)}>
                    {b.products.length ? "Change products" : "Choose products"}
                  </s-button>
                </div>

                <Text
                  label="Name (shown as the discount name at checkout)"
                  placeholder="Bundle discount"
                  value={b.title}
                  onValue={(v) => setBundle(b.id, { title: v })}
                />
                <Num
                  label="Bundle discount (%)"
                  details="0 = no discount, just sold together"
                  min={0}
                  max={90}
                  step={1}
                  value={b.percent}
                  onValue={(v) =>
                    setBundle(b.id, {
                      percent: Math.max(0, Math.min(90, Math.round(Number(v) || 0))),
                    })
                  }
                />
                <Check
                  label="Show this bundle"
                  checked={b.enabled}
                  onValue={(v) => setBundle(b.id, { enabled: v })}
                />
                <s-stack direction="inline" gap="small">
                  <s-button onClick={() => setPreviewId(b.id)}>Preview</s-button>
                  <s-button tone="critical" onClick={() => removeBundle(b.id)}>
                    Delete bundle
                  </s-button>
                </s-stack>
              </s-stack>
            </div>
          ))}
          {cfg.bundles.length < MAX_BUNDLES ? (
            <div>
              <s-button onClick={addBundle}>Add bundle</s-button>
            </div>
          ) : (
            <s-banner tone="info">
              {`You've reached ${MAX_BUNDLES} bundles, the most Shopify's discount data can hold. Delete a bundle to add another, or turn on smart bundles to cover the rest of your products.`}
            </s-banner>
          )}
          <s-text color="subdued">
            A product page shows the first bundle (top of this list) that
            contains its product.
          </s-text>
        </s-stack>
      </s-section>

      <s-section heading="Text">
        <s-stack gap="base">
          <Text
            label="Heading"
            value={cfg.heading}
            onValue={(v) => set({ heading: v })}
          />
          <Text
            label="Total label"
            value={cfg.totalLabel}
            onValue={(v) => set({ totalLabel: v })}
          />
          <Text
            label="Savings badge"
            details="{amount} = money saved, {percent} = the bundle discount. Leave empty to hide."
            value={cfg.savingsText}
            onValue={(v) => set({ savingsText: v })}
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
          <Text
            label="Sold-out text"
            value={cfg.soldOutText}
            onValue={(v) => set({ soldOutText: v })}
          />
          <Select
            label="After the customer adds the bundle"
            value={cfg.afterAdd}
            onValue={(v) => set({ afterAdd: v })}
            options={[
              ["drawer", "Open the cart drawer (cart page if the theme has none)"],
              ["cart", "Go to the cart page"],
              ["checkout", "Go straight to checkout"],
              ["stay", "Stay on the page and show “Added”"],
            ]}
          />
        </s-stack>
      </s-section>

      <s-section heading="Look">
        <s-stack gap="base">
          <Check
            label="Original prices (crossed out)"
            checked={cfg.showCompare}
            onValue={(v) => set({ showCompare: v })}
          />
          <Check
            label="Tick boxes, so customers can leave products out"
            details="The bundle discount only applies when every product is ticked (smart bundles: at least 2)."
            checked={cfg.checkboxes}
            onValue={(v) => set({ checkboxes: v })}
          />
          <Check
            label="“+” between products"
            checked={cfg.showPlus}
            onValue={(v) => set({ showPlus: v })}
          />
          <Check
            label="Thin outline"
            checked={cfg.border}
            onValue={(v) => set({ border: v })}
          />
          <Color label="Background" value={cfg.bg} onValue={(v) => set({ bg: v })} />
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
            label="Savings badge color"
            value={cfg.badgeBg}
            onValue={(v) => set({ badgeBg: v })}
          />
          <Color
            label="Savings badge text color"
            value={cfg.badgeText}
            onValue={(v) => set({ badgeText: v })}
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
            options={[12, 13, 14, 15, 16, 17, 18].map((n) => [n, `${n}px`])}
          />
          <Select
            label="Position on the product page"
            value={cfg.position}
            onValue={(v) => set({ position: v })}
            options={[
              ["after_form", "Below the Add to Cart button"],
              ["before_form", "Above the Add to Cart button"],
            ]}
          />
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
