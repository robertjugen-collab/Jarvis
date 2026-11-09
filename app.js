/* =========================================================
   JARVIS HUD — app.js
   Ren HTML/JS, inga beroenden. Väder via Open-Meteo (gratis, ingen nyckel).
   ========================================================= */

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const startTime = Date.now();

/* ---------------- Logg ---------------- */
function log(msg, cls = "") {
  const li = document.createElement("li");
  const t = new Date();
  li.className = cls;
  li.innerHTML = `<time>${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}</time>`;
  li.append(document.createTextNode(msg));
  const ul = $("log");
  ul.append(li);
  while (ul.children.length > 80) ul.firstChild.remove();
  ul.scrollTop = ul.scrollHeight;
}

/* ---------------- Boot-sekvens ---------------- */
const bootLines = [
  "> Laddar kärnmoduler ............ OK",
  "> Kalibrerar holografisk display . OK",
  "> Ansluter till satellitlänk ..... OK",
  "> Startar röstigenkänning ........ OK",
  "> Synkroniserar väderdata ........ OK",
  "> Kontrollerar säkerhetsprotokoll  OK",
  "> Alla system nominella.",
];
function boot() {
  const pre = $("boot-log");
  let i = 0;
  const step = () => {
    if (i < bootLines.length) {
      pre.textContent += bootLines[i] + "\n";
      $("boot-fill").style.width = ((i + 1) / bootLines.length) * 100 + "%";
      i++;
      setTimeout(step, 180 + Math.random() * 260);
    } else {
      $("boot-start").hidden = false;
      $("boot-start").focus();
    }
  };
  step();
}
$("boot-start").addEventListener("click", () => {
  $("boot").classList.add("done");
  $("hud").classList.add("on");
  const h = new Date().getHours();
  const greet = h < 5 ? "God natt" : h < 10 ? "God morgon" : h < 18 ? "God dag" : "God kväll";
  respond(`${greet}. Alla system är online. Hur kan jag hjälpa dig?`);
  log("Systemet aktiverat");
  maybeShowSetup();
});

/* ---------------- Bakgrund: rutnät + partiklar ---------------- */
const bg = $("bg"), bctx = bg.getContext("2d");
let particles = [];
function sizeBg() {
  bg.width = innerWidth * devicePixelRatio;
  bg.height = innerHeight * devicePixelRatio;
  particles = Array.from({ length: 70 }, () => ({
    x: Math.random() * bg.width, y: Math.random() * bg.height,
    vx: (Math.random() - .5) * .3, vy: (Math.random() - .5) * .3, r: Math.random() * 1.6 + .4,
  }));
}
addEventListener("resize", sizeBg); sizeBg();
function drawBg() {
  const w = bg.width, h = bg.height, s = 48 * devicePixelRatio;
  bctx.clearRect(0, 0, w, h);
  bctx.strokeStyle = "rgba(37,213,255,0.05)"; bctx.lineWidth = 1;
  bctx.beginPath();
  for (let x = 0; x < w; x += s) { bctx.moveTo(x, 0); bctx.lineTo(x, h); }
  for (let y = 0; y < h; y += s) { bctx.moveTo(0, y); bctx.lineTo(w, y); }
  bctx.stroke();
  bctx.fillStyle = "rgba(122,240,255,0.6)";
  for (const p of particles) {
    p.x = (p.x + p.vx + w) % w; p.y = (p.y + p.vy + h) % h;
    bctx.beginPath(); bctx.arc(p.x, p.y, p.r * devicePixelRatio, 0, 7); bctx.fill();
  }
}

/* ---------------- Reaktorringar (genererade) ---------------- */
(function buildRings() {
  const NS = "http://www.w3.org/2000/svg";
  const ticks = $("ticks");
  for (let i = 0; i < 120; i++) {
    const l = document.createElementNS(NS, "line");
    const long = i % 10 === 0;
    l.setAttribute("x1", 0); l.setAttribute("y1", -195);
    l.setAttribute("x2", 0); l.setAttribute("y2", long ? -180 : -188);
    l.setAttribute("stroke", "#25d5ff"); l.setAttribute("stroke-width", long ? 2 : 1);
    l.setAttribute("opacity", long ? .9 : .45);
    l.setAttribute("transform", `rotate(${i * 3})`);
    ticks.append(l);
  }
  const seg = $("segments");
  for (let i = 0; i < 10; i++) {
    const p = document.createElementNS(NS, "path");
    const a0 = (i * 36 + 3) * Math.PI / 180, a1 = (i * 36 + 30) * Math.PI / 180;
    const R = 122, r = 104;
    const pt = (rad, a) => `${(rad * Math.sin(a)).toFixed(1)} ${(-rad * Math.cos(a)).toFixed(1)}`;
    p.setAttribute("d", `M${pt(R, a0)} A${R} ${R} 0 0 1 ${pt(R, a1)} L${pt(r, a1)} A${r} ${r} 0 0 0 ${pt(r, a0)}Z`);
    p.setAttribute("fill", "rgba(37,213,255,.35)");
    p.setAttribute("stroke", "#25d5ff");
    seg.append(p);
  }
})();

/* ---------------- Klocka ---------------- */
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 864e5 + 1) / 7);
}
function tickClock() {
  const d = new Date();
  $("clock").firstChild.nodeValue = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  $("sec").textContent = ":" + pad(d.getSeconds());
  $("topclock").textContent = d.toLocaleTimeString("sv-SE");
  $("date").textContent = d.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  $("week").textContent = isoWeek(d);
  const up = Math.floor((Date.now() - startTime) / 1000);
  $("uptime").textContent = `${pad(Math.floor(up / 3600))}:${pad(Math.floor(up / 60) % 60)}:${pad(up % 60)}`;
}
setInterval(tickClock, 1000); tickClock();

/* ---------------- Väder (Open-Meteo) ---------------- */
const WMO = {
  0: "Klart", 1: "Mestadels klart", 2: "Halvklart", 3: "Mulet", 45: "Dimma", 48: "Rimfrost",
  51: "Lätt duggregn", 53: "Duggregn", 55: "Kraftigt duggregn", 61: "Lätt regn", 63: "Regn", 65: "Kraftigt regn",
  66: "Underkylt regn", 67: "Underkylt regn", 71: "Lätt snöfall", 73: "Snöfall", 75: "Kraftigt snöfall", 77: "Kornsnö",
  80: "Regnskurar", 81: "Regnskurar", 82: "Kraftiga skurar", 85: "Snöbyar", 86: "Kraftiga snöbyar",
  95: "Åska", 96: "Åska med hagel", 99: "Åska med hagel",
};
let weather = null;

async function loadWeather(lat, lon, place) {
  $("coords").textContent = `LAT ${lat.toFixed(4)} LON ${lon.toFixed(4)}`;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&wind_speed_unit=ms&timezone=auto`;
    const r = await fetch(url);
    const j = await r.json();
    const c = j.current;
    weather = { temp: Math.round(c.temperature_2m), desc: WMO[c.weather_code] || "Okänt", wind: c.wind_speed_10m, hum: c.relative_humidity_2m, place, daily: j.daily };
    $("wx-temp").textContent = weather.temp + "°";
    $("wx-desc").textContent = weather.desc;
    $("wx-wind").textContent = `${c.wind_speed_10m.toFixed(1)} m/s`;
    $("wx-hum").textContent = `${c.relative_humidity_2m}%`;
    $("sunrise").textContent = j.daily.sunrise[0].slice(11);
    $("sunset").textContent = j.daily.sunset[0].slice(11);
    $("wx-fc").innerHTML = j.daily.time.slice(1, 6).map((t, i) => {
      const day = new Date(t).toLocaleDateString("sv-SE", { weekday: "short" }).toUpperCase();
      return `<div>${day}<b>${Math.round(j.daily.temperature_2m_max[i + 1])}°</b>${Math.round(j.daily.temperature_2m_min[i + 1])}°</div>`;
    }).join("");
    log(`Väderdata uppdaterad (${place})`);
  } catch (e) {
    $("wx-desc").textContent = "Ingen väderdata";
    log("Kunde inte hämta väder", "warn");
  }
}

async function placeName(lat, lon) {
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=sv`);
    const j = await r.json();
    return j.city || j.locality || "OKÄND PLATS";
  } catch { return "OKÄND PLATS"; }
}

