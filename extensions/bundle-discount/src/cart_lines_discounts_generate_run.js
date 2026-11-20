// Bundle discount, written by the app (app/routes/app.bundles.jsx) to this discount's metafields:
//
// - $app:bundles, bundles_2, bundles_3, bundles_4: the merchant's own bundles, split over several
//   metafields because a function only receives metafield values up to 10 KB each. Each bundle is
//   [percent, title, [productId, ...]]. When every product of a bundle is in the cart, its
//   percentage comes off one of each; two of everything gets it twice, and so on.
// - $app:smart: { p: percent, t: title, m: minimum products } for smart bundles. The storefront adds
//   a smart bundle's products with the line property _boostify_bundle = "smart:<random id>"; lines
//   sharing that value (at least m different products, never fewer than 2) get the smart
//   percentage, one of each per complete set.
//
// Own bundles go first; a unit of a product is never discounted twice.

/**
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

const PRODUCT_GID = "gid://shopify/Product/";

// Both the current compact form and the first version's [{ title, percent, products: [gid] }]
function readBundles(discount) {
  const out = [];
  for (const field of [discount.bundles, discount.bundles2, discount.bundles3, discount.bundles4]) {
    const list = field?.jsonValue;
    if (!Array.isArray(list)) continue;
    for (const b of list) {
      if (Array.isArray(b)) {
        const ids = Array.isArray(b[2]) ? b[2] : [];
        out.push({
          percent: Number(b[0]),
          title: b[1],
          products: ids.map((id) => PRODUCT_GID + id),
        });
      } else if (b && typeof b === "object") {
        out.push({
          percent: Number(b.percent),
          title: b.title,
          products: Array.isArray(b.products) ? b.products.map(String) : [],
        });
      }
    }
  }
  return out;
}

/**
 * @param {RunInput} input
 * @returns {CartLinesDiscountsGenerateRunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  if (!input.discount.discountClasses.includes("PRODUCT") || !input.cart.lines.length) {
    return { operations: [] };
  }
  const bundles = readBundles(input.discount);
  const smart = input.discount.smart?.jsonValue;
  const smartPercent = Number(smart?.p);
  const smartMin = Math.max(2, Math.round(Number(smart?.m)) || 2);

  // Units of each cart line not yet used by an earlier bundle
  const left = new Map();
  const linesByProduct = new Map();
  const smartGroups = new Map();
  for (const line of input.cart.lines) {
    const productId = line.merchandise?.product?.id;
    if (!productId) continue;
    left.set(line.id, line.quantity);
    if (!linesByProduct.has(productId)) linesByProduct.set(productId, []);
    linesByProduct.get(productId).push(line);
    const tag = line.bundle?.value;
    if (typeof tag === "string" && tag.indexOf("smart:") === 0) {
      if (!smartGroups.has(tag)) smartGroups.set(tag, new Map());
      const group = smartGroups.get(tag);
      if (!group.has(productId)) group.set(productId, []);
      group.get(productId).push(line);
    }
  }

  // Take `sets` units of every product from these lines; returns the discount targets
  const take = (productIds, linesOf, sets) => {
    const targets = [];
    for (const productId of productIds) {
      let need = sets;
      for (const line of linesOf(productId)) {
        const n = Math.min(need, left.get(line.id));
        if (n <= 0) continue;
        left.set(line.id, left.get(line.id) - n);
        targets.push({ cartLine: { id: line.id, quantity: n } });
        need -= n;
        if (!need) break;
      }
    }
    return targets;
  };
  const unitsIn = (lines) => lines.reduce((sum, line) => sum + left.get(line.id), 0);

  const candidates = [];
  const add = (title, percent, targets) =>
    candidates.push({
      message: title ? String(title).slice(0, 60) : "Bundle discount",
      targets,
      value: { percentage: { value: Math.min(100, percent) } },
    });

  for (const bundle of bundles) {
    const products = [...new Set(bundle.products)];
    if (!(bundle.percent > 0) || products.length < 2) continue;
    const sets = Math.min(...products.map((id) => unitsIn(linesByProduct.get(id) || [])));
    if (!(sets > 0)) continue;
    add(bundle.title, bundle.percent, take(products, (id) => linesByProduct.get(id), sets));
  }

  if (smartPercent > 0) {
    for (const group of smartGroups.values()) {
      const products = [...group.keys()];
      if (products.length < smartMin) continue;
      const sets = Math.min(...products.map((id) => unitsIn(group.get(id))));
      if (!(sets > 0)) continue;
      add(smart.t, smartPercent, take(products, (id) => group.get(id), sets));
    }
  }

  if (!candidates.length) return { operations: [] };
  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates,
          selectionStrategy: "ALL",
        },
      },
    ],
  };
}
