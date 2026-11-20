(function () {
  var root = document.getElementById('boostify-satc');
  if (!root || root.getAttribute('data-ready')) return;
  root.setAttribute('data-ready', '1');

  var variants;
  try { variants = JSON.parse(document.getElementById('boostify-satc-variants').textContent); } catch (e) { return; }
  var byId = {};
  variants.forEach(function (v) { byId[v.id] = v; });

  var currentId;
  try { currentId = JSON.parse(document.getElementById('boostify-satc-current').textContent); } catch (e) { /* no current variant data */ }

  var qtyInput = root.querySelector('.boostify-satc__qty-input');
  var btn = root.querySelector('.boostify-satc__btn');
  var priceEl = root.querySelector('.boostify-satc__now');
  var compareEl = root.querySelector('.boostify-satc__compare');
  var imgEl = root.querySelector('.boostify-satc__img');

  var devices = root.getAttribute('data-devices');
  var appear = root.getAttribute('data-appear');
  var afterAdd = root.getAttribute('data-after-add');
  var addedText = root.getAttribute('data-added-text') || 'Added';
  var soldOutText = root.getAttribute('data-sold-out-text') || 'Sold out';
  var buttonText = root.getAttribute('data-button-text') || 'Add to cart';

  var mq = window.matchMedia('(max-width: 768px)');
  var busy = false;
  var pastButton = false;

  function selectedVariant() {
    return byId[currentId];
  }

  function render() {
    var v = selectedVariant();
    if (!v) return;
    if (priceEl) priceEl.textContent = v.price;
    if (compareEl) {
      compareEl.textContent = v.compare || '';
      compareEl.hidden = !v.compare;
    }
    if (imgEl && v.image) imgEl.src = v.image;
    if (!busy) {
      btn.disabled = !v.available;
      btn.textContent = v.available ? buttonText : soldOutText;
    }
  }

  function quantity() {
    var q = qtyInput ? parseInt(qtyInput.value, 10) : 1;
    return q > 0 ? q : 1;
  }

  function flash(text, ms) {
    btn.textContent = text;
    setTimeout(function () { busy = false; btn.disabled = false; render(); }, ms);
  }

  // Best effort: refresh the cart count in the header for themes that expose the section
  function refreshCartBubble() {
    var root_ = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    fetch(root_ + '?sections=cart-icon-bubble')
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

  // Spinner on the button while adding, shown for at least MIN_LOADING so it never just flickers
  var MIN_LOADING = 500;
  function loading(on) {
    btn.classList.toggle('is-loading', on);
    if (on) btn.setAttribute('aria-busy', 'true');
    else btn.removeAttribute('aria-busy');
  }

  function add() {
    var v = selectedVariant();
    if (!v || !v.available || busy) return;
    busy = true;
    btn.disabled = true;
    loading(true);
    var started = Date.now();
    function settle(fn) {
      setTimeout(function () { loading(false); fn(); }, Math.max(0, MIN_LOADING - (Date.now() - started)));
    }
    fetch((window.Shopify && window.Shopify.routes ? window.Shopify.routes.root : '/') + 'cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [{ id: v.id, quantity: quantity() }] })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) {
          settle(function () { flash((res.d && (res.d.description || res.d.message)) || 'Could not add', 2500); });
          return;
        }
        document.dispatchEvent(new CustomEvent('boostify:cart-add', { detail: res.d }));
        // Going to another page: keep spinning until it loads
        if (afterAdd === 'cart') { window.location.href = '/cart'; return; }
        if (afterAdd === 'checkout') { window.location.href = '/checkout'; return; }
        refreshCartBubble();
        settle(function () { flash(addedText, 1800); });
      })
      .catch(function () { settle(function () { flash('Could not add', 2500); }); });
  }

  // ---- events ----
  btn.addEventListener('click', add);

  if (qtyInput) {
    var minus = root.querySelector('.boostify-satc__minus');
    var plus = root.querySelector('.boostify-satc__plus');
    minus.addEventListener('click', function () { qtyInput.value = Math.max(1, quantity() - 1); });
    plus.addEventListener('click', function () { qtyInput.value = quantity() + 1; });
    qtyInput.addEventListener('change', function () { qtyInput.value = quantity(); });
  }

  // Follow the theme's own variant picker (themes update ?variant= in the URL)
  function syncFromUrl() {
    var m = window.location.search.match(/[?&]variant=(\d+)/);
    if (!m || !byId[m[1]] || Number(m[1]) === currentId) return;
    currentId = Number(m[1]);
    render();
  }
  window.addEventListener('popstate', syncFromUrl);
  setInterval(syncFromUrl, 700);

  // ---- layout + visibility ----
  function applyCompact() { root.classList.toggle('is-compact', mq.matches); }
  function deviceAllowed() {
    return devices === 'both' || (devices === 'mobile' && mq.matches) || (devices === 'desktop' && !mq.matches);
  }
  function update() {
    var show = deviceAllowed() && (appear === 'always' || pastButton);
    root.classList.toggle('is-visible', show);
  }
  mq.addEventListener ? mq.addEventListener('change', function () { applyCompact(); update(); }) : mq.addListener(function () { applyCompact(); update(); });

  // Show once the theme's own Add to Cart button has scrolled out of view
  function findNativeButton() {
    return document.querySelector(
      'form[action*="/cart/add"] [type="submit"], form[action*="/cart/add"] button[name="add"], product-form button[type="submit"]'
    );
  }

  applyCompact();
  syncFromUrl();
  render();

  if (appear === 'always') {
    update();
  } else {
    var native = findNativeButton();
    if ('IntersectionObserver' in window && native) {
      new IntersectionObserver(function (entries) {
        var e = entries[0];
        pastButton = !e.isIntersecting && e.boundingClientRect.top < 0;
        update();
      }).observe(native);
    } else {
      // No recognisable button: show after the visitor has scrolled a little
      window.addEventListener('scroll', function () {
        pastButton = window.scrollY > 500;
        update();
      }, { passive: true });
    }
  }
})();
