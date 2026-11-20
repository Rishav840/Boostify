(function () {
  // The script tag can appear twice (app embed + section block); only run once per page.
  if (window.__boostifyUP) { window.__boostifyUP(); return; }

  var ROOT = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  var HEX = /^#[0-9a-f]{3,8}$/i;
  var FONTS = {
    inherit: 'inherit',
    serif: 'Georgia, "Times New Roman", serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  };

  function hex(v, d) { return typeof v === 'string' && HEX.test(v) ? v : d; }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ---------- config ----------
  var cfg = null, moneyFormat = '{{amount}}', shopperCurrency = null;
  function readConfig() {
    var node = document.querySelector('script[data-boostify-up]');
    if (!node) return false;
    try { cfg = JSON.parse(node.textContent); } catch (e) { cfg = null; }
    if (!cfg || !cfg.enabled) { cfg = null; return false; }
    moneyFormat = node.getAttribute('data-money-format') || '{{amount}}';
    var active = window.Shopify && window.Shopify.currency && window.Shopify.currency.active;
    var own = node.getAttribute('data-shop-currency');
    shopperCurrency = active && own && active !== own ? active : null;
    return true;
  }

  // ---------- money (same as cart-progress.js) ----------
  function formatMoney(cents) {
    if (shopperCurrency) {
      try {
        return new Intl.NumberFormat(document.documentElement.lang || undefined, { style: 'currency', currency: shopperCurrency }).format(cents / 100);
      } catch (e) { /* unknown currency code: fall back to the store format */ }
    }
    function n(c, decimals, thousands, decimal) {
      var v = (c / 100).toFixed(decimals).split('.');
      var w = v[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
      return v[1] ? w + decimal + v[1] : w;
    }
    return moneyFormat.replace(/\{\{\s*(\w+)\s*\}\}/, function (_, name) {
      switch (name) {
        case 'amount_no_decimals': return n(Math.round(cents / 100) * 100, 0, ',', '.');
        case 'amount_with_comma_separator': return n(cents, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator': return n(Math.round(cents / 100) * 100, 0, '.', ',');
        case 'amount_with_apostrophe_separator': return n(cents, 2, "'", '.');
        default: return n(cents, 2, ',', '.');
      }
    });
  }

  function imageUrl(src, width) {
    if (!src || typeof src !== 'string') return '';
    var u = src.indexOf('//') === 0 ? 'https:' + src : src;
    if (!/^https:\/\//i.test(u)) return '';
    return u + (u.indexOf('?') === -1 ? '?' : '&') + 'width=' + width;
  }

  // ---------- products ----------
  // Storefront JSON (recommendations and /products/<handle>.js) is already in the shopper's
  // currency, in cents. Each lookup is fetched once per page.
  var cache = {};
  function getJson(url) {
    if (!cache[url]) {
      cache[url] = fetch(url, { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }
    return cache[url];
  }

  function recommendationsFor(productId, limit) {
    var base = ROOT + 'recommendations/products.json?limit=' + limit + '&product_id=' + productId;
    // "Complementary" products are set up by the merchant in Search & Discovery; most stores
    // only have Shopify's automatic "related" ones
    return getJson(base + '&intent=complementary').then(function (d) {
      if (d && d.products && d.products.length) return d.products;
      return getJson(base + '&intent=related').then(function (r) { return (r && r.products) || []; });
    });
  }

  function pickedProducts() {
    return Promise.all((cfg.products || []).map(function (p) {
      return getJson(ROOT + 'products/' + encodeURIComponent(p.handle) + '.js');
    }));
  }

  function firstAvailable(p) {
    var vs = (p && p.variants) || [];
    for (var i = 0; i < vs.length; i++) if (vs[i].available) return vs[i];
    return null;
  }

  function choose(cart) {
    var max = Math.max(1, Math.min(8, num(cfg.maxItems, 4)));
    var inCart = {};
    var cartProducts = [];
    (cart.items || []).forEach(function (it) {
      if (!inCart[it.product_id]) cartProducts.push(it.product_id);
      inCart[it.product_id] = true;
    });

    var sources = [];
    if (cfg.source !== 'manual') {
      // Newest cart items first: they say most about what the customer wants right now
      cartProducts.slice(-3).reverse().forEach(function (id) { sources.push(recommendationsFor(id, max + 4)); });
    }
    sources.push(pickedProducts());

    return Promise.all(sources).then(function (lists) {
      var seen = {}, out = [];
      lists.forEach(function (list) {
        (list || []).forEach(function (p) {
          if (!p || seen[p.id] || out.length >= max) return;
          if (cfg.hideInCart !== false && inCart[p.id]) return;
          var v = firstAvailable(p);
          if (!v) return;
          seen[p.id] = true;
          out.push({ product: p, variant: v });
        });
      });
      return out;
    });
  }

  // ---------- markup ----------
  function percentOff(price, compare) {
    return compare > price ? Math.round((compare - price) / compare * 100) : 0;
  }

  function build(kind) {
    var wrap = el('div', 'boostify-up-wrap boostify-up-wrap--' + kind);
    var root = el('div', 'boostify-up' + (cfg.layout === 'grid' ? ' boostify-up--grid' : ''));
    var s = root.style;
    s.setProperty('--up-bg', hex(cfg.bg, '#f6f6f7'));
    s.setProperty('--up-card', hex(cfg.cardBg, '#ffffff'));
    s.setProperty('--up-text', hex(cfg.textColor, '#111111'));
    s.setProperty('--up-price', hex(cfg.priceColor, '#111111'));
    s.setProperty('--up-compare', hex(cfg.compareColor, '#8a8a8a'));
    s.setProperty('--up-btn-bg', hex(cfg.btnBg, '#ffffff'));
    s.setProperty('--up-btn-text', hex(cfg.btnText, '#111111'));
    s.setProperty('--up-badge-bg', hex(cfg.badgeBg, '#7dd3b0'));
    s.setProperty('--up-badge-text', hex(cfg.badgeTextColor, '#0b3d2a'));
    s.setProperty('--up-promo-bg', hex(cfg.promoBg, '#f1f2f4'));
    s.setProperty('--up-promo-text', hex(cfg.promoTextColor, '#111111'));
    s.setProperty('--up-radius', num(cfg.radius, 12) + 'px');
    s.setProperty('--up-size', num(cfg.fontSize, 13) + 'px');
    s.setProperty('--up-font', FONTS[cfg.fontFamily] || 'inherit');
    root.hidden = true;
    wrap.appendChild(root);
    return { wrap: wrap, root: root, kind: kind, key: '' };
  }

  function card(item, inst) {
    var p = item.product, v = item.variant;
    var price = num(v.price, 0), compare = num(v.compare_at_price, 0);
    var c = el('div', 'boostify-up__card');

    var media = el('a', 'boostify-up__media');
    media.href = p.url || (ROOT + 'products/' + p.handle);
    media.tabIndex = -1;
    media.setAttribute('aria-hidden', 'true');
    var src = imageUrl((v.featured_image && v.featured_image.src) || p.featured_image, 200);
    if (src) {
      var img = el('img', 'boostify-up__img');
      img.src = src;
      img.alt = '';
      img.loading = 'lazy';
      img.width = 72;
      img.height = 72;
      media.appendChild(img);
    }
    var pct = percentOff(price, compare);
    if (cfg.showBadge !== false && pct > 0 && cfg.badgeText) {
      media.appendChild(el('span', 'boostify-up__badge', String(cfg.badgeText).replace(/\{percent\}/g, pct)));
    }
    c.appendChild(media);

    var body = el('div', 'boostify-up__body');
    var title = el('a', 'boostify-up__title', p.title);
    title.href = media.href;
    body.appendChild(title);
    var prices = el('div', 'boostify-up__prices');
    if (cfg.showCompare !== false && compare > price) prices.appendChild(el('s', 'boostify-up__compare', formatMoney(compare)));
    prices.appendChild(el('span', 'boostify-up__price', formatMoney(price)));
    body.appendChild(prices);

    var btn = el('button', 'boostify-up__add', cfg.buttonText || '+Add');
    btn.type = 'button';
    btn.setAttribute('aria-label', (cfg.buttonText || 'Add') + ': ' + p.title);
    btn.addEventListener('click', function () { add(btn, v.id, inst); });
    body.appendChild(btn);
    c.appendChild(body);
    return c;
  }

  function paint(inst) {
    var key = state.items.map(function (i) { return i.variant.id; }).join(',');
    if (key === inst.key && inst.root.childNodes.length) return;
    inst.key = key;
    var root = inst.root;
    root.textContent = '';
    if (!state.items.length || state.count <= 0) { root.hidden = true; return; }
    if (cfg.promoText) root.appendChild(el('p', 'boostify-up__promo', cfg.promoText));
    var list = el('div', 'boostify-up__list');
    state.items.forEach(function (item) { list.appendChild(card(item, inst)); });
    var arrows = cfg.layout === 'grid' ? null : buildArrows(list);
    if (cfg.heading || arrows) {
      var head = el('div', 'boostify-up__head');
      if (cfg.heading) head.appendChild(el('p', 'boostify-up__heading', cfg.heading));
      if (arrows) head.appendChild(arrows);
      root.appendChild(head);
    }
    root.appendChild(list);
    root.hidden = false;
    if (arrows) arrows.update();
  }

  // ---------- arrows: move one card at a time; hidden when everything fits ----------
  var ARROW = {
    prev: 'M10 3 5 8l5 5',
    next: 'M6 3l5 5-5 5'
  };
  function arrowButton(dir, label) {
    var b = el('button', 'boostify-up__arrow boostify-up__arrow--' + dir);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    // Fixed markup, no data in it
    b.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + ARROW[dir] + '"/></svg>';
    return b;
  }

  function buildArrows(list) {
    var box = el('div', 'boostify-up__arrows');
    var prev = arrowButton('prev', 'Previous products');
    var next = arrowButton('next', 'Next products');
    box.appendChild(prev);
    box.appendChild(next);
    function step() {
      var first = list.firstElementChild;
      var gap = parseFloat(getComputedStyle(list).columnGap) || 0;
      return first ? first.getBoundingClientRect().width + gap : list.clientWidth;
    }
    function update() {
      var max = list.scrollWidth - list.clientWidth;
      box.hidden = max <= 2;
      prev.disabled = list.scrollLeft <= 2;
      next.disabled = list.scrollLeft >= max - 2;
    }
    prev.addEventListener('click', function () { list.scrollBy({ left: -step(), behavior: 'smooth' }); });
    next.addEventListener('click', function () { list.scrollBy({ left: step(), behavior: 'smooth' }); });
    list.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(update).observe(list);
    box.update = update;
    return box;
  }

  // ---------- adding ----------
  function themeDrawer() {
    var d = document.querySelector('cart-drawer');
    return d && typeof d.renderContents === 'function' && typeof d.getSectionsToRender === 'function' ? d : null;
  }

  function add(btn, variantId, inst) {
    if (btn.disabled) return;
    btn.disabled = true;
    var label = btn.textContent;
    var drawer = inst.kind === 'drawer' || inst.kind === 'drawer-slot' ? themeDrawer() : null;
    var body = { items: [{ id: variantId, quantity: 1 }] };
    if (drawer) {
      body.sections = drawer.getSectionsToRender().map(function (s) { return s.id; });
      body.sections_url = window.location.pathname;
    }
    fetch(ROOT + 'cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) {
          btn.textContent = (res.d && (res.d.description || res.d.message)) || 'Sold out';
          setTimeout(function () { btn.textContent = label; btn.disabled = false; }, 2500);
          return;
        }
        btn.textContent = cfg.addedText || 'Added';
        document.dispatchEvent(new CustomEvent('boostify:cart-add', { detail: res.d }));
        refreshThemeCart(drawer, res.d);
      })
      .catch(function () { btn.textContent = label; btn.disabled = false; });
  }

  // Make the theme show the new line: Dawn-style drawer and cart page re-render themselves,
  // anything else reloads (the cart page) or is told through the usual cart events.
  function refreshThemeCart(drawer, data) {
    if (drawer) {
      try { drawer.renderContents(data); return; } catch (e) { /* fall through */ }
    }
    if (/\/cart\/?$/.test(window.location.pathname)) {
      refreshCartPage();
      return;
    }
    ['cart:refresh', 'cart:build', 'cart:updated'].forEach(function (name) {
      document.dispatchEvent(new CustomEvent(name, { bubbles: true }));
    });
  }

  // Dawn's own cart-items.onCartUpdate() only redraws the lines, leaving the subtotal stale, so
  // swap the lines, the totals and the header bubble from a fresh copy of the page.
  function refreshCartPage() {
    var parts = ['cart-items', '#main-cart-footer', '#cart-icon-bubble'];
    fetch(window.location.pathname, { headers: { Accept: 'text/html' }, cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(); })
      .then(function (html) {
        var fresh = new DOMParser().parseFromString(html, 'text/html');
        if (!document.querySelector('cart-items') || !fresh.querySelector('cart-items')) throw 0;
        parts.forEach(function (sel) {
          var now = document.querySelector(sel), next = fresh.querySelector(sel);
          if (now && next) now.innerHTML = next.innerHTML;
        });
      })
      .catch(function () { window.location.reload(); });
  }

  // ---------- state ----------
  var state = { items: [], count: 0 };
  var instances = [];

  function paintAll() {
    instances = instances.filter(function (i) { return document.body.contains(i.wrap); });
    instances.forEach(function (i) { i.key = null; paint(i); });
  }

  var timer = null, seq = 0;
  function refresh() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var mine = ++seq;
      fetch(ROOT + 'cart.js', { headers: { Accept: 'application/json' }, cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (cart) {
          return choose(cart).then(function (items) {
            if (mine !== seq) return; // a newer refresh is on its way
            state.count = num(cart.item_count, 0);
            state.items = items;
            ensurePlaced();
            paintAll();
          });
        })
        .catch(function () {});
    }, 250);
  }

  // Cart changes made by the theme or other apps go through these endpoints
  var CART_WRITE = /\/cart\/(add|change|update|clear)(\.js)?(\?|$)/;
  function watchNetwork() {
    if (window.fetch) {
      var orig = window.fetch;
      window.fetch = function (input) {
        var url = typeof input === 'string' ? input : input && input.url;
        var p = orig.apply(this, arguments);
        if (url && CART_WRITE.test(url)) p.then(refresh, function () {});
        return p;
      };
    }
    var open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      if (url && CART_WRITE.test(String(url))) this.addEventListener('load', refresh);
      return open.apply(this, arguments);
    };
    ['cart:updated', 'cart:change', 'boostify:cart-add'].forEach(function (name) {
      document.addEventListener(name, refresh);
    });
    window.addEventListener('pageshow', function (e) { if (e.persisted) refresh(); });
  }

  // ---------- placement: below the line items in the cart drawer and on the cart page ----------
  function mount(kind, place) {
    var inst = build(kind);
    place(inst.wrap);
    instances.push(inst);
    paint(inst);
  }

  function hasInstance(container) {
    return instances.some(function (i) { return container.contains(i.wrap); });
  }
  function isShown(node) { return !!node && node.getClientRects().length > 0; }

  var DRAWER_SEL = 'cart-drawer, #CartDrawer, .cart-drawer, [id*="cart-drawer"]';

  function placeSlots() {
    var slots = document.querySelectorAll('.boostify-up-slot:not([data-ready])');
    Array.prototype.forEach.call(slots, function (slot) {
      slot.setAttribute('data-ready', '1');
      mount(slot.closest(DRAWER_SEL) ? 'drawer-slot' : 'slot', function (w) { slot.appendChild(w); });
    });
  }

  // Best effort for common themes (Dawn and relatives); the block is the fallback. The box goes at
  // the end of the drawer's scrolling list of items, so it scrolls with them instead of taking
  // fixed room away from the items.
  function placeDrawer() {
    if (!cfg.showDrawer) return;
    var drawer = document.querySelector(DRAWER_SEL);
    if (!drawer || hasInstance(drawer)) return;
    var items = drawer.querySelector('cart-drawer-items, .cart-drawer__items, .drawer__contents');
    var footer = drawer.querySelector('.drawer__footer, .cart-drawer__footer');
    if (items) mount('drawer', function (w) { items.appendChild(w); });
    else if (footer && footer.parentNode) mount('drawer', function (w) { footer.parentNode.insertBefore(w, footer); });
  }

  function placeCartPage() {
    if (!cfg.showCartPage || !/\/cart\/?$/.test(window.location.pathname)) return;
    if (document.querySelector('.boostify-up-slot')) return; // placed with the theme editor
    if (instances.some(function (i) { return i.kind === 'cart' && document.body.contains(i.wrap); })) return;
    var skip = 'cart-notification, #cart-notification, ' + DRAWER_SEL + ', header, [role="dialog"]';
    var candidates = ['cart-items', '#main-cart-items', '.cart__items', 'main form[action$="/cart"]'];
    for (var i = 0; i < candidates.length; i++) {
      var found = document.querySelectorAll(candidates[i]);
      for (var j = 0; j < found.length; j++) {
        var t = found[j];
        if (t.closest(skip) || !isShown(t) || !t.parentNode) continue;
        mount('cart', function (w) { t.parentNode.insertBefore(w, t.nextSibling); });
        return;
      }
    }
  }

  function ensurePlaced() {
    placeSlots();
    placeDrawer();
    placeCartPage();
  }

  function watchDom() {
    if (!window.MutationObserver) return;
    var queued = false;
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      setTimeout(function () { queued = false; ensurePlaced(); }, 200);
    }).observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    if (!readConfig()) return;
    ensurePlaced();
    watchNetwork();
    watchDom();
    refresh();
  }

  window.__boostifyUP = function () { if (cfg) ensurePlaced(); else init(); };
  init();

  // Theme editor re-renders sections live; pick up newly added blocks.
  document.addEventListener('shopify:section:load', function () { if (cfg) ensurePlaced(); else init(); });
})();
