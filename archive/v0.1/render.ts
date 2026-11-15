// Rendering. Static structure lives in index.html; this file fills it in.
// Numbers update every frame; lists and charts re-render only when their inputs change.

import { CFG } from "../engine/config";
import * as G from "../engine/game";
import type { Flows, State } from "../engine/game";
import { esc, pct, usd, usdShort } from "./format";

const $ = (id: string) => document.getElementById(id)!;
const text = (id: string, v: string) => { const e = $(id); if (e.textContent !== v) e.textContent = v; };
const show = (id: string, on: boolean) => { const e = $(id); if (e.hidden === on) e.hidden = !on; };

const memo: Record<string, string> = {};
/** Set innerHTML only when the content key changes. */
function html(id: string, key: string, build: () => string) {
  if (memo[id] === key) return;
  memo[id] = key;
  $(id).innerHTML = build();
}

type Seg = [label: string, value: number, colorVar: string];

function bar(id: string, legendId: string | null, segs: Seg[], total?: number) {
  const live = segs.filter(([, v]) => v > 0.5);
  const sum = total ?? live.reduce((a, [, v]) => a + v, 0);
  const key = live.map(([l, v]) => l + Math.round(v)).join("|") + Math.round(sum);
  html(id, key, () => live.map(([l, v, c]) =>
    `<i style="width:${sum > 0 ? (100 * v) / sum : 0}%;background:var(${c})" title="${esc(l)}"></i>`).join(""));
  if (legendId) html(legendId, key, () => live.map(([l, v, c]) =>
    `<div><span class="k"><span class="sw" style="background:var(${c})"></span>${esc(l)}</span><span class="fig">${usdShort(v)}</span></div>`).join(""));
}

function sparkline(values: number[], colorVar: string, w = 300, h = 36): string {
  if (values.length < 2) return "";
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - lo) / span) * (h - 6)).toFixed(1)}`);
  const last = pts[pts.length - 1].split(",");
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${pts.join(" ")}" fill="none" stroke="var(${colorVar})" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="2.5" fill="var(${colorVar})"/></svg>`;
}

