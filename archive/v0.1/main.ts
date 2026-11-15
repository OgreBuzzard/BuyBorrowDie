import "./style.css";
import { CFG } from "./engine/config";
import * as G from "./engine/game";
import type { State } from "./engine/game";
import { render } from "./ui/render";

const SAVE_KEY = "bbd.save.v1";

function load(): State | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as State;
    return s && s.v === 1 ? s : null;
  } catch { return null; }
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* storage unavailable: play without saving */ }
}

let state: State = load() ?? G.newGame();
let paused = false;
let speed = 1;
let last = performance.now();

function frame() {
  const now = performance.now();
  // Active play only: cap the gap so a sleeping tab does not skip years.
  const dt = Math.min(now - last, 1000) / 1000;
  last = now;
  if (!paused && !document.hidden && !state.dead) G.advance(state, (dt * speed) / CFG.secondsPerYear);
  render(state, paused);
}
setInterval(frame, 200);
setInterval(save, 5000);
document.addEventListener("visibilitychange", () => { last = performance.now(); if (document.hidden) save(); });

const on = (id: string, fn: () => void) => document.getElementById(id)!.addEventListener("click", () => { fn(); render(state, paused); });

on("work", () => G.work(state));
on("resign", () => G.resign(state));
on("pause", () => { paused = !paused; });
on("again", () => { state = G.newGame(); save(); window.scrollTo(0, 0); });

// Start over asks twice, in place.
let armed = 0;
on("restart", () => {
  const btn = document.getElementById("restart")!;
  if (Date.now() - armed < 4000) { state = G.newGame(); save(); btn.textContent = "Start over"; armed = 0; return; }
  armed = Date.now();
  btn.textContent = "Tap again to erase this life";
  setTimeout(() => { if (armed && Date.now() - armed >= 4000) { btn.textContent = "Start over"; armed = 0; } }, 4100);
});

document.addEventListener("click", (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>("[data-invest],[data-sell],[data-borrow],[data-repay],[data-buy]");
  if (!el) return;
  const d = el.dataset;
  if (d.invest) G.invest(state, Number(d.invest));
  else if (d.sell) G.sell(state, Number(d.sell));
  else if (d.borrow) G.borrow(state, Number(d.borrow));
  else if (d.repay) G.repay(state, Number(d.repay));
  else if (d.buy) G.buy(state, d.buy);
  render(state, paused);
});

document.getElementById("opt-living")!.addEventListener("change", (e) => G.setPayLivingFromLine(state, (e.target as HTMLInputElement).checked));
document.getElementById("opt-interest")!.addEventListener("change", (e) => G.setPayInterestInCash(state, (e.target as HTMLInputElement).checked));
document.getElementById("speed")!.addEventListener("change", (e) => { speed = Number((e.target as HTMLSelectElement).value) || 1; });

render(state, paused);
