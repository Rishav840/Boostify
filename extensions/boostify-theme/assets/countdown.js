(function () {
  // The script tag can appear twice (app embed + section block); only run once per page.
  if (window.__boostifyCD) { window.__boostifyCD(); return; }

  var HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
  var FONTS = {
    inherit: 'inherit',
    serif: 'Georgia, "Times New Roman", serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  };

  function hex(v, d) { return typeof v === 'string' && HEX.test(v) ? v : d; }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function safeUrl(u) { return typeof u === 'string' && /^(https?:\/\/|\/)/i.test(u) ? u : ''; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var cfg = null, pageType = '';
  var instances = [];
  var tickTimer = null;

  function readConfig() {
    var node = document.querySelector('script[data-boostify-cd]');
    if (!node) return false;
    try { cfg = JSON.parse(node.textContent); } catch (e) { return false; }
    pageType = node.getAttribute('data-page') || '';
    return !!(cfg && Array.isArray(cfg.timers));
  }

  // ---------- when does each timer end? ----------
  function storageKey(t) { return 'boostify_cd_' + t.id + '_' + t.durationMin; }

  function endOf(t, now) {
    if (t.mode === 'evergreen') {
      var start = null;
      try { start = Number(localStorage.getItem(storageKey(t))); } catch (e) { /* storage blocked */ }
      if (!start || !isFinite(start)) {
        start = now;
        try { localStorage.setItem(storageKey(t), String(start)); } catch (e) { /* storage blocked */ }
      }
      return start + num(t.durationMin, 120) * 60000;
    }
    if (t.mode === 'daily') {
      var parts = String(t.dailyTime || '23:59').split(':');
      var d = new Date(now);
      d.setHours(num(parts[0], 23), num(parts[1], 59), 0, 0);
      if (d.getTime() <= now) d.setDate(d.getDate() + 1);
      return d.getTime();
    }
    return typeof t.deadlineUtc === 'number' ? t.deadlineUtc : null; // fixed
  }

  function shouldShow(t, now) {
    if (!t.enabled) return false;
    if (typeof t.showFromUtc === 'number' && now < t.showFromUtc) return false;
    if (t.place === 'bar') {
      if (t.showOn === 'home' && pageType !== 'index') return false;
      if (t.showOn === 'product' && pageType !== 'product') return false;
    }
    return endOf(t, now) !== null;
  }

  // ---------- building ----------
  var UNITS = [
    { key: 'days', needs: function (t) { return t.showDays; } },
    { key: 'hours', needs: function () { return true; } },
    { key: 'minutes', needs: function () { return true; } },
    { key: 'seconds', needs: function (t) { return t.showSeconds; } }
  ];

  function build(t, kind) {
    var wrap = el('div', 'boostify-cd-wrap boostify-cd-wrap--' + kind);
    wrap.style.setProperty('--cd-inset', num(t.inset, 0) + 'px');
    if (kind === 'bar' && t.sticky) wrap.classList.add('boostify-cd-wrap--sticky');

    var root = el('div', 'boostify-cd boostify-cd--' + (t.layout || 'inline'));
    if (t.uppercase) root.classList.add('boostify-cd--upper');
    if (t.border) root.classList.add('boostify-cd--border');
    if (t.shadow) root.classList.add('boostify-cd--shadow');
    if (!t.showLabels) root.classList.add('boostify-cd--nolabels');
    root.setAttribute('role', 'timer');

    var bg = hex(t.bgFrom, '#111111');
    var to = hex(t.bgTo, bg);
    var s = root.style;
    s.setProperty('--cd-bg', bg === to ? bg : 'linear-gradient(' + num(t.angle, 90) + 'deg,' + bg + ',' + to + ')');
    s.setProperty('--cd-text', hex(t.textColor, '#ffffff'));
    s.setProperty('--cd-digit-bg', hex(t.digitBg, '#ffffff22'));
    s.setProperty('--cd-digit', hex(t.digitColor, '#ffffff'));
    s.setProperty('--cd-label', hex(t.labelColor, '#ffffffaa'));
    s.setProperty('--cd-accent', hex(t.accentColor, '#ffd24a'));
    s.setProperty('--cd-btn-bg', hex(t.btnBg, '#ffffff'));
    s.setProperty('--cd-btn-text', hex(t.btnText, '#111111'));
    s.setProperty('--cd-btn-radius', num(t.btnRadius, 999) + 'px');
    s.setProperty('--cd-radius', num(t.radius, 0) + 'px');
    s.setProperty('--cd-font', FONTS[t.fontFamily] || 'inherit');
    s.setProperty('--cd-size', num(t.fontSize, 15) + 'px');
    s.setProperty('--cd-weight', num(t.fontWeight, 700));
    s.setProperty('--cd-pad', num(t.padding, 10) + 'px');
    s.setProperty('--cd-align', t.align === 'left' ? 'flex-start' : t.align === 'right' ? 'flex-end' : 'center');

    if (t.title) root.appendChild(el('div', 'boostify-cd__title', t.title));

    var units = el('div', 'boostify-cd__units');
    var nums = {};
    var first = true;
    UNITS.forEach(function (u) {
      if (!u.needs(t)) return;
      if (!first) units.appendChild(el('span', 'boostify-cd__sep', ':'));
      first = false;
      var unit = el('div', 'boostify-cd__unit');
      var n = el('span', 'boostify-cd__num', '00');
      unit.appendChild(n);
      if (t.showLabels) unit.appendChild(el('span', 'boostify-cd__label', (t.labels && t.labels[u.key]) || u.key));
      units.appendChild(unit);
      nums[u.key] = n;
    });
    root.appendChild(units);

    var link = safeUrl(t.buttonLink);
    if (t.buttonText && link) {
      var a = el('a', 'boostify-cd__btn', t.buttonText);
      a.href = link;
      root.appendChild(a);
    }
    root.appendChild(el('div', 'boostify-cd__expired', t.expiredText || ''));

    wrap.appendChild(root);
    return { t: t, wrap: wrap, root: root, nums: nums, end: null, expired: false };
  }

  function update(inst, now) {
    var t = inst.t;
    if (inst.end === null) inst.end = endOf(t, now);
    var rem = inst.end - now;

    if (rem <= 0 && t.mode === 'daily') { inst.end = endOf(t, now); rem = inst.end - now; }

    if (rem <= 0) {
      if (!inst.expired) {
        inst.expired = true;
        inst.root.classList.add('is-expired');
        inst.root.classList.remove('is-urgent');
        if (t.expiredAction === 'hide') inst.wrap.hidden = true;
      }
      return;
    }

    var total = Math.floor(rem / 1000);
    var days = Math.floor(total / 86400);
    var hours = Math.floor((total % 86400) / 3600) + (t.showDays ? 0 : days * 24);
    var minutes = Math.floor((total % 3600) / 60);
    var seconds = total % 60;
    if (inst.nums.days) inst.nums.days.textContent = pad2(days);
    if (inst.nums.hours) inst.nums.hours.textContent = pad2(hours);
    if (inst.nums.minutes) inst.nums.minutes.textContent = pad2(minutes);
    if (inst.nums.seconds) inst.nums.seconds.textContent = pad2(seconds);

    var urgent = num(t.urgentMinutes, 0) > 0 && rem <= num(t.urgentMinutes, 0) * 60000;
    inst.root.classList.toggle('is-urgent', urgent);
  }

  function tick() {
    var now = Date.now();
    instances = instances.filter(function (i) { return document.body.contains(i.wrap); });
    instances.forEach(function (i) { update(i, now); });
  }

  function mount(t, kind, place) {
    var inst = build(t, kind);
    place(inst.wrap);
    instances.push(inst);
    update(inst, Date.now());
    return inst;
  }

  // ---------- placement ----------
  var topDone = false;
  function init() {
    if (!readConfig()) return;
    var now = Date.now();

    // Timers placed as a bar: just below any announcement bars at the top of the page
    var embedOn = !!document.querySelector('script[data-boostify-cd][data-mode="embed"]');
    if (embedOn && !topDone) {
      topDone = true;
      var bars = cfg.timers.filter(function (t) { return t.place === 'bar' && shouldShow(t, now); });
      var anchor = document.body.firstChild;
      // skip announcement bars and the blank text a page may start with
      while (anchor && ((anchor.nodeType === 1 && anchor.classList.contains('boostify-ab-wrap')) || (anchor.nodeType === 3 && !anchor.textContent.trim()))) anchor = anchor.nextSibling;
      bars.forEach(function (t) {
        mount(t, 'bar', function (w) { document.body.insertBefore(w, anchor); });
      });
    }

    // Timers placed with the Boostify Timer block (product page or anywhere)
    var slots = document.querySelectorAll('.boostify-cd-slot:not([data-ready])');
    Array.prototype.forEach.call(slots, function (slot) {
      slot.setAttribute('data-ready', '1');
      var t = cfg.timers[num(slot.getAttribute('data-slot'), 1) - 1];
      if (t && t.enabled && shouldShow(Object.assign({}, t, { place: 'block' }), Date.now())) {
        mount(t, 'block', function (w) { slot.appendChild(w); });
      }
    });

    if (!tickTimer && instances.length) tickTimer = setInterval(tick, 1000);
  }

  window.__boostifyCD = init;
  init();

  // Theme editor re-renders sections live; pick up newly added blocks.
  document.addEventListener('shopify:section:load', init);
  document.addEventListener('shopify:block:select', init);
})();
