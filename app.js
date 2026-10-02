"use strict";

/* ================= data & config ================= */

const TOPICS = [
  { id: "family", color: "#e573b8" },
  { id: "friends", color: "#3e9ad9" },
  { id: "work", color: "#f76b15" },
  { id: "values", color: "#46a758" },
  { id: "secrets", color: "#e5484d" },
];

/* depth scale 1..5, each value covers two CSV difficulties */
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
    decline: "Fine — talk to you never. 💔",
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
    decline: "Na gut — dann eben nie. 💔",
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
    if (!topics.has(topic)) continue;
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

/* ================= screens ================= */

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $("#" + id).classList.add("active");
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

/* scale values that can come up for the chosen depth: depth-1, depth, depth+1 */
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

function setupDepthInput() {
  const el = $("#depth-slider");
  el.value = state.depth;
  const readout = () => {
    $("#depth-readout").textContent = `${SCALE_EMOJI[state.depth - 1]} ${state.depth}`;
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

/* weighted slices for the inner ring: center value 50%, neighbors 25% each
   (clamped & renormalized at the scale edges or when a value has no questions) */
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
    label.setAttribute("font-size", topics.length > 5 ? 10 : 13);
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
    label.setAttribute("font-size", "16");
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

/* slower & longer: ~1.5 turns over ~5.5s with a long ease-out */
function spin() {
  if (state.spinning || !wheel) return;
  state.spinning = true;
  $("#btn-spin").classList.add("spinning");
  hideResult();

  const t = wheel;
  const startO = t.rotO % 360, startI = t.rotI % 360;
  const endO = startO - (360 * 1.2 + Math.random() * 180);
  const endI = startI + (Math.random() < 0.5 ? -1 : 1) * (360 * 1 + Math.random() * 180);
  const dur = 5500 + Math.random() * 1000;
  const t0 = performance.now();

  function frame(now) {
    const p = Math.min((now - t0) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    setRingRotations(startO + (endO - startO) * ease, startI + (endI - startI) * ease);
    if (p < 1) requestAnimationFrame(frame);
    else {
      t.rotO = endO; t.rotI = endI;
      const topic = topicAt(endO);
      const value = sliceValueAt(endI);
      finishSpin(topic, value);
    }
  }
  requestAnimationFrame(frame);
}

/* ================= results ================= */

function bandMatch(q, s) { return inScaleBand(q, s); }

function finishSpin(topic, value) {
  state.spinning = false;
  $("#btn-spin").classList.remove("spinning");

  const matches = (q) => q.topic === topic && bandMatch(q, value);
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

/* ================= swipe support ================= */

function setupSwipe() {
  let sx = 0, sy = 0, tracking = false;
  const el = $("#wheel-container");
  el.addEventListener("pointerdown", (e) => {
    if (e.target.closest("#btn-spin")) return;
    tracking = true; sx = e.clientX; sy = e.clientY;
  });
  window.addEventListener("pointerup", (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.hypot(dx, dy) > 40) spin();
  });
}

/* ================= wiring ================= */

function wireButtons() {
  document.querySelectorAll("[data-start]").forEach((b) =>
    b.addEventListener("click", () => {
      state.lang = b.dataset.start;
      localStorage.setItem("cs-lang", state.lang);
      applyI18n();
      buildWheel();
      showScreen("screen-setup");
    })
  );
  document.querySelectorAll("[data-decline]").forEach((b) =>
    b.addEventListener("click", () => {
      $("#intro-decline-msg").textContent = I18N[b.dataset.decline].decline;
    })
  );
  $("#btn-back-intro").addEventListener("click", () => showScreen("screen-intro"));
  $("#btn-back-setup").addEventListener("click", () => { hideResult(); showScreen("screen-setup"); });
  $("#btn-to-wheel").addEventListener("click", () => { buildWheel(); showScreen("screen-wheel"); });
  $("#btn-spin").addEventListener("click", spin);
  $("#btn-next-question").addEventListener("click", () => {
    if (!wheel) return;
    finishSpin(topicAt(wheel.rotO), sliceValueAt(wheel.rotI));
  });
  $("#btn-respin").addEventListener("click", () => { hideResult(); spin(); });
  $("#btn-to-setup").addEventListener("click", () => { hideResult(); showScreen("screen-setup"); });
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
}

init();
