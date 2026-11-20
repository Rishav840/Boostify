// The storefront CSS lives in the theme extension. The admin previews need the same files,
// but Shopify's dev proxy reserves /extensions/* URLs, so they can't be imported from there.
// Copy them into app/ (run automatically before dev and build).
import { copyFileSync } from "node:fs";

const files = [
  ["announcement-bar.css", "announcement-bar.generated.css"],
  ["sticky-cart.css", "sticky-cart.generated.css"],
  ["cart-progress.css", "cart-progress.generated.css"],
  ["countdown.css", "countdown.generated.css"],
  ["bundle.css", "bundle.generated.css"],
  ["cart-upsell.css", "cart-upsell.generated.css"],
];
for (const [from, to] of files) {
  copyFileSync(`extensions/boostify-theme/assets/${from}`, `app/${to}`);
  console.log(`Synced ${from} -> app/${to}`);
}
