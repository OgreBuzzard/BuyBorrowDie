// Rendering. Static structure lives in index.html; this file fills it in every frame.

import { CFG, LOANS } from "../engine/config";
import type { LoanKind } from "../engine/config";
import * as G from "../engine/game";
import type { GameEvent, Offer, State } from "../engine/game";
import { esc, usd } from "./format";

const $ = (id: string) => document.getElementById(id)!;
const text = (id: string, v: string) => { const e = $(id); if (e.textContent !== v) e.textContent = v; };
const show = (id: string, on: boolean) => { const e = $(id); if (e.hidden === on) e.hidden = !on; };
const disable = (el: HTMLButtonElement, off: boolean) => { if (el.disabled !== off) el.disabled = off; };

const memo: Record<string, string> = {};
/** Set innerHTML only when the content key changes, so buttons are not replaced mid-tap. */
function html(id: string, key: string, build: () => string) {
  if (memo[id] === key) return;
  memo[id] = key;
  $(id).innerHTML = build();
}

/** Interface state. Not saved. */
export const ui = {
  selected: -1, // which Buy offer is open
  moveLevel: -1, // apartment level being considered in the Move panel; -1 when closed
  quitArmedAt: 0, // time of the first Quit tap
  paused: false,
  adjustingRetirement: false,
};

const rate = (x: number) => (Math.round(x * 10000) / 100).toString() + "%";
const perMonth = (n: number) => `${usd(n)} a month`;
const notches = (filled: number, total: number) =>
  Array.from({ length: total }, (_, i) => `<i${i < filled ? ' class="on"' : ""}></i>`).join("");
const meter = (label: string, attr: string, filled: number) => `
  <div class="meter-row">
    ${label ? `<span class="meter-label wide">${label}</span>` : ""}
    <button class="pm" type="button" data-${attr}="-1" aria-label="Less">&minus;</button>
    <div class="hmeter">${notches(filled, CFG.buyNotches)}</div>
    <button class="pm" type="button" data-${attr}="1" aria-label="More">+</button>
  </div>`;
const confirmRow = (label: string, attr: string, ok = true) => `
  <div class="confirm">
    <button class="buy" type="button" ${attr}${ok ? "" : " disabled"}>${label}</button>
    <button class="cancel" type="button" data-cancel="1">Cancel</button>
  </div>`;
const line = (k: string, v: string) => `<div class="exp"><span>${k}</span><span>${v}</span></div>`;

let tickTimer = 0;

/** Brief line under net worth: interest charged, pay received, things bought. */
function tick(parts: string[]) {
  const el = $("ticker");
  el.innerHTML = parts.join("");
  el.classList.add("on");
  clearTimeout(tickTimer);
  tickTimer = window.setTimeout(() => el.classList.remove("on"), 2500);
}

export function handleEvents(events: GameEvent[]) {
  const parts: string[] = [];
  const neg = (t: string) => parts.push(`<span class="neg">${t}</span>`);
  const pos = (t: string) => parts.push(`<span class="pos">${t}</span>`);
  for (const e of events) {
    if (e.kind === "interest") neg(`${usd(-e.amount)} interest`);
    else if (e.kind === "pay") pos(`+${usd(e.amount)} pay`);
    else if (e.kind === "retire") pos(`+${usd(e.amount)} retirement`);
    else if (e.kind === "buy") neg(`${usd(-e.amount)} ${esc(e.name)}`);
    else if (e.kind === "mortgage") neg(`${usd(-e.amount)} mortgage`);
    else if (e.kind === "doctor") neg(`${usd(-e.amount)} doctor`);
    else if (e.kind === "raise") pos("Raise");
    else if (e.kind === "fired") neg("Job lost");
    else if (e.kind === "quit") neg("You quit");
    else if (e.kind === "hired") pos("New job");
  }
  if (parts.length) tick(parts);
}