function locate() {
  const fallback = () => { $("wx-place").textContent = "STOCKHOLM"; loadWeather(59.3293, 18.0686, "Stockholm"); };
  if (!navigator.geolocation) return fallback();
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude: lat, longitude: lon } = pos.coords;
    const name = await placeName(lat, lon);
    $("wx-place").textContent = name.toUpperCase();
    loadWeather(lat, lon, name);
  }, () => { log("Position nekad – använder Stockholm", "warn"); fallback(); }, { timeout: 8000 });
}
locate();
setInterval(locate, 15 * 60 * 1000);

/* ---------------- Systemdiagnostik (riktiga webbläsarvärden) ---------------- */
let fps = 60, frames = 0, lastFpsT = performance.now(), lag = 0;
// Event loop-latens (används av kommandot "diagnostik")
(function measureLag() {
  const t = performance.now();
  setTimeout(() => { lag = Math.max(0, performance.now() - t - 100); measureLag(); }, 100);
})();
function updNet() {
  $("pill-net").querySelector(".dot").className = "dot " + (navigator.onLine ? "ok" : "");
}
addEventListener("online", updNet); addEventListener("offline", updNet); updNet();

/* ---------------- Radar ---------------- */
const radar = $("radar"), rctx = radar.getContext("2d");
let sweep = 0;
const blips = Array.from({ length: 7 }, () => ({ a: Math.random() * Math.PI * 2, d: .2 + Math.random() * .75, life: 0 }));
function drawRadar() {
  const w = radar.width, c = w / 2, R = c - 6;
  rctx.clearRect(0, 0, w, w);
  rctx.strokeStyle = "rgba(37,213,255,.35)"; rctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) { rctx.beginPath(); rctx.arc(c, c, (R * i) / 4, 0, 7); rctx.stroke(); }
  rctx.beginPath(); rctx.moveTo(c - R, c); rctx.lineTo(c + R, c); rctx.moveTo(c, c - R); rctx.lineTo(c, c + R); rctx.stroke();
  // svep
  sweep = (sweep + 0.025) % (Math.PI * 2);
  const g = rctx.createConicGradient ? rctx.createConicGradient(sweep - 1.2, c, c) : null;
  if (g) {
    g.addColorStop(0, "rgba(37,213,255,0)"); g.addColorStop(1.2 / (Math.PI * 2), "rgba(37,213,255,.45)"); g.addColorStop(1.2 / (Math.PI * 2) + .001, "rgba(37,213,255,0)");
    rctx.fillStyle = g; rctx.beginPath(); rctx.arc(c, c, R, 0, 7); rctx.fill();
  }
  rctx.strokeStyle = "#7af0ff"; rctx.beginPath(); rctx.moveTo(c, c);
  rctx.lineTo(c + Math.cos(sweep) * R, c + Math.sin(sweep) * R); rctx.stroke();
  for (const b of blips) {
    const diff = (sweep - b.a + Math.PI * 2) % (Math.PI * 2);
    if (diff < 0.05) b.life = 1;
    b.life *= 0.985;
    if (b.life > .05) {
      rctx.fillStyle = `rgba(122,240,255,${b.life})`;
      rctx.beginPath(); rctx.arc(c + Math.cos(b.a) * b.d * R, c + Math.sin(b.a) * b.d * R, 3.5, 0, 7); rctx.fill();
    }
    if (Math.random() < 0.0008) { b.a = Math.random() * Math.PI * 2; b.d = .2 + Math.random() * .75; }
  }
}

/* ---------------- Energigraf (förbrukning + sol, senaste 60 mätningarna) ---------------- */
const graph = $("graph"), gctx = graph.getContext("2d");
const energyHist = []; // { house, solar } i watt
function drawSeries(key, color, max, fill) {
  const w = graph.width, h = graph.height, step = w / 59;
  gctx.beginPath();
  energyHist.forEach((p, i) => { const x = i * step, y = h - 4 - ((p[key] || 0) / max) * (h - 10); i ? gctx.lineTo(x, y) : gctx.moveTo(x, y); });
  gctx.strokeStyle = color; gctx.lineWidth = 2; gctx.shadowColor = color; gctx.shadowBlur = 8; gctx.stroke();
  gctx.shadowBlur = 0;
  if (fill) { gctx.lineTo((energyHist.length - 1) * step, h); gctx.lineTo(0, h); gctx.closePath(); gctx.fillStyle = fill; gctx.fill(); }
}
function drawGraph() {
  const w = graph.width, h = graph.height;
  gctx.clearRect(0, 0, w, h);
  gctx.strokeStyle = "rgba(37,213,255,.12)"; gctx.lineWidth = 1;
  for (let y = 0; y < h; y += 22) { gctx.beginPath(); gctx.moveTo(0, y); gctx.lineTo(w, y); gctx.stroke(); }
  if (energyHist.length < 2) return;
  const max = Math.max(1000, ...energyHist.map((p) => Math.max(p.house || 0, p.solar || 0))) * 1.15;
  drawSeries("house", "#25d5ff", max, "rgba(37,213,255,.12)");
  drawSeries("solar", "#ffb347", max);
}

/* ---------------- Vågform i reaktorn ---------------- */
const wave = $("wave"), wctx = wave.getContext("2d");
let energy = 0, targetEnergy = 0;
function drawWave(t) {
  const w = wave.width, c = w / 2;
  wctx.clearRect(0, 0, w, w);
  energy += (targetEnergy - energy) * 0.08;
  if (energy < 0.01) return;
  wctx.strokeStyle = `rgba(255,255,255,${0.4 + energy * 0.5})`; wctx.lineWidth = 2;
  wctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const n = Math.sin(a * 6 + t / 120) * Math.sin(a * 3 - t / 200) + Math.sin(a * 11 + t / 80) * .5;
    const r = 112 + n * 16 * energy;
    const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
    i ? wctx.lineTo(x, y) : wctx.moveTo(x, y);
  }
  wctx.closePath(); wctx.stroke();
}

/* ---------------- Huvudloop ---------------- */
function loop(t) {
  frames++;
  if (t - lastFpsT >= 1000) { fps = (frames * 1000) / (t - lastFpsT); frames = 0; lastFpsT = t; }
  drawBg(); drawRadar(); drawGraph(); drawWave(t);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------------- Tal (ut) ---------------- */
let svVoice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  svVoice = vs.find((v) => v.lang === "sv-SE" && /male|mattias/i.test(v.name)) || vs.find((v) => v.lang.startsWith("sv")) || null;
}
if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

function setState(s) {
  const r = $("reactor");
  r.classList.toggle("speaking", s === "speaking");
  r.classList.toggle("listening", s === "listening");
  $("state").textContent = { speaking: "SVARAR", listening: "LYSSNAR", idle: "VILOLÄGE", thinking: "ANALYSERAR" }[s];
  targetEnergy = s === "idle" ? 0 : s === "thinking" ? .3 : 1;
}

