"use strict";

/* ================= data & config ================= */

const TOPICS = [
  { id: "family", color: "#e573b8" },
  { id: "work", color: "#f76b15" },
  { id: "money", color: "#ffd23f" },
  { id: "politics", color: "#9d5bd2" },
  { id: "misc", color: "#3e9ad9" },
];

const SCALE_BAND = (s) => [s * 2 - 1, s * 2];
const SCALE_EMOJI = ["😇", "🙂", "🤔", "🔥", "😅"];

const I18N = {
  en: {
    setupTitle: "Setup",
    topicsLabel: "Topics",
    difficultyLabel: "Depth",
    toWheel: "Go to the wheel →",
    wheelTitle: "Spin it!",
    wheelHint: "Tap the middle button — or swipe the wheel",
    wheelEmpty: "No questions match your filters. Go back and widen them!",
    nextQuestion: "Next question",
    spinAgain: "Spin again",
    backToSetup: "Setup",
    bye: "Ok bye 👋",
    poolSingular: "question in the pool",
    poolPlural: "questions in the pool",
    scaleNames: ["small talk", "casual", "personal", "deep", "secrets & truths"],
  },
  de: {
    setupTitle: "Einstellungen",
    topicsLabel: "Themen",
    difficultyLabel: "Tiefe",
    toWheel: "Zum Rad →",
    wheelTitle: "Dreh's!",
    wheelHint: "Tippe auf den Knopf in der Mitte — oder wische über das Rad",
    wheelEmpty: "Keine Fragen passen zu deinen Filtern. Gehe zurück und stelle sie weiter!",
    nextQuestion: "Nächste Frage",
    spinAgain: "Nochmal drehen",
    backToSetup: "Einstellungen",
    bye: "Ok tschüss 👋",
    poolSingular: "Frage im Topf",
    poolPlural: "Fragen im Topf",
    scaleNames: ["Small Talk", "locker", "persönlich", "tief", "Geheimnisse & Wahrheiten"],
  },
};

const SCALE_COLOR = (s) => `hsl(${120 - (s - 1) * 30}, 65%, 45%)`;

/* ================= state ================= */

const state = {
  lang: localStorage.getItem("cs-lang") || "en",
  questions: [],
  selectedTopics: new Set(JSON.parse(localStorage.getItem("cs-topics") || "null") || TOPICS.map((t) => t.id)),
  depth: parseInt(localStorage.getItem("cs-depth") || "3", 10),
  bag: [],
  spinning: false,
};

const $ = (sel) => document.querySelector(sel);

/* ================= csv parsing ================= */

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

function loadQuestions(csvText) {
  const rows = parseCSV(csvText);
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {
    topic: header.indexOf("topic"),
    question: header.indexOf("question"),
    question_de: header.indexOf("question_de"),
    difficulty: header.indexOf("difficulty"),
  };
  const topics = new Set(TOPICS.map((t) => t.id));
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const topic = (r[idx.topic] || "").trim().toLowerCase();
    const difficulty = parseInt((r[idx.difficulty] || "").trim(), 10);
    if (!topics.has(topic)) { console.warn(`Row ${i + 1}: unknown topic "${topic}" — skipped`); continue; }
    if (!(difficulty >= 1 && difficulty <= 10)) { console.warn(`Row ${i + 1}: bad difficulty — skipped`); continue; }
    const q = (r[idx.question] || "").trim();
    const qde = (idx.question_de >= 0 ? r[idx.question_de] : "").trim();
    if (!q && !qde) continue;
    out.push({ topic, difficulty, en: q, de: qde || q });
  }
  return out;
}

/* ================= i18n / UI text ================= */

function applyI18n() {
  const t = I18N[state.lang];
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t[el.dataset.i18n] || ""; });
  updatePoolCount();
}

/* ================= routing (browser back/forward) ================= */

const ROUTES = { "": "screen-intro", intro: "screen-intro", setup: "screen-setup", wheel: "screen-wheel", bye: "screen-bye" };

