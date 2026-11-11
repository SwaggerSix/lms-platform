/* Mosaic certification player — single SCO, SCORM 1.2, works offline.
   Course content arrives in course-data.js (lightly obfuscated). */
(function () {
  "use strict";

  // ------------------------------------------------------------ data
  function decode(b64, k64) {
    var bin = atob(b64), key = atob(k64), n = bin.length, out = new Uint8Array(n);
    for (var i = 0; i < n; i++) out[i] = bin.charCodeAt(i) ^ key.charCodeAt(i % key.length) ^ ((i * 7) & 255);
    var s;
    if (window.TextDecoder) s = new TextDecoder("utf-8").decode(out);
    else { var t = ""; for (var j = 0; j < n; j++) t += String.fromCharCode(out[j]); s = decodeURIComponent(escape(t)); }
    return JSON.parse(s);
  }
  var C = decode(window.MOSAIC_COURSE, window.MOSAIC_K);
  var MODS = C.modules, ITEMS = C.items, EX = C.exam;
  // Wording for the hand-in step. A course whose work goes into the Mosaic
  // Practitioner capstone on the LMS (MOS-100, MOS-230, MOS-240) overrides it
  // in course-data.js (C.handIn); MOS-210/220 keep their own practical.
  var HI = C.handIn || {};
  var HAND = {
    navId: HI.navId || "Practical task",
    navTitle: HI.navTitle || "How to submit",
    label: HI.label || "the practical task",
    heading: HI.heading || "Practical task: how to submit",
    notice: HI.notice || "<p>The practical task is marked by hand by Dr. Chris Cancialosi, outside this course. " +
      "This page isn't graded and doesn't collect files: follow the submission instructions below.</p>",
    home: HI.home || "The practical task is marked by Dr. Chris Cancialosi outside this course; the last page explains how to submit it.",
    next: HI.next || "<p>Take the final exam and submit your practical task.</p>",
    nextButton: HI.nextButton || "How to submit the practical"
  };
  var VIDEO_DONE = 90;

  // ------------------------------------------------------------ SCORM 1.2
  var SC = { api: null, preview: true, finished: false, start: Date.now() };
  function findAPI(win) {
    var n = 0;
    try {
      while (win && !win.API && win.parent && win.parent !== win && n < 12) { n++; win = win.parent; }
      return (win && win.API) ? win.API : null;
    } catch (e) { return null; }
  }
  function getAPI() {
    var a = findAPI(window);
    try { if (!a && window.opener) a = findAPI(window.opener); } catch (e) {}
    try { if (!a && window.top && window.top.opener) a = findAPI(window.top.opener); } catch (e) {}
    return a;
  }
  function sget(k) { if (!SC.api) return ""; try { return String(SC.api.LMSGetValue(k) || ""); } catch (e) { return ""; } }
  function sset(k, v) { if (!SC.api) return false; try { return String(SC.api.LMSSetValue(k, String(v))) === "true"; } catch (e) { return false; } }
  function commit() { if (SC.api) { try { SC.api.LMSCommit(""); } catch (e) {} } }
  var LSKEY = "mosaic-scorm-" + C.code;

  function initScorm() {
    var api = getAPI();
    if (api) {
      try {
        var r = String(api.LMSInitialize(""));
        if (r === "true") { SC.api = api; SC.preview = false; }
      } catch (e) {}
    }
  }

  // ------------------------------------------------------------ state
  // v: {modIdx: [pct per video]}, c: [mods with check passed], s: [sims passed], k: [acks],
  // e: {n: attempts used, p: passed 0/1, sc: last score, r: last result summary}, x: exam in progress
  var S = { v: {}, c: [], s: [], k: [], e: { n: 0, p: 0, sc: null, r: null }, x: null };
  var RUNTIME = { unlock: false, check: {}, sim: {}, examTimer: null };

  function loadState() {
    var raw = "";
    if (SC.api) raw = sget("cmi.suspend_data");
    else { try { raw = localStorage.getItem(LSKEY) || ""; } catch (e) {} }
    if (raw) { try { var o = JSON.parse(raw); for (var k in o) S[k] = o[k]; } catch (e) {} }
  }
  var saveTimer = null;
  function saveState(now) {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (!now) { saveTimer = setTimeout(function () { saveState(true); }, 1500); return; }
    var str = JSON.stringify(S);
    if (SC.api) { sset("cmi.suspend_data", str); commit(); }
    else { try { localStorage.setItem(LSKEY, str); } catch (e) {} }
  }
  function setLocation(loc) { if (SC.api) { sset("cmi.core.lesson_location", loc); } }
  function has(arr, i) { return arr.indexOf(i) >= 0; }
  function addTo(arr, i) { if (!has(arr, i)) arr.push(i); }

  // ------------------------------------------------------------ helpers
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]); }
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function announce(msg) { var l = document.getElementById("live"); l.textContent = ""; setTimeout(function () { l.textContent = msg; }, 50); }
  function pctOf(a, b) { return b ? Math.round(100 * a / b) : 0; }

  function videoPct(mi, vi) { var a = S.v[mi]; return a && a[vi] ? a[vi] : 0; }
  function videosDone(mi) { var m = MODS[mi]; for (var i = 0; i < m.videos.length; i++) if (videoPct(mi, i) < VIDEO_DONE) return false; return true; }
  function modDone(mi) {
    var m = MODS[mi];
    if (!videosDone(mi)) return false;
    if (m.ack && !has(S.k, mi)) return false;
    if (m.sim && !has(S.s, mi)) return false;
    if (m.check && !has(S.c, mi)) return false;
    return true;
  }
  function modStarted(mi) { return videoPct(mi, 0) > 0 || has(S.c, mi) || has(S.s, mi) || has(S.k, mi); }
  function modIndex(id) { for (var i = 0; i < MODS.length; i++) if (MODS[i].id === id) return i; return -1; }
  function missingPrereqs(mi) {
    var out = [], p = MODS[mi].prereq || [];
    for (var i = 0; i < p.length; i++) { var j = modIndex(p[i]); if (j >= 0 && !modDone(j)) out.push(MODS[j]); }
    return out;
  }
  function requiredForExam() { var r = []; for (var i = 0; i < MODS.length; i++) if (!MODS[i].final) r.push(i); return r; }
  function examUnlocked() {
    if (RUNTIME.unlock) return true;
    var r = requiredForExam();
    for (var i = 0; i < r.length; i++) if (!modDone(r[i])) return false;
    return true;
  }

  // ------------------------------------------------------------ status
  function updateLessonStatus() {
    if (!SC.api) return;
    var st = sget("cmi.core.lesson_status");
    if (S.e.p) { if (st !== "passed") sset("cmi.core.lesson_status", "passed"); }
    else if (S.e.n >= EX.attempts && S.e.sc !== null && !S.x) { if (st !== "failed") sset("cmi.core.lesson_status", "failed"); }
    else if (st === "failed") sset("cmi.core.lesson_status", "incomplete");
    else if (st === "" || st === "not attempted" || st === "browsed") sset("cmi.core.lesson_status", "incomplete");
  }

  // ------------------------------------------------------------ navigation
  var current = "home";
  function navItems() {
    var list = [{ key: "home", id: "", title: "Welcome", sub: "" }];
    for (var i = 0; i < MODS.length; i++) {
      var m = MODS[i];
      list.push({ key: "m:" + i, id: m.id, title: m.title, mi: i });
    }
    list.push({ key: "exam", id: "Final exam", title: EX.total + " questions · " + EX.time + " min", exam: true });
    list.push({ key: "practical", id: HAND.navId, title: HAND.navTitle, practical: true });
    return list;
  }
  function renderNav() {
    var nav = document.getElementById("nav");
    var ol = el("ol");
    navItems().forEach(function (it) {
      var li = el("li");
      if (it.exam) li.appendChild(el("div", { "class": "sep", "aria-hidden": "true" }));
      var b = el("button", { type: "button", "class": "navbtn", "data-key": it.key });
      if (it.key === current) b.setAttribute("aria-current", "page");
      var st = "", stTxt = "", cls = "st";
      if (it.mi !== undefined) {
        var locked = missingPrereqs(it.mi).length > 0;
        if (modDone(it.mi)) { cls += " done"; st = "✓"; stTxt = "Complete"; }
        else if (locked) { cls += " lock"; stTxt = "Locked"; }
        else if (modStarted(it.mi)) { cls += " prog"; stTxt = "In progress"; }
        else stTxt = "Not started";
      } else if (it.exam) {
        if (S.e.p) { cls += " done"; st = "✓"; stTxt = "Passed"; }
        else if (!examUnlocked()) { cls += " lock"; stTxt = "Locked"; }
        else if (S.e.n >= EX.attempts) { stTxt = "Attempts used"; }
        else stTxt = S.e.n ? "Attempt " + S.e.n + " of " + EX.attempts + " used" : "Available";
      } else if (it.practical) { stTxt = "Marked by your assessor"; }
      else { stTxt = ""; }
      var inner = '<span class="' + cls + '" aria-hidden="true">' + st + '</span><span class="lbl">' +
        (it.id ? '<span class="mid">' + esc(it.id) + '</span>' : "") +
        '<span class="mt">' + esc(it.title) + '</span>' +
        (stTxt ? '<span class="ms">' + esc(stTxt) + '</span>' : "") + "</span>";
      b.innerHTML = inner;
      b.addEventListener("click", function () { go(it.key); closeNavMobile(); });
      li.appendChild(b);
      ol.appendChild(li);
    });
    nav.innerHTML = "";
    nav.appendChild(ol);
  }
  function closeNavMobile() { var n = document.getElementById("nav"); n.classList.remove("open"); document.getElementById("navtoggle").setAttribute("aria-expanded", "false"); }

  function go(key, noFocus) {
    stopVideos();
    current = key;
    setLocation(key);
    saveState(true);
    render();
    if (!noFocus) {
      var h = document.querySelector("#main h1, #main h2");
      if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
      window.scrollTo(0, 0);
    }
  }
  function stopVideos() { var vs = document.querySelectorAll("video"); for (var i = 0; i < vs.length; i++) { try { vs[i].pause(); } catch (e) {} } }

  function render() {
    renderNav();
    var main = document.getElementById("main");
    main.innerHTML = "";
    if (current === "home") renderHome(main);
    else if (current.indexOf("m:") === 0) renderModule(main, parseInt(current.slice(2), 10));
    else if (current === "exam") renderExam(main);
    else if (current === "practical") renderPractical(main);
    else renderHome(main);
  }

  // ------------------------------------------------------------ home
  function nextKey() {
    for (var i = 0; i < MODS.length; i++) if (!MODS[i].final && !modDone(i) && !missingPrereqs(i).length) return "m:" + i;
    if (examUnlocked() && !S.e.p && S.e.n < EX.attempts) return "exam";
    for (var j = 0; j < MODS.length; j++) if (MODS[j].final) return "m:" + j;
    return "practical";
  }
  function renderHome(main) {
    var done = 0, req = requiredForExam();
    req.forEach(function (i) { if (modDone(i)) done++; });
    var h = '<p class="kicker">' + esc(C.code) + "</p><h1>" + esc(C.title) + "</h1>" +
      '<p class="credit">' + esc(C.credit) + "</p>";
    h += '<div class="card"><h2>How this course works</h2><ul>' +
      "<li>Each module has a video, then a module check. Watch at least 90% of the video to open the check.</li>" +
      "<li>A module is complete when its video is watched and its check is passed" +
      (MODS.some(function (m) { return m.sim; }) ? " (plus its simulation, where there is one)" : "") +
      ". Checks draw fresh questions each time, and you can retake them as often as you like.</li>" +
      "<li>The final exam opens when every module before the practical module is complete.</li>" +
      "<li>" + esc(HAND.home) + "</li>" +
      "<li>Captions are on by default. Use the Captions button under each video to turn them off or on.</li></ul></div>";
    h += '<div class="card"><h2>Your progress</h2><p>' + done + " of " + req.length + " modules complete. " +
      (S.e.p ? '<span class="status ok">Final exam passed</span>' : (S.e.n ? "Final exam attempts used: " + S.e.n + " of " + EX.attempts + "." : "Final exam not yet taken.")) +
      '</p><button type="button" class="btn" id="cont">' + (done || S.e.n ? "Continue" : "Start the course") + "</button></div>";
    main.innerHTML = h;
    document.getElementById("cont").addEventListener("click", function () { go(nextKey()); });
  }

  // ------------------------------------------------------------ module
  function renderModule(main, mi) {
    var m = MODS[mi];
    main.appendChild(pagerBlock(mi));
    main.appendChild(el("p", { "class": "kicker" }, esc(m.id)));
    main.appendChild(el("h1", null, esc(m.title)));
    var miss = missingPrereqs(mi);
    if (miss.length) {
      main.appendChild(el("div", { "class": "notice" }, "<p>This module opens when you've completed: " +
        miss.map(function (x) { return "<strong>" + esc(x.id + " " + x.title) + "</strong>"; }).join(", ") + ".</p>"));
      return;
    }
    var stat = el("p");
    stat.innerHTML = modDone(mi) ? '<span class="status ok">✓ Module complete</span>' : '<span class="status wait">In progress</span>';
    main.appendChild(stat);

    // A note from the course data above the video (e.g. where what the
    // narration describes has since changed).
    if (m.note) main.appendChild(el("div", { "class": "notice" }, m.note));
    // videos
    if (!m.videos.length) main.appendChild(el("div", { "class": "notice" }, "<p>No video for this module.</p>"));
    m.videos.forEach(function (v, vi) { main.appendChild(videoBlock(mi, vi, v, m.videos.length)); });
    var actList = activitiesList(mi);
    if (actList) main.appendChild(actList);

    var after = el("div", { id: "after-video" });
    main.appendChild(after);
    renderModuleActivities(after, mi);

    var ns = el("div", { id: "next-step" });
    main.appendChild(ns);
    renderNextStep(ns, mi);

    if (m.final) {
      var c = el("div", { "class": "card" });
      c.innerHTML = "<h2>Next steps</h2>" + HAND.next;
      var b1 = el("button", { type: "button", "class": "btn" }, "Go to the final exam");
      b1.addEventListener("click", function () { go("exam"); });
      var b2 = el("button", { type: "button", "class": "btn secondary" }, esc(HAND.nextButton));
      b2.addEventListener("click", function () { go("practical"); });
      c.appendChild(b1); c.appendChild(b2);
      main.appendChild(c);
    }
  }

  // ------------------------------------------------------------ moving on
  // Learners shouldn't have to find the module list to move forward: every
  // module ends with a "Continue to <next>" button, and a pager sits on top.
  function keyLabel(key) {
    if (key === "exam") return "the final exam";
    if (key === "practical") return HAND.label;
    if (key.indexOf("m:") === 0) { var m = MODS[parseInt(key.slice(2), 10)]; return m.id + ": " + m.title; }
    return "the course home";
  }
  function forwardKey(mi) {
    // The next module in order, unless it is still locked; then wherever the
    // learner should go next.
    var n = mi + 1;
    if (n < MODS.length && !missingPrereqs(n).length) return "m:" + n;
    var k = nextKey();
    return k === "m:" + mi ? null : k;
  }
  function remainingSteps(mi) {
    var m = MODS[mi], out = [];
    if (!videosDone(mi)) out.push("Watch at least 90% of the video" + (m.videos.length > 1 ? "s" : ""));
    if (m.ack && !has(S.k, mi)) out.push("Read " + esc(m.ack.title) + " and tick the box to confirm");
    if (m.sim && !has(S.s, mi)) out.push("Complete the simulation");
    if (m.check && !has(S.c, mi)) out.push("Pass the module check");
    return out;
  }
  function pagerBlock(mi) {
    var bar = el("nav", { "class": "pager", "aria-label": "Module navigation" });
    var prev = el("button", { type: "button", "class": "pgbtn" }, "&larr; " + (mi > 0 ? esc(MODS[mi - 1].id) : "Welcome"));
    prev.addEventListener("click", function () { go(mi > 0 ? "m:" + (mi - 1) : "home"); });
    bar.appendChild(prev);
    bar.appendChild(el("span", { "class": "pgpos" }, esc(MODS[mi].id) + " of " + esc(MODS[MODS.length - 1].id)));
    if (mi + 1 < MODS.length) {
      var nk = "m:" + (mi + 1), locked = missingPrereqs(mi + 1).length > 0;
      var next = el("button", { type: "button", "class": "pgbtn" }, esc(MODS[mi + 1].id) + " &rarr;");
      if (locked) { next.disabled = true; next.title = "Opens when the modules before it are complete"; }
      next.addEventListener("click", function () { go(nk); });
      bar.appendChild(next);
    } else bar.appendChild(el("span"));
    return bar;
  }
  function renderNextStep(box, mi) {
    box.innerHTML = "";
    var m = MODS[mi];
    if (m.final || missingPrereqs(mi).length) return;
    var c;
    if (modDone(mi)) {
      var fk = forwardKey(mi);
      if (!fk) return;
      c = el("section", { "class": "card nextcard", "aria-labelledby": "next-h" });
      c.innerHTML = '<h2 id="next-h">\u2713 ' + esc(m.id) + ' complete</h2><p>Up next: <strong>' + esc(keyLabel(fk)) + "</strong></p>";
      var b = el("button", { type: "button", "class": "btn big" }, "Continue to " + esc(keyLabel(fk)) + " &rarr;");
      b.addEventListener("click", function () { go(fk); });
      c.appendChild(b);
    } else {
      var steps = remainingSteps(mi);
      c = el("section", { "class": "card todo", "aria-labelledby": "next-h" });
      c.innerHTML = '<h2 id="next-h">To finish ' + esc(m.id) + "</h2><ol>" +
        steps.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ol>" +
        "<p>When you've done " + (steps.length > 1 ? "these" : "this") + ", a <strong>Continue</strong> button appears here.</p>";
    }
    box.appendChild(c);
  }
  function refreshNextStep(mi) {
    var box = document.getElementById("next-step");
    var wasDone = box && box.querySelector(".nextcard");
    if (box) renderNextStep(box, mi);
    var now = box && box.querySelector(".nextcard");
    if (now && !wasDone) {
      announce(MODS[mi].id + " complete. Use the Continue button to go on.");
      try { now.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) { now.scrollIntoView(); }
    }
  }

  function renderModuleActivities(box, mi) {
    var m = MODS[mi];
    box.innerHTML = "";
    if (m.ack) box.appendChild(ackBlock(mi));
    if (!m.sim && !m.check) {
      if (!m.ack && !m.final) box.appendChild(el("p", null, "This module has no check. It's complete once you've watched the video."));
      return;
    }
    if (!videosDone(mi)) {
      box.appendChild(el("div", { "class": "notice" }, "<p>Watch at least 90% of the video" + (m.videos.length > 1 ? "s" : "") +
        " to open " + (m.sim ? "the simulation and " : "") + "the module check.</p>"));
      return;
    }
    if (m.sim) box.appendChild(simBlock(mi));
    if (m.check) box.appendChild(checkBlock(mi));
  }

  function refreshModule(mi) {
    if (current !== "m:" + mi) return;
    var box = document.getElementById("after-video");
    if (box) renderModuleActivities(box, mi);
    var stat = document.querySelector("#main > p:nth-of-type(2)");
    if (stat) stat.innerHTML = modDone(mi) ? '<span class="status ok">✓ Module complete</span>' : '<span class="status wait">In progress</span>';
    renderNav();
    refreshNextStep(mi);
  }

  function videoBlock(mi, vi, v, count) {
    var wrap = el("section", { "class": "vwrap", "aria-label": "Video" + (count > 1 ? " part " + (vi + 1) : "") });
    if (count > 1) wrap.appendChild(el("h2", null, "Video, part " + (vi + 1) + " of " + count));
    var video = el("video", { controls: "", preload: "metadata", playsinline: "", crossorigin: null, "data-mi": mi, "data-vi": vi,
      "aria-label": MODS[mi].title + (count > 1 ? ", part " + (vi + 1) : "") });
    video.appendChild(el("source", { src: v.src, type: "video/mp4" }));
    if (v.vtt) video.appendChild(el("track", { kind: "captions", src: v.vtt, srclang: "en", label: "English", "default": "" }));
    wrap.appendChild(video);
    var bar = el("div", { "class": "vbar" });
    var cc = el("button", { type: "button", "class": "btn secondary", "aria-pressed": "true" }, "Captions: on");
    if (!v.vtt) { cc.disabled = true; cc.textContent = "No captions"; }
    var meter = el("div", { "class": "meter", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": "Watched" });
    var fill = el("span"); meter.appendChild(fill);
    var txt = el("span");
    bar.appendChild(cc); bar.appendChild(meter); bar.appendChild(txt);
    wrap.appendChild(bar);
    wireVideoActivities(video, wrap, mi, v.label);
    var capsOn = true;
    function applyCaps() {
      for (var i = 0; i < video.textTracks.length; i++) video.textTracks[i].mode = capsOn ? "showing" : "hidden";
    }
    cc.addEventListener("click", function () {
      capsOn = !capsOn; applyCaps();
      cc.setAttribute("aria-pressed", capsOn ? "true" : "false");
      cc.textContent = "Captions: " + (capsOn ? "on" : "off");
    });
    video.addEventListener("loadedmetadata", applyCaps);
    setTimeout(applyCaps, 0);
    function show() {
      var p = videoPct(mi, vi);
      fill.style.width = p + "%";
      meter.setAttribute("aria-valuenow", String(p));
      meter.className = "meter" + (p >= VIDEO_DONE ? " done" : "");
      txt.textContent = p >= VIDEO_DONE ? "Watched ✓" : "Watched " + p + "% (90% needed)";
    }
    function track(force) {
      var d = video.duration;
      if (!d || !isFinite(d)) return;
      var p = force ? 100 : Math.min(100, Math.floor(100 * video.currentTime / d + 0.0001));
      var before = videoPct(mi, vi);
      if (p > before) {
        if (!S.v[mi]) S.v[mi] = [];
        while (S.v[mi].length <= vi) S.v[mi].push(0);
        S.v[mi][vi] = p;
        show();
        var crossed = before < VIDEO_DONE && p >= VIDEO_DONE;
        saveState(crossed || force);
        if (crossed) { announce("Video watched. " + (MODS[mi].check ? "The module check is open." : "")); refreshModule(mi); }
      }
    }
    video.addEventListener("timeupdate", function () { track(false); });
    video.addEventListener("seeked", function () { track(false); });
    video.addEventListener("ended", function () { track(true); });
    show();
    return wrap;
  }

  function ackBlock(mi) {
    var a = MODS[mi].ack;
    var c = el("section", { "class": "card", "aria-labelledby": "ackh" });
    c.innerHTML = '<h2 id="ackh">' + esc(a.title) + '</h2><div class="code">' + a.code + "</div>" + a.prompt;
    var lab = el("label", { "class": "ackrow" });
    var cb = el("input", { type: "checkbox", id: "ackbox" });
    cb.checked = has(S.k, mi);
    lab.appendChild(cb);
    lab.appendChild(el("span", null, esc(a.label)));
    c.appendChild(lab);
    cb.addEventListener("change", function () {
      if (cb.checked) addTo(S.k, mi); else S.k.splice(S.k.indexOf(mi), 1);
      saveState(true); renderNav();
      var stat = document.querySelector("#main > p:nth-of-type(2)");
      if (stat) stat.innerHTML = modDone(mi) ? '<span class="status ok">✓ Module complete</span>' : '<span class="status wait">In progress</span>';
      announce(cb.checked ? "Acknowledged." : "Acknowledgement removed.");
      refreshNextStep(mi);
    });
    return c;
  }

  // ------------------------------------------------------------ practice activities
  // The in-video activities (warm-ups, scenarios, sorting, quick checks,
  // practice cases). They arrive in activities.js; a course without it simply
  // has none. The video pauses at each one (t = seconds into that video), and
  // every module lists its activities after the video so they can be redone.
  // Practice only: nothing here is scored, saved or required.
  var ACTS = [];
  (function loadActs() {
    if (!window.MOSAIC_ACTS) return;
    try { ACTS = decode(window.MOSAIC_ACTS, window.MOSAIC_K) || []; } catch (e) { ACTS = []; return; }
    var byId = {};
    for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id) byId[ITEMS[i].id] = i;
    ACTS.forEach(function (a) {
      a.q = [];
      (a.items || []).forEach(function (it) {
        if (it.ref) { if (byId[it.ref] !== undefined) a.q.push(byId[it.ref]); }
        else if (it.k === "open") a.q.push({ open: it });
        else { it.act = true; ITEMS.push(it); a.q.push(ITEMS.length - 1); }
      });
    });
  })();
  function actsFor(mi, label) {
    return ACTS.filter(function (a) { return a.mod === MODS[mi].id && (!label || a.video === label); })
      .sort(function (x, y) { return (x.video || "") === (y.video || "") ? x.t - y.t : ((x.video || "") < (y.video || "") ? -1 : 1); });
  }
  function isReveal(it) {
    // A warm-up with one reveal for every choice has no right answer to grade.
    if (it.k !== "mcq" || !it.f) return false;
    var seen = null;
    for (var i = 0; i < it.o.length; i++) { var f = it.f[String(i)]; if (!f) return false; if (seen === null) seen = f; else if (f !== seen) return false; }
    return true;
  }
  function activityCard(a, where) {
    var pre = (where + "-" + a.id).replace(/[^A-Za-z0-9-]/g, "");
    var c = el("section", { "class": "card act", "aria-labelledby": pre + "-h" });
    c.appendChild(el("p", { "class": "kicker" }, "Practice activity · not graded"));
    c.appendChild(el("h3", { id: pre + "-h", tabindex: "-1" }, esc(a.title)));
    if (a.intro) c.appendChild(el("div", { "class": "actintro" }, a.intro));
    var total = a.q.length;
    a.q.forEach(function (q, n) {
      if (q && q.open) {
        var it = q.open, box = el("div", { "class": "q openq" });
        if (total > 1) box.appendChild(el("p", { "class": "ms" }, "<strong>Part " + (n + 1) + " of " + total + "</strong>"));
        box.appendChild(el("div", { "class": "stem" }, it.s));
        var tid = pre + "-t" + n;
        box.appendChild(el("label", { "for": tid, "class": "ms" }, "Your notes (kept on this device so you can come back to them; never sent anywhere)"));
        var ta = el("textarea", { id: tid, rows: "4" });
        // Saved in this browser only (not the LMS): per course, activity and part.
        var nk = "mosaic-notes:" + C.code + ":" + a.id + ":" + n, saveT = null;
        try { ta.value = localStorage.getItem(nk) || ""; } catch (e) {}
        ta.addEventListener("input", function () {
          clearTimeout(saveT);
          saveT = setTimeout(function () { try { if (ta.value) localStorage.setItem(nk, ta.value); else localStorage.removeItem(nk); } catch (e) {} }, 400);
        });
        box.appendChild(ta);
        var reveal = el("div", { "class": "fb", hidden: "" }, "<p><strong>What a strong answer includes</strong></p>" + it.model);
        var b = el("button", { type: "button", "class": "btn secondary" }, "Show a model answer");
        b.addEventListener("click", function () { reveal.hidden = false; b.hidden = true; announce("Model answer shown."); });
        box.appendChild(b); box.appendChild(reveal);
        c.appendChild(box);
        return;
      }
      var item = ITEMS[q], qp = pre + "-" + n;
      var fs = renderQuestion(qp, 0, 1, q, optOrder(item), null);
      if (item.k === "match") dragSort(fs, item);
      if (item.k === "order") dragOrder(fs, item);
      var lg = fs.querySelector("legend");
      if (lg) lg.textContent = total > 1 ? "Question " + (n + 1) + " of " + total : "Your answer";
      c.appendChild(fs);
      var fb = el("div", { "class": "fb", role: "status", hidden: "" });
      var chk = el("button", { type: "button", "class": "btn" }, isReveal(item) ? "See what practitioners pick" : "Check my answer");
      chk.addEventListener("click", function () {
        var ans = readAnswer(qp, 0, q);
        fb.hidden = false;
        if (!answered(ans)) {
          var left = Array.isArray(ans) ? ans.filter(function (x) { return x === null || x === undefined; }).length : (item.p ? item.p.length : 0);
          fb.className = "fb";
          fb.innerHTML = item.k === "match" && left ? "<p>Place every card first (" + left + " left).</p>" : "<p>Choose an answer first.</p>";
          return;
        }
        if (isReveal(item)) { fb.className = "fb"; fb.innerHTML = feedbackFor(item, ans, true); return; }
        var ok = isCorrect(item, ans);
        if (fs._mark) fs._mark(ans);
        fb.className = "fb " + (ok ? "ok" : "no");
        // vr / vw: an activity's own verdict line (e.g. "✓ Eligible" / "Not eligible").
        var verdict = ok && item.vr ? item.vr : !ok && item.vw ? item.vw :
          item.k === "mcq" ? (ok ? "✓ That's the best answer." : "Not the best answer.") : (ok ? "✓ Correct." : "Not quite.");
        // tk: one takeaway for the whole question, shown once under the option's feedback.
        fb.innerHTML = "<p><strong>" + verdict + "</strong>" + (ok ? "" : " Change your answer and check again, or read on.") + "</p>" + (feedbackFor(item, ans, ok) || "") +
          (item.tk ? '<p class="tk"><strong>' + esc(item.tkl || "Takeaway") + ":</strong> " + item.tk + "</p>" : "");
        announce(verdict);
      });
      c.appendChild(chk); c.appendChild(fb);
    });
    return c;
  }
  // Drag-and-drop for a practice "match": chips (it.p) dragged into zones
  // (it.o). It drives the question's own <select>s, so reading and grading the
  // answer don't change. Pointer events, so mouse, touch and pen all drag.
  // Keyboard / tap: choose a chip (it lifts), then choose a zone or the tray.
  function dragSort(fs, it) {
    var sels = fs.querySelectorAll("select");
    if (sels.length !== it.p.length) return;
    var rows = fs.querySelectorAll(".selrow");
    for (var r = 0; r < rows.length; r++) rows[r].style.display = "none";
    var box = el("div", { "class": "dnd" });
    box.appendChild(el("p", { "class": "ms" }, "<em>Drag each card into its box. Or choose a card, then choose a box. Drag a card back to the tray to undo.</em>"));
    var tray = el("div", { "class": "dndtray", role: "group", "aria-label": "Cards not placed yet" });
    var zones = el("div", { "class": "dndzones" });
    box.appendChild(tray); box.appendChild(zones);
    var zoneEls = [], chips = [], picked = null;
    function holder(z) { return z < 0 ? tray : zoneEls[z].querySelector(".dndbody"); }
    it.o.forEach(function (lab, zi) {
      var z = el("div", { "class": "dndzone", "data-z": String(zi) });
      var b = el("button", { type: "button", "class": "dndzhead" }, lab.replace(/<\/?p>/g, ""));
      b.addEventListener("click", function () { if (picked !== null) place(picked, zi); });
      z.appendChild(b);
      z.appendChild(el("div", { "class": "dndbody" }));
      zones.appendChild(z); zoneEls.push(z);
    });
    tray.addEventListener("click", function (e) { if (e.target === tray && picked !== null) place(picked, -1); });
    function status(pi) {
      var v = sels[pi].value;
      return v === "" ? "not placed" : "in " + it.o[parseInt(v, 10)].replace(/<[^>]+>/g, "");
    }
    function setPicked(pi) {
      picked = pi;
      chips.forEach(function (c, i) { c.classList.toggle("picked", i === pi); c.setAttribute("aria-pressed", i === pi ? "true" : "false"); });
      box.classList.toggle("picking", pi !== null);
    }
    function place(pi, zi) {
      sels[pi].value = zi < 0 ? "" : String(zi);
      holder(zi).appendChild(chips[pi]);
      chips[pi].classList.remove("ok", "no");
      chips[pi].setAttribute("aria-label", it.p[pi].replace(/<[^>]+>/g, "") + ", " + status(pi));
      setPicked(null);
      announce(it.p[pi].replace(/<[^>]+>/g, "") + " " + status(pi) + ".");
      try { chips[pi].focus({ preventScroll: true }); } catch (e) {}
    }
    it.p.forEach(function (pr, pi) {
      var c = el("button", { type: "button", "class": "dndchip", "aria-pressed": "false" }, pr.replace(/<\/?p>/g, ""));
      c.setAttribute("aria-label", pr.replace(/<[^>]+>/g, "") + ", not placed");
      chips.push(c); tray.appendChild(c);
      var start = null, ghost = null, over = null, last = null, scroller = null;
      function hit(x, y) {
        var t = document.elementFromPoint(x, y);
        var z = t && t.closest ? (t.closest(".dndzone") || (t.closest(".dndtray") === tray ? tray : null)) : null;
        if (z && !box.contains(z)) z = null;
        if (over !== z) { if (over) over.classList.remove("over"); over = z; if (over) over.classList.add("over"); }
      }
      // Scroll the page while a card is held near the top or bottom edge,
      // so a box below the fold can still be reached.
      function edgeScroll() {
        if (!ghost || !last) { scroller = null; return; }
        var h = window.innerHeight, d = 0, edge = 70;
        if (last.y > h - edge) d = Math.ceil((last.y - (h - edge)) / 4);
        else if (last.y < edge) d = -Math.ceil((edge - last.y) / 4);
        if (d) { window.scrollBy(0, d); hit(last.x, last.y); }
        scroller = requestAnimationFrame(edgeScroll);
      }
      c.addEventListener("pointerdown", function (e) {
        if (e.button !== undefined && e.button !== 0) return;
        start = { x: e.clientX, y: e.clientY }; try { c.setPointerCapture(e.pointerId); } catch (er) {}
      });
      c.addEventListener("pointermove", function (e) {
        if (!start) return;
        if (!ghost) {
          if (Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) < 6) return;
          ghost = c.cloneNode(true); ghost.className = "dndchip ghost";
          ghost.style.width = c.offsetWidth + "px";
          document.body.appendChild(ghost); c.classList.add("dragging"); setPicked(null);
        }
        ghost.style.left = (e.clientX - c.offsetWidth / 2) + "px";
        ghost.style.top = (e.clientY - 18) + "px";
        last = { x: e.clientX, y: e.clientY };
        hit(e.clientX, e.clientY);
        if (!scroller) scroller = requestAnimationFrame(edgeScroll);
        e.preventDefault();
      });
      function end() {
        if (ghost) {
          ghost.parentNode.removeChild(ghost); ghost = null; c.classList.remove("dragging");
          if (over) { over.classList.remove("over"); place(pi, over === tray ? -1 : parseInt(over.getAttribute("data-z"), 10)); }
          over = null; start = null; c._dragged = true; return;
        }
        start = null;
      }
      c.addEventListener("pointerup", end);
      c.addEventListener("pointercancel", function () { if (ghost) { ghost.parentNode.removeChild(ghost); ghost = null; c.classList.remove("dragging"); } if (over) over.classList.remove("over"); over = null; start = null; });
      c.addEventListener("click", function () {
        if (c._dragged) { c._dragged = false; return; }
        setPicked(picked === pi ? null : pi);
        if (picked === pi) announce("Picked " + pr.replace(/<[^>]+>/g, "") + ". Now choose a box.");
      });
      c.addEventListener("keydown", function (e) { if (e.key === "Escape") setPicked(null); });
    });
    fs._mark = function (ans) {
      for (var i = 0; i < chips.length; i++) {
        var cj = it.c[i], a = ans ? ans[i] : null;
        var ok = a !== null && a !== undefined && (Array.isArray(cj) ? cj.indexOf(a) >= 0 : a === cj);
        chips[i].classList.toggle("ok", ok); chips[i].classList.toggle("no", !ok && a !== null && a !== undefined);
      }
    };
    fs.appendChild(box);
  }

  // Drag-to-reorder for a practice "order": the steps are a list of cards;
  // drag one up or down (it moves live as you pass other cards), or use its
  // ↑ / ↓ buttons. It keeps the question's hidden <select>s (one per step,
  // value = position) in step with the list, so grading doesn't change.
  function dragOrder(fs, it) {
    var sels = fs.querySelectorAll("select");
    if (sels.length !== it.o.length) return;
    var selFor = {};
    for (var i = 0; i < sels.length; i++) selFor[sels[i].getAttribute("data-orig")] = sels[i];
    var rows = fs.querySelectorAll(".selrow");
    for (var r = 0; r < rows.length; r++) rows[r].style.display = "none";
    var hint = fs.querySelector("p.ms"); if (hint) hint.style.display = "none";
    var box = el("div", { "class": "dnd" });
    box.appendChild(el("p", { "class": "ms" }, "<em>Drag the steps into order, first at the top. Or use the ↑ and ↓ buttons.</em>"));
    var list = el("ol", { "class": "dndlist" });
    box.appendChild(list);
    var order = [];
    for (var k = 0; k < rows.length; k++) order.push(parseInt(rows[k].querySelector("select").getAttribute("data-orig"), 10));
    var cards = {};
    function txt(ei) { return it.o[ei].replace(/<[^>]+>/g, ""); }
    function sync(moved) {
      var lis = list.children;
      for (var p = 0; p < lis.length; p++) {
        var ei = lis[p].getAttribute("data-e");
        selFor[ei].value = String(p);
        lis[p].classList.remove("ok", "no");
        lis[p].querySelector(".up").disabled = p === 0;
        lis[p].querySelector(".down").disabled = p === lis.length - 1;
        lis[p].querySelector(".pos").textContent = String(p + 1);
      }
      if (moved !== undefined) {
        var at = Array.prototype.indexOf.call(lis, cards[moved]);
        announce(txt(moved) + ", now step " + (at + 1) + " of " + lis.length + ".");
      }
    }
    function move(ei, delta) {
      var li = cards[ei], sib = delta < 0 ? li.previousElementSibling : li.nextElementSibling;
      if (!sib) return;
      if (delta < 0) list.insertBefore(li, sib); else list.insertBefore(sib, li);
      sync(ei);
      var btn = li.querySelector(delta < 0 ? ".up" : ".down");
      try { (btn.disabled ? li.querySelector(delta < 0 ? ".down" : ".up") : btn).focus({ preventScroll: true }); } catch (e) {}
    }
    order.forEach(function (ei) {
      var li = el("li", { "class": "dndrow", "data-e": String(ei) });
      li.appendChild(el("span", { "class": "pos", "aria-hidden": "true" }));
      var grip = el("span", { "class": "dndgrip", "aria-hidden": "true" }, "⠿");
      li.appendChild(grip);
      li.appendChild(el("span", { "class": "dndtxt" }, it.o[ei].replace(/<\/?p>/g, "")));
      var up = el("button", { type: "button", "class": "mv up", "aria-label": "Move up: " + txt(ei) }, "↑");
      var dn = el("button", { type: "button", "class": "mv down", "aria-label": "Move down: " + txt(ei) }, "↓");
      up.addEventListener("click", function () { move(ei, -1); });
      dn.addEventListener("click", function () { move(ei, 1); });
      li.appendChild(up); li.appendChild(dn);
      cards[ei] = li; list.appendChild(li);
      var start = null, dragging = false, last = null, scroller = null;
      function reflow(y) {
        var others = Array.prototype.filter.call(list.children, function (x) { return x !== li; });
        var before = null;
        for (var q = 0; q < others.length; q++) {
          var b = others[q].getBoundingClientRect();
          if (y < b.top + b.height / 2) { before = others[q]; break; }
        }
        if (before) { if (li.nextElementSibling !== before) list.insertBefore(li, before); }
        else if (list.lastElementChild !== li) list.appendChild(li);
      }
      function edgeScroll() {
        if (!dragging || !last) { scroller = null; return; }
        var h = window.innerHeight, d = 0, edge = 70;
        if (last.y > h - edge) d = Math.ceil((last.y - (h - edge)) / 4);
        else if (last.y < edge) d = -Math.ceil((edge - last.y) / 4);
        if (d) { window.scrollBy(0, d); reflow(last.y); }
        scroller = requestAnimationFrame(edgeScroll);
      }
      // Track the pointer on the whole window, not with pointer capture: the
      // card moves in the list as it is dragged, and moving a captured
      // element drops the capture.
      li.addEventListener("pointerdown", function (e) {
        if (e.target.closest && e.target.closest("button")) return;
        if (e.button !== undefined && e.button !== 0) return;
        start = { x: e.clientX, y: e.clientY };
        window.addEventListener("pointermove", onMove, { passive: false });
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
        e.preventDefault();
      });
      function onMove(e) {
        if (!start) return;
        if (!dragging) {
          if (Math.abs(e.clientY - start.y) + Math.abs(e.clientX - start.x) < 6) return;
          dragging = true; li.classList.add("lifted");
        }
        last = { x: e.clientX, y: e.clientY };
        reflow(e.clientY);
        if (!scroller) scroller = requestAnimationFrame(edgeScroll);
        e.preventDefault();
      }
      function end() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        if (dragging) { dragging = false; li.classList.remove("lifted"); sync(ei); }
        start = null; last = null;
      }
    });
    sync();
    fs._mark = function () {
      var lis = list.children, c = it.c;
      for (var p = 0; p < lis.length; p++) {
        var ok = parseInt(lis[p].getAttribute("data-e"), 10) === c[p];
        lis[p].classList.toggle("ok", ok); lis[p].classList.toggle("no", !ok);
      }
      if (isCorrect(it, readOrder())) for (var z = 0; z < lis.length; z++) { lis[z].classList.add("ok"); lis[z].classList.remove("no"); }
    };
    function readOrder() {
      var a = []; for (var x = 0; x < it.o.length; x++) a.push(parseInt(selFor[String(x)].value, 10)); return a;
    }
    fs.appendChild(box);
  }

  function activitiesList(mi) {
    var list = actsFor(mi);
    if (!list.length) return null;
    var c = el("section", { "class": "card", "aria-labelledby": "acts-h" });
    c.innerHTML = '<h2 id="acts-h">Practice activities (' + list.length + ")</h2><p>The video pauses for each of these. You can also open any of them here, as often as you like. They aren't graded.</p>";
    list.forEach(function (a) {
      var d = el("details", { "class": "actdet" });
      d.appendChild(el("summary", null, esc(a.title)));
      var filled = false;
      d.addEventListener("toggle", function () { if (d.open && !filled) { filled = true; d.appendChild(activityCard(a, "ls")); } });
      c.appendChild(d);
    });
    return c;
  }
  function wireVideoActivities(video, wrap, mi, label) {
    var pts = actsFor(mi, label);
    if (!pts.length) return;
    var panel = el("div", { "class": "actpanel", hidden: "" });
    wrap.appendChild(panel);
    var fired = {}, last = 0;
    function show(a) {
      try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
      panel.innerHTML = "";
      panel.hidden = false;
      panel.appendChild(el("p", { "class": "actnote" }, "⏸ The video is paused so you can try this. Then press <strong>Continue the video</strong>."));
      panel.appendChild(activityCard(a, "vp"));
      var go = el("button", { type: "button", "class": "btn big" }, "Continue the video ▶");
      go.addEventListener("click", function () { panel.hidden = true; panel.innerHTML = ""; try { video.play(); } catch (e) {} video.focus(); });
      panel.appendChild(go);
      announce("Video paused for a practice activity: " + a.title);
      try { panel.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { panel.scrollIntoView(); }
      var h = panel.querySelector("h3"); if (h) setTimeout(function () { try { h.focus({ preventScroll: true }); } catch (e) {} }, 400);
    }
    video.addEventListener("timeupdate", function () {
      var t = video.currentTime;
      if (!video.paused && !video.seeking) {
        for (var i = 0; i < pts.length; i++) {
          var a = pts[i];
          if (!fired[a.id] && last < a.t && t >= a.t && t - a.t < 2) { fired[a.id] = 1; video.pause(); show(a); break; }
        }
      }
      last = t;
    });
    video.addEventListener("seeked", function () {
      var t = video.currentTime;
      pts.forEach(function (a) { if (a.t > t + 0.5) delete fired[a.id]; });
      last = t;
    });
    video.addEventListener("play", function () { if (!panel.hidden) { panel.hidden = true; panel.innerHTML = ""; } });
  }

  // ------------------------------------------------------------ questions
  function drawFrom(pool, n, always, minType) {
    var chosen = always.slice();
    if (minType) {
      for (var t in minType) {
        var spec = minType[t], have = chosen.filter(function (x) { return has(spec.items, x); }).length;
        var cand = shuffle(spec.items.filter(function (x) { return !has(chosen, x); }));
        while (have < spec.n && cand.length) { chosen.push(cand.shift()); have++; }
      }
    }
    var rest = shuffle(pool.filter(function (x) { return !has(chosen, x); }));
    while (chosen.length < n && rest.length) chosen.push(rest.shift());
    return chosen.slice(0, Math.max(n, always.length));
  }
  function optOrder(it) {
    var n = it.o ? it.o.length : 0, a = [];
    for (var i = 0; i < n; i++) a.push(i);
    // Practice activities keep the authored order: their feedback can say "most people pick B".
    if (it.act && it.k !== "order") return a;
    return (it.k === "mcq" || it.k === "multi" || it.k === "order") ? shuffle(a) : a;
  }
  // answers: mcq -> int, multi -> [ints], order -> [position per element], match -> [choice per prompt]
  function isCorrect(it, ans) {
    if (ans === null || ans === undefined) return false;
    if (it.k === "mcq") return ans === it.c;
    if (it.k === "multi") { var a = ans.slice().sort(), b = it.c.slice().sort(); return a.join() === b.join(); }
    if (it.k === "order") {
      // alt: other accepted orders (practice activities), same form as c.
      var orders = [it.c].concat(it.alt || []);
      return orders.some(function (c) { for (var i = 0; i < c.length; i++) if (ans[c[i]] !== i) return false; return true; });
    }
    if (it.k === "match") {
      // A prompt may accept more than one target: c[j] is an index or a list of them.
      for (var j = 0; j < it.c.length; j++) {
        var cj = it.c[j];
        if (Array.isArray(cj) ? cj.indexOf(ans[j]) < 0 : ans[j] !== cj) return false;
      }
      return true;
    }
    return false;
  }
  function feedbackFor(it, ans, ok) {
    if (it.k === "mcq") return (ans !== null && it.f[String(ans)]) || it.g || "";
    if (ok) return it.fr || it.g || "";
    if (it.k === "multi" && !it.fw && !it.g) {
      var parts = [];
      for (var i = 0; i < it.o.length; i++) {
        var sel = ans && has(ans, i), right = has(it.c, i);
        if (sel !== right && it.f[String(i)]) parts.push(it.f[String(i)]);
      }
      return parts.join("");
    }
    return it.fw || it.g || "";
  }
  function qid(prefix, n) { return prefix + "-q" + n; }

  function renderQuestion(prefix, n, total, idx, order, ans) {
    var it = ITEMS[idx];
    var fs = el("fieldset", { "class": "q", id: qid(prefix, n), "data-item": String(idx), "aria-describedby": qid(prefix, n) + "-stem" });
    fs.appendChild(el("legend", null, "Question " + (n + 1) + " of " + total));
    var stem = el("div", { "class": "stem", id: qid(prefix, n) + "-stem" }, it.s);
    fs.appendChild(stem);
    var name = qid(prefix, n) + "-a";
    if (it.k === "mcq" || it.k === "multi") {
      if (it.k === "multi" && !/select all/i.test(it.s)) fs.appendChild(el("p", { "class": "ms" }, "<em>Select all that apply.</em>"));
      order.forEach(function (oi) {
        var lab = el("label", { "class": "opt" });
        var inp = el("input", { type: it.k === "mcq" ? "radio" : "checkbox", name: name, value: String(oi), "data-orig": String(oi) });
        if (it.k === "mcq" && ans === oi) inp.checked = true;
        if (it.k === "multi" && ans && has(ans, oi)) inp.checked = true;
        lab.appendChild(inp);
        if (it.act) lab.appendChild(el("span", { "class": "optl" }, String.fromCharCode(65 + oi) + "."));
        lab.appendChild(el("span", null, it.o[oi]));
        fs.appendChild(lab);
      });
    } else if (it.k === "order") {
      fs.appendChild(el("p", { "class": "ms" }, "<em>Give each step its position, 1 = first.</em>"));
      order.forEach(function (ei, row) {
        var r = el("div", { "class": "selrow" });
        var sid = name + "-" + ei;
        r.appendChild(el("label", { "for": sid, "class": "seltext" }, it.o[ei]));
        var s = el("select", { id: sid, "data-orig": String(ei) });
        s.appendChild(el("option", { value: "" }, "Position…"));
        for (var p = 0; p < it.o.length; p++) {
          var op = el("option", { value: String(p) }, String(p + 1));
          if (ans && ans[ei] === p) op.selected = true;
          s.appendChild(op);
        }
        r.appendChild(s);
        fs.appendChild(r);
      });
    } else if (it.k === "match") {
      it.p.forEach(function (pr, pi) {
        var r = el("div", { "class": "selrow" });
        var sid = name + "-" + pi;
        r.appendChild(el("label", { "for": sid, "class": "seltext" }, pr));
        var s = el("select", { id: sid, "data-orig": String(pi) });
        s.appendChild(el("option", { value: "" }, "Choose…"));
        it.o.forEach(function (ch, ci) {
          var op = el("option", { value: String(ci) }, ch.replace(/<[^>]+>/g, ""));
          if (ans && ans[pi] === ci) op.selected = true;
          s.appendChild(op);
        });
        r.appendChild(s);
        fs.appendChild(r);
      });
    }
    return fs;
  }
  function readAnswer(prefix, n, idx) {
    var it = ITEMS[idx], fs = document.getElementById(qid(prefix, n));
    if (!fs) return null;
    if (it.k === "mcq") { var c = fs.querySelector("input:checked"); return c ? parseInt(c.value, 10) : null; }
    if (it.k === "multi") {
      var cs = fs.querySelectorAll("input:checked"), a = [];
      for (var i = 0; i < cs.length; i++) a.push(parseInt(cs[i].value, 10));
      return a.length ? a.sort() : null;
    }
    var sels = fs.querySelectorAll("select"), out = [], any = false;
    var n2 = it.k === "order" ? it.o.length : it.p.length;
    for (var k = 0; k < n2; k++) out.push(null);
    for (var j = 0; j < sels.length; j++) {
      var v = sels[j].value;
      if (v !== "") { out[parseInt(sels[j].getAttribute("data-orig"), 10)] = parseInt(v, 10); any = true; }
    }
    return any ? out : null;
  }
  function answered(ans) {
    if (ans === null || ans === undefined) return false;
    if (typeof ans === "number") return true;
    if (Array.isArray(ans)) return ans.length > 0 && ans.every(function (x) { return x !== null; });
    return false;
  }

  // ------------------------------------------------------------ module check
  function checkBlock(mi) {
    var m = MODS[mi], ch = m.check;
    var c = el("section", { "class": "card", "aria-labelledby": "chk-h" });
    c.appendChild(el("h2", { id: "chk-h" }, "Module check"));
    var passed = has(S.c, mi);
    var rt = RUNTIME.check[mi];
    if (!rt || rt.done) {
      var p = el("p", null, ch.n + " questions, drawn fresh each attempt. You need " + ch.pass + " of " + ch.n + " (" + ch.pct + "%) to pass. Unlimited retakes.");
      c.appendChild(p);
      if (passed) c.appendChild(el("p", null, '<span class="status ok">✓ Passed</span>'));
      if (rt && rt.done) c.appendChild(checkResult(mi, rt));
      var b = el("button", { type: "button", "class": "btn" + (passed ? " secondary" : "") },
        rt && rt.done ? (rt.ok ? "Take it again (optional)" : "Retake with new questions") : (passed ? "Take it again (optional)" : "Start the module check"));
      b.addEventListener("click", function () {
        RUNTIME.check[mi] = { q: drawFrom(ch.items, ch.n, ch.always, ch.minType), o: null, done: false };
        RUNTIME.check[mi].o = RUNTIME.check[mi].q.map(function (i) { return optOrder(ITEMS[i]); });
        refreshModule(mi);
        var f = document.getElementById("chk-form"); if (f) { var lg = f.querySelector("legend"); if (lg) { lg.setAttribute("tabindex", "-1"); lg.focus(); } }
      });
      c.appendChild(b);
      return c;
    }
    var form = el("form", { id: "chk-form", novalidate: "" });
    rt.q.forEach(function (idx, n) { form.appendChild(renderQuestion("chk" + mi, n, rt.q.length, idx, rt.o[n], null)); });
    var msg = el("p", { "class": "ms", id: "chk-msg", role: "alert" });
    form.appendChild(msg);
    form.appendChild(el("button", { type: "submit", "class": "btn" }, "Submit answers"));
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var ans = rt.q.map(function (idx, n) { return readAnswer("chk" + mi, n, idx); });
      var un = ans.filter(function (a) { return !answered(a); }).length;
      if (un) { msg.textContent = "Please answer every question (" + un + " left)."; return; }
      var right = 0;
      rt.res = ans.map(function (a, n) { var ok = isCorrect(ITEMS[rt.q[n]], a); if (ok) right++; return { a: a, ok: ok }; });
      rt.right = right; rt.ok = right >= ch.pass; rt.done = true;
      if (rt.ok) { addTo(S.c, mi); saveState(true); }
      announce("You scored " + right + " of " + rt.q.length + ". " + (rt.ok ? "Passed." : "Not passed yet."));
      refreshModule(mi);
      var h = document.getElementById("chk-res"); if (h) { h.focus(); }
    });
    c.appendChild(form);
    return c;
  }
  function checkResult(mi, rt) {
    var box = el("div");
    var h = el("h3", { id: "chk-res", tabindex: "-1" }, "Your result: " + rt.right + " of " + rt.q.length + " (" + pctOf(rt.right, rt.q.length) + "%)");
    box.appendChild(h);
    box.appendChild(el("div", { "class": "notice " + (rt.ok ? "good" : "warn") }, rt.ok ?
      "<p><strong>Passed.</strong> " + (modDone(mi) ? "This module is complete." : "") + "</p>" :
      "<p><strong>Not passed yet.</strong> Review the video and the feedback below, then retake. You'll get a fresh set of questions.</p>"));
    rt.q.forEach(function (idx, n) {
      var it = ITEMS[idx], r = rt.res[n];
      var d = el("div", { "class": "fb " + (r.ok ? "ok" : "no") });
      d.innerHTML = "<p><strong>Question " + (n + 1) + ": " + (r.ok ? "Correct" : "Not quite") + "</strong></p>" +
        '<div class="stem">' + it.s + "</div>" + (feedbackFor(it, r.a, r.ok) || "");
      box.appendChild(d);
    });
    return box;
  }

  // ------------------------------------------------------------ simulation
  function simBlock(mi) {
    var sim = MODS[mi].sim;
    var c = el("section", { "class": "card", "aria-labelledby": "sim-h" });
    c.appendChild(el("h2", { id: "sim-h" }, "Simulation: " + esc(sim.title)));
    var rt = RUNTIME.sim[mi];
    if (!rt) {
      c.innerHTML += sim.intro;
      if (has(S.s, mi)) c.appendChild(el("p", null, '<span class="status ok">✓ Simulation passed</span>'));
      var b = el("button", { type: "button", "class": "btn" + (has(S.s, mi) ? " secondary" : "") }, has(S.s, mi) ? "Run it again (optional)" : "Start the simulation");
      b.addEventListener("click", function () { RUNTIME.sim[mi] = { d: 0, chosen: null, state: "ask" }; refreshModule(mi); focusSim(); });
      c.appendChild(b);
      return c;
    }
    var total = sim.decisions.length;
    if (rt.state === "passed") {
      c.appendChild(el("div", { "class": "notice good" }, "<p><strong>Simulation passed — no critical errors.</strong></p>" + sim.pass));
      var again = el("button", { type: "button", "class": "btn secondary", id: "sim-focus" }, "Close");
      again.addEventListener("click", function () { RUNTIME.sim[mi] = null; refreshModule(mi); });
      c.appendChild(again);
      return c;
    }
    var dcs = sim.decisions[rt.d];
    c.appendChild(el("p", { "class": "simprog" }, "Decision " + (rt.d + 1) + " of " + total));
    var fs = el("fieldset", { "class": "q", "aria-describedby": "sim-text" });
    fs.appendChild(el("legend", { id: "sim-focus", tabindex: "-1" }, esc(dcs.title)));
    fs.appendChild(el("div", { "class": "stem", id: "sim-text" }, dcs.text));
    dcs.options.forEach(function (o, oi) {
      var lab = el("label", { "class": "opt" });
      var inp = el("input", { type: "radio", name: "sim" + mi, value: String(oi), "data-orig": String(oi) });
      if (rt.chosen === oi) inp.checked = true;
      if (rt.state !== "ask") inp.disabled = true;
      lab.appendChild(inp); lab.appendChild(el("span", null, o.text));
      fs.appendChild(lab);
    });
    c.appendChild(fs);
    var msg = el("p", { role: "alert", "class": "ms" });
    c.appendChild(msg);
    if (rt.state === "ask") {
      var ok = el("button", { type: "button", "class": "btn" }, "Confirm choice");
      ok.addEventListener("click", function () {
        var ch = fs.querySelector("input:checked");
        if (!ch) { msg.textContent = "Choose an option first."; return; }
        rt.chosen = parseInt(ch.value, 10);
        rt.state = dcs.options[rt.chosen].crit ? "crit" : "fb";
        refreshModule(mi); focusSim("sim-fb");
      });
      c.appendChild(ok);
    } else {
      var o = dcs.options[rt.chosen];
      var fb = el("div", { id: "sim-fb", tabindex: "-1", "class": rt.state === "crit" ? "crit" : ("fb " + (o.best ? "ok" : "")) });
      fb.innerHTML = (rt.state === "crit" ? '<p><span class="tag">Critical</span><strong>Critical error — this attempt ends.</strong></p>' :
        "<p><strong>" + (o.best ? "Good choice." : "Not the best choice.") + "</strong></p>") + o.fb;
      c.appendChild(fb);
      if (rt.state === "crit") {
        var tr = el("button", { type: "button", "class": "btn" }, "Try again");
        tr.addEventListener("click", function () { RUNTIME.sim[mi] = { d: 0, chosen: null, state: "ask" }; refreshModule(mi); focusSim(); });
        c.appendChild(tr);
      } else {
        var nx = el("button", { type: "button", "class": "btn" }, rt.d + 1 < total ? "Next decision" : "Finish");
        nx.addEventListener("click", function () {
          if (rt.d + 1 < total) { rt.d++; rt.chosen = null; rt.state = "ask"; }
          else { rt.state = "passed"; addTo(S.s, mi); saveState(true); announce("Simulation passed."); }
          refreshModule(mi); focusSim();
        });
        c.appendChild(nx);
      }
    }
    return c;
  }
  function focusSim(id) { var f = document.getElementById(id || "sim-focus"); if (f) f.focus(); }

  // ------------------------------------------------------------ final exam
  function encAns(it, a) {
    if (a === null || a === undefined) return "-";
    if (typeof a === "number") return String(a);
    if (it.k === "multi") return a.join("");
    return a.map(function (x) { return x === null ? "_" : String(x); }).join("");
  }
  function decAns(it, s) {
    if (!s || s === "-") return null;
    if (it.k === "mcq") return parseInt(s, 10);
    var arr = s.split("").map(function (ch) { return ch === "_" ? null : parseInt(ch, 10); });
    return arr;
  }
  function startExam() {
    var q = [];
    EX.pools.forEach(function (p) { q = q.concat(drawFrom(p.items, p.n, p.always, null)); });
    q = shuffle(q);
    S.e.n += 1;
    S.x = { t: Date.now() + EX.time * 60000, q: q, o: q.map(function (i) { return optOrder(ITEMS[i]).join(""); }), a: q.map(function () { return "-"; }) };
    saveState(true);
    if (SC.api) { var st = sget("cmi.core.lesson_status"); if (st !== "passed" && st !== "failed") sset("cmi.core.lesson_status", "incomplete"); commit(); }
    render();
    var lg = document.querySelector("#exam-form legend"); if (lg) { lg.setAttribute("tabindex", "-1"); lg.focus(); }
  }
  function captureExamAnswers() {
    if (!S.x) return;
    S.x.q.forEach(function (idx, n) { S.x.a[n] = encAns(ITEMS[idx], readAnswer("ex", n, idx)); });
  }
  function gradeExam(timedOut) {
    var x = S.x; if (!x) return;
    var per = {}, right = 0, critOk = true, missed = [];
    EX.domains.forEach(function (d) { per[d.k] = [0, 0]; });
    x.q.forEach(function (idx, n) {
      var it = ITEMS[idx], a = decAns(it, x.a[n]), ok = isCorrect(it, a);
      if (!per[it.d]) per[it.d] = [0, 0];
      per[it.d][1]++;
      if (ok) { right++; per[it.d][0]++; }
      else if (it.x) critOk = false;
      else missed.push([idx, x.a[n]]);
    });
    var total = x.q.length, score = pctOf(right, total);
    var overallOk = right * 100 >= EX.overall * total - 1e-9;
    var domOk = true;
    if (EX.domainMin !== null && EX.domainMin !== undefined) {
      for (var k in per) if (per[k][1] && per[k][0] * 100 < EX.domainMin * per[k][1] - 1e-9) domOk = false;
    }
    var pass = overallOk && domOk && critOk;
    S.e.sc = score;
    S.e.r = { r: right, t: total, d: per, o: overallOk ? 1 : 0, m: domOk ? 1 : 0, c: critOk ? 1 : 0, p: pass ? 1 : 0, to: timedOut ? 1 : 0,
      miss: missed.slice(0, 60).map(function (m) { return m[0] + ":" + m[1]; }).join(",") };
    if (pass) S.e.p = 1;
    S.x = null;
    if (SC.api) {
      sset("cmi.core.score.min", "0"); sset("cmi.core.score.max", "100");
      if (!S.e.p || pass) sset("cmi.core.score.raw", String(score));
      // "failed" only when the last allowed attempt fails; otherwise the learner still has a try left.
      sset("cmi.core.lesson_status", S.e.p ? "passed" : (S.e.n >= EX.attempts ? "failed" : "incomplete"));
    }
    saveState(true);
    announce("Exam submitted. Score " + score + "%. " + (pass ? "Passed." : "Not passed."));
  }
  function renderExam(main) {
    main.appendChild(el("p", { "class": "kicker" }, esc(C.code)));
    main.appendChild(el("h1", null, "Final exam"));
    if (S.x) return renderExamRunning(main);
    if (!examUnlocked() && !S.e.n) {
      var left = requiredForExam().filter(function (i) { return !modDone(i); });
      main.appendChild(el("div", { "class": "notice" }, "<p>The final exam opens when every module is complete. Still to do:</p><ul>" +
        left.map(function (i) { return "<li>" + esc(MODS[i].id + " " + MODS[i].title) + "</li>"; }).join("") + "</ul>"));
      return;
    }
    if (S.e.r) main.appendChild(examResult());
    if (S.e.p) return;
    if (S.e.n >= EX.attempts) {
      main.appendChild(el("div", { "class": "notice warn" }, "<p><strong>No attempts left in this course window.</strong></p>" + EX.retake));
      return;
    }
    var c = el("div", { "class": "card" });
    c.innerHTML = "<h2>Before you start</h2>" + (C.examIntro || "") +
      "<p><strong>In this course:</strong> " + EX.total + " questions, " + EX.time + " minutes. To pass: " + EX.overall + "% overall" +
      (EX.domainMin ? ", at least " + EX.domainMin + "% in every area" : "") + ", and every critical question correct. " +
      "The timer starts when you press Start and keeps running if you leave. When time runs out, your answers are submitted automatically.</p>" +
      "<p>Attempts used: " + S.e.n + " of " + EX.attempts + ".</p>";
    var b = el("button", { type: "button", "class": "btn" }, "Start attempt " + (S.e.n + 1) + " of " + EX.attempts);
    b.addEventListener("click", function () {
      if (window.confirm("Start attempt " + (S.e.n + 1) + " of " + EX.attempts + "? The " + EX.time + "-minute timer starts now.")) startExam();
    });
    c.appendChild(b);
    main.appendChild(c);
  }
  function fmtTime(ms) { var s = Math.max(0, Math.round(ms / 1000)); var m = Math.floor(s / 60); s = s % 60; return m + ":" + (s < 10 ? "0" : "") + s; }
  function renderExamRunning(main) {
    var x = S.x;
    if (Date.now() >= x.t) { gradeExam(true); render(); return; }
    var timer = el("div", { "class": "timer", id: "ex-timer" });
    timer.innerHTML = '<span>Attempt ' + S.e.n + " of " + EX.attempts + '</span><span>Time left: <strong id="ex-left" style="color:#fff">' + fmtTime(x.t - Date.now()) + "</strong></span>";
    main.appendChild(timer);
    var form = el("form", { id: "exam-form", novalidate: "" });
    x.q.forEach(function (idx, n) {
      var it = ITEMS[idx];
      var order = x.o[n].split("").map(function (d) { return parseInt(d, 10); });
      form.appendChild(renderQuestion("ex", n, x.q.length, idx, order, decAns(it, x.a[n])));
    });
    var msg = el("p", { role: "alert", id: "ex-msg" });
    form.appendChild(msg);
    form.appendChild(el("button", { type: "submit", "class": "btn" }, "Submit exam"));
    form.addEventListener("change", function () { captureExamAnswers(); saveState(false); });
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      captureExamAnswers();
      var un = 0;
      S.x.q.forEach(function (idx, n) { if (!answered(decAns(ITEMS[idx], S.x.a[n]))) un++; });
      if (un && !window.confirm(un + " question" + (un > 1 ? "s are" : " is") + " unanswered. Submit anyway?")) return;
      finishExam(false);
    });
    main.appendChild(form);
    var warned5 = false, warned1 = false;
    if (RUNTIME.examTimer) clearInterval(RUNTIME.examTimer);
    RUNTIME.examTimer = setInterval(function () {
      if (!S.x) { clearInterval(RUNTIME.examTimer); return; }
      var left = S.x.t - Date.now(), lt = document.getElementById("ex-left"), tb = document.getElementById("ex-timer");
      if (lt) lt.textContent = fmtTime(left);
      if (tb && left < 5 * 60000) tb.className = "timer low";
      if (!warned5 && left < 5 * 60000 && left > 4 * 60000) { warned5 = true; announce("Five minutes left."); }
      if (!warned1 && left < 60000 && left > 50000) { warned1 = true; announce("One minute left."); }
      if (left <= 0) { finishExam(true); }
    }, 1000);
  }
  function finishExam(timedOut) {
    if (RUNTIME.examTimer) { clearInterval(RUNTIME.examTimer); RUNTIME.examTimer = null; }
    if (current === "exam") captureExamAnswers();
    gradeExam(timedOut);
    if (current === "exam") { render(); var h = document.getElementById("ex-res"); if (h) h.focus(); } else renderNav();
  }
  function examResult() {
    var r = S.e.r, box = el("section", { "class": "card", "aria-labelledby": "ex-res" });
    var h = '<h2 id="ex-res" tabindex="-1">Your result: ' + r.r + " of " + r.t + " (" + pctOf(r.r, r.t) + "%) — " +
      (r.p ? '<span class="status ok">Passed</span>' : '<span class="status no">Not passed</span>') + "</h2>";
    if (r.to) h += '<p class="notice">Time ran out, so your answers were submitted automatically.</p>';
    h += '<div class="tablewrap"><table class="resulttbl"><caption class="sr-only">Score by area</caption><thead><tr><th scope="col">Area</th><th scope="col">Score</th></tr></thead><tbody>';
    EX.domains.forEach(function (d) {
      var v = r.d[d.k] || [0, 0];
      if (!v[1]) return;
      h += "<tr><td>" + esc(d.k + " · " + d.label) + '</td><td class="num">' + v[0] + " of " + v[1] + " (" + pctOf(v[0], v[1]) + "%)</td></tr>";
    });
    h += "</tbody></table></div><ul>";
    h += "<li>" + (r.o ? "✓" : "✗") + " At least " + EX.overall + "% overall</li>";
    if (EX.domainMin) h += "<li>" + (r.m ? "✓" : "✗") + " At least " + EX.domainMin + "% in every area</li>";
    h += "<li>" + (r.c ? "✓" : "✗") + " Every critical question correct</li></ul>";
    box.innerHTML = h;
    if (r.miss) {
      var list = r.miss.split(",").filter(Boolean);
      if (list.length) {
        box.appendChild(el("h3", null, "Feedback on questions you missed"));
        box.appendChild(el("p", { "class": "ms" }, "Feedback is shown for missed questions, except questions on critical rules."));
        list.forEach(function (s) {
          var p = s.split(":"), idx = parseInt(p[0], 10), it = ITEMS[idx];
          if (!it) return;
          var a = decAns(it, p.slice(1).join(":"));
          var d = el("div", { "class": "fb no" });
          d.innerHTML = '<div class="stem">' + it.s + "</div>" + (feedbackFor(it, a, false) || "<p>Review this topic in the module.</p>");
          box.appendChild(d);
        });
      }
    }
    return box;
  }

  // ------------------------------------------------------------ practical
  function renderPractical(main) {
    main.appendChild(el("p", { "class": "kicker" }, esc(C.code)));
    main.appendChild(el("h1", null, esc(HAND.heading)));
    main.appendChild(el("div", { "class": "notice" }, HAND.notice));
    var c = el("div", { "class": "card" }, C.practical || "<p>See your course instructions.</p>");
    main.appendChild(c);
  }

  // ------------------------------------------------------------ boot
  function finish() {
    if (SC.finished) return;
    SC.finished = true;
    if (S.x && current === "exam") captureExamAnswers();
    saveState(true);
    if (SC.api) {
      var secs = Math.round((Date.now() - SC.start) / 1000), hh = Math.floor(secs / 3600), mm = Math.floor(secs / 60) % 60, ss = secs % 60;
      sset("cmi.core.session_time", (hh < 10 ? "000" : hh < 100 ? "00" : hh < 1000 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm + ":" + (ss < 10 ? "0" : "") + ss);
      sset("cmi.core.exit", S.e.p ? "" : "suspend");
      commit();
      try { SC.api.LMSFinish(""); } catch (e) {}
    }
  }

  function boot() {
    initScorm();
    loadState();
    document.getElementById("footer").textContent = C.footer;
    document.title = C.title;
    if (SC.preview) {
      var m = document.getElementById("mode");
      m.hidden = false;
      m.textContent = "Preview mode — progress not reported (no LMS connection; progress is kept in this browser only).";
    }
    updateLessonStatus();
    commit();
    document.getElementById("navtoggle").addEventListener("click", function () {
      var n = document.getElementById("nav"), open = !n.classList.contains("open");
      n.classList.toggle("open", open);
      this.setAttribute("aria-expanded", open ? "true" : "false");
    });
    var loc = SC.api ? sget("cmi.core.lesson_location") : "";
    if (S.x) loc = "exam";
    if (loc && (loc === "home" || loc === "exam" || loc === "practical" || /^m:\d+$/.test(loc))) current = loc;
    render();
    window.addEventListener("pagehide", finish);
    window.addEventListener("beforeunload", finish);
    window.addEventListener("unload", finish);
  }

  // Small hooks for automated QA (an LMS learner gains nothing they couldn't do with devtools anyway).
  window.MosaicPlayer = {
    unlockExam: function () { RUNTIME.unlock = true; render(); },
    state: function () { return JSON.parse(JSON.stringify(S)); },
    suspendLength: function () { return JSON.stringify(S).length; },
    go: go,
    finish: finish
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