function respond(text) {
  $("reply").textContent = text;
  log("JARVIS: " + text);
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "sv-SE"; if (svVoice) u.voice = svVoice;
  u.rate = 1.02; u.pitch = 0.9;
  u.onstart = () => setState("speaking");
  u.onend = u.onerror = () => setState("idle");
  speechSynthesis.speak(u);
}

/* ---------------- Homey ---------------- */
// Elmätaren som visas under ENERGI (matchas mot enhetens namn). Byt t.ex. till /Energy Dongle/i.
const ENERGY_METER = /pulse|tibber/i;
const homey = { configured: false, ok: false, devices: {}, zones: {}, flows: null };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const cap = (d, c) => d.capabilitiesObj?.[c]?.value;
const has = (d, c) => !!d.capabilitiesObj && c in d.capabilitiesObj;
const isLight = (d) => (d.class === "light" || d.virtualClass === "light") && has(d, "onoff");
const norm = (s) => String(s).toLowerCase().replace(/[^a-zåäöéü0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const fmtNum = (n, dec = 1) => Number(n).toLocaleString("sv-SE", { maximumFractionDigits: dec });

async function H(path, opts = {}) {
  const r = await fetch("/homey/" + path, { ...opts, headers: { "X-Jarvis": "1", "Content-Type": "application/json" } });
  if (!r.ok) {
    let e = "HTTP " + r.status;
    try { e = (await r.json()).error || e; } catch {}
    throw new Error(e);
  }
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

function zoneChain(id) {
  const out = [];
  for (let z = homey.zones[id]; z; z = homey.zones[z.parent]) out.push(z);
  return out; // [egen zon, förälder, ..., rot]
}
const zoneLabel = (id) => homey.zones[id]?.name || "Okänd";

// Matchar ord i texten inklusive svenska bestämda former (kök → köket, hall → hallen)
function wordIn(text, word) {
  const w = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const last = /[bcdfghjklmnpqrstvwxz]$/.test(word) ? word.slice(-1) + "?" : ""; // vardagsrum → vardagsrummet
  return new RegExp(`(^| )${w}(${last}(et|en|n|t|a|arna|erna))?( |$)`).test(text);
}
const GENERIC = new Set(["temperatur", "fukt", "led", "list", "lampa", "sensor", "hem"]);

/** Hittar enheter som texten syftar på: hela namnet → zon → enskilda ord i namnet. */
function findDevices(text, filter) {
  const t = norm(text);
  const pool = Object.values(homey.devices).filter(filter);
  const full = pool.filter((d) => wordIn(t, norm(d.name)));
  if (full.length) return { devices: full, label: full.map((d) => d.name).join(" och "), kind: "name" };
  const zones = Object.values(homey.zones).filter((z) => wordIn(t, norm(z.name)))
    .sort((a, b) => zoneChain(b.id).length - zoneChain(a.id).length); // mest specifik zon först
  if (zones.length) {
    const z = zones[0];
    const inZone = pool.filter((d) => zoneChain(d.zone).some((x) => x.id === z.id));
    if (inZone.length) return { devices: inZone, label: z.name, kind: "zone" };
  }
  let best = 0, hits = [];
  for (const d of pool) {
    const score = norm(d.name).split(" ").filter((w) => w.length > 2 && !GENERIC.has(w) && wordIn(t, w)).length;
    if (score > best) { best = score; hits = [d]; } else if (score && score === best) hits.push(d);
  }
  if (hits.length) return { devices: hits, label: hits.map((d) => d.name).join(" och "), kind: "name" };
  if (/(^| )(alla|allt|överallt|hela huset)( |$)/.test(t)) return { devices: pool, label: "hela huset", kind: "all" };
  return { devices: [], label: "" };
}

async function setCap(d, capId, value) {
  await H(`manager/devices/device/${d.id}/capability/${capId}`, { method: "PUT", body: JSON.stringify({ value }) });
  if (d.capabilitiesObj?.[capId]) d.capabilitiesObj[capId].value = value;
}

/* ---- Rendering ---- */
function keepScroll(el, html) { const s = el.scrollTop; el.innerHTML = html; el.scrollTop = s; }

function groupByZone(list) {
  const groups = {};
  for (const d of list) (groups[zoneLabel(d.zone)] ||= []).push(d);
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, "sv"));
}

function renderHomey() {
  const devs = Object.values(homey.devices);

  // Belysning
  const lights = devs.filter(isLight).sort((a, b) => a.name.localeCompare(b.name, "sv"));
  const onCount = lights.filter((d) => cap(d, "onoff")).length;
  $("lights-sub").textContent = `${onCount}/${lights.length} TÄNDA`;
  keepScroll($("lights"), groupByZone(lights).map(([zone, ds]) =>
    `<li class="zone">${esc(zone.toUpperCase())}</li>` + ds.map((d) => {
      const on = !!cap(d, "onoff"), dim = cap(d, "dim");
      return `<li><span class="name" title="${esc(d.name)}">${esc(d.name)}</span>` +
        `<span class="dimv">${on && dim != null ? Math.round(dim * 100) + "%" : ""}</span>` +
        `<button class="toggle ${on ? "on" : ""}" data-id="${d.id}" title="${on ? "Släck" : "Tänd"}"></button></li>`;
    }).join("")).join("") || `<li class="hint">Inga lampor hittades.</li>`);

  // Klimat
  const temps = devs.filter((d) => has(d, "measure_temperature") && cap(d, "measure_temperature") != null &&
    ["sensor", "thermostat", "airconditioning", "heater", "fan"].includes(d.class));
  $("climate-sub").textContent = `${temps.length} GIVARE`;
  keepScroll($("climate"), groupByZone(temps).map(([zone, ds]) =>
    `<li class="zone">${esc(zone.toUpperCase())}</li>` + ds.map((d) => {
      const v = cap(d, "measure_temperature"), hum = cap(d, "measure_humidity");
      const cls = v < 5 ? "cold" : v > 24 ? "warm" : "";
      const name = d.name.replace(/^Temperatur(\/Fukt)?\s*/i, "") || d.name;
      return `<li><span class="name" title="${esc(d.name)}">${esc(name)}</span>` +
        (hum != null ? `<span class="dimv">${Math.round(hum)}%</span>` : "") +
        `<span class="val ${cls}">${fmtNum(v)}°</span></li>`;
    }).join("")).join(""));

  // Energi
  const meter = devs.find((d) => ENERGY_METER.test(d.name) && has(d, "measure_power")) ||
    devs.find((d) => d.energyObj?.cumulative && has(d, "measure_power")) ||
    devs.find((d) => has(d, "meter_power.imported") && has(d, "measure_power"));
  const solars = devs.filter((d) => d.class === "solarpanel" && has(d, "measure_power"));
  const house = meter ? cap(meter, "measure_power") : null;
  const solar = solars.length ? solars.reduce((s, d) => s + (cap(d, "measure_power") || 0), 0) : null;
  homey.power = { house, solar, meter };
  $("e-house").textContent = house == null ? "-- W" : house >= 1000 ? fmtNum(house / 1000, 2) + " kW" : Math.round(house) + " W";
  $("e-solar").textContent = solar == null ? "-- W" : solar >= 1000 ? fmtNum(solar / 1000, 2) + " kW" : Math.round(solar) + " W";
  $("energy-sub").textContent = meter ? meter.name.toUpperCase().slice(0, 22) : "INGEN MÄTARE";
  energyHist.push({ house, solar });
  if (energyHist.length > 60) energyHist.shift();

  // Larm (visas, styrs aldrig)
  const alarm = devs.find((d) => has(d, "homealarm_state"));
  if (alarm) {
    const st = cap(alarm, "homealarm_state");
    const pill = $("pill-alarm");
    pill.hidden = false;
    pill.querySelector("span").textContent = { armed: "LARM PÅ", disarmed: "LARM AV", partially_armed: "LARM DEL" }[st] || "LARM ?";
    pill.querySelector(".dot").className = "dot " + (st === "armed" ? "ok" : st === "partially_armed" ? "" : "off");
  }
}

const CONNECT_BTN = `<button type="button" data-action="setup">ANSLUT HOMEY</button>`;
function homeyHint(html) {
  $("lights").innerHTML = $("climate").innerHTML = `<li class="hint">${html}</li>`;
}
function homeyDot(cls) { $("pill-homey").querySelector(".dot").className = "dot " + cls; }

function showNotConnected() {
  homey.ok = false; homey.devices = {}; homey.zones = {}; homey.flows = null;
  homeyDot("off");
  $("lights-sub").textContent = "--";
  $("climate-sub").textContent = "HOMEY";
  $("pill-alarm").hidden = true;
  homeyHint("Homey är inte ansluten ännu. Anslut med Homeys IP-adress och en API-nyckel för att styra lampor och se givare." + CONNECT_BTN);
}

async function pollHomey() {
  clearTimeout(homey.timer);
  if (!homey.configured) return;
  try {
    if (!Object.keys(homey.zones).length) homey.zones = await H("manager/zones/zone");
    homey.devices = await H("manager/devices/device");
    if (!homey.ok) log(`Homey ansluten – ${Object.keys(homey.devices).length} enheter`);
    homey.ok = true; homey.err = null;
    homeyDot("ok");
    renderHomey();
  } catch (e) {
    if (e.message === "not configured") { homey.configured = false; showNotConnected(); return; }
    if (homey.ok || homey.err !== e.message) log("Homey: " + e.message, "warn");
    homey.ok = false; homey.err = e.message;
    homeyDot("");
    homeyHint((e.message === "unreachable"
      ? "Kan inte nå Homey. Kontrollera att datorn är på samma nätverk och att IP-adressen stämmer."
      : `Homey svarade: ${esc(e.message)}. Kontrollera API-nyckeln och dess behörigheter.`) + CONNECT_BTN);
  }
  homey.timer = setTimeout(pollHomey, homey.ok ? 5000 : 30000);
}

async function initHomey() {
  try {
    const s = await (await fetch("/homey/status")).json();
    homey.configured = s.configured; homey.url = s.url || "";
  } catch { homey.configured = false; }
  if (!homey.configured) { showNotConnected(); log("Homey ej ansluten", "warn"); return; }
  pollHomey();
}

/* ---- Anslutningsruta ---- */
const SETUP_ERRORS = {
  unreachable: "Hittar ingen Homey på den adressen. Kontrollera IP-adressen och att datorn är på samma nätverk.",
  unauthorized: "Homey godkände inte API-nyckeln. Kontrollera att den är rätt inklistrad och har behörighet.",
  "bad url": "Det där ser inte ut som en IP-adress, till exempel 192.168.1.50.",
  "no token": "Fyll i API-nyckeln.",
};
function setupMsg(text, cls = "") { const m = $("setup-msg"); m.textContent = text; m.className = "setup-msg " + cls; }

function openSetup() {
  $("setup-url").value = (homey.url || "").replace(/^http:\/\//, "");
  $("setup-token").value = "";
  $("setup-token").placeholder = homey.configured ? "Lämna tomt för att behålla nuvarande nyckel" : "Klistra in nyckeln";
  $("setup-token").required = !homey.configured;
  $("setup-state").textContent = homey.configured ? (homey.ok ? "ANSLUTEN" : "ANSLUTEN – SVARAR EJ") : "EJ ANSLUTEN";
  $("setup-disconnect").hidden = !homey.configured;
  $("setup-skip").textContent = homey.configured ? "STÄNG" : "HOPPA ÖVER";
  setupMsg("");
  $("setup").hidden = false;
  ($("setup-url").value ? $("setup-token") : $("setup-url")).focus();
}
function closeSetup() {
  const wasOpen = !$("setup").hidden;
  $("setup").hidden = true;
  if (wasOpen) setTimeout(maybeShowClaudeSetup, 300); // första start: fråga efter Claude efter Homey
}

function maybeShowSetup() {
  let skipped = false;
  try { skipped = localStorage.getItem("jarvis.homeySkipped") === "1"; } catch {}
  if (!homey.configured && !skipped) openSetup();
  else maybeShowClaudeSetup();
}

$("setup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("setup-submit");
  btn.disabled = true; setupMsg("Ansluter till Homey…");
  try {
    const r = await fetch("/homey/setup", {
      method: "POST", headers: { "X-Jarvis": "1", "Content-Type": "application/json" },
      body: JSON.stringify({ url: $("setup-url").value, token: $("setup-token").value }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
    $("setup-token").value = "";
    homey.configured = true; homey.url = j.url; homey.zones = {}; homey.flows = null; homey.ok = false;
    setupMsg("Ansluten!", "ok");
    await pollHomey();
    setTimeout(closeSetup, 600);
    if (homey.ok) respond(`Ansluten till Homey. Jag ser ${Object.keys(homey.devices).length} enheter.`);
  } catch (err) {
    setupMsg(SETUP_ERRORS[err.message] || "Det gick inte att ansluta: " + err.message, "err");
  } finally { btn.disabled = false; }
});

$("setup-skip").addEventListener("click", () => {
  if (!homey.configured) { try { localStorage.setItem("jarvis.homeySkipped", "1"); } catch {} }
  closeSetup();
});

$("setup-disconnect").addEventListener("click", async () => {
  if (!confirm("Koppla från Homey? IP-adress och API-nyckel tas bort från den här datorn.")) return;
  await fetch("/homey/setup", { method: "DELETE", headers: { "X-Jarvis": "1" } });
  clearTimeout(homey.timer);
  homey.configured = false; homey.url = "";
  showNotConnected();
  log("Homey frånkopplad", "warn");
  closeSetup();
});

$("setup").addEventListener("click", (e) => { if (e.target === $("setup")) closeSetup(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("setup").hidden) closeSetup(); });
$("pill-homey").addEventListener("click", openSetup);
document.addEventListener("click", (e) => { if (e.target.closest('[data-action="setup"]')) openSetup(); });

$("lights").addEventListener("click", async (e) => {
  const btn = e.target.closest(".toggle");
  if (!btn) return;
  const d = homey.devices[btn.dataset.id];
  if (!d) return;
  const next = !cap(d, "onoff");
  btn.disabled = true;
  try { await setCap(d, "onoff", next); log(`${d.name}: ${next ? "tänd" : "släckt"}`); }
  catch (err) { log(`Kunde inte styra ${d.name}: ${err.message}`, "warn"); }
  renderHomey();
});

/* ---- Röst-/textkommandon för hemmet ---- */
const needHomey = () => (homey.ok ? null : "Jag har ingen kontakt med Homey just nu.");
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

async function cmdLights(m) {
  const on = /^(tänd|sätt på|slå på)/.test(m[1]);
  const rest = m[2];
  if (needHomey()) return needHomey();
  // Först alla enheter med av/på som nämns vid namn, annars lampor per zon
  let { devices, label, kind } = findDevices(rest, (d) => has(d, "onoff") && wordIn(norm(rest), norm(d.name)));
  if (!devices.length) ({ devices, label, kind } = findDevices(rest, isLight));
  if (!devices.length) return claude.configured ? undefined : `Jag hittar ingen lampa som matchar "${rest.trim()}".`;
  const todo = devices.filter((d) => !!cap(d, "onoff") !== on);
  if (!todo.length) return `${label} är redan ${on ? "tänd" : "släckt"}.`;
  const res = await Promise.allSettled(todo.map((d) => setCap(d, "onoff", on)));
  const failed = res.filter((r) => r.status === "rejected").length;
  renderHomey();
  const n = todo.length - failed;
  const what = kind === "name" ? label : `${plural(n, "lampa", "lampor")} i ${label}`;
  return `${on ? "Tänder" : "Släcker"} ${what}.` + (failed ? ` ${failed} svarade inte.` : "");
}

async function cmdDim(m) {
  if (needHomey()) return needHomey();
  const pct = Math.max(0, Math.min(100, +m[3]));
  const { devices, label } = findDevices(m[2], (d) => isLight(d) && has(d, "dim"));
  if (!devices.length) return claude.configured ? undefined : `Jag hittar ingen dimbar lampa som matchar "${m[2]}".`;
  await Promise.allSettled(devices.flatMap((d) => [setCap(d, "dim", pct / 100), pct > 0 && !cap(d, "onoff") ? setCap(d, "onoff", true) : null]));
  renderHomey();
  return `${label} är nu på ${pct} procent.`;
}

function cmdTemp(m, q) {
  if (!homey.ok) return undefined; // låt väderkommandot ta över
  const rest = q;
  const isTemp = (d) => has(d, "measure_temperature") && cap(d, "measure_temperature") != null && ["sensor", "thermostat", "airconditioning", "heater"].includes(d.class);
  let { devices, label, kind } = findDevices(rest, isTemp);
  if (/(^| )(ute|utomhus|utanför)( |$)/.test(norm(rest)) && !devices.length) ({ devices, label, kind } = findDevices("ute", isTemp));
  if (!devices.length || kind === "all") return undefined;
  // I en zon: föredra givaren som heter som zonen (t.ex. "Temperatur Kök" framför frysarna)
  if (kind === "zone") {
    const named = devices.filter((d) => wordIn(norm(d.name), norm(label)));
    if (named.length) devices = named;
  }
  const clean = (d) => d.name.replace(/^Temperatur(\/Fukt)?\s*/i, "") || d.name;
  const deg = (d) => `${fmtNum(cap(d, "measure_temperature"))} grader`;
  if (devices.length === 1) {
    const d = devices[0];
    if (kind === "zone") return `Det är ${deg(d)} i ${label}.`;
    return /^ute$/i.test(clean(d)) ? `Det är ${deg(d)} ute.` : `${clean(d)}: ${deg(d)}.`;
  }
  return devices.slice(0, 4).map((d) => `${clean(d)} ${deg(d)}`).join(", ") + ".";
}

function cmdEnergy() {
  if (needHomey()) return needHomey();
  const { house, solar } = homey.power || {};
  const w = (v) => (v >= 1000 ? `${fmtNum(v / 1000, 1)} kilowatt` : `${Math.round(v)} watt`);
  let s = house != null ? `Huset drar just nu ${w(house)}.` : "Jag hittar ingen elmätare.";
  if (solar != null) s += ` Solcellerna producerar ${w(solar)}.`;
  return s;
}

function cmdAlarm(m, q) {
  if (/(stäng|slå|koppla|aktivera|sätt|larma)/.test(q) && !/^(är|vad|hur)/.test(q))
    return "Av säkerhetsskäl styr jag inte larmet. Använd larmets egen app.";
  if (needHomey()) return needHomey();
  const a = Object.values(homey.devices).find((d) => has(d, "homealarm_state"));
  if (!a) return "Jag hittar inget larm i Homey.";
  return { armed: "Larmet är tillkopplat.", disarmed: "Larmet är frånkopplat.", partially_armed: "Larmet är delvis tillkopplat." }[cap(a, "homealarm_state")] || "Larmets status är okänd.";
}

function cmdWhichOn() {
  if (needHomey()) return needHomey();
  const on = Object.values(homey.devices).filter((d) => isLight(d) && cap(d, "onoff"));
  if (!on.length) return "Alla lampor är släckta.";
  return `${plural(on.length, "lampa är tänd", "lampor är tända")}: ${on.slice(0, 8).map((d) => d.name).join(", ")}${on.length > 8 ? " med flera" : ""}.`;
}

async function cmdFlow(m) {
  if (needHomey()) return needHomey();
  if (!homey.flows) {
    const [a, b] = await Promise.allSettled([H("manager/flow/flow"), H("manager/flow/advancedflow")]);
    homey.flows = [
      ...Object.values(a.value || {}).map((f) => ({ ...f, kind: "flow" })),
      ...Object.values(b.value || {}).map((f) => ({ ...f, kind: "advancedflow" })),
    ];
  }
  const t = norm(m[2]);
  const flow = homey.flows.filter((f) => f.enabled !== false)
    .map((f) => ({ f, n: norm(f.name) }))
    .filter(({ n }) => t.includes(n) || n.includes(t))
    .sort((a, b) => Math.abs(a.n.length - t.length) - Math.abs(b.n.length - t.length))[0]?.f;
  if (!flow) return `Jag hittar inget flöde som heter "${m[2]}".`;
  await H(`manager/flow/${flow.kind}/${flow.id}/trigger`, { method: "POST", body: "{}" });
  return `Kör flödet ${flow.name}.`;
}

/* ---------------- Kommandon ---------------- */
const timers = [];
const jokes = [
  "Jag skulle berätta ett skämt om UDP, men du kanske inte får det.",
  "Det finns 10 sorters människor: de som förstår binärt och de som inte gör det.",
  "Min favoritmusik? Allt med bra bandbredd.",
];
function setTimer(seconds, label) {
  timers.push(setTimeout(() => { respond(`Tiden är ute: ${label}.`); log("⏰ Timer klar: " + label, "warn"); }, seconds * 1000));
}
const sites = { youtube: "https://youtube.com", google: "https://google.com", spotify: "https://open.spotify.com", gmail: "https://mail.google.com", github: "https://github.com", netflix: "https://netflix.com" };

const commands = [
  [/^(hjälp|vad kan du)/, () => "Jag kan styra hemmet: tänd eller släck lampor per namn eller rum, dimma, säga temperaturen i ett rum, elförbrukning, larmstatus och köra Homey-flöden. Jag kan också säga tid, väder, sätta timer, räkna och söka på nätet. Prova till exempel: tänd i köket."],
  // --- Hemmet (Homey) ---
  [/larm/, cmdAlarm],
  [/^(tänd|släck|sätt på|slå på|slå av|stäng av)\s*(.*)$/, cmdLights],
  [/^(dimma|dimra|ställ|sätt)\s+(.+?)\s+(?:till|på)\s+(\d+)\s*(%|procent)?$/, cmdDim],
  [/(vilka lampor|vad är tänt|är det tänt)/, cmdWhichOn],
  [/(förbrukning|drar huset|drar vi|elen|effekt|solcell|solpanel)/, cmdEnergy],
  [/^(kör|starta|aktivera)\s+(?:flödet|flowet|flow|scenen)?\s*(.+)$/, cmdFlow],
  [/(hur varmt|hur kallt|vilken temperatur|temperatur|hur många grader)/, cmdTemp],
  [/(hej|hallå|tjena)/, () => "Hej. Till din tjänst."],
  [/(vem är du|vad heter du)/, () => "Jag är Jarvis, din personliga assistent. Just nu körs jag lokalt i din webbläsare."],
  [/(klocka|tid)(?!.*timer)/, () => { const d = new Date(); return `Klockan är ${pad(d.getHours())}:${pad(d.getMinutes())}.`; }],
  [/(datum|vilken dag)/, () => `Idag är det ${new Date().toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}, vecka ${isoWeek(new Date())}.`],
  [/(väde?r|temperatur|grader|regn|snö|kallt|varmt|prognos)/, () => weather
    ? `I ${weather.place} är det ${weather.temp} grader och ${weather.desc.toLowerCase()}. Vinden ligger på ${weather.wind.toFixed(0)} meter per sekund. I morgon blir det upp till ${Math.round(weather.daily.temperature_2m_max[1])} grader.`
    : "Väderdatan är inte tillgänglig ännu."],
  [/timer.*?(\d+)\s*(sekund|minut|timm)/, (m) => {
    const n = +m[1], unit = m[2];
    const s = n * (unit.startsWith("sek") ? 1 : unit.startsWith("min") ? 60 : 3600);
    const label = `${n} ${unit.startsWith("sek") ? "sekunder" : unit.startsWith("min") ? "minuter" : "timmar"}`;
    setTimer(s, label);
    return `Timer satt på ${label}.`;
  }],
  [/(räkna|vad är)\s+([\d\s+\-*/().,x×]+)$/, (m) => {
    const expr = m[2].replace(/,/g, ".").replace(/[x×]/g, "*");
    if (!/^[\d\s+\-*/().]+$/.test(expr)) return "Det kunde jag inte räkna ut.";
    try { const v = Function(`"use strict";return (${expr})`)(); return `Det blir ${+v.toFixed(6)}.`; }
    catch { return "Det kunde jag inte räkna ut."; }
  }],
  [/^(sök|googla)( efter| på)?\s+(.+)/, (m) => { open("https://www.google.com/search?q=" + encodeURIComponent(m[3]), "_blank"); return `Söker efter ${m[3]}.`; }],
  [/öppna\s+(\w+)/, (m) => { const u = sites[m[1]]; if (!u) return `Jag vet inte hur jag öppnar ${m[1]}.`; open(u, "_blank"); return `Öppnar ${m[1]}.`; }],
  [/(diagnostik|status|systemstatus)/, () => `Alla system nominella. Rendering ${Math.round(fps)} bilder per sekund, latens ${lag.toFixed(0)} millisekunder, ${navigator.hardwareConcurrency || "okänt antal"} processorkärnor.`],
  [/(skämt|rolig)/, () => jokes[Math.floor(Math.random() * jokes.length)]],
  [/(helskärm|fullskärm)/, () => { document.documentElement.requestFullscreen?.(); return "Helskärmsläge aktiverat."; }],
  [/(rensa logg)/, () => { $("log").innerHTML = ""; return "Loggen är rensad."; }],
  [/(tyst|stopp|avbryt)/, () => { speechSynthesis.cancel(); timers.forEach(clearTimeout); timers.length = 0; return ""; }],
  [/(tack)/, () => "Varsågod. Alltid ett nöje."],
];

/* ---------------- Claude som hjärna ---------------- */
// Anropen går via serve.ps1 (/claude/messages) som lägger till API-nyckeln – den når aldrig webbläsaren.
// Valbara modeller. effort "low" ger snabba, korta svar som passar röst; höj till "medium" för mer eftertanke.
// Haiku saknar serverns reservmodell (fallbacks) och använder den äldre webbsökningsvarianten.
const CLAUDE_MODELS = {
  "claude-haiku-5-5": { label: "Haiku 5.5", effort: "low", fallbacks: false, webSearch: "web_search_20250305" },
  "claude-sonnet-5-5": { label: "Sonnet 5.5", effort: "low", fallbacks: true, webSearch: "web_search_20260209" },
  "claude-opus-5-5": { label: "Opus 5.5", effort: "low", fallbacks: true, webSearch: "web_search_20260209" },
};
const DEFAULT_MODEL = "claude-haiku-5-5";
let claudeModel = DEFAULT_MODEL;
try { const m = localStorage.getItem("jarvis.claudeModel"); if (CLAUDE_MODELS[m]) claudeModel = m; } catch {}
const modelLabel = () => CLAUDE_MODELS[claudeModel].label;

function setClaudeModel(id) {
  if (!CLAUDE_MODELS[id] || id === claudeModel) return;
  claudeModel = id;
  try { localStorage.setItem("jarvis.claudeModel", id); } catch {}
  claude.convo = []; // nya verktyg/modell → ny konversation så historiken förblir giltig
  claudeDot();
  log(`Claude-modell: ${modelLabel()}`);
}
const claude = { configured: false, source: null, convo: [], lastAt: 0, busy: false };

const CLAUDE_SYSTEM = `Du är JARVIS, en personlig AI-assistent som körs i en HUD-dashboard hemma hos användaren i Sverige.

Dina svar läses upp med talsyntes. Svara därför på svenska, kort (oftast en till tre meningar) och i naturligt talspråk. Skriv aldrig markdown, listor, rubriker, emojis eller länkar. Skriv tal, tider och enheter så att de låter naturliga när de läses upp. Tonen är lugn, artig och effektiv med en antydan av torr humor, som en erfaren butler.

Hemmet styrs via Homey. Hämta get_home_status när du behöver veta vilka enheter som finns eller hur läget är, om du inte redan har aktuella uppgifter från tidigare i samtalet. Styr bara det användaren ber om. Om det är oklart vilken enhet eller vilket rum som avses, fråga kort i stället för att gissa. Larmet kan du bara läsa av och aldrig ändra; säg det vänligt om användaren ber om det. Kör bara Homey-flöden när användaren uttryckligen ber om ett flöde. Bekräfta kort vad du gjorde efter att du styrt något.

Använd web_search för aktuella händelser, nyheter, öppettider och fakta du är osäker på. Sammanfatta resultatet muntligt utan källhänvisningar.

Varje användarmeddelande inleds med en rad inom hakparenteser med aktuell tid, plats och väder. Det är bakgrundsinformation, inte något användaren har sagt.`;

const CLAUDE_TOOLS = [
  {
    name: "get_home_status",
    description: "Hämtar aktuellt läge i hemmet från Homey: alla lampor (id, namn, rum, på/av, dimnivå), termostater och klimatenheter (id, börvärde, uppmätt temperatur), temperaturgivare per rum, elförbrukning, solcellsproduktion och larmstatus. Använd innan du styr enheter om du inte redan känner till deras id.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "control_lights",
    description: "Tänder, släcker eller dimmar en eller flera lampor. Ange lampornas id från get_home_status. Sätt on för att tända/släcka och/eller dim_percent (0–100) för ljusstyrka; dimning tänder lampan automatiskt.",
    input_schema: {
      type: "object",
      properties: {
        device_ids: { type: "array", items: { type: "string" }, description: "Id för lamporna som ska styras" },
        on: { type: "boolean", description: "true = tänd, false = släck" },
        dim_percent: { type: "integer", minimum: 0, maximum: 100, description: "Ljusstyrka i procent" },
      },
      required: ["device_ids"],
      additionalProperties: false,
    },
  },
  {
    name: "set_temperature",
    description: "Ändrar börvärdet på en termostat eller luftvärmepump. Ange id från get_home_status och temperatur i grader Celsius (5–30).",
    input_schema: {
      type: "object",
      properties: {
        device_id: { type: "string" },
        target_celsius: { type: "number", minimum: 5, maximum: 30 },
      },
      required: ["device_id", "target_celsius"],
      additionalProperties: false,
    },
  },
  {
    name: "run_flow",
    description: "Startar ett Homey-flöde (en scen eller automation) med det angivna namnet. Används bara när användaren uttryckligen ber om att köra ett flöde eller en scen.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string", description: "Flödets namn, eller en del av det" } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "set_timer",
    description: "Startar en nedräkningstimer. Jarvis säger till med rösten när tiden är ute.",
    input_schema: {
      type: "object",
      properties: {
        seconds: { type: "integer", minimum: 1, maximum: 86400 },
        label: { type: "string", description: "Kort beskrivning som läses upp när timern är klar, t.ex. 'pastan'" },
      },
      required: ["seconds", "label"],
      additionalProperties: false,
    },
  },
];
const claudeTools = () => [...CLAUDE_TOOLS, { type: CLAUDE_MODELS[claudeModel].webSearch, name: "web_search", max_uses: 3 }];

/* ---- Verktyg som körs här i webbläsaren ---- */
function homeStatus() {
  if (!homey.ok) return { error: "Homey är inte ansluten just nu." };
  const devs = Object.values(homey.devices);
  const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
  return {
    lights: devs.filter(isLight).map((d) => ({ id: d.id, name: d.name, room: zoneLabel(d.zone), on: !!cap(d, "onoff"), dim_percent: has(d, "dim") ? Math.round((cap(d, "dim") || 0) * 100) : undefined })),
    thermostats: devs.filter((d) => has(d, "target_temperature")).map((d) => ({ id: d.id, name: d.name, room: zoneLabel(d.zone), target: cap(d, "target_temperature"), measured: r1(cap(d, "measure_temperature")) })),
    temperatures: devs.filter((d) => has(d, "measure_temperature") && cap(d, "measure_temperature") != null && ["sensor", "thermostat", "airconditioning", "heater"].includes(d.class))
      .map((d) => ({ name: d.name, room: zoneLabel(d.zone), celsius: r1(cap(d, "measure_temperature")), humidity: has(d, "measure_humidity") ? Math.round(cap(d, "measure_humidity")) : undefined })),
    energy: { house_watts: homey.power?.house ?? null, solar_watts: homey.power?.solar ?? null },
    alarm: (() => { const a = devs.find((d) => has(d, "homealarm_state")); return a ? cap(a, "homealarm_state") : "inget larm"; })(),
  };
}

async function runTool(name, input) {
  switch (name) {
    case "get_home_status":
      return homeStatus();
    case "control_lights": {
      if (!homey.ok) return { error: "Homey är inte ansluten." };
      const ids = Array.isArray(input.device_ids) ? input.device_ids : [];
      const done = [], failed = [], unknown = [];
      for (const id of ids) {
        const d = homey.devices[id];
        if (!d || !isLight(d)) { unknown.push(id); continue; }
        try {
          if (typeof input.dim_percent === "number" && has(d, "dim")) {
            const pct = Math.max(0, Math.min(100, input.dim_percent));
            await setCap(d, "dim", pct / 100);
            if (pct > 0 && input.on !== false && !cap(d, "onoff")) await setCap(d, "onoff", true);
          }
          if (typeof input.on === "boolean") await setCap(d, "onoff", input.on);
          done.push(d.name);
        } catch (e) { failed.push(`${d.name}: ${e.message}`); }
      }
      renderHomey();
      if (done.length) log(`⚙ Lampor: ${done.join(", ")}`);
      return { changed: done, failed, unknown_ids: unknown };
    }
    case "set_temperature": {
      if (!homey.ok) return { error: "Homey är inte ansluten." };
      const d = homey.devices[input.device_id];
      if (!d || !has(d, "target_temperature")) return { error: "Okänd termostat." };
      const t = Math.max(5, Math.min(30, Number(input.target_celsius)));
      await setCap(d, "target_temperature", t);
      log(`⚙ ${d.name}: ${t}°`);
      return { ok: true, device: d.name, target_celsius: t };
    }
    case "run_flow": {
      const out = await cmdFlow([null, null, String(input.name || "")]);
      return { result: out };
    }
    case "set_timer": {
      const s = Math.max(1, Math.min(86400, Math.round(Number(input.seconds))));
      setTimer(s, String(input.label || "timer"));
      log(`⏰ Timer: ${input.label} (${s} s)`);
      return { ok: true, seconds: s };
    }
    default:
      return { error: "Okänt verktyg: " + name };
  }
}

function contextLine() {
  const d = new Date();
  const when = d.toLocaleString("sv-SE", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const wx = weather ? `, ${weather.place}, ${weather.temp} grader och ${weather.desc.toLowerCase()}` : "";
  return `[${when}${wx}]`;
}

// Gör svaret talbart även om modellen skulle använda markdown
const speakable = (t) => t.replace(/\*\*?|__|`|^#+\s*/gm, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/^\s*[-•]\s+/gm, "").trim();

async function callClaude() {
  const m = CLAUDE_MODELS[claudeModel];
  const body = {
    model: claudeModel,
    max_tokens: 16000,
    system: CLAUDE_SYSTEM,
    tools: claudeTools(),
    messages: claude.convo,
    output_config: { effort: m.effort },
    cache_control: { type: "ephemeral" },
  };
  const headers = { "X-Jarvis": "1", "Content-Type": "application/json" };
  if (m.fallbacks) { body.fallbacks = "default"; headers["X-Claude-Fallback"] = "1"; } // servern lägger till beta-huvudet
  const r = await fetch("/claude/messages", { method: "POST", headers, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(j.error?.message || j.error || "HTTP " + r.status);
    err.status = r.status; err.type = j.error?.type;
    throw err;
  }
  return j;
}

async function askClaude(text) {
  // Ny konversation efter 10 minuters tystnad eller när historiken blivit lång.
  // Historiken byggs bara på (append-only) så att tänkande och cache förblir giltiga.
  if (Date.now() - claude.lastAt > 10 * 60 * 1000 || claude.convo.length > 60) {
    if (claude.convo.length) log("Ny konversation med Claude");
    claude.convo = [];
  }
  claude.lastAt = Date.now();
  claude.convo.push({ role: "user", content: [{ type: "text", text: `${contextLine()}\n${text}` }] });

  for (let step = 0; step < 10; step++) {
    const msg = await callClaude();
    claude.convo.push({ role: "assistant", content: msg.content }); // oförändrat, inkl. thinking-block

    if (msg.stop_reason === "refusal") return "Det kan jag tyvärr inte hjälpa till med.";

    if (msg.stop_reason === "pause_turn") continue; // webbsökning pågår – fortsätt samma tur

    if (msg.stop_reason === "tool_use") {
      const uses = msg.content.filter((b) => b.type === "tool_use");
      const results = await Promise.all(uses.map(async (u) => {
        try {
          const out = await runTool(u.name, u.input || {});
          return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out), ...(out?.error ? { is_error: true } : {}) };
        } catch (e) {
          return { type: "tool_result", tool_use_id: u.id, content: "Fel: " + e.message, is_error: true };
        }
      }));
      claude.convo.push({ role: "user", content: results }); // alla resultat i ett meddelande
      continue;
    }

    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join(" ");
    return speakable(text) || "Klart.";
  }
  return "Det där tog för många steg. Kan du formulera om frågan?";
}

/* ---- Claude-anslutning (ruta + statusknapp) ---- */
function claudeDot() {
  $("pill-claude").querySelector(".dot").className = "dot " + (claude.configured ? "ok" : "off");
  $("pill-claude").title = `Claude-anslutning (${modelLabel()})`;
}
async function initClaude() {
  try {
    const s = await (await fetch("/claude/status")).json();
    claude.configured = s.configured; claude.source = s.source || null;
  } catch { claude.configured = false; }
  claudeDot();
  log(claude.configured ? `Claude ansluten (${modelLabel()})` : "Claude ej ansluten – lokala kommandon används", claude.configured ? "" : "warn");
}
function claudeMsg(text, cls = "") { const m = $("claude-msg"); m.textContent = text; m.className = "setup-msg " + cls; }
function openClaudeSetup() {
  $("claude-key").value = "";
  $("claude-key").required = !claude.configured;
  $("claude-key").placeholder = claude.configured ? "Klistra in en ny nyckel för att byta" : "sk-ant-…";
  $("claude-state").textContent = !claude.configured ? "EJ ANSLUTEN" : claude.source === "env" ? "ANSLUTEN (MILJÖVARIABEL)" : "ANSLUTEN";
  $("claude-remove").hidden = claude.source !== "file";
  $("claude-skip").textContent = claude.configured ? "STÄNG" : "HOPPA ÖVER";
  document.querySelectorAll('input[name="claude-model"]').forEach((r) => { r.checked = r.value === claudeModel; });
  claudeMsg("");
  $("claude-setup").hidden = false;
  $("claude-key").focus();
}
function closeClaudeSetup() { $("claude-setup").hidden = true; }
function maybeShowClaudeSetup() {
  if (claude.configured || !$("setup").hidden || !$("hud").classList.contains("on")) return;
  let skipped = false;
  try { skipped = localStorage.getItem("jarvis.claudeSkipped") === "1"; } catch {}
  if (!skipped) openClaudeSetup();
}

const CLAUDE_ERRORS = {
  unauthorized: "Nyckeln godkändes inte. Kontrollera att hela nyckeln är inklistrad.",
  unreachable: "Kan inte nå Claude API. Kontrollera internetanslutningen.",
  "bad key": "Det där ser inte ut som en API-nyckel.",
};
$("claude-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const key = $("claude-key").value.trim();
  if (!key) return closeClaudeSetup();
  const btn = $("claude-submit");
  btn.disabled = true; claudeMsg("Kontrollerar nyckeln…");
  try {
    const r = await fetch("/claude/setup", { method: "POST", headers: { "X-Jarvis": "1", "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
    $("claude-key").value = "";
    claude.configured = true; claude.source = "file"; claude.convo = [];
    claudeDot();
    claudeMsg("Ansluten!", "ok");
    log(`Claude ansluten (${modelLabel()})`);
    setTimeout(closeClaudeSetup, 600);
    respond("Anslutningen till Claude är klar. Fråga mig vad du vill.");
  } catch (err) {
    claudeMsg(CLAUDE_ERRORS[err.message] || "Det gick inte att ansluta: " + err.message, "err");
  } finally { btn.disabled = false; }
});
$("claude-skip").addEventListener("click", () => {
  if (!claude.configured) { try { localStorage.setItem("jarvis.claudeSkipped", "1"); } catch {} }
  closeClaudeSetup();
});
$("claude-remove").addEventListener("click", async () => {
  if (!confirm("Ta bort Claude-nyckeln från den här datorn? Jarvis går då tillbaka till lokala kommandon.")) return;
  await fetch("/claude/setup", { method: "DELETE", headers: { "X-Jarvis": "1" } });
  await initClaude();
  closeClaudeSetup();
});
$("claude-setup").addEventListener("click", (e) => { if (e.target === $("claude-setup")) closeClaudeSetup(); });
$("pill-claude").addEventListener("click", openClaudeSetup);
document.querySelectorAll('input[name="claude-model"]').forEach((r) => r.addEventListener("change", () => {
  setClaudeModel(r.value);
  if (claude.configured) claudeMsg(`Modell bytt till ${modelLabel()}.`, "ok");
}));
addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("claude-setup").hidden) closeClaudeSetup(); });

/* ---------------- Kommandohantering ---------------- */
// Med Claude: blixtsnabba lokala kommandon först (lampor, timer, tyst), allt annat till Claude.
// Utan Claude (eller om Claude inte svarar): hela listan med lokala kommandon.
const FAST = new Set([cmdLights, cmdDim]);
const fastCommands = commands.filter(([re, fn]) => FAST.has(fn) || /timer|tyst/.test(String(re)));

async function runLocal(list, q) {
  for (const [re, fn] of list) {
    const m = q.match(re);
    if (!m) continue;
    let out;
    try { out = await fn(m, q); } catch (e) { out = "Något gick fel: " + e.message; }
    if (out === undefined) continue; // kommandot avstod, prova nästa
    return out;
  }
  return undefined;
}

function handle(raw) {
  const text = raw.trim();
  if (!text) return;
  $("heard").textContent = "» " + text;
  log("DU: " + text, "you");
  setState("thinking");
  const q = text.toLowerCase();
  setTimeout(async () => {
    if (/^(ny konversation|glöm (allt|det)|börja om)/.test(q)) { claude.convo = []; return respond("Ny konversation. Vad kan jag hjälpa till med?"); }

    if (claude.configured) {
      const fast = await runLocal(fastCommands, q);
      if (fast !== undefined) return fast ? respond(fast) : setState("idle");
      if (claude.busy) return respond("Ett ögonblick, jag arbetar fortfarande med förra frågan.");
      claude.busy = true;
      try {
        return respond(await askClaude(text));
      } catch (e) {
        log(`Claude: ${e.message}`, "warn");
        // Kasta den ofullständiga turen så att historiken förblir giltig
        claude.convo = [];
        if (e.status === 401) { claude.configured = false; claudeDot(); return respond("Claude-nyckeln fungerar inte längre. Klicka på Claude-knappen för att byta nyckel."); }
        const local = await runLocal(commands, q);
        return respond(local || "Jag når inte Claude just nu. Försök igen om en stund.");
      } finally { claude.busy = false; }
    }

    const out = await runLocal(commands, q);
    if (out === undefined) return respond("Det förstod jag inte riktigt. Säg 'hjälp' för att se vad jag kan.");
    out ? respond(out) : setState("idle");
  }, 150);
}

$("cmd").addEventListener("submit", (e) => {
  e.preventDefault();
  handle($("cmdinput").value);
  $("cmdinput").value = "";
});

/* ---------------- Röstigenkänning ---------------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false;
if (SR) {
  rec = new SR();
  rec.lang = "sv-SE"; rec.interimResults = true; rec.continuous = false;
  rec.onstart = () => { listening = true; $("micbtn").classList.add("live"); $("pill-mic").querySelector(".dot").className = "dot live"; setState("listening"); };
  rec.onend = () => { listening = false; $("micbtn").classList.remove("live"); $("pill-mic").querySelector(".dot").className = "dot off"; if ($("state").textContent === "LYSSNAR") setState("idle"); };
  rec.onerror = (e) => log("Mikrofonfel: " + e.error, "warn");
  rec.onresult = (e) => {
    const r = e.results[e.results.length - 1];
    $("heard").textContent = "» " + r[0].transcript;
    if (r.isFinal) handle(r[0].transcript.replace(/^(jarvis[,]?\s*)/i, ""));
  };
} else {
  $("micbtn").title = "Röststyrning stöds inte i den här webbläsaren (använd Chrome eller Edge)";
}
function toggleMic() {
  if (!rec) return respond("Röststyrning stöds inte i den här webbläsaren. Använd Chrome eller Edge.");
  speechSynthesis.cancel();
  listening ? rec.stop() : rec.start();
}
$("micbtn").addEventListener("click", toggleMic);
// Mellanslag (när fältet inte har fokus) = prata
addEventListener("keydown", (e) => {
  const typing = /^(INPUT|TEXTAREA|BUTTON)$/.test(document.activeElement?.tagName);
  if (e.code === "Space" && !typing && $("setup").hidden && $("claude-setup").hidden && $("hud").classList.contains("on")) { e.preventDefault(); toggleMic(); }
});

/* ---------------- Start ---------------- */
log("Kärna online");
boot();
initHomey();
initClaude();