export function render(s: State) {
  show("game", !s.dead);
  show("end", s.dead);
  const nw = G.netWorth(s);
  text("nw", usd(nw));
  $("nw").classList.toggle("neg", nw < 0);
  const m = G.ageMonths(s);
  text("age", `Age ${G.ageYears(s)} and ${m} ${m === 1 ? "month" : "months"}`);
  // Cash, or debt with its interest rate. The credit line shows how much more can be borrowed.
  const owed = G.debt(s);
  $("cash-line").firstChild!.textContent = owed > 0 ? "Debt: " : "Cash: ";
  text("cash", usd(owed > 0 ? owed : s.cash));
  $("cash").classList.toggle("neg", owed > 0);
  show("interest-line", owed > 0);
  text("apr", rate(G.debtRate(s)));
  show("credit-line", s.credit.open);
  text("credit", usd(G.creditAvailable(s)));
  text("face", G.face(s));
  renderPopup(s);
  if (s.dead) return renderEnd(s);

  show("own-box", s.venture.active);
  text("own", usd(s.venture.value));

  // Retirement: appears once the player has enrolled.
  show("retire-box", s.retire.enrolled);
  if (s.retire.enrolled) {
    text("retire", usd(s.retire.balance));
    text("growth", (s.retire.growth * 100).toFixed(1) + "%");
    show("retire-panel", ui.adjustingRetirement);
    text("retire-adjust", ui.adjustingRetirement ? "Done" : "Adjust");
    text("retire-rate", Math.round(s.retire.rate * 100) + "%");
  }

  renderWork(s);
  renderExpenses(s);
  renderBuy(s);
  renderMortgage(s);
  text("pause", ui.paused ? "Resume" : "Pause");
}

/** Pop-up message. One choice is shown as a single confirm button; several are shown side by side. */
function renderPopup(s: State) {
  const p = s.popups[0];
  show("popup", !!p && !s.dead);
  if (!p) return;
  show("popup-title", !!p.title);
  text("popup-title", p.title ?? "");
  text("popup-text", p.text);
  const long = p.choices.some((c) => c.label.length > 12) || p.choices.length > 3;
  $("popup-choices").classList.toggle("stack", long);
  html("popup-choices", p.id + p.choices.map((c) => c.label).join("|"), () =>
    p.choices.map((c) => `<button type="button"${p.choices.length === 1 ? ' class="primary"' : ""} data-answer="${esc(c.value)}">${esc(c.label)}</button>`).join(""));
}

function renderWork(s: State) {
  text("salary", usd(G.salaryNow(s)));
  const able = G.canWork(s);
  disable($("work") as HTMLButtonElement, !able);
  text("work-label", !s.job.employed ? "No job" : able ? "Work" : "Sick");
  $("thermo").classList.toggle("off", !able);
  const need = G.tapsNeeded(s);
  $("thermo-fill").style.height = `${(100 * s.job.taps) / need}%`;
  // One notch per tap on the regular bar: a founder's bars show twice as many.
  for (const id of ["thermo", "thermo-extra"]) $(id).style.setProperty("--step", `${100 / need}%`);
  // The extra-work bar keeps its place in the row and appears once the first bar is full.
  $("thermo-extra").classList.toggle("shown", able && G.extraUnlocked(s));
  $("thermo-extra-fill").style.height = `${(100 * s.job.extraTaps) / G.extraTapsToFill(s)}%`;
  $("clock-hand").style.transform = `rotate(${(G.monthFraction(s) * 360).toFixed(1)}deg)`;

  // Quit grows as the mood sinks.
  const quit = $("quit");
  show("quit", s.job.employed);
  const gloom = Math.min(1, Math.max(0, (75 - s.well.w) / 65));
  quit.style.fontSize = `${(11 + 17 * gloom).toFixed(1)}px`;
  if (ui.quitArmedAt && Date.now() - ui.quitArmedAt > 3000) ui.quitArmedAt = 0;
  text("quit", ui.quitArmedAt ? "Sure?" : "Quit");
}

