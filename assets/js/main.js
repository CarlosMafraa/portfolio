/* Carlos Mafra — portfólio. JS sem dependências: tema, menu mobile, animações e mapa mental. */
(function () {
  "use strict";

  var root = document.documentElement;

  /* ---- tema claro/escuro ---- */
  var toggle = document.querySelector(".theme-toggle");

  function currentTheme() {
    return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function syncToggle() {
    if (!toggle) return;
    var dark = currentTheme() === "dark";
    toggle.setAttribute("aria-pressed", String(dark));
    toggle.setAttribute("title", dark ? "Mudar para o tema claro" : "Mudar para o tema escuro");
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#050505" : "#f6f5f1");
    syncToggle();
  }

  // escolha manual: fica salva e passa a valer em vez do horário
  function setTheme(theme) {
    try { localStorage.setItem("cm-theme", theme); } catch (e) {}
    applyTheme(theme);
  }

  // Troca de tema com View Transitions, sempre a partir do botão:
  //  - indo para o escuro, a escuridão se EXPANDE a partir do botão;
  //  - voltando para o claro, a escuridão se RECOLHE para dentro do botão.
  // Navegador sem suporte ou prefers-reduced-motion: troca direto, sem animação.
  function switchTheme(from) {
    var next = currentTheme() === "dark" ? "light" : "dark";
    var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || calm) { setTheme(next); return; }
    var b = from.getBoundingClientRect();
    var x = b.left + b.width / 2, y = b.top + b.height / 2;
    var radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    var at = " at " + x + "px " + y + "px)";
    var small = "circle(0px" + at, big = "circle(" + radius + "px" + at;
    var toDark = next === "dark";
    root.classList.add("theme-switching");
    root.classList.toggle("theme-to-light", !toDark);
    var t = document.startViewTransition(function () { setTheme(next); });
    var clip;
    t.ready.then(function () {
      clip = root.animate(
        { clipPath: toDark ? [small, big] : [big, small] },
        {
          // a expansão começa devagar, para a escuridão nascer visivelmente do botão
          // (um ease-out forte cobria metade da tela já nos primeiros frames)
          duration: toDark ? 700 : 550,
          easing: toDark ? "cubic-bezier(.45, 0, .25, 1)" : "cubic-bezier(.7, 0, .84, 0)",
          fill: "forwards",
          // no escuro anima a página nova (escura) crescendo; no claro, a antiga (escura) encolhendo
          pseudoElement: toDark ? "::view-transition-new(root)" : "::view-transition-old(root)"
        }
      );
    }).catch(function () {});
    // o fill "forwards" segura o último frame até a transição acabar; depois precisa ser
    // cancelado, senão o recorte final (circle(0px) no old) fica valendo na PRÓXIMA troca
    // e esconde a página antiga inteira: a tela apagava de uma vez em vez de sair do botão
    function done() {
      if (clip) clip.cancel();
      root.classList.remove("theme-switching", "theme-to-light");
    }
    t.finished.then(done, done);
  }

  if (toggle) {
    syncToggle();
    toggle.addEventListener("click", function () { switchTheme(toggle); });
  }

  /* Sem escolha salva, o tema segue o horário de Brasília também com a página aberta:
     vira sozinho às 06:01 e às 18:01 (confere a cada minuto e ao voltar para a aba). */
  function followClock() {
    var stored;
    try { stored = localStorage.getItem("cm-theme"); } catch (err) {}
    if (stored === "light" || stored === "dark" || !window.cmClockTheme) return;
    var t = window.cmClockTheme();
    if (t !== currentTheme()) applyTheme(t);
  }
  setInterval(followClock, 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) followClock(); });

  /* ---- menu mobile ---- */
  var header = document.querySelector(".site-header");
  var navToggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("nav-primary");

  function closeNav() {
    if (!header) return;
    header.classList.remove("is-open");
    if (navToggle) {
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Abrir menu");
    }
  }

  if (navToggle && header) {
    navToggle.addEventListener("click", function () {
      var open = header.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    });
  }

  if (nav) {
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") closeNav();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeNav();
  });

  /* ---- ano no rodapé (se houver marcador) ---- */
  var y = document.querySelector("[data-year]");
  if (y) y.textContent = String(new Date().getFullYear());

  /* =======================================================
     Movimento. Com prefers-reduced-motion, tudo aparece no
     estado final e nada fica animando.
     ======================================================= */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasIO = "IntersectionObserver" in window;

  /* ---- entrada no scroll ---- */
  var REVEAL = [
    ".hero__text > *", ".hero__visual",
    ".metric", ".section__head", ".section__title", ".section__intro", ".subhead",
    ".bento--sobre > *", ".trace", ".skillmap-win", ".skills > *",
    ".practice", ".pcard", ".project", ".edu li", ".contact"
  ];

  function onVisible(el) {
    if (el.classList.contains("trace")) el.classList.add("is-visible");
    var h = el.querySelector && el.querySelector(".section__kicker");
    if (h) scramble(h);
    var nums = el.querySelectorAll ? el.querySelectorAll("[data-count]") : [];
    for (var i = 0; i < nums.length; i++) countUp(nums[i]);
  }

  var revealEls = document.querySelectorAll(REVEAL.join(","));
  // stagger entre irmãos que entram juntos
  for (var r = 0; r < revealEls.length; r++) {
    var el = revealEls[r];
    el.setAttribute("data-reveal", "");
    var sib = 0, prev = el.previousElementSibling;
    while (prev) { if (prev.hasAttribute("data-reveal")) sib++; prev = prev.previousElementSibling; }
    el.style.setProperty("--d", String(Math.min(sib, 6)));
  }

  if (reduceMotion || !hasIO) {
    for (var v = 0; v < revealEls.length; v++) revealEls[v].classList.add("is-visible");
  } else {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("is-visible");
        onVisible(en.target);
        revealIO.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    for (var w = 0; w < revealEls.length; w++) revealIO.observe(revealEls[w]);
  }
  root.classList.add("reveal-ready");

  /* ---- contadores ---- */
  function countUp(el) {
    if (el.getAttribute("data-counted")) return;
    el.setAttribute("data-counted", "1");
    var target = parseInt(el.getAttribute("data-count"), 10);
    if (isNaN(target) || reduceMotion) return;
    var t0 = null, dur = 1400;
    el.textContent = "0";
    function step(t) {
      if (t0 === null) t0 = t;
      var k = Math.min((t - t0) / dur, 1);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---- efeito "decrypt" nos títulos de seção ---- */
  var GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/_#$%&";
  function scramble(el) {
    if (reduceMotion || el.getAttribute("data-scrambled")) return;
    el.setAttribute("data-scrambled", "1");
    var final = el.textContent;
    el.setAttribute("aria-label", final);
    var frame = 0, total = 22;
    (function tick() {
      var out = "";
      for (var i = 0; i < final.length; i++) {
        var ch = final[i];
        if (ch === " " || i < (frame / total) * final.length) out += ch;
        else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (++frame <= total) setTimeout(tick, 32);
      else { el.textContent = final; el.removeAttribute("aria-label"); }
    })();
  }

  /* ---- terminal digitando no hero ---- */
  var typer = document.querySelector(".typer");
  if (typer && !reduceMotion) {
    var words = [];
    try { words = JSON.parse(typer.getAttribute("data-words") || "[]"); } catch (e) {}
    if (words.length) {
      var wi = 0, ci = 0, deleting = false;
      typer.textContent = "";
      (function type() {
        var word = words[wi];
        ci += deleting ? -1 : 1;
        typer.textContent = word.slice(0, ci);
        var delay = deleting ? 28 : 55 + Math.random() * 60;
        if (!deleting && ci === word.length) { deleting = true; delay = 1700; }
        else if (deleting && ci === 0) { deleting = false; wi = (wi + 1) % words.length; delay = 350; }
        setTimeout(type, delay);
      })();
    }
  }

  /* ---- scrollspy: a seção atual é a última cujo título já passou de ~1/3 da tela;
          no fim da página, a última seção (senão o Contato nunca ficaria ativo) ---- */
  var spy = [];
  if (nav) {
    nav.querySelectorAll('a[href^="#"]').forEach(function (a) {
      var sec = document.getElementById(a.getAttribute("href").slice(1));
      if (sec) spy.push({ a: a, head: sec.querySelector(".section__head") || sec });
    });
  }
  function updateSpy() {
    if (!spy.length) return;
    var line = window.innerHeight * 0.35, current = null;
    var atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    for (var i = 0; i < spy.length; i++) {
      if (spy[i].head.getBoundingClientRect().top <= line) current = spy[i];
    }
    if (atEnd && current) current = spy[spy.length - 1];
    for (var j = 0; j < spy.length; j++) {
      var on = spy[j] === current;
      spy[j].a.classList.toggle("is-active", on);
      if (on) spy[j].a.setAttribute("aria-current", "location");
      else spy[j].a.removeAttribute("aria-current");
    }
  }

  /* ---- header: progresso de leitura + sombra + scrollspy ---- */
  var progress = document.querySelector(".scroll-progress");
  var ticking = false;
  function onScroll() {
    ticking = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
    if (progress) progress.style.setProperty("--p", p.toFixed(4));
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
    updateSpy();
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  /* ---- rolagem das âncoras: suave, mas curta (o "smooth" nativo demora em página longa) ---- */
  // targetY é uma função e é relida a cada quadro: se o layout mudar durante a rolagem
  // (o menu do celular fechando, fonte terminando de carregar), o destino acompanha.
  // Se a pessoa mexer na rolagem no meio (roda, toque, teclado, outro clique), a animação
  // desiste na hora em vez de brigar com ela.
  var scrollRun = 0;
  function cancelScroll() { scrollRun++; }
  ["wheel", "touchstart", "keydown"].forEach(function (ev) {
    window.addEventListener(ev, cancelScroll, { passive: true });
  });

  function scrollToY(targetY, done) {
    var run = ++scrollRun;
    // durante a animação o navegador não "compensa" mudanças de layout sozinho
    // (scroll anchoring); quem acompanha essas mudanças é o targetY()
    var html = document.documentElement;
    html.style.overflowAnchor = "none";
    var finish = done;
    done = function () { html.style.overflowAnchor = ""; finish(); };
    var start = window.scrollY, dist = targetY() - start;
    var dur = Math.min(650, 260 + Math.abs(dist) * 0.05), t0 = null, settle = 0, lastY = NaN, setY = start;
    function step(t) {
      if (run !== scrollRun) { html.style.overflowAnchor = ""; return; }
      // alguém rolou a página por fora: para aqui
      if (Math.abs(window.scrollY - setY) > 2) { done(); return; }
      if (t0 === null) t0 = t;
      var k = reduceMotion ? 1 : Math.min((t - t0) / dur, 1);
      var e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      var y = targetY();
      window.scrollTo(0, start + (y - start) * e);
      setY = window.scrollY;
      if (k < 1) { requestAnimationFrame(step); return; }
      // chegou: segura no destino até ele parar de mudar por 2 quadros seguidos (máx. +0,5s)
      settle = Math.abs(y - lastY) <= 1 ? settle + 1 : 0;
      lastY = y;
      if (settle < 2 && (t - t0) < dur + 500) { requestAnimationFrame(step); return; }
      done();
    }
    requestAnimationFrame(step);
  }

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var id = a.getAttribute("href").slice(1);
    var target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    var offset = (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) +
                 (parseFloat(getComputedStyle(target).scrollMarginTop) || 0);
    function targetY() {
      if (id === "topo") return 0;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      return Math.max(0, Math.min(max, target.getBoundingClientRect().top + window.scrollY - offset));
    }
    function arrive() {
      if (history.pushState) history.pushState(null, "", "#" + id);
      if (!target.hasAttribute("tabindex") && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) {
        target.setAttribute("tabindex", "-1");
      }
      target.focus({ preventScroll: true });
    }
    // no toque a rolagem fica com o próprio navegador: no Safari do iPhone a rolagem é
    // assíncrona e a animação quadro a quadro achava que "alguém rolou por fora" e desistia
    // logo no início, então o item do menu não levava a lugar nenhum
    if (window.matchMedia("(pointer: coarse)").matches) {
      cancelScroll();
      window.scrollTo({ top: targetY(), behavior: reduceMotion ? "auto" : "smooth" });
      arrive();
      return;
    }
    scrollToY(targetY, arrive);
  });

  /* ---- spotlight que segue o cursor ---- */
  document.querySelectorAll(".card").forEach(function (el) {
    el.addEventListener("pointermove", function (e) {
      var b = el.getBoundingClientRect();
      el.style.setProperty("--mx", (e.clientX - b.left) + "px");
      el.style.setProperty("--my", (e.clientY - b.top) + "px");
    });
  });

  /* ---- abre/fecha suave dos spans da carreira ---- */
  var EASE = "cubic-bezier(.16, 1, .3, 1)";
  document.querySelectorAll("details.span").forEach(function (d) {
    var sum = d.querySelector("summary");
    var body = d.querySelector(".span__body");
    if (!sum || !body || reduceMotion || !body.animate) return;
    sum.addEventListener("click", function (e) {
      e.preventDefault();
      if (d.hasAttribute("data-anim")) return;
      d.setAttribute("data-anim", "");
      var cs = getComputedStyle(body);
      var full = { height: body.scrollHeight + "px", paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, opacity: 1 };
      var shut = { height: "0px", paddingTop: "0px", paddingBottom: "0px", opacity: 0 };
      var opening = !d.open;
      if (opening) {
        d.open = true;
        full.height = body.scrollHeight + "px";
      }
      var anim = body.animate(opening ? [shut, full] : [full, shut], { duration: 420, easing: EASE });
      anim.onfinish = anim.oncancel = function () {
        if (!opening) d.open = false;
        d.removeAttribute("data-anim");
      };
    });
  });

  /* ---- palco da logo inclina com o mouse ---- */
  var stage = document.querySelector(".logo-stage");
  var heroEl = document.querySelector(".hero");
  if (stage && heroEl && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    heroEl.addEventListener("pointermove", function (e) {
      var b = stage.getBoundingClientRect();
      var dx = (e.clientX - (b.left + b.width / 2)) / window.innerWidth;
      var dy = (e.clientY - (b.top + b.height / 2)) / window.innerHeight;
      stage.style.setProperty("--rx", (dx * 24).toFixed(2) + "deg");
      stage.style.setProperty("--ry", (-dy * 24).toFixed(2) + "deg");
    });
    heroEl.addEventListener("pointerleave", function () {
      stage.style.setProperty("--rx", "0deg");
      stage.style.setProperty("--ry", "0deg");
    });
  }

  /* ---- rede de nós no fundo do hero (canvas) ---- */
  var canvas = document.querySelector(".hero__net");
  if (canvas && heroEl && canvas.getContext && !reduceMotion) {
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, nodes = [], rgb = "169, 92, 37";
    var mouse = { x: -9999, y: -9999 };
    var running = false, visible = true, LINK = 130;

    var readColor = function () {
      rgb = getComputedStyle(root).getPropertyValue("--net").trim() || rgb;
    };
    var resize = function () {
      var b = heroEl.getBoundingClientRect();
      W = b.width; H = b.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.min(Math.round(W * H / 16000), 90);
      nodes = [];
      for (var i = 0; i < n; i++) {
        nodes.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35 });
      }
    };
    var draw = function () {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        a.x += a.vx; a.y += a.vy;
        if (a.x < 0 || a.x > W) a.vx *= -1;
        if (a.y < 0 || a.y > H) a.vy *= -1;
        for (var j = i + 1; j < nodes.length; j++) {
          var b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            ctx.strokeStyle = "rgba(" + rgb + "," + (0.16 * (1 - Math.sqrt(d2) / LINK)).toFixed(3) + ")";
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        var mx = a.x - mouse.x, my = a.y - mouse.y, md = Math.sqrt(mx * mx + my * my);
        if (md < 170) {
          ctx.strokeStyle = "rgba(" + rgb + "," + (0.4 * (1 - md / 170)).toFixed(3) + ")";
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
        ctx.fillStyle = "rgba(" + rgb + ",0.55)";
        ctx.fillRect(a.x - 1, a.y - 1, 2, 2);
      }
      requestAnimationFrame(draw);
    };
    var setRunning = function () {
      var should = visible && !document.hidden;
      if (should && !running) { running = true; requestAnimationFrame(draw); }
      else if (!should) running = false;
    };

    readColor(); resize(); setRunning();
    var rz;
    window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(resize, 150); });
    heroEl.addEventListener("pointermove", function (e) {
      var b = heroEl.getBoundingClientRect();
      mouse.x = e.clientX - b.left; mouse.y = e.clientY - b.top;
    });
    heroEl.addEventListener("pointerleave", function () { mouse.x = mouse.y = -9999; });
    document.addEventListener("visibilitychange", setRunning);
    if (hasIO) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; setRunning(); }).observe(heroEl);
    new MutationObserver(readColor).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  }

  /* ---- mapa mental de habilidades (markmap-view + d3) ---- */
  // paleta derivada do cobre da logo, legível no claro e no escuro
  var MM_COLORS = [
    "#c47a42", "#2f9cbf", "#4ea36a", "#b08a3e",
    "#a86a9a", "#3aa39a", "#c2604a", "#8a8f98"
  ];
  var MM_OPTS = {
    color: MM_COLORS,
    colorFreezeLevel: 2,
    maxWidth: 300,
    spacingHorizontal: 64,
    spacingVertical: 8,
    paddingX: 16,
    fitRatio: 0.92,
    duration: 250,
    // sem arrastar e sem zoom: não rouba a rolagem da página. O enquadramento é feito
    // por fitToContent() (abaixo), que mantém o texto legível e ajusta a altura do quadro.
    zoom: false,
    pan: false,
    autoFit: false
  };

  // parser mínimo do outline (#, ##, ###, "- ", "  - ")
  function parseOutline(md) {
    var out = md.replace(/^﻿/, "").replace(/^\s*---\n[\s\S]*?\n---\s*/, "");
    var lines = out.split("\n");
    var rootNode = null;
    var stack = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/\s+$/, "");
      if (!line.trim()) continue;
      var h = line.match(/^(#{1,6})\s+(.+)$/);
      var b = line.match(/^(\s*)-\s+(.+)$/);
      var level, text;
      if (h) { level = h[1].length; text = h[2]; }
      else if (b) { level = 4 + Math.floor(b[1].length / 2); text = b[2]; }
      else continue;
      var node = { content: escapeHtml(text.trim()), children: [], payload: {} };
      if (level === 1 && !rootNode) { rootNode = node; stack = [{ node: node, level: 1 }]; continue; }
      if (!rootNode) continue;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      (stack.length ? stack[stack.length - 1].node : rootNode).children.push(node);
      stack.push({ node: node, level: level });
    }
    return rootNode;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function applyLevel(node, level, depth) {
    node.payload = node.payload || {};
    node.payload.fold = depth >= level ? 1 : 0;
    for (var i = 0; i < (node.children || []).length; i++) {
      applyLevel(node.children[i], level, depth + 1);
    }
  }

  function initSkillMap() {
    var host = document.querySelector(".skillmap");
    var mk = window.markmap;
    if (!host || !mk || !mk.Markmap || !window.d3) return;
    var tpl = host.querySelector('script[type="text/template"]');
    if (!tpl) return;
    var rootNode = parseOutline(tpl.textContent || "");
    if (!rootNode) return;

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    host.insertBefore(svg, host.firstChild);

    var opts = mk.deriveOptions ? mk.deriveOptions(MM_OPTS) : MM_OPTS;
    var mm = mk.Markmap.create(svg, opts);

    // Em vez de encolher o mapa até caber numa altura fixa (texto minúsculo ao abrir tudo),
    // o zoom fica numa faixa legível e o QUADRO muda de altura para caber o mapa inteiro;
    // a página rola normalmente. A altura do CSS vira o mínimo.
    var READ_SCALE = 1;     // tamanho normal do texto (13px), igual ao resto dos detalhes do site
    var MIN_SCALE = 0.92;   // zoom mínimo: o texto nunca fica menor que ~12px
    var fitRatio = MM_OPTS.fitRatio;
    function baseHeight() {
      var prev = host.style.height;
      host.style.height = "";
      var h = host.getBoundingClientRect().height;
      host.style.height = prev;
      return h;
    }
    var minH = baseHeight();
    function fitToContent() {
      var r = mm.state.rect;
      var natW = r.x2 - r.x1, natH = r.y2 - r.y1;
      if (!natW || !natH) return mm.fit();
      var width = host.getBoundingClientRect().width;
      var scale = Math.max(MIN_SCALE, Math.min(READ_SCALE, (width * fitRatio) / natW));
      var needed = Math.ceil((natH * scale) / fitRatio);
      host.style.height = Math.max(minH, needed) + "px";
      return mm.fit(scale);
    }
    // clicar num item para abrir/fechar também passa por aqui
    var renderData = mm.renderData.bind(mm);
    mm.renderData = function () {
      return Promise.resolve(renderData.apply(mm, arguments)).then(fitToContent);
    };

    var DEFAULT_LEVEL = 2;
    function render(level) {
      applyLevel(rootNode, level, 0);
      return mm.setData(rootNode);
    }
    render(DEFAULT_LEVEL);

    var ctrl = document.querySelector(".skillmap-ctrl");
    if (ctrl) {
      var levelBtns = ctrl.querySelectorAll("[data-mm-level]");
      ctrl.addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn) return;
        var lvl = parseInt(btn.getAttribute("data-mm-level"), 10);
        if (isNaN(lvl)) return;
        for (var i = 0; i < levelBtns.length; i++) {
          levelBtns[i].setAttribute("aria-pressed", String(levelBtns[i] === btn));
        }
        render(lvl);
      });
    }

    // reenquadra quando a janela muda (a altura mínima do CSS depende da tela)
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { minH = baseHeight(); fitToContent(); }, 200);
    });
  }

  // o mapa só aparece com mouse em tela larga (mesma regra do CSS); no celular fica a
  // grade de cards e o mapa não é montado, então não rouba o arrastar da rolagem.
  var mapMQ = window.matchMedia("(min-width: 721px) and (pointer: fine)");
  var mapStarted = false;
  function maybeInitSkillMap() {
    if (mapStarted || !mapMQ.matches) return;
    mapStarted = true;
    initSkillMap();
  }
  if (mapMQ.addEventListener) mapMQ.addEventListener("change", maybeInitSkillMap);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", maybeInitSkillMap);
  } else {
    maybeInitSkillMap();
  }
})();