/** Net worth against age. Samples are quarterly from the start age. */
export function netWorthChart(nw: number[]): string {
  const w = 320, h = 150, padL = 4, padR = 4, padT = 14, padB = 18;
  if (nw.length < 2) return "";
  const lo = Math.min(0, ...nw), hi = Math.max(1, ...nw);
  const x = (i: number) => padL + (i / (nw.length - 1)) * (w - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
  const line = nw.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${x(0)},${y(0)} ${line} ${x(nw.length - 1)},${y(0)}`;
  const startAge = CFG.startAge, endAge = startAge + (nw.length - 1) / 4;
  const li = nw.length - 1;
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Net worth by age">
    <line x1="${padL}" x2="${w - padR}" y1="${y(0)}" y2="${y(0)}" stroke="var(--rule)"/>
    <line x1="${padL}" x2="${w - padR}" y1="${y(hi)}" y2="${y(hi)}" stroke="var(--rule)" stroke-dasharray="2 3"/>
    <polygon points="${area}" fill="var(--c-keep)" opacity="0.14"/>
    <polyline points="${line}" fill="none" stroke="var(--c-keep)" stroke-width="1.6"/>
    <circle cx="${x(li)}" cy="${y(nw[li])}" r="3" fill="var(--c-keep)"/>
    <text x="${padL}" y="${y(hi) - 4}">${usdShort(hi)}</text>
    <text x="${padL}" y="${h - 4}">age ${startAge}</text>
    <text x="${w - padR}" y="${h - 4}" text-anchor="end">age ${Math.floor(endAge)}</text></svg>`;
}

function flowBars(f: Flows) {
  const inSegs: Seg[] = [
    ["Salary and bonus", f.salary + f.bonus, "--c-keep"],
    ["Stock pay", f.stock, "--c-stock"],
    ["Sold investments", f.sales, "--c-sales"],
    ["Borrowed", f.borrowed, "--c-debt"],
  ];
  const outSegs: Seg[] = [
    ["Tax", f.tax, "--c-tax"],
    ["Spending", f.living, "--c-living"],
    ["Interest", f.interest, "--c-interest"],
    ["Invested", f.invested, "--c-keep"],
    ["Debt repaid", f.repaid, "--c-debt"],
  ];
  const tin = inSegs.reduce((a, s) => a + s[1], 0);
  const tout = outSegs.reduce((a, s) => a + s[1], 0);
  if (tin > tout) outSegs.push(["Kept as cash", tin - tout, "--c-idle"]);
  else if (tout > tin) inSegs.push(["From cash on hand", tout - tin, "--c-idle"]);
  const total = Math.max(tin, tout);
  bar("flow-in", "flow-in-legend", inSegs, total);
  bar("flow-out", "flow-out-legend", outSegs, total);
}

export function render(s: State, paused: boolean) {
  show("game", !s.dead);
  show("end", s.dead);
  text("nw", usd(G.netWorth(s)));
  text("age", String(Math.floor(G.age(s))));
  text("eff", pct(G.effectiveRate(s)));
  text("pause", paused ? "Resume" : "Pause");
  if (s.dead) return renderEnd(s);

  // Work
  const lv = G.level(s);
  show("work-on", s.job.employed);
  show("work-off", !s.job.employed);
  text("job-title", s.job.employed ? lv.title : "No job");
  text("job-pay", s.job.employed ? `${usd(lv.salary)}${lv.stock ? " + " + usdShort(lv.stock) + " stock" : ""}` : "");
  if (s.job.employed) {
    const top = lv.perf === Infinity;
    $("perf-fill").style.width = top ? "100%" : `${Math.min(100, (100 * s.job.perf) / lv.perf)}%`;
    text("perf-label", top ? "Top of the ladder" : "Progress to promotion");
    text("bonus", `Bonus this year ${usd(s.job.bonusAccrued)}`);
    show("resign", !!s.flags.resign);
  }

  // Paycheck
  show("sec-pay", !!s.lastPay);
  if (s.lastPay) {
    const p = s.lastPay;
    bar("pay-bar", "pay-legend", [
      ["You keep", p.net, "--c-keep"],
      ["Federal tax", p.fed, "--c-tax"],
      ["Payroll tax", p.payroll, "--c-payroll"],
      ["State tax", p.state, "--c-state"],
    ]);
  }

  // Cash and costs
  text("cash", usd(s.cash));
  const items = G.recurringItems(s);
  text("costs", usd(G.monthlyExpenses(s)));
  html("cost-lines", items.map(([n, v]) => n + Math.round(v)).join("|"), () =>
    items.length > 1 ? items.map(([n, v]) => `<div><span>${esc(n)}</span><span class="fig">${usd(v)}</span></div>`).join("") : "");
  const card = G.cardDebt(s);
  show("card-box", card > 0.5);
  if (card > 0.5) {
    text("card", usd(card));
    text("card-apr", pct(CFG.cardApr, 0));
    bar("card-bar", "card-legend", [["Borrowed", s.card.principal, "--c-debt"], ["Interest", s.card.interest, "--c-interest"]]);
  }

  // Investments
  show("sec-invest", !!s.flags.invest || s.port.value > 0);
  text("port", usd(s.port.value));
  text("basis", usd(s.port.basis));
  text("gain", usd(s.port.value - s.port.basis));
  html("mkt-spark", "m" + s.hist.index.length, () => sparkline(s.hist.index.slice(-60), "--c-keep"));
  const share = G.saleTaxShare(s);
  text("sell-note", s.port.value > 0
    ? `Selling now loses ${pct(share)} of the proceeds to tax.`
    : "Selling at a gain is taxed. Holding is not.");
  document.querySelectorAll<HTMLButtonElement>("[data-invest]").forEach((b) => (b.disabled = s.cash < 1));
  document.querySelectorAll<HTMLButtonElement>("[data-sell]").forEach((b) => (b.disabled = s.port.value < 1));

  // Credit line
  show("sec-loan", s.loan.unlocked);
  if (s.loan.unlocked) {
    const debt = G.loanDebt(s);
    const rate = G.loanRate(s);
    text("debt", usd(debt));
    bar("loan-bar", "loan-legend", [
      ["Borrowed", s.loan.principal, "--c-debt"],
      ["Interest added", s.loan.interest, "--c-interest"],
    ], Math.max(s.port.value, debt, 1));
    $("tick-limit").style.left = `${CFG.lineMaxLtv * 100}%`;
    $("tick-call").style.left = `${CFG.lineCallLtv * 100}%`;
    text("rate", pct(rate, 2));
    html("rate-spark", "r" + s.hist.rate.length, () => sparkline(s.hist.rate.slice(-60), "--c-interest"));
    text("int-year", usd(debt * rate));
    const tr = G.trailingReturn(s);
    html("compare", [tr?.toFixed(3), rate.toFixed(4), share.toFixed(3)].join("|"), () => `
      <div><div class="v">${tr === null ? "n/a" : pct(tr)}</div><div class="d">Market growth per year, last ten years</div></div>
      <div><div class="v">${pct(rate)}</div><div class="d">Cost of borrowing per year</div></div>
      <div><div class="v">${pct(share)}</div><div class="d">Cost of selling, once, in tax</div></div>`);
    const head = G.lineHeadroom(s);
    text("avail", `${usdShort(head)} available`);
    document.querySelectorAll<HTMLButtonElement>("[data-borrow]").forEach((b) => (b.disabled = head < 1));
    document.querySelectorAll<HTMLButtonElement>("[data-repay]").forEach((b) => (b.disabled = debt < 1 || s.cash < 1));
    ($("opt-living") as HTMLInputElement).checked = s.loan.payLivingFromLine;
    ($("opt-interest") as HTMLInputElement).checked = s.loan.payInterestInCash;
  }

  // Things to buy
  const vis = G.visibleLifestyle(s);
  const lifeKey = vis.map((i) => i.id + (s.life.owned.includes(i.id) ? "o" : G.canBuy(s, i.id) ? "y" : "n")).join("");
  html("life-list", lifeKey, () => vis.map((i) => {
    const owned = s.life.owned.includes(i.id);
    const monthly = i.recurring.reduce((a, [, v]) => a + v, 0);
    return `<div class="item"><div class="n"><div>${esc(i.name)}</div><div class="sub fig">${
      owned ? `Owned. ${usd(monthly)} a month.` : usdShort(i.price)}</div></div>${
      owned ? "" : `<button class="btn" type="button" data-buy="${i.id}"${G.canBuy(s, i.id) ? "" : " disabled"}>Buy</button>`}</div>`;
  }).join(""));

  // Flows and chart
  show("sec-flow", !!s.lastYear);
  if (s.lastYear) flowBars(s.lastYear);
  show("sec-chart", s.hist.nw.length > 4);
  html("nw-chart", "c" + s.hist.nw.length, () => netWorthChart(s.hist.nw));

  // Record
  html("log", s.log.length + (s.log[0]?.msg ?? ""), () =>
    s.log.slice(0, 40).map((l) => `<li><span class="a">${l.age}</span><span>${esc(l.msg)}</span></li>`).join(""));
}

function renderEnd(s: State) {
  const e = s.estate!;
  const row = (k: string, v: string, cls = "") => `<div class="row ${cls}"><span>${k}</span><span class="fig">${v}</span></div>`;
  text("end-title", `You died at ${e.ageAtDeath}.`);
  html("end-body", "end" + e.net, () => `<div class="statement">
    <h3>Estate</h3>
    ${row("Assets", usd(e.assets))}
    ${row("Debts, repaid by the estate", usd(-e.debts))}
    ${row("Net estate", usd(e.net), "total")}
    ${row("Estate tax", usd(-e.estateTax))}
    ${row("Passed to heirs", usd(e.toHeirs), "total")}
    <h3>Lifetime</h3>
    ${row("Gains never taxed", usd(e.untaxedGains))}
    ${row("Borrowed against assets", usd(e.lifetimeBorrowed))}
    ${row("Interest paid or owed", usd(e.lifetimeInterest))}
    ${row("Income and gains, total", usd(e.lifetimeGain))}
    ${row("Income tax paid", usd(e.lifetimeTax))}
    ${row("Lifetime tax rate", pct(e.lifetimeRate), "total")}
  </div>`);
  html("end-chart", "ec" + s.hist.nw.length, () => netWorthChart(s.hist.nw));
}