function renderExpenses(s: State) {
  html("food-meter", "f" + s.food, () => notches(s.food, CFG.foodNotches));
  text("transport", s.car ? "Car" : "Bus fare");
  text("transport-cost", perMonth(G.transportMonthly(s)));
  show("housing-row", s.home.kind !== "none");
  text("housing", G.housingLabel(s));
  const renting = s.home.kind === "apartment";
  text("housing-cost", renting ? perMonth(G.rentMonthly(s)) : s.mortgage ? perMonth(G.nextPayment(s.mortgage).total) : "");
  show("move", renting);
  show("gym-row", !!s.gym);
  text("gym-cost", perMonth(G.gymMonthly(s)));
  const insured = s.health.plan === "bad" || s.health.plan === "good";
  show("health-row", s.health.offered);
  text("health-cost", insured ? perMonth(G.healthMonthly(s)) : "none");
  if (!renting) ui.moveLevel = -1;
  show("move-panel", ui.moveLevel >= 0);
  if (ui.moveLevel >= 0) {
    const rent = G.priceOf(G.item("apartment"), ui.moveLevel);
    html("move-panel", "mv" + ui.moveLevel, () =>
      meter("", "movelevel", ui.moveLevel)
      + confirmRow(`Move for ${perMonth(rent)}`, 'data-move="go"')
      + `<div class="note">${usd(rent * CFG.rentDepositMonths)} deposit today.</div>`);
  }
}

function housePanel(s: State, o: Offer): string {
  const h = G.houseTerms(s, o);
  const kinds = Object.keys(LOANS) as LoanKind[];
  const io = h.loan.ioYears;
  return `
    ${meter("Price", "level", o.level)}
    ${meter("Down", "down", o.down)}
    <div class="seg">${kinds.map((k) => `<button type="button" data-loan="${k}"${k === o.loan ? ' class="on"' : ""}>${LOANS[k].name}</button>`).join("")}</div>
    <div class="terms">
      ${line("Price", usd(h.price))}
      ${line(`Down payment, ${Math.round(h.downPct * 100)}%`, usd(h.down))}
      ${line("Closing costs", usd(h.closing))}
      ${line("Mortgage", usd(h.borrowed))}
      ${line(io ? `Rate, first ${io} years` : `Rate, fixed for ${h.loan.years} years`, rate(h.rate))}
      ${line(io ? `Payment, first ${io} years` : "Payment", perMonth(h.payment))}
    </div>
    ${io ? `<div class="note">Interest only for ${io} years: nothing comes off what you owe. After that the rate changes every year.</div>` : ""}
    ${confirmRow(`Buy for ${usd(h.upfront)} today`, 'data-buy="1"', G.canBuy(s, o))}
    ${G.canBuy(s, o) ? "" : `<div class="note">You need ${usd(h.upfront)} in cash.</div>`}`;
}

function renderBuy(s: State) {
  const offers = s.shop.offers;
  if (ui.selected >= offers.length) ui.selected = -1;
  html("offers", offers.map((o) => o.id).join("|") + ui.selected, () =>
    offers.map((o, i) => `<button class="offer${i === ui.selected ? " sel" : ""}" type="button" data-offer="${i}">${esc(G.item(o.id).name)}</button>`).join(""));
  const sel = offers[ui.selected];
  show("buy-panel", !!sel);
  if (!sel) return;
  const it = G.item(sel.id);
  const ok = G.canBuy(s, sel);
  if (sel.id === "house") {
    html("buy-panel", ["h", sel.level, sel.down, sel.loan, s.loanRate, ok].join("|"), () => housePanel(s, sel));
  } else if (sel.id === "apartment") {
    html("buy-panel", "a" + sel.level, () =>
      meter("", "level", sel.level)
      + confirmRow(`Rent for ${perMonth(G.offerPrice(sel))}`, 'data-buy="1"')
      + `<div class="note">${usd(G.upfrontCost(s, sel))} deposit today.</div>`);
  } else if (sel.id === "gym") {
    html("buy-panel", "g" + sel.level, () =>
      meter("", "level", sel.level) + confirmRow(`Join for ${perMonth(G.offerPrice(sel))}`, 'data-buy="1"'));
  } else {
    html("buy-panel", "i" + sel.id + sel.level, () =>
      (it.max ? meter("", "level", sel.level) : "") + confirmRow(`Buy for ${usd(G.offerPrice(sel))}`, 'data-buy="1"'));
  }
}

