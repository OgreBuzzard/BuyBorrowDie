import "./style.css";
import { CFG } from "./engine/config";
import type { LoanKind } from "./engine/config";
import * as G from "./engine/game";
import type { State } from "./engine/game";
import { handleEvents, render, ui } from "./ui/render";

const SAVE_KEY = "bbd.save.v7";

function load(): State | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as State;
    return s && s.v === 7 ? s : null;
  } catch { return null; }
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, events: [] })); } catch { /* storage unavailable: play without saving */ }
}

let state: State = load() ?? G.newGame();
let speed = 1;
let last = performance.now();

// Runs once per display frame. Time-based, so the pace is the same at 60 or 120 fps.
function frame(now: number) {
  // Active play only: cap the gap so a sleeping tab does not skip months.
  const dt = Math.min(now - last, 250) / 1000;
  last = now;
  if (!ui.paused && !document.hidden && !state.dead) G.advance(state, (dt * speed) / CFG.secondsPerYear);
  if (state.events.length) handleEvents(state.events.splice(0));
  render(state);
  requestAnimationFrame(frame);
}

function reset() {
  state = G.newGame();
  ui.selected = -1;
  ui.moveLevel = -1;
  ui.adjustingRetirement = false;
  document.getElementById("end-body")!.innerHTML = "";
  save();
  window.scrollTo(0, 0);
}

const on = (id: string, fn: () => void) => document.getElementById(id)!.addEventListener("click", () => { fn(); render(state); });

on("work", () => G.work(state));
on("again", reset);
on("pause", () => { ui.paused = !ui.paused; });
// Quit asks once: the first tap arms it for three seconds.
on("quit", () => {
  if (ui.quitArmedAt && Date.now() - ui.quitArmedAt <= 3000) { ui.quitArmedAt = 0; G.quit(state); }
  else ui.quitArmedAt = Date.now();
});

// Everything else is found by its data attribute, because panels are rebuilt as their contents change.
document.addEventListener("click", (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>(
    "[data-answer],[data-retire],[data-health],[data-food],[data-offer],[data-level],[data-down],[data-loan],[data-buy],[data-cancel],[data-move],[data-movelevel],[data-paydown]");
  if (!el) return;
  const d = el.dataset;
  if (d.answer !== undefined) G.answer(state, d.answer);
  else if (d.health) G.changeHealth(state);
  else if (d.retire === "toggle") ui.adjustingRetirement = !ui.adjustingRetirement;
  else if (d.retire) G.adjustRetirement(state, Number(d.retire));
  else if (d.food) G.setFood(state, Number(d.food));
  else if (d.offer) { ui.selected = ui.selected === Number(d.offer) ? -1 : Number(d.offer); ui.moveLevel = -1; }
  else if (d.level) G.setOfferLevel(state, ui.selected, Number(d.level));
  else if (d.down) G.setOfferDown(state, ui.selected, Number(d.down));
  else if (d.loan) G.setOfferLoan(state, ui.selected, d.loan as LoanKind);
  else if (d.buy) { if (ui.selected >= 0) { G.buy(state, ui.selected); ui.selected = -1; } }
  else if (d.cancel) { ui.selected = -1; ui.moveLevel = -1; }
  else if (d.move === "open") {
    ui.moveLevel = ui.moveLevel >= 0 ? -1 : state.home.kind === "apartment" ? state.home.level : -1;
    ui.selected = -1;
  }
  else if (d.move === "go") { G.moveApartment(state, ui.moveLevel); ui.moveLevel = -1; }
  else if (d.movelevel) ui.moveLevel = Math.min(CFG.buyNotches, Math.max(0, ui.moveLevel + Number(d.movelevel)));
  else if (d.paydown) G.payMortgage(state, d.paydown === "all" ? Infinity : Number(d.paydown));
  render(state);
});

// Space bar works. It never answers a pop-up or presses whatever button has focus, and holding it down does nothing.
document.addEventListener("keydown", (ev) => {
  if (ev.code !== "Space") return;
  ev.preventDefault();
  if (ev.repeat || ui.paused || state.popups.length) return;
  G.work(state);
  render(state);
});
document.addEventListener("keyup", (ev) => { if (ev.code === "Space") ev.preventDefault(); });

// No on-screen test controls. From the browser console: bbd.speed = 20, bbd.reset(), bbd.state().
(window as unknown as Record<string, unknown>).bbd = {
  get speed() { return speed; },
  set speed(v: number) { speed = Number(v) || 1; },
  reset,
  state: () => state,
};

document.addEventListener("visibilitychange", () => { last = performance.now(); if (document.hidden) save(); });
setInterval(save, 5000);

render(state);
requestAnimationFrame(frame);