function routeFromHash() {
  return (location.hash.replace(/^#\/?/, "") || "intro");
}

function showScreen(id, push) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $("#" + id).classList.add("active");
  if (push) {
    const name = Object.keys(ROUTES).find((k) => ROUTES[k] === id);
    const target = `#/${name}`;
    if (location.hash !== target) history.pushState({ screen: name }, "", target);
  }
}

function syncFromRoute() {
  const name = routeFromHash();
  const id = ROUTES[name] || "screen-intro";
  if (id === "screen-wheel") buildWheel();
  if (id === "screen-intro" || id === "screen-bye") hideResult();
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $("#" + id).classList.add("active");
}

function goTo(name) {
  history.pushState({ screen: name }, "", `#/${name}`);
  syncFromRoute();
}

/* ================= setup screen ================= */

function buildTopicBoard() {
  const board = $("#topic-board");
  board.innerHTML = "";
  TOPICS.forEach((tp) => {
    const btn = document.createElement("button");
    btn.className = "topic-btn";
    btn.style.setProperty("--tc", tp.color);
    btn.textContent = tp.id;
    btn.setAttribute("aria-pressed", state.selectedTopics.has(tp.id));
    if (state.selectedTopics.has(tp.id)) btn.classList.add("on");
    btn.addEventListener("click", () => {
      if (state.selectedTopics.has(tp.id)) {
        if (state.selectedTopics.size <= 1) return;
        state.selectedTopics.delete(tp.id);
      } else state.selectedTopics.add(tp.id);
      btn.classList.toggle("on", state.selectedTopics.has(tp.id));
      btn.setAttribute("aria-pressed", state.selectedTopics.has(tp.id));
      saveTopics();
      updatePoolCount();
      buildWheel();
    });
    board.appendChild(btn);
  });
}

function saveTopics() {
  localStorage.setItem("cs-topics", JSON.stringify([...state.selectedTopics]));
}

function spinScaleRange() {
  const vals = [];
  for (let s = Math.max(1, state.depth - 1); s <= Math.min(5, state.depth + 1); s++) vals.push(s);
  return vals;
}

function inScaleBand(q, s) {
  const [lo, hi] = SCALE_BAND(s);
  return q.difficulty >= lo && q.difficulty <= hi;
}

function filterPool() {
  const scales = spinScaleRange();
  return state.questions.filter(
    (q) => state.selectedTopics.has(q.topic) && scales.some((s) => inScaleBand(q, s))
  );
}

function updatePoolCount() {
  const n = filterPool().length;
  const t = I18N[state.lang];
  const el = $("#pool-count");
  if (el) el.textContent = n === 0 ? "" : `${n} ${n === 1 ? t.poolSingular : t.poolPlural}`;
}

function emojiThumbURL(emoji) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='88'>${emoji}</text></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function setupDepthInput() {
  const el = $("#depth-slider");
  el.value = state.depth;
  const readout = () => {
    const emoji = SCALE_EMOJI[state.depth - 1];
    $("#depth-readout").textContent = emoji;
    el.style.setProperty("--thumb-bg", emojiThumbURL(emoji));
  };
  readout();
  el.addEventListener("input", () => {
    state.depth = parseInt(el.value, 10);
    localStorage.setItem("cs-depth", String(state.depth));
    readout();
    updatePoolCount();
    buildWheel();
  });
}

/* ================= wheel ================= */

const CX = 150, CY = 150, R_OUT = 148, R_IN = 88, R_LABEL_OUT = 124, R_LABEL_IN = 60;
const NS = "http://www.w3.org/2000/svg";
let wheel = null;

function segPath(cx, cy, r0, r1, a0, a1) {
  const x = (r, a) => cx + r * Math.cos(a), y = (r, a) => cy + r * Math.sin(a);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${x(r0, a0)} ${y(r0, a0)} L ${x(r1, a0)} ${y(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${x(r1, a1)} ${y(r1, a1)} L ${x(r0, a1)} ${y(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${x(r0, a0)} ${y(r0, a0)} Z`;
}

function depthSlices(pool) {
  const has = (s) => pool.some((q) => inScaleBand(q, s));
  const raw = spinScaleRange().map((s) => ({ value: s, weight: s === state.depth ? 2 : 1, has: has(s) }));
  const usable = raw.filter((r) => r.has);
  if (usable.length === 0) return [];
  const total = usable.reduce((a, r) => a + r.weight, 0);
  return usable.map((r) => ({ value: r.value, frac: r.weight / total }));
}

function buildWheel() {
  const svg = $("#wheel-svg");
  if (!svg) return;
  svg.innerHTML = "";

  const pool = filterPool();
  const topics = TOPICS.filter((t) => state.selectedTopics.has(t.id) && pool.some((q) => q.topic === t.id));
  const slices = depthSlices(pool);

  const empty = topics.length === 0 || slices.length === 0;
  $("#wheel-empty").classList.toggle("hidden", !empty);
  $("#btn-spin").disabled = empty;
  if (empty) { wheel = null; return; }

  const tUnit = (Math.PI * 2) / topics.length;

  const gOuter = document.createElementNS(NS, "g");
  gOuter.id = "ring-outer";
  const gInner = document.createElementNS(NS, "g");
  gInner.id = "ring-inner";

  topics.forEach((tp, i) => {
    const a0 = i * tUnit - Math.PI / 2, a1 = a0 + tUnit;
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", segPath(CX, CY, R_IN, R_OUT, a0, a1));
    p.setAttribute("fill", tp.color);
    p.setAttribute("stroke", "rgba(0,0,0,0.35)");
    gOuter.appendChild(p);
    const mid = (a0 + a1) / 2;
    const lx = CX + R_LABEL_OUT * Math.cos(mid), ly = CY + R_LABEL_OUT * Math.sin(mid);
    const label = document.createElementNS(NS, "text");
    label.setAttribute("x", lx);
    label.setAttribute("y", ly);
    label.setAttribute("fill", "#fff");
    label.setAttribute("font-size", "15");
    label.setAttribute("font-weight", "700");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("dominant-baseline", "middle");
    label.setAttribute("transform", `rotate(${(mid * 180) / Math.PI + 90}, ${lx}, ${ly})`);
    label.textContent = tp.id;
    gOuter.appendChild(label);
  });

  let angle = -Math.PI / 2;
  const sliceAngles = [];
  slices.forEach((sl) => {
    const span = sl.frac * Math.PI * 2;
    sliceAngles.push({ value: sl.value, a0: angle, a1: angle + span });
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", segPath(CX, CY, 16, R_IN - 4, angle, angle + span));
    p.setAttribute("fill", SCALE_COLOR(sl.value));
    p.setAttribute("stroke", "rgba(0,0,0,0.35)");
    gInner.appendChild(p);
    const mid = angle + span / 2;
    const label = document.createElementNS(NS, "text");
    label.setAttribute("x", CX + R_LABEL_IN * Math.cos(mid));
    label.setAttribute("y", CY + R_LABEL_IN * Math.sin(mid));
    label.setAttribute("fill", "#fff");
    label.setAttribute("font-size", "20");
    label.setAttribute("font-weight", "800");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("dominant-baseline", "middle");
    label.textContent = sl.value;
    gInner.appendChild(label);
    angle += span;
  });

  svg.appendChild(gOuter);
  svg.appendChild(gInner);

  wheel = { topics, slices: sliceAngles, tUnit, rotO: 0, rotI: 0 };
  setRingRotations(0, 0);
}

function setRingRotations(o, i) {
  $("#ring-outer").style.transform = `rotate(${o}deg)`;
  $("#ring-outer").style.transformOrigin = "150px 150px";
  $("#ring-inner").style.transform = `rotate(${i}deg)`;
  $("#ring-inner").style.transformOrigin = "150px 150px";
}

function topicAt(rot) {
  const norm = ((-rot % 360) + 360) % 360;
  const idx = Math.floor(norm / (wheel.tUnit * 180 / Math.PI)) % wheel.topics.length;
  return wheel.topics[idx].id;
}

function sliceValueAt(rot) {
  const rad = (((-rot % 360) + 360) % 360) * Math.PI / 180 - Math.PI / 2;
  for (const sl of wheel.slices) {
    const a1 = sl.a1 < sl.a0 ? sl.a1 + Math.PI * 2 : sl.a1;
    let r = rad;
    while (r < sl.a0) r += Math.PI * 2;
    if (r < a1) return sl.value;
  }
  return wheel.slices[wheel.slices.length - 1].value;
}

/* intensity: 1 = gentle tap default, up to ~4 for a hard swipe.
   outer ring turns clockwise, inner ring counter-clockwise at a
   different speed so the two rings land in fresh combinations */
function spin(intensity) {
  if (state.spinning || !wheel) return;
  state.spinning = true;
  $("#btn-spin").classList.add("spinning");
  hideResult();

  const k = Math.min(Math.max(intensity, 0.6), 4);
  const t = wheel;
  const startO = t.rotO % 360, startI = t.rotI % 360;
  const turnsO = 1.2 + k * 1.4 + Math.random() * 0.3;
  const turnsI = (1 + k * 0.9 + Math.random() * 0.3);
  const endO = startO - turnsO * 360;
  const endI = startI + turnsI * 360;
  const dur = 3800 + k * 900;
  const t0 = performance.now();

  function frame(now) {
    const p = Math.min((now - t0) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    setRingRotations(startO + (endO - startO) * ease, startI + (endI - startI) * ease);
    if (p < 1) requestAnimationFrame(frame);
    else {
      t.rotO = endO; t.rotI = endI;
      finishSpin(topicAt(endO), sliceValueAt(endI));
    }
  }
  requestAnimationFrame(frame);
}

/* ================= results ================= */

function finishSpin(topic, value) {
  state.spinning = false;
  $("#btn-spin").classList.remove("spinning");

  const matches = (q) => q.topic === topic && inScaleBand(q, value);
  if (state.bag.length === 0 || !state.bag.some(matches)) {
    state.bag = filterPool().slice().sort(() => Math.random() - 0.5);
  }
  let q = state.bag.find(matches);
  if (!q) q = state.bag.find((x) => x.topic === topic);
  if (!q) q = state.bag[0];
  state.bag = state.bag.filter((x) => x !== q);

  showResult(q, value);
}

function showResult(q, value) {
  const tp = TOPICS.find((t) => t.id === q.topic);
  const t = I18N[state.lang];
  const panel = $("#result-panel");
  panel.style.setProperty("--tc", tp ? tp.color : "#888");
  $("#result-topic").textContent = tp ? tp.id : q.topic;
  $("#result-depth").textContent = `${SCALE_EMOJI[value - 1]} ${t.scaleNames[value - 1]}`;
  $("#result-question").textContent = q[state.lang] || q.en;
  panel.classList.remove("hidden");
}

function hideResult() {
  $("#result-panel").classList.add("hidden");
}

/* ================= swipe support (velocity → spin intensity) ================= */

function setupSwipe() {
  let tracking = false, samples = [];
  const el = $("#wheel-container");
  el.addEventListener("pointerdown", (e) => {
    if (e.target.closest("#btn-spin")) return;
    tracking = true;
    samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
  });
  window.addEventListener("pointermove", (e) => {
    if (!tracking) return;
    samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (samples.length > 8) samples.shift();
  });
  window.addEventListener("pointerup", () => {
    if (!tracking) return;
    tracking = false;
    if (samples.length < 2) return;
    const first = samples[0], last = samples[samples.length - 1];
    const dist = Math.hypot(last.x - first.x, last.y - first.y);
    const dt = Math.max(last.t - first.t, 1);
    if (dist < 40) return;
    const v = dist / dt;
    spin(Math.min(4, 0.6 + v * 1.6));
  });
}

/* ================= wiring ================= */

function wireButtons() {
  document.querySelectorAll("[data-start]").forEach((b) =>
    b.addEventListener("click", () => {
      state.lang = b.dataset.start;
      localStorage.setItem("cs-lang", state.lang);
      applyI18n();
      updateEmojiLabels();
      goTo("setup");
    })
  );
  document.querySelectorAll("[data-decline]").forEach((b) =>
    b.addEventListener("click", () => {
      state.lang = b.dataset.decline;
      localStorage.setItem("cs-lang", state.lang);
      applyI18n();
      updateEmojiLabels();
      goTo("bye");
    })
  );
  $("#btn-back-intro").addEventListener("click", () => goTo("intro"));
  $("#btn-back-setup").addEventListener("click", () => { hideResult(); goTo("setup"); });
  $("#btn-to-wheel").addEventListener("click", () => { buildWheel(); goTo("wheel"); });
  $("#btn-spin").addEventListener("click", () => spin(1.2));
  $("#btn-next-question").addEventListener("click", () => {
    if (!wheel) return;
    finishSpin(topicAt(wheel.rotO), sliceValueAt(wheel.rotI));
  });
  $("#btn-respin").addEventListener("click", () => spin(1.2));
  $("#btn-to-setup").addEventListener("click", () => { hideResult(); goTo("setup"); });
  window.addEventListener("popstate", syncFromRoute);
}

function updateEmojiLabels() {
  $("#depth-readout").textContent = SCALE_EMOJI[state.depth - 1];
  const el = $("#depth-slider");
  if (el) el.style.setProperty("--thumb-bg", emojiThumbURL(SCALE_EMOJI[state.depth - 1]));
}

/* ================= init ================= */

async function init() {
  applyI18n();
  buildTopicBoard();
  setupDepthInput();
  setupSwipe();
  wireButtons();
  try {
    const res = await fetch("questions.csv");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.questions = loadQuestions(await res.text());
  } catch (err) {
    console.error("Failed to load questions.csv:", err);
    const el = $("#wheel-empty");
    el.classList.remove("hidden");
    el.textContent = "Could not load questions.csv — serve this folder over http(s).";
  }
  updatePoolCount();
  buildWheel();
  if (!location.hash) history.replaceState({ screen: "intro" }, "", "#/intro");
  syncFromRoute();
}

init();
