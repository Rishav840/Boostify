(function () {
  // The script tag can appear twice (app embed + section block); only run once per page.
  if (window.__boostifyBD) { window.__boostifyBD(); return; }

  var ROOT = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

  // ---------- money (same as cart-progress.js) ----------
  function formatMoney(cents, format, shopperCurrency) {
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

  // ---------- after adding: open the theme's cart ----------
  // Dawn and its relatives expose <cart-drawer> with renderContents(); other themes go to /cart.
  function themeDrawer() {
    var d = document.querySelector('cart-drawer');
    return d && typeof d.renderContents === 'function' && typeof d.getSectionsToRender === 'function' ? d : null;
  }

  function refreshCartBubble() {
    fetch(ROOT + '?sections=cart-icon-bubble')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data['cart-icon-bubble']) return;
        var tmp = document.createElement('div');
        tmp.innerHTML = data['cart-icon-bubble'];
        var fresh = tmp.querySelector('.shopify-section') || tmp;
        var target = document.getElementById('cart-icon-bubble');
        if (target && fresh) target.innerHTML = fresh.innerHTML;
      })
      .catch(function () {});
  }

  // ---------- smart bundles: the product plus Shopify's recommendations ----------
  // Same markup as snippets/boostify-bundle.liquid; product JSON prices are already in the
  // shopper's currency, in cents.
  var SMART_SIZE = 3; // products a smart bundle starts with (more if the minimum is higher)
  var MAX_ITEMS = 6; // most products a customer can build a bundle of
  var MAX_SUGGESTIONS = 8;

  function getJson(url) {
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function recommendations(productId) {
    var base = ROOT + 'recommendations/products.json?limit=10&product_id=' + productId;
    return getJson(base + '&intent=complementary').then(function (d) {
      if (d && d.products && d.products.length) return d.products;
      return getJson(base + '&intent=related').then(function (r) { return (r && r.products) || []; });
    });
  }

  function imageUrl(src) {
    if (!src || typeof src !== 'string') return '';
    var u = src.indexOf('//') === 0 ? 'https:' + src : src;
    if (!/^https:\/\//i.test(u)) return '';
    return u + (u.indexOf('?') === -1 ? '?' : '&') + 'width=160';
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function smartItem(p) {
    var variants = (p.variants || []).map(function (v) {
      return {
        id: v.id,
        price: Number(v.price) || 0,
        compare: Number(v.compare_at_price) > Number(v.price) ? Number(v.compare_at_price) : null,
        available: !!v.available,
        image: imageUrl(v.featured_image && v.featured_image.src) || null
      };
    });
    var first = null;
    variants.forEach(function (v) { if (!first && v.available) first = v; });
    var item = el('div', 'boostify-bd__item');
    item.setAttribute('data-product', String(p.id));
    var src = (first && first.image) || imageUrl(p.featured_image);
    var img;
    if (src) {
      img = el('img', 'boostify-bd__img');
      img.src = src;
      img.alt = p.title || '';
      img.width = 64;
      img.height = 64;
      img.loading = 'lazy';
    } else {
      img = el('div', 'boostify-bd__img');
      img.setAttribute('aria-hidden', 'true');
    }
    item.appendChild(img);
    var info = el('div', 'boostify-bd__info');
    var title = el('a', 'boostify-bd__title', p.title || '');
    title.href = p.url || (ROOT + 'products/' + p.handle);
    info.appendChild(title);
    var price = el('div', 'boostify-bd__price');
    price.appendChild(el('span', 'boostify-bd__now'));
    var cmp = el('s', 'boostify-bd__compare');
    cmp.hidden = true;
    price.appendChild(cmp);
    info.appendChild(price);
    if (variants.length > 1) {
      var select = el('select', 'boostify-bd__variant');
      select.setAttribute('aria-label', p.title || '');
      (p.variants || []).forEach(function (v) {
        var o = el('option', null, v.title);
        o.value = String(v.id);
        if (!v.available) o.disabled = true;
        if (first && v.id === first.id) o.selected = true;
        select.appendChild(o);
      });
      info.appendChild(select);
    }
    item.appendChild(info);
    var data = el('script', 'boostify-bd__data', JSON.stringify(variants));
    data.type = 'application/json';
    item.appendChild(data);
    return item;
  }

  function smartMin(box) { return Math.max(2, Math.min(5, Number(box.getAttribute('data-min')) || 2)); }

  // Resolves true once the box holds a bundle that can reach the minimum. With the builder on, the
  // recommendations that don't fit go in a row of suggestions under the bundle.
  function fillSmart(box) {
    var own = Number(box.getAttribute('data-product-id'));
    var min = smartMin(box);
    var builder = box.getAttribute('data-builder') === '1';
    var start = Math.min(MAX_ITEMS, Math.max(SMART_SIZE, min));
    return recommendations(own).then(function (list) {
      var usable = [];
      list.forEach(function (p) {
        if (!p || p.id === own) return;
        if ((p.variants || []).some(function (v) { return v.available; })) usable.push(p);
      });
      if (usable.length < min - 1) return false;
      var wrap = box.querySelector('.boostify-bd__items');
      usable.slice(0, start - 1).forEach(function (p) { wrap.appendChild(smartItem(p)); });
      if (builder) {
        var more = el('div', 'boostify-bd__more');
        var heading = box.getAttribute('data-more-heading');
        if (heading) more.appendChild(el('p', 'boostify-bd__more-title', heading));
        var row = el('div', 'boostify-bd__more-list');
        usable.slice(start - 1, start - 1 + MAX_SUGGESTIONS).forEach(function (p) { row.appendChild(smartItem(p)); });
        more.appendChild(row);
        box.insertBefore(more, box.querySelector('.boostify-bd__footer'));
      }
      return true;
    });
  }

  function setup(box) {
    if (box.getAttribute('data-ready')) return;
    box.setAttribute('data-ready', '1');
    if (box.getAttribute('data-smart') === '1') {
      fillSmart(box).then(function (ok) {
        if (!ok) { box.parentNode && box.parentNode.removeChild(box); return; }
        box.removeAttribute('data-smart');
        box.hidden = false;
        build(box);
      });
      return;
    }
    build(box);
  }

  // ---------- one bundle box ----------
  function build(box) {

    var pct = Math.max(0, Math.min(90, Number(box.getAttribute('data-percent')) || 0));
    var format = box.getAttribute('data-money-format') || '{{amount}}';
    var active = window.Shopify && window.Shopify.currency && window.Shopify.currency.active;
    var own = box.getAttribute('data-shop-currency');
    var shopper = active && own && active !== own ? active : null;
    var showCompare = box.getAttribute('data-show-compare') === '1';
    var afterAdd = box.getAttribute('data-after-add') || 'drawer';
    var buttonText = box.getAttribute('data-button-text') || 'Add bundle to cart';
    var addedText = box.getAttribute('data-added-text') || 'Added';
    var soldOutText = box.getAttribute('data-sold-out-text') || 'Sold out';
    var savingsText = box.getAttribute('data-savings-text') || '';
    var checkboxes = box.getAttribute('data-checkboxes') === '1';
    var smart = box.getAttribute('data-bundle') === 'smart';
    var builder = smart && box.getAttribute('data-builder') === '1';
    var minItems = smart ? smartMin(box) : 0;
    var hintText = box.getAttribute('data-hint') || '';
    var ownId = box.getAttribute('data-product-id');
    var showPlus = box.getAttribute('data-show-plus') === '1';
    var list = box.querySelector('.boostify-bd__items');
    var more = box.querySelector('.boostify-bd__more');
    var moreList = more && more.querySelector('.boostify-bd__more-list');
    if (builder) checkboxes = false; // removing a product does the same job
    function money(c) { return formatMoney(c, format, shopper); }

    var items = Array.prototype.map.call(box.querySelectorAll('.boostify-bd__item'), function (node) {
      var variants = [];
      try { variants = JSON.parse(node.querySelector('.boostify-bd__data').textContent); } catch (e) { /* keep empty */ }
      return {
        node: node,
        variants: variants,
        select: node.querySelector('.boostify-bd__variant'),
        img: node.querySelector('img.boostify-bd__img'),
        now: node.querySelector('.boostify-bd__now'),
        compare: node.querySelector('.boostify-bd__compare'),
        inBundle: !node.closest('.boostify-bd__more')
      };
    }).filter(function (it) { return it.variants.length; });
    function inBundle() { return items.filter(function (it) { return it.inBundle; }); }

    // A product was deleted or unpublished: a "bundle" of one isn't a bundle
    if (inBundle().length < 2) { box.parentNode && box.parentNode.removeChild(box); return; }

    // Tick boxes: customers can leave products out (fixed markup, the name goes in as text)
    if (checkboxes) {
      box.classList.add('boostify-bd--checks');
      items.forEach(function (it) {
        var label = document.createElement('label');
        label.className = 'boostify-bd__tick';
        var input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'boostify-bd__check';
        input.checked = true;
        var title = it.node.querySelector('.boostify-bd__title');
        input.setAttribute('aria-label', title ? title.textContent : '');
        label.appendChild(input);
        it.node.insertBefore(label, it.node.firstChild);
        it.check = input;
        input.addEventListener('change', function () {
          it.node.classList.toggle('is-off', !input.checked);
          render();
        });
      });
    }
    function picked() { return items.filter(function (it) { return it.inBundle && (!it.check || it.check.checked); }); }

    // Build your own: x takes a product out, + Add puts a suggestion in (the page's own product stays)
    function titleOf(it) {
      var t = it.node.querySelector('.boostify-bd__title');
      return t ? t.textContent : '';
    }
    function setToggle(it) {
      if (!it.toggle) return;
      it.toggle.textContent = it.inBundle ? '×' : '+ Add';
      it.toggle.className = 'boostify-bd__toggle ' + (it.inBundle ? 'boostify-bd__toggle--remove' : 'boostify-bd__toggle--add');
      it.toggle.setAttribute('aria-label', (it.inBundle ? 'Remove ' : 'Add to bundle: ') + titleOf(it));
    }
    function layout() {
      Array.prototype.forEach.call(list.querySelectorAll('.boostify-bd__plus'), function (n) { n.parentNode.removeChild(n); });
      inBundle().forEach(function (it, n) {
        if (showPlus && n > 0) {
          var sign = el('div', 'boostify-bd__plus', '+');
          sign.setAttribute('aria-hidden', 'true');
          list.insertBefore(sign, it.node);
        }
      });
      if (more) more.hidden = !items.some(function (it) { return !it.inBundle; });
      var full = inBundle().length >= MAX_ITEMS;
      items.forEach(function (it) { if (it.toggle && !it.inBundle) it.toggle.disabled = full; });
    }
    function move(it, into) {
      if (into && inBundle().length >= MAX_ITEMS) return;
      it.inBundle = into;
      (into ? list : moreList).appendChild(it.node);
      setToggle(it);
      layout();
      render();
      // keep keyboard users on a sensible control after the product moves
      if (it.toggle) it.toggle.focus({ preventScroll: true });
    }
    if (builder) {
      box.classList.add('boostify-bd--builder');
      items.forEach(function (it) {
        if (it.node.getAttribute('data-product') === ownId) return;
        it.toggle = el('button');
        it.toggle.type = 'button';
        setToggle(it);
        it.toggle.addEventListener('click', function () { move(it, !it.inBundle); });
        it.node.appendChild(it.toggle);
      });
      layout();
    } else if (smart) {
      layout(); // the "+" signs between the products the script added
    }
    var hint = null;
    if (builder) {
      hint = el('p', 'boostify-bd__hint');
      hint.hidden = true;
      var foot = box.querySelector('.boostify-bd__footer');
      foot.insertBefore(hint, box.querySelector('.boostify-bd__btn'));
    }

    var btn = box.querySelector('.boostify-bd__btn');
    var sum = box.querySelector('.boostify-bd__sum');
    var was = box.querySelector('.boostify-bd__was');
    var badge = box.querySelector('.boostify-bd__badge');
    var error = box.querySelector('.boostify-bd__error');
    var busy = false;

    function chosen(it) {
      var id = it.select ? Number(it.select.value) : null;
      var found = null;
      it.variants.forEach(function (v) { if (v.id === id) found = v; });
      if (found) return found;
      for (var i = 0; i < it.variants.length; i++) if (it.variants[i].available) return it.variants[i];
      return it.variants[0];
    }

    function render() {
      var total = 0, regular = 0, available = true;
      var chosenItems = picked();
      items.forEach(function (it) {
        var v = chosen(it);
        var on = chosenItems.indexOf(it) !== -1;
        if (on) {
          total += v.price;
          regular += v.compare && v.compare > v.price ? v.compare : v.price;
          if (!v.available) available = false;
        }
        it.now.textContent = money(v.price);
        if (it.compare) {
          it.compare.hidden = !v.compare;
          it.compare.textContent = v.compare ? money(v.compare) : '';
        }
        if (it.img && v.image) it.img.src = v.image;
      });
      // The checkout discount needs the whole bundle (smart bundles: at least the minimum)
      var whole = smart ? chosenItems.length >= minItems : chosenItems.length === inBundle().length;
      var off = whole ? pct : 0;
      if (!chosenItems.length) available = false;
      // Build your own: the bundle can only be added once it has the minimum
      var missing = builder ? Math.max(0, minItems - chosenItems.length) : 0;
      if (missing) available = false;
      if (hint) {
        hint.hidden = !missing;
        hint.textContent = hintText
          .replace(/\{count\}/g, String(missing))
          .replace(/\{percent\}/g, pct + '%')
          .replace(/\{min\}/g, String(minItems));
      }
      var bundlePrice = Math.round(total * (100 - off) / 100);
      sum.textContent = money(bundlePrice);
      var showWas = showCompare && regular > bundlePrice;
      was.hidden = !showWas;
      was.textContent = showWas ? money(regular) : '';
      var saved = total - bundlePrice;
      badge.hidden = !(off > 0 && saved > 0 && savingsText);
      badge.textContent = savingsText.replace(/\{percent\}/g, off + '%').replace(/\{amount\}/g, money(saved));
      if (!busy) {
        btn.disabled = !available;
        btn.textContent = available || !chosenItems.length || missing ? buttonText : soldOutText;
      }
    }

    function done(text) {
      btn.textContent = text;
      setTimeout(function () { busy = false; render(); }, 1800);
    }

    function add() {
      if (busy || !picked().length) return;
      busy = true;
      btn.disabled = true;
      error.hidden = true;
      var drawer = afterAdd === 'drawer' ? themeDrawer() : null;
      // Smart bundles: a fresh tag per add, so the discount function sees which lines came together
      var tag = box.getAttribute('data-bundle');
      if (tag === 'smart') tag = 'smart:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      var body = {
        items: picked().map(function (it) {
          return { id: chosen(it).id, quantity: 1, properties: { _boostify_bundle: tag } };
        })
      };
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
            error.textContent = (res.d && (res.d.description || res.d.message)) || 'Could not add the bundle';
            error.hidden = false;
            busy = false;
            render();
            return;
          }
          document.dispatchEvent(new CustomEvent('boostify:cart-add', { detail: res.d }));
          if (afterAdd === 'checkout') { window.location.href = ROOT + 'checkout'; return; }
          if (afterAdd === 'cart' || (afterAdd === 'drawer' && !drawer)) { window.location.href = ROOT + 'cart'; return; }
          if (drawer) {
            try { drawer.renderContents(res.d); } catch (e) { window.location.href = ROOT + 'cart'; return; }
          } else {
            refreshCartBubble();
          }
          done(addedText);
        })
        .catch(function () {
          error.textContent = 'Could not add the bundle';
          error.hidden = false;
          busy = false;
          render();
        });
    }

    items.forEach(function (it) { if (it.select) it.select.addEventListener('change', render); });
    btn.addEventListener('click', add);
    render();
  }

  // ---------- placement ----------
  // The app embed's copy goes next to the product form, unless the merchant placed the
  // Boostify Bundle block with the theme editor (then the embed's copy is dropped).
  function productForm() {
    var skip = 'cart-drawer, .cart-drawer, #CartDrawer, quick-add-modal, [id*="QuickAdd"], .boostify-satc, [role="dialog"]';
    var forms = document.querySelectorAll('product-form, form[action*="/cart/add"]');
    for (var i = 0; i < forms.length; i++) {
      var f = forms[i];
      if (f.closest(skip) || !f.getClientRects().length) continue;
      // Dawn's Shop Pay installments form also posts to /cart/add but sits by the price
      if (!f.querySelector('[name="add"], [type="submit"], button:not([type])')) continue;
      // Dawn wraps the form in <product-form>; go to the outermost of the two
      return f.parentElement && f.parentElement.closest('product-form') || f;
    }
    return null;
  }

  function place() {
    var autos = document.querySelectorAll('.boostify-bd[data-auto="1"]');
    var slotted = document.querySelector('.boostify-bd-slot .boostify-bd');
    Array.prototype.forEach.call(autos, function (box) {
      if (slotted) { box.parentNode && box.parentNode.removeChild(box); return; }
      if (box.getAttribute('data-placed')) return;
      var form = productForm();
      if (!form || !form.parentNode) return;
      box.setAttribute('data-placed', '1');
      if (box.getAttribute('data-position') === 'before_form') form.parentNode.insertBefore(box, form);
      else form.parentNode.insertBefore(box, form.nextSibling);
      if (box.getAttribute('data-smart') !== '1') box.hidden = false; // smart: once filled
    });
    Array.prototype.forEach.call(document.querySelectorAll('.boostify-bd'), setup);
  }

  window.__boostifyBD = place;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', place);
  else place();
  // Theme editor re-renders sections live; pick up newly added blocks.
  document.addEventListener('shopify:section:load', place);
})();
