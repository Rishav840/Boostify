(function () {
  // The script tag can appear twice (top embed + section block); only run once per page.
  if (window.__boostifyAB) { window.__boostifyAB(); return; }

  var HEX = /^#[0-9a-f]{3,8}$/i;
  var FONTS = {
    inherit: 'inherit',
    serif: 'Georgia, "Times New Roman", serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  };

  function hex(v, d) { return typeof v === 'string' && HEX.test(v) ? v : d; }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function safeUrl(u) { return typeof u === 'string' && /^(https?:\/\/|\/)/i.test(u) ? u : ''; }
  function parseDate(s) {
    if (!s) return null;
    var d = new Date(String(s).trim().replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function readConfig() {
    var node = document.querySelector('script[data-boostify-config]');
    if (!node) return null;
    try {
      var cfg = JSON.parse(node.textContent);
      return cfg && Array.isArray(cfg.bars) ? cfg : null;
    } catch (e) { return null; }
  }

  function pageType() {
    var node = document.querySelector('script[data-boostify-config]');
    return (node && node.getAttribute('data-page')) || '';
  }

  function isVisible(bar) {
    if (!bar.enabled || !bar.messages || !bar.messages.length) return false;
    if (bar.showOn === 'home' && pageType() !== 'index') return false;
    // Saved as exact moments in the store's time zone; older saves fall back to the visitor's clock
    var now = Date.now();
    var sd = parseDate(bar.start), ed = parseDate(bar.end);
    var s = typeof bar.startUtc === 'number' ? bar.startUtc : (sd ? sd.getTime() : null);
    var e = typeof bar.endUtc === 'number' ? bar.endUtc : (ed ? ed.getTime() : null);
    if ((s !== null && now < s) || (e !== null && now > e)) return false;
    try {
      if (bar.dismissible && sessionStorage.getItem('boostify_ab_' + bar.id)) return false;
    } catch (err) { /* storage blocked */ }
    return true;
  }

  function background(bar) {
    var from = hex(bar.bgFrom, '#111111');
    var to = hex(bar.bgTo, from);
    var base = from === to ? from : 'linear-gradient(' + num(bar.angle, 90) + 'deg,' + from + ',' + to + ')';
    var img = safeUrl(bar.bgImage);
    return img ? 'url("' + img.replace(/"/g, '%22') + '") center / cover no-repeat,' + from : base;
  }

  function messageNodes(m) {
    var nodes = [];
    var link = safeUrl(m.link);
    if (link && !m.buttonText) {
      var a = el('a', 'boostify-ab__text', m.text);
      a.href = link;
      nodes.push(a);
    } else {
      nodes.push(el('span', 'boostify-ab__text', m.text));
      if (link && m.buttonText) {
        var b = el('a', 'boostify-ab__btn', m.buttonText);
        b.href = link;
        nodes.push(b);
      }
    }
    return nodes;
  }

  // Moves from one message to the next straight away (no waiting); direction aware, so "next"
  // enters from the right/bottom and "previous" from the left/top. Clicks use a quicker 0.22s.
  function animateSwap(cur, nxt, dir, mode, ms) {
    if (!cur || !nxt || cur === nxt || !nxt.animate) return;
    var axis = mode === 'slide-x' ? 'X' : 'Y';
    if (cur.getAnimations) cur.getAnimations().forEach(function (a) { a.finish(); });
    if (nxt.getAnimations) nxt.getAnimations().forEach(function (a) { a.finish(); });
    cur.classList.add('is-leaving');
    var out, inn;
    if (mode === 'fade') {
      out = [{ opacity: 1 }, { opacity: 0 }];
      inn = [{ opacity: 0 }, { opacity: 1 }];
    } else {
      out = [{ transform: 'translate' + axis + '(0)', opacity: 1 }, { transform: 'translate' + axis + '(' + (-dir * 100) + '%)', opacity: 0 }];
      inn = [{ transform: 'translate' + axis + '(' + (dir * 100) + '%)', opacity: 0 }, { transform: 'translate' + axis + '(0)', opacity: 1 }];
    }
    var opts = { duration: ms, easing: mode === 'fade' ? 'ease' : 'cubic-bezier(.3,.7,.2,1)' };
    var a = cur.animate(out, opts);
    nxt.animate(inn, opts);
    var done = function () { cur.classList.remove('is-leaving'); };
    a.onfinish = done;
    a.oncancel = done;
  }

  function build(bar, allowSticky) {
    // Compact (the default) trims height, text, spacing; "normal" keeps the sizes exactly as set
    var compact = bar.size !== 'normal';
    var pad = num(bar.padding, 8), fs = num(bar.fontSize, 13), inset = num(bar.inset, 0);
    if (compact) {
      pad = Math.max(4, Math.round(pad * 0.7));
      fs = Math.max(11, Math.round(fs * 0.9 * 10) / 10);
      inset = Math.round(inset * 0.6);
    }
    // Visitors who asked their device for less motion get no scrolling and no auto-rotation
    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var type = reduceMotion && bar.type === 'marquee' ? 'rotate' : bar.type;

    var wrap = el('div', 'boostify-ab-wrap');
    wrap.style.setProperty('--bab-inset', inset + 'px');
    if (allowSticky && bar.sticky) wrap.classList.add('boostify-ab-wrap--sticky');

    var root = el('div', 'boostify-ab boostify-ab--' + type);
    if (compact) root.classList.add('boostify-ab--compact');
    if (bar.uppercase) root.classList.add('boostify-ab--upper');
    if (bar.border) root.classList.add('boostify-ab--border');
    if (bar.shadow) root.classList.add('boostify-ab--shadow');
    if (bar.edgeFade) root.classList.add('boostify-ab--edge');
    if (bar.dismissible) root.classList.add('boostify-ab--dismissible');
    if (bar.btnStyle === 'outline') root.classList.add('boostify-ab--btn-outline');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Announcement');

    var s = root.style;
    s.setProperty('--bab-bg', background(bar));
    s.setProperty('--bab-from', hex(bar.bgFrom, '#111111'));
    s.setProperty('--bab-text', hex(bar.textColor, '#ffffff'));
    s.setProperty('--bab-accent', hex(bar.accentColor, '#ffd24a'));
    s.setProperty('--bab-btn-bg', hex(bar.btnBg, '#ffffff'));
    s.setProperty('--bab-btn-text', hex(bar.btnText, '#111111'));
    s.setProperty('--bab-btn-radius', num(bar.btnRadius, 999) + 'px');
    s.setProperty('--bab-radius', num(bar.radius, 0) + 'px');
    s.setProperty('--bab-font', FONTS[bar.fontFamily] || 'inherit');
    s.setProperty('--bab-size', fs + 'px');
    s.setProperty('--bab-weight', num(bar.fontWeight, 600));
    s.setProperty('--bab-space', num(bar.letterSpacing, 0.5) + 'px');
    s.setProperty('--bab-pad', pad + 'px');
    s.setProperty('--bab-align', bar.align === 'left' ? 'flex-start' : bar.align === 'right' ? 'flex-end' : 'center');
    s.setProperty('--bab-speed', num(bar.speed, 25) + 's');

    var timer = null;

    if (type === 'marquee') {
      var marquee = el('div', 'boostify-ab__marquee');
      var lane = el('div', 'boostify-ab__lane');
      var sep = typeof bar.separator === 'string' ? bar.separator : '';
      // Enough repeats to overflow wide screens, doubled so the -50% loop is seamless
      var reps = Math.max(2, Math.ceil(8 / bar.messages.length));
      var half = [];
      for (var r = 0; r < reps; r++) half = half.concat(bar.messages);
      for (var d = 0; d < 2; d++) {
        half.forEach(function (m) {
          var item = el('span', 'boostify-ab__item');
          messageNodes(m).forEach(function (n) { item.appendChild(n); });
          lane.appendChild(item);
          if (sep) lane.appendChild(el('span', 'boostify-ab__sep', sep));
          else item.style.paddingRight = '36px';
        });
      }
      marquee.appendChild(lane);
      root.appendChild(marquee);
    } else {
      var track = el('div', 'boostify-ab__track');
      var msgs = bar.messages.map(function (m) {
        var node = el('div', 'boostify-ab__msg');
        messageNodes(m).forEach(function (n) { node.appendChild(n); });
        track.appendChild(node);
        return node;
      });
      msgs[0].classList.add('is-active');

      var i = 0;
      // dir: 1 = next, -1 = previous. manual (arrow click / swipe) = quick; automatic = a bit slower
      var show = function (n, dir, manual) {
        var prev = i;
        i = (n + msgs.length) % msgs.length;
        if (prev === i) return;
        msgs.forEach(function (m, idx) {
          m.classList.toggle('is-active', idx === i);
          if (idx !== prev) m.classList.remove('is-leaving');
        });
        if (reduceMotion) { msgs[prev].classList.remove('is-leaving'); return; }
        animateSwap(msgs[prev], msgs[i], dir || 1, bar.animation, manual ? 220 : 450);
      };
      var multi = type === 'rotate' && msgs.length > 1;
      var canRotate = multi && !reduceMotion;
      var stop = function () { if (timer) { clearInterval(timer); timer = null; } };
      var start = function () {
        stop();
        // No work while the tab is in the background
        if (canRotate) timer = setInterval(function () { if (!document.hidden) show(i + 1, 1, false); }, num(bar.interval, 4) * 1000);
      };

      if (multi && bar.arrows) {
        var prevBtn = el('button', 'boostify-ab__nav boostify-ab__nav--prev', '‹');
        var nextBtn = el('button', 'boostify-ab__nav boostify-ab__nav--next', '›');
        prevBtn.type = nextBtn.type = 'button';
        prevBtn.setAttribute('aria-label', 'Previous');
        nextBtn.setAttribute('aria-label', 'Next');
        prevBtn.addEventListener('click', function () { show(i - 1, -1, true); start(); });
        nextBtn.addEventListener('click', function () { show(i + 1, 1, true); start(); });
        root.appendChild(prevBtn);
        root.appendChild(track);
        root.appendChild(nextBtn);
      } else {
        root.appendChild(track);
      }

      start();
      root.addEventListener('mouseenter', stop);
      root.addEventListener('mouseleave', start);
      // Keyboard users can pause it too, by moving focus into the bar
      root.addEventListener('focusin', stop);
      root.addEventListener('focusout', function (e) { if (!root.contains(e.relatedTarget)) start(); });

      // Swipe left / right on a phone to change the message
      if (multi) {
        var tx = 0, ty = 0;
        root.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
        root.addEventListener('touchend', function (e) {
          var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) { show(i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1, true); start(); }
        }, { passive: true });
      }
    }

    if (bar.dismissible) {
      var close = el('button', 'boostify-ab__close', '×');
      close.type = 'button';
      close.setAttribute('aria-label', 'Close announcement');
      close.addEventListener('click', function () {
        wrap.hidden = true;
        if (timer) clearInterval(timer);
        try { sessionStorage.setItem('boostify_ab_' + bar.id, '1'); } catch (err) { /* storage blocked */ }
      });
      root.appendChild(close);
    }

    wrap.appendChild(root);
    return wrap;
  }

  var topDone = false;

  function init() {
    var cfg = readConfig();
    if (!cfg) return;

    // 1) Bars placed "top of every page": needs the app embed switched on.
    var embedOn = !!document.querySelector('script[data-boostify-config][data-mode="embed"]');
    if (embedOn && !topDone) {
      topDone = true;
      var tops = cfg.bars.filter(function (b) { return b.placement !== 'inline' && isVisible(b); });
      for (var k = tops.length - 1; k >= 0; k--) {
        document.body.insertBefore(build(tops[k], true), document.body.firstChild);
      }
    }

    // 2) Bars placed with the "Boostify Bar" block anywhere in a section.
    var slots = document.querySelectorAll('.boostify-ab-slot:not([data-ready])');
    Array.prototype.forEach.call(slots, function (slot) {
      slot.setAttribute('data-ready', '1');
      var bar = cfg.bars[num(slot.getAttribute('data-slot'), 1) - 1];
      if (bar && isVisible(bar)) slot.appendChild(build(bar, false));
    });
  }

  window.__boostifyAB = init;
  init();

  // Theme editor re-renders sections live; pick up newly added blocks.
  document.addEventListener('shopify:section:load', init);
  document.addEventListener('shopify:block:select', init);
})();
