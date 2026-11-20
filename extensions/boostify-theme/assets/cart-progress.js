(function () {
  // The script tag can appear twice (app embed + section block); only run once per page.
  if (window.__boostifyCP) { window.__boostifyCP(); return; }

  var HEX = /^#[0-9a-f]{3,8}$/i;
  var FONTS = {
    inherit: 'inherit',
    serif: 'Georgia, "Times New Roman", serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  };
  // One-colour line icons (same set as app/cartprogress.js). Only these fixed strings are ever
  // inserted as markup; everything the merchant types is inserted as plain text.
  var ICONS = {
    truck: '<path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
    percent: '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8"/><path d="M12 8v12"/><path d="M12 8C10 4 6 4 6 6.5S9.5 8 12 8zM12 8c2-4 6-4 6-1.5S14.5 8 12 8z"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    heart: '<path d="M12 20s-7-4.4-9-9a4.5 4.5 0 0 1 9-3.2A4.5 4.5 0 0 1 21 11c-2 4.6-9 9-9 9z"/>'
  };

  function hex(v, d) { return typeof v === 'string' && HEX.test(v) ? v : d; }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function safeUrl(u) { return typeof u === 'string' && /^(https?:\/\/|\/)/i.test(u) ? u : ''; }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ---------- config ----------
  var node = null, cfg = null, moneyFormat = '{{amount}}', rate = 1, shopperCurrency = null;
  function readConfig() {
    node = document.querySelector('script[data-boostify-cp]');
    if (!node) return false;
    try { cfg = JSON.parse(node.textContent); } catch (e) { return false; }
    if (!cfg || !cfg.enabled || !Array.isArray(cfg.goals) || !cfg.goals.length) return false;
    moneyFormat = node.getAttribute('data-money-format') || '{{amount}}';
    var r = window.Shopify && window.Shopify.currency && parseFloat(window.Shopify.currency.rate);
    rate = r > 0 ? r : 1;
    // When the shopper browses in another currency (Shopify Markets), show amounts in that
    // currency rather than with the store's own symbol
    var active = window.Shopify && window.Shopify.currency && window.Shopify.currency.active;
    var own = node.getAttribute('data-shop-currency');
    shopperCurrency = active && own && active !== own ? active : null;
    return true;
  }

  // ---------- maths (same as app/cartprogress.js) ----------
  function formatMoney(cents, format) {
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
    return (format || '{{amount}}').replace(/\{\{\s*(\w+)\s*\}\}/, function (_, name) {
      switch (name) {
        case 'amount_no_decimals': return n(Math.round(cents / 100) * 100, 0, ',', '.');
        case 'amount_with_comma_separator': return n(cents, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator': return n(Math.round(cents / 100) * 100, 0, '.', ',');
        case 'amount_with_apostrophe_separator': return n(cents, 2, "'", '.');
        default: return n(cents, 2, ',', '.');
      }
    });
  }

  function compute(total) {
    var goals = cfg.goals.map(function (g) {
      return { label: g.label, icon: g.icon, iconImage: g.iconImage, tip: g.tip, cents: Math.round(num(g.amount, 0) * 100 * rate) };
    });
    var max = goals[goals.length - 1].cents;
    var reached = goals.filter(function (g) { return total >= g.cents; }).length;
    var next = goals[reached] || null;
    // {amount}, {goal} and {threshold} come out bold
    function parts(tpl, goal, remaining) {
      return String(tpl || '').split(/(\{amount\}|\{goal\}|\{threshold\})/).filter(Boolean).map(function (tok) {
        if (tok === '{amount}') return { t: formatMoney(remaining, moneyFormat), b: true };
        if (tok === '{goal}') return { t: goal ? goal.label : '', b: true };
        if (tok === '{threshold}') return { t: goal ? formatMoney(goal.cents, moneyFormat) : '', b: true };
        return { t: tok, b: false };
      });
    }
    var p;
    if (!next) p = [{ t: cfg.allReachedText, b: false }];
    else if (total <= 0 && cfg.emptyText) p = parts(cfg.emptyText, next, next.cents);
    else p = parts(cfg.progressText, next, next.cents - total);
    return {
      goals: goals, pct: max > 0 ? Math.min(100, total / max * 100) : 0, reached: reached, next: next, max: max, parts: p,
      message: p.map(function (x) { return x.t; }).join('')
    };
  }

  // ---------- confetti: a party-popper burst, only inside the open cart drawer ----------
  var DRAWER_SEL = 'cart-drawer, #CartDrawer, .cart-drawer, [id*="cart-drawer"]';
  var PANEL_SEL = '.drawer__inner, .cart-drawer__inner, [role="dialog"]';

  // The drawer panel's on-screen box, or null when the drawer is closed or missing
  function openDrawerRect() {
    var drawer = document.querySelector(DRAWER_SEL);
    if (!drawer) return null;
    var dcs = window.getComputedStyle(drawer);
    if (dcs.display === 'none' || dcs.visibility === 'hidden') return null;
    var panel = drawer.querySelector(PANEL_SEL) || drawer;
    var pcs = window.getComputedStyle(panel);
    if (pcs.display === 'none' || pcs.visibility === 'hidden') return null;
    var r = panel.getBoundingClientRect();
    if (r.width < 120 || r.height < 120) return null;
    // a closed drawer is usually parked off-screen
    if (r.right <= 20 || r.left >= window.innerWidth - 20 || r.bottom <= 20 || r.top >= window.innerHeight - 20) return null;
    return r;
  }

  function blast(r) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!document.body.animate) return;
    var layer = el('div');
    layer.setAttribute('aria-hidden', 'true');
    layer.className = 'boostify-confetti';
    // Clipped to the drawer panel so nothing flies over the rest of the store
    layer.style.cssText = 'position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;pointer-events:none;overflow:hidden;z-index:2147483000;';
    var colors = [hex(cfg.fillColor, '#111111'), hex(cfg.fillColor2, '#111111'), '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#22c55e'];
    var w = r.width, h = r.height;
    var pieces = 80;
    for (var i = 0; i < pieces; i++) {
      var fromLeft = i % 2 === 0;
      var p = el('div');
      var size = 6 + Math.random() * 6;
      p.style.cssText = 'position:absolute;display:block;width:' + size + 'px;height:' + (size * (0.5 + Math.random() * 0.8)) + 'px;background:' + colors[i % colors.length] + ';border-radius:' + (Math.random() < 0.3 ? '50%' : '2px') + ';left:' + (fromLeft ? '0' : (w - size) + 'px') + ';top:' + (h - size) + 'px;opacity:0;';
      layer.appendChild(p);
      // projectile motion up and inwards, then gravity pulls it down
      var angle = (fromLeft ? 58 + Math.random() * 28 : 122 - Math.random() * 28) * Math.PI / 180;
      var speed = 0.5 * h + Math.random() * 0.5 * h;
      var vx = Math.cos(angle) * speed, vy = Math.sin(angle) * speed, g = 1.8 * h;
      var spin = (Math.random() * 720 - 360), frames = [], steps = 12;
      for (var s = 0; s <= steps; s++) {
        var t = s / steps;
        frames.push({
          transform: 'translate(' + (vx * t).toFixed(1) + 'px,' + (-(vy * t) + 0.5 * g * t * t).toFixed(1) + 'px) rotate(' + (spin * t).toFixed(0) + 'deg)',
          opacity: s === 0 ? 0 : (s > steps - 2 ? 0 : 1),
          offset: t
        });
      }
      p.animate(frames, { duration: 1700 + Math.random() * 1000, delay: Math.random() * 150, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' });
    }
    document.body.appendChild(layer);
    setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 3300);
  }

  // Fires now if the drawer is open. If the theme is still opening it (typical right after
  // "add to cart"), wait a few seconds for it; if it never opens, there is no confetti.
  var pendingBlast = null;
  function celebrate() {
    var r = openDrawerRect();
    if (r) { blast(r); return; }
    if (pendingBlast) return;
    var tries = 0;
    pendingBlast = setInterval(function () {
      var rect = openDrawerRect();
      if (rect || ++tries > 16) {
        clearInterval(pendingBlast);
        pendingBlast = null;
        if (rect) blast(rect);
      }
    }, 250);
  }

  // ---------- state ----------
  var state = { total: 0, reached: -1 };
  var instances = [];

  function iconInto(target, g) {
    var img = safeUrl(g.iconImage);
    var key = typeof g.icon === 'string' && g.icon.indexOf('svg:') === 0 ? g.icon.slice(4) : '';
    if (img) {
      var i = el('img', 'boostify-cp__img');
      i.src = img;
      i.alt = '';
      i.loading = 'lazy';
      target.appendChild(i);
    } else if (key && Object.prototype.hasOwnProperty.call(ICONS, key)) {
      target.insertAdjacentHTML('beforeend', '<svg class="boostify-cp__svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[key] + '</svg>');
    } else {
      target.appendChild(document.createTextNode(g.icon || ''));
    }
  }

  // Tooltip: the merchant's own text, or "Free shipping at ₹500" / "✓ Free shipping unlocked"
  function tipText(g, reached) {
    if (g.tip) {
      var t = String(g.tip).replace(/\{threshold\}/g, formatMoney(g.cents, moneyFormat)).replace(/\{goal\}/g, g.label || '');
      return (reached ? '\u2713 ' : '') + t;
    }
    var name = g.label ? g.label.charAt(0).toUpperCase() + g.label.slice(1) : 'Reward';
    return reached ? '\u2713 ' + name + ' unlocked' : name + ' at ' + formatMoney(g.cents, moneyFormat);
  }

  function build(kind) {
    var wrap = el('div', 'boostify-cp-wrap boostify-cp-wrap--' + kind);
    var root = el('div', 'boostify-cp');
    var solid = cfg.backgroundMode === 'solid';
    if (cfg.layout !== 'classic') root.classList.add('boostify-cp--clean');
    if (solid) root.classList.add('boostify-cp--solid');
    if (cfg.density === 'roomy') root.classList.add('boostify-cp--roomy');
    if (cfg.divider) root.classList.add('boostify-cp--divider');
    if (cfg.border) root.classList.add('boostify-cp--border');
    if (cfg.shadow) root.classList.add('boostify-cp--shadow');
    if (cfg.showMilestones && cfg.showLabels) root.classList.add('boostify-cp--labels');
    if (cfg.showMilestones && cfg.showAmounts) root.classList.add('boostify-cp--amounts');
    var s = root.style;
    s.setProperty('--cp-bg', solid ? hex(cfg.bg, '#ffffff') : 'transparent');
    s.setProperty('--cp-text', hex(cfg.textColor, '#111111'));
    s.setProperty('--cp-fill', hex(cfg.fillColor, '#111111'));
    s.setProperty('--cp-fill2', hex(cfg.fillColor2, hex(cfg.fillColor, '#111111')));
    s.setProperty('--cp-track', hex(cfg.trackColor, '#e5e7eb'));
    s.setProperty('--cp-marker-bg', hex(cfg.markerBg, '#ebebeb'));
    s.setProperty('--cp-icon', hex(cfg.markerIconColor, '#111111'));
    s.setProperty('--cp-gap', hex(cfg.gapColor, '#ffffff'));
    s.setProperty('--cp-radius', (solid ? num(cfg.radius, 0) : 0) + 'px');
    s.setProperty('--cp-bar-radius', cfg.barShape === 'rounded' ? '999px' : '0px');
    s.setProperty('--cp-marker-radius', cfg.markerShape === 'square' ? '0px' : '50%');
    s.setProperty('--cp-marker-size', num(cfg.markerSize, 22) + 'px');
    s.setProperty('--cp-height', num(cfg.height, 6) + 'px');
    s.setProperty('--cp-weight', num(cfg.fontWeight, 600));
    s.setProperty('--cp-size', num(cfg.fontSize, 13) + 'px');
    s.setProperty('--cp-font', FONTS[cfg.fontFamily] || 'inherit');

    var msg = el('p', 'boostify-cp__msg');
    msg.setAttribute('aria-live', 'polite');
    var rail = el('div', 'boostify-cp__rail');
    var track = el('div', 'boostify-cp__track');
    var fill = el('div', 'boostify-cp__fill');
    track.appendChild(fill);
    rail.appendChild(track);

    var markers = [];
    if (cfg.showMilestones) {
      cfg.goals.forEach(function (g) {
        var m = el('div', 'boostify-cp__marker');
        var dot = el('div', 'boostify-cp__dot');
        iconInto(dot, g);
        var tip = null;
        if (cfg.tooltips !== false) {
          // focusable so a tap (phones) or the keyboard shows the tooltip too
          m.tabIndex = 0;
          m.setAttribute('role', 'img');
          tip = el('span', 'boostify-cp__tip');
          tip.setAttribute('aria-hidden', 'true');
        }
        var amount = null;
        if (cfg.showAmounts) { amount = el('div', 'boostify-cp__amount'); m.appendChild(amount); }
        m.appendChild(dot);
        if (cfg.showLabels) m.appendChild(el('div', 'boostify-cp__label', g.label));
        if (tip) m.appendChild(tip);
        rail.appendChild(m);
        markers.push({ node: m, amount: amount, tip: tip });
      });
    }

    root.appendChild(msg);
    root.appendChild(rail);
    wrap.appendChild(root);
    return { wrap: wrap, root: root, rail: rail, msg: msg, fill: fill, markers: markers, kind: kind };
  }

  // Keep neighbouring reward names from running into each other on narrow screens/drawers
  function fitLabels(inst) {
    if (!cfg.showMilestones || !cfg.showLabels) return;
    var w = inst.rail.clientWidth;
    if (!w) return;
    var c = compute(state.total);
    var pos = c.goals.map(function (g) { return c.max > 0 ? Math.min(100, g.cents / c.max * 100) : 100; });
    var gap = w; // distance in px to the nearest neighbouring marker
    for (var i = 1; i < pos.length; i++) gap = Math.min(gap, (pos[i] - pos[i - 1]) * w / 100);
    var width = Math.max(44, Math.min(110, Math.floor(gap) - 8));
    inst.root.style.setProperty('--cp-label-w', width + 'px');
  }

  function paint(inst) {
    var c = compute(state.total);
    // message: optional icon of the next reward, then text with bold amount / reward
    var msg = inst.msg;
    msg.textContent = '';
    if (cfg.iconInMessage !== false && c.next) {
      var ic = el('span', 'boostify-cp__msg-icon');
      ic.setAttribute('aria-hidden', 'true');
      iconInto(ic, c.next);
      msg.appendChild(ic);
    }
    c.parts.forEach(function (x) { msg.appendChild(x.b ? el('strong', null, x.t) : document.createTextNode(x.t)); });
    inst.fill.style.width = c.pct + '%';
    inst.markers.forEach(function (m, i) {
      var g = c.goals[i];
      var pos = c.max > 0 ? Math.min(100, g.cents / c.max * 100) : 100;
      var done = i < c.reached;
      m.node.style.left = pos + '%';
      m.node.classList.toggle('is-reached', done);
      // keep tooltips inside the bar near the edges
      m.node.classList.toggle('is-start', pos < 15);
      m.node.classList.toggle('is-end', pos > 85);
      if (m.amount) m.amount.textContent = formatMoney(g.cents, moneyFormat);
      if (m.tip) {
        var t = tipText(g, done);
        m.tip.textContent = t;
        m.node.setAttribute('aria-label', t);
      }
    });
    // Hide while the cart is empty, unless the merchant chose to show it
    inst.root.hidden = state.total <= 0 && !cfg.showEmpty;
    fitLabels(inst);
  }

  function paintAll() {
    instances = instances.filter(function (i) { return document.body.contains(i.wrap); });
    instances.forEach(paint);
  }

  // Called whenever the total changes: celebrates each newly reached goal
  function setTotal(total) {
    state.total = total;
    var reached = compute(total).reached;
    if (state.reached !== -1 && reached > state.reached) {
      if (cfg.confetti) celebrate();
      instances.forEach(function (i) {
        i.root.classList.add('is-celebrate');
        setTimeout(function () { i.root.classList.remove('is-celebrate'); }, 1200);
      });
    }
    state.reached = reached;
    paintAll();
  }

  function mount(kind, place) {
    var inst = build(kind);
    place(inst.wrap);
    instances.push(inst);
    paint(inst);
    if (window.ResizeObserver) new ResizeObserver(function () { fitLabels(inst); }).observe(inst.rail);
    return inst;
  }

  // ---------- cart data ----------
  var timer = null;
  function refresh() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
      fetch(root + 'cart.js', { headers: { Accept: 'application/json' }, cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (cart) {
          setTotal(num(cart.total_price, 0));
          ensurePlaced();
        })
        .catch(function () {});
    }, 250);
  }

  // Cart changes made by the theme or other apps go through these endpoints
  var CART_WRITE = /\/cart\/(add|change|update|clear)(\.js)?(\?|$)/;
  function watchNetwork() {
    if (window.__boostifyCPWatch) return;
    window.__boostifyCPWatch = true;
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
    ['cart:updated', 'cart:refresh', 'cart:change', 'boostify:cart-add'].forEach(function (name) {
      document.addEventListener(name, refresh);
    });
    window.addEventListener('pageshow', function (e) { if (e.persisted) refresh(); });
  }

  // ---------- placement: cart drawer + cart page (plus the optional block) ----------
  function placeSlots() {
    var slots = document.querySelectorAll('.boostify-cp-slot:not([data-ready])');
    Array.prototype.forEach.call(slots, function (slot) {
      slot.setAttribute('data-ready', '1');
      mount('slot', function (w) { slot.appendChild(w); });
    });
  }

  function hasInstance(container, kind) {
    return instances.some(function (i) { return i.kind === kind && container.contains(i.wrap); });
  }

  // Best effort for common themes (Dawn and relatives); the block is the fallback.
  function placeDrawer() {
    if (!cfg.showDrawer) return;
    var drawer = document.querySelector('cart-drawer, #CartDrawer, .cart-drawer, [id*="cart-drawer"]');
    if (!drawer || hasInstance(drawer, 'drawer')) return;
    var panel = drawer.querySelector('.drawer__inner, .cart-drawer__inner, [role="dialog"]') || drawer;
    var header = panel.querySelector('.drawer__header, .cart-drawer__header');
    mount('drawer', function (w) {
      if (header && header.parentNode) header.parentNode.insertBefore(w, header.nextSibling);
      else panel.insertBefore(w, panel.firstChild);   // empty drawer: show at the very top
    });
  }

  function isShown(node) { return !!node && node.getClientRects().length > 0; }

  function placeCartPage() {
    if (!cfg.showCartPage || !/\/cart\/?$/.test(window.location.pathname)) return;
    if (instances.some(function (i) { return i.kind === 'cart' && document.body.contains(i.wrap) && isShown(i.wrap); })) return;
    // A bar placed earlier inside something the theme later hid (e.g. an empty cart's form) is moved
    instances = instances.filter(function (i) {
      if (i.kind === 'cart' && !isShown(i.wrap)) { if (i.wrap.parentNode) i.wrap.parentNode.removeChild(i.wrap); return false; }
      return true;
    });

    var skip = 'cart-notification, #cart-notification, cart-drawer, #CartDrawer, .cart-drawer, header, [role="dialog"]';
    function firstShown(selectors) {
      for (var i = 0; i < selectors.length; i++) {
        var found = document.querySelectorAll(selectors[i]);
        for (var j = 0; j < found.length; j++) {
          if (!found[j].closest(skip) && isShown(found[j])) return found[j];
        }
      }
      return null;
    }

    // Cart with items: directly above the line items
    var target = firstShown(['#main-cart-items', 'cart-items', '.cart__items', 'main form[action$="/cart"]', 'form[action$="/cart"]']);
    if (target && target.parentNode) {
      mount('cart', function (w) { target.parentNode.insertBefore(w, target); });
      return;
    }
    // Empty cart: above the "your cart is empty" message, else at the top of the page content
    var empty = firstShown(['.cart__warnings', '.cart-empty', '.cart--empty', '.cart.is-empty', '[class*="empty-cart"]']);
    if (empty && empty.parentNode) {
      mount('cart', function (w) { w.classList.add('boostify-cp-wrap--standalone'); empty.parentNode.insertBefore(w, empty); });
      return;
    }
    var main = document.querySelector('main, #MainContent, [role="main"]');
    if (main) mount('cart', function (w) { w.classList.add('boostify-cp-wrap--standalone'); main.insertBefore(w, main.firstChild); });
  }

  function ensurePlaced() {
    placeSlots();
    placeDrawer();
    placeCartPage();
  }

  var mo = null;
  function watchDom() {
    if (mo || !window.MutationObserver) return;
    var queued = false;
    mo = new MutationObserver(function () {
      if (queued) return;
      queued = true;
      setTimeout(function () { queued = false; ensurePlaced(); }, 200);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    if (!readConfig()) return;
    // First paint from the cart total the server rendered; refreshed straight after.
    // The starting point is recorded so loading a page never triggers confetti.
    var t = Number(node.getAttribute('data-total'));
    if (isFinite(t)) { state.total = t; state.reached = compute(t).reached; }
    ensurePlaced();
    watchNetwork();
    watchDom();
    refresh();
  }

  window.__boostifyCP = function () { if (cfg || readConfig()) { ensurePlaced(); } else init(); };
  init();

  // Theme editor re-renders sections live; pick up newly added blocks.
  document.addEventListener('shopify:section:load', function () { if (cfg) ensurePlaced(); else init(); });
})();