function duration(months: number): string {
  if (!isFinite(months)) return "never, at this payment";
  const y = Math.floor(months / 12), m = months % 12;
  const ys = y ? `${y} ${y === 1 ? "year" : "years"}` : "", ms = m ? `${m} ${m === 1 ? "month" : "months"}` : "";
  return [ys, ms].filter(Boolean).join(" and ") || "paid off";
}

function renderMortgage(s: State) {
  const m = s.mortgage;
  show("sec-mortgage", !!m);
  if (!m) return;
  const done = m.balance <= 0;
  const loan = LOANS[m.kind];
  text("m-balance", usd(m.balance));
  const paid = 1 - m.balance / m.original;
  html("m-progress", "p" + Math.round(paid * 1000), () => `<i class="c-principal" style="width:${(paid * 100).toFixed(1)}%"></i>`);
  text("m-left", duration(G.monthsLeft(m)));
  const next = G.nextPayment(m);
  text("m-payment", usd(next.total));
  const total = next.total || 1;
  const key = Math.round(next.interest) + "|" + Math.round(next.principal);
  html("m-split", "s" + key, () =>
    `<i class="c-interest" style="width:${(100 * next.interest) / total}%"></i><i class="c-principal" style="width:${(100 * next.principal) / total}%"></i>`);
  html("m-legend", "l" + key, () =>
    `<span class="li">Interest ${usd(next.interest)}</span><span class="lp">Principal ${usd(next.principal)}</span>`);
  text("m-paid", usd(m.interestPaid));
  const coming = G.interestRemaining(s, m);
  text("m-coming", done ? usd(0) : isFinite(coming) ? usd(coming) : "unbounded");
  const floating = loan.resetSpread !== undefined;
  text("m-terms", !floating ? `Rate, fixed for ${loan.years} years` : m.ioLeft > 0 ? "Rate, for now" : "Rate, changes every year");
  text("m-rate", rate(m.rate));
  show("m-note", floating && m.ioLeft > 0 && !done);
  if (floating && m.ioLeft > 0) text("m-note", `Interest only for ${duration(m.ioLeft)} more. Then the rate resets and the payment rises.`);
  document.querySelectorAll<HTMLButtonElement>("[data-paydown]").forEach((b) => {
    const want = b.dataset.paydown === "all" ? m.balance : Number(b.dataset.paydown);
    disable(b, done || s.cash < want || (b.dataset.paydown !== "all" && want > m.balance));
  });
}

function renderEnd(s: State) {
  const e = s.estate!;
  text("end-title", `You died at ${e.ageAtDeath}.`);
  show("end-cause", !!e.cause);
  text("end-cause", e.cause ? `${e.cause}.` : "");
  const el = $("end-body");
  if (!el.innerHTML) el.innerHTML = `<div class="statement">
    ${line("Net worth", usd(e.net))}
    ${line("Estate tax", usd(-e.estateTax))}
    ${line("Passed to heirs", usd(e.toHeirs))}
    ${line("Lifetime pay", usd(e.lifetimePay))}
    ${line("Lifetime tax", usd(-e.lifetimeTax))}
    ${line("Lifetime interest", usd(-e.lifetimeInterest))}
  </div>`;
}
