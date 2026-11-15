// Game engine. No DOM access here: the UI reads State and calls actions.

import { CFG, LIFESTYLE } from "./config";
import { estateTax, gainsRate, ordinaryTax } from "./tax";

export interface Flows {
  salary: number; bonus: number; stock: number; sales: number; borrowed: number;
  tax: number; living: number; interest: number; invested: number; repaid: number;
}
const zeroFlows = (): Flows => ({
  salary: 0, bonus: 0, stock: 0, sales: 0, borrowed: 0,
  tax: 0, living: 0, interest: 0, invested: 0, repaid: 0,
});

export interface Estate {
  generation: number;
  ageAtDeath: number;
  assets: number;
  debts: number;
  net: number;
  untaxedGains: number;
  estateTax: number;
  toHeirs: number;
  lifetimeTax: number;
  lifetimeGain: number;
  lifetimeRate: number;
  lifetimeInterest: number;
  lifetimeBorrowed: number;
}

export interface State {
  v: 1;
  generation: number; // hook for heirs
  t: number; // years since start
  months: number; // whole months processed
  deathAge: number; // hidden
  dead: boolean;
  estate: Estate | null;

  cash: number;
  card: { principal: number; interest: number };
  job: { employed: boolean; level: number; perf: number; bonusAccrued: number };
  port: { value: number; basis: number };
  realEstate: number;
  mkt: { index: number; baseRate: number; crashLeft: number; recoverLeft: number; nextCrash: number };
  loan: {
    unlocked: boolean; principal: number; interest: number; everDrawn: boolean;
    payLivingFromLine: boolean; payInterestInCash: boolean;
  };
  life: { baseline: number; owned: string[] };

  ytd: { wages: number; withheld: number; gains: number };
  totals: { tax: number; wages: number; realized: number; interest: number; borrowed: number };
  flows: Flows;
  lastYear: Flows | null;
  lastPay: { gross: number; fed: number; payroll: number; state: number; net: number } | null;

  hist: { nw: number[]; rate: number[]; index: number[] }; // quarterly samples
  log: { age: number; msg: string }[];
  flags: Record<string, boolean>;
}

let rng: () => number = Math.random;
export function setRng(fn: () => number) { rng = fn; }

function gauss(): number {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function newGame(generation = 1): State {
  const s: State = {
    v: 1,
    generation,
    t: 0,
    months: 0,
    deathAge: clamp(CFG.deathMean + CFG.deathSd * gauss(), CFG.deathMin, CFG.deathMax),
    dead: false,
    estate: null,
    cash: CFG.startCash,
    card: { principal: 0, interest: 0 },
    job: { employed: true, level: 0, perf: 0, bonusAccrued: 0 },
    port: { value: 0, basis: 0 },
    realEstate: 0,
    mkt: { index: 100, baseRate: CFG.rateMean, crashLeft: 0, recoverLeft: 0, nextCrash: 5 + rng() * 6 },
    loan: { unlocked: false, principal: 0, interest: 0, everDrawn: false, payLivingFromLine: false, payInterestInCash: false },
    life: { baseline: CFG.baseLivingMonthly, owned: [] },
    ytd: { wages: 0, withheld: 0, gains: 0 },
    totals: { tax: 0, wages: 0, realized: 0, interest: 0, borrowed: 0 },
    flows: zeroFlows(),
    lastYear: null,
    lastPay: null,
    hist: { nw: [CFG.startCash], rate: [CFG.rateMean], index: [100] },
    log: [],
    flags: {},
  };
  say(s, `You are ${CFG.startAge}. You have a job.`);
  return s;
}

// ---------- Derived values ----------

export const age = (s: State) => CFG.startAge + s.t;
export const level = (s: State) => CFG.levels[s.job.level];
export const loanDebt = (s: State) => s.loan.principal + s.loan.interest;
export const cardDebt = (s: State) => s.card.principal + s.card.interest;
export const netWorth = (s: State) => s.cash + s.port.value + s.realEstate - loanDebt(s) - cardDebt(s);
export const unrealized = (s: State) => Math.max(0, s.port.value - s.port.basis);
export const lineLimit = (s: State) => (s.loan.unlocked ? s.port.value * CFG.lineMaxLtv : 0);
export const lineHeadroom = (s: State) => Math.max(0, lineLimit(s) - loanDebt(s));
export const ltv = (s: State) => (s.port.value > 0 ? loanDebt(s) / s.port.value : 0);

export function loanRate(s: State): number {
  for (const [ceiling, spread] of CFG.spreads) if (s.port.value < ceiling) return s.mkt.baseRate + spread;
  return s.mkt.baseRate;
}

/** Lifetime tax paid as a share of lifetime gain (wages + realized + unrealized gains). */
export function effectiveRate(s: State): number {
  const gain = s.totals.wages + s.totals.realized + unrealized(s);
  return gain > 0 ? s.totals.tax / gain : 0;
}

/** Share of a sale's proceeds lost to tax right now. */
export function saleTaxShare(s: State): number {
  if (s.port.value <= 0) return 0;
  const gainFrac = Math.max(0, 1 - s.port.basis / s.port.value);
  return gainFrac * gainsRate(s.ytd.wages + s.ytd.gains);
}

export function medicalMonthly(s: State): number {
  const a = age(s);
  if (a < 50) return 0;
  const toDeath = s.deathAge - a;
  const decline = toDeath < 6 ? 3000 * (6 - toDeath) ** 2 : 0;
  return 250 * 1.07 ** (a - 50) + decline;
}

export function recurringItems(s: State): [string, number][] {
  const out: [string, number][] = [["Living", s.life.baseline]];
  for (const item of LIFESTYLE) if (s.life.owned.includes(item.id)) out.push(...item.recurring);
  const med = medicalMonthly(s);
  if (med > 0) out.push(["Medical", med]);
  return out;
}
export const monthlyExpenses = (s: State) => recurringItems(s).reduce((a, [, v]) => a + v, 0);

/** Annualized market return over the last ten years of samples. */
export function trailingReturn(s: State): number | null {
  const h = s.hist.index;
  if (h.length < 5) return null;
  const n = Math.min(40, h.length - 1);
  return (h[h.length - 1] / h[h.length - 1 - n]) ** (4 / n) - 1;
}

// ---------- Internals ----------

function say(s: State, msg: string) {
  s.log.unshift({ age: Math.floor(age(s)), msg });
  if (s.log.length > 80) s.log.length = 80;
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

/** Incoming cash pays card debt first. */
function receive(s: State, amount: number) {
  let left = amount;
  const toInt = Math.min(left, s.card.interest);
  s.card.interest -= toInt; left -= toInt;
  const toPrin = Math.min(left, s.card.principal);
  s.card.principal -= toPrin; left -= toPrin;
  s.flows.repaid += toInt + toPrin;
  s.cash += left;
}

function drawLine(s: State, amount: number): number {
  const x = Math.min(amount, lineHeadroom(s));
  if (x <= 0) return 0;
  s.loan.principal += x;
  s.flows.borrowed += x;
  s.totals.borrowed += x;
  if (!s.loan.everDrawn) {
    s.loan.everDrawn = true;
    say(s, "You borrowed against your portfolio. Borrowed money is not income. No tax is due on it.");
    // The first downturn arrives soon after the first loan.
    if (s.mkt.crashLeft <= 0 && s.mkt.nextCrash - s.t > 4) s.mkt.nextCrash = s.t + 2 + rng() * 2;
  }
  return x;
}

/** Sell `gross` of the portfolio. Returns net proceeds after tax. */
function sellGross(s: State, gross: number): { net: number; tax: number; gain: number; gross: number } {
  gross = Math.min(gross, s.port.value);
  if (gross <= 0) return { net: 0, tax: 0, gain: 0, gross: 0 };
  const share = gross / s.port.value;
  const basisSold = s.port.basis * share;
  const gain = gross - basisSold;
  const tax = gain > 0 ? gain * gainsRate(s.ytd.wages + s.ytd.gains) : 0;
  s.port.value -= gross;
  s.port.basis -= basisSold;
  if (s.port.value < 0.01) { s.port.value = 0; s.port.basis = 0; }
  if (gain > 0) { s.ytd.gains += gain; s.totals.realized += gain; }
  s.totals.tax += tax;
  s.flows.tax += tax;
  s.flows.sales += gross;
  return { net: gross - tax, tax, gain, gross };
}

/** Pay an obligation. Order: cash, credit line, forced sale, credit card. */
function fund(s: State, amount: number, lineFirst = false) {
  let need = amount;
  if (lineFirst) need -= drawLine(s, need);
  const c = Math.min(s.cash, need);
  s.cash -= c; need -= c;
  if (need > 0.005) need -= drawLine(s, need);
  if (need > 0.005 && s.port.value > 0) {
    const gross = need / (1 - saleTaxShare(s));
    const r = sellGross(s, gross);
    const used = Math.min(r.net, need);
    need -= used;
    s.cash += r.net - used;
    say(s, `Not enough cash. Sold ${usd(r.gross)} of investments. Tax on the gain: ${usd(r.tax)}.`);
  }
  if (need > 0.005) {
    if (cardDebt(s) <= 0) say(s, `Not enough cash. The rest went on a credit card at ${Math.round(CFG.cardApr * 100)}%.`);
    s.card.principal += need;
    s.flows.borrowed += need;
  }
}

function repayLoan(s: State, amount: number) {
  const toInt = Math.min(amount, s.loan.interest);
  s.loan.interest -= toInt;
  const toPrin = Math.min(amount - toInt, s.loan.principal);
  s.loan.principal -= toPrin;
  s.flows.repaid += toInt + toPrin;
  return { toInt, toPrin };
}

function marginCheck(s: State) {
  const debt = loanDebt(s);
  if (debt <= 0 || debt <= s.port.value * CFG.lineCallLtv) return;
  const v = s.port.value;
  const share = saleTaxShare(s);
  let gross = (debt - CFG.lineMaxLtv * v) / (CFG.lineMaxLtv - share);
  const wiped = gross >= v || gross <= 0;
  if (wiped) gross = v;
  const r = sellGross(s, gross);
  repayLoan(s, r.net);
  say(s, `Margin call. The bank sold ${usd(r.gross)} of your investments. Tax on the gain: ${usd(r.tax)}.`);
  if (wiped) {
    const left = loanDebt(s);
    if (left > 0) {
      s.card.principal += left;
      s.loan.principal = 0; s.loan.interest = 0;
      say(s, `The portfolio did not cover the loan. ${usd(left)} is now unsecured debt.`);
    }
  }
}

function stepMarket(s: State, dt: number) {
  const m = s.mkt;
  let mu = CFG.drift, vol = CFG.vol;
  if (m.crashLeft > 0) {
    mu = CFG.crashDrift; vol = CFG.crashVol;
    m.crashLeft -= dt;
    if (m.crashLeft <= 0) { m.recoverLeft = CFG.recoverYears; say(s, "Markets stabilize."); }
  } else if (m.recoverLeft > 0) {
    mu = CFG.recoverDrift;
    m.recoverLeft -= dt;
  } else if (s.t >= m.nextCrash) {
    m.crashLeft = CFG.crashYears;
    m.nextCrash = s.t + 7 + rng() * 9;
    say(s, "Markets fall.");
  }
  const f = Math.exp((mu - (vol * vol) / 2) * dt + vol * Math.sqrt(dt) * gauss());
  m.index *= f;
  s.port.value *= f;
}

function month(s: State) {
  s.months++;
  const lv = level(s);

  if (s.job.employed) {
    const gross = lv.salary / 12;
    const t = ordinaryTax(lv.salary);
    const pay = { gross, fed: t.fed / 12, payroll: t.payroll / 12, state: t.state / 12, net: gross - t.total / 12 };
    s.lastPay = pay;
    s.ytd.wages += gross; s.ytd.withheld += t.total / 12;
    s.totals.wages += gross; s.totals.tax += t.total / 12;
    s.flows.salary += gross; s.flows.tax += t.total / 12;
    receive(s, pay.net);

    if (lv.stock > 0) {
      const g = lv.stock / 12;
      const w = g * CFG.supplementalWithholding;
      s.port.value += g - w; s.port.basis += g - w;
      s.ytd.wages += g; s.ytd.withheld += w;
      s.totals.wages += g; s.totals.tax += w;
      s.flows.stock += g; s.flows.tax += w; s.flows.invested += g - w;
    }
    s.job.perf += CFG.passivePerfPerMonth;
    promoteIfDue(s);
  }

  if (s.job.employed && age(s) >= CFG.retireAge) {
    s.job.employed = false;
    s.job.bonusAccrued = 0;
    s.lastPay = null;
    say(s, "You retired.");
  }
  if (age(s) >= CFG.retireAge) {
    s.flows.salary += CFG.retirementBenefitMonthly;
    receive(s, CFG.retirementBenefitMonthly);
  }

  const living = monthlyExpenses(s);
  s.flows.living += living;
  fund(s, living, s.loan.payLivingFromLine);

  // Interest on the credit line: paid in cash, or added to the balance.
  const debt = loanDebt(s);
  if (debt > 0) {
    const int = (debt * loanRate(s)) / 12;
    s.totals.interest += int;
    s.flows.interest += int;
    if (s.loan.payInterestInCash && s.cash >= int) s.cash -= int;
    else { s.loan.interest += int; s.flows.borrowed += int; }
  }
  const cd = cardDebt(s);
  if (cd > 0) {
    const int = (cd * CFG.cardApr) / 12;
    s.card.interest += int;
    s.totals.interest += int;
    s.flows.interest += int; s.flows.borrowed += int;
  }

  s.mkt.baseRate = clamp(
    s.mkt.baseRate + CFG.rateRevert * (CFG.rateMean - s.mkt.baseRate) + CFG.rateShock * gauss(),
    CFG.rateMin, CFG.rateMax,
  );

  unlocks(s);
  bankruptcyCheck(s);

  if (s.months % 3 === 0) {
    s.hist.nw.push(netWorth(s));
    s.hist.rate.push(loanRate(s));
    s.hist.index.push(s.mkt.index);
  }
  if (s.months % 12 === 0) yearEnd(s);
}

/** Provisional rule: deep insolvency wipes the slate. A setback, not an ending. */
function bankruptcyCheck(s: State) {
  const floor = CFG.bankruptcyFloor + (s.job.employed ? level(s).salary : 0);
  if (cardDebt(s) <= 0 || netWorth(s) > -floor) return;
  s.cash = 0;
  s.port = { value: 0, basis: 0 };
  s.realEstate = 0;
  s.card = { principal: 0, interest: 0 };
  s.loan.principal = 0; s.loan.interest = 0;
  s.loan.unlocked = false; s.loan.payLivingFromLine = false;
  s.life.owned = [];
  s.life.baseline = CFG.baseLivingMonthly;
  s.flags.resign = false;
  say(s, "Bankruptcy. Your assets were liquidated and your debts discharged.");
  if (!s.job.employed && age(s) < CFG.retireAge) {
    s.job.employed = true;
    s.job.level = Math.max(0, s.job.level - 1);
    s.job.perf = 0;
    say(s, `You took a job as ${level(s).title}.`);
  }
}

function promoteIfDue(s: State) {
  const lv = level(s);
  if (s.job.perf < lv.perf || s.job.level >= CFG.levels.length - 1) return;
  s.job.level++;
  s.job.perf = 0;
  s.life.baseline *= CFG.lifestyleCreep;
  const next = level(s);
  say(s, `Promoted to ${next.title}. Salary ${usd(next.salary)}${next.stock ? `, plus ${usd(next.stock)} a year in stock` : ""}. Your spending adjusts.`);
}

function unlocks(s: State) {
  if (!s.flags.invest && s.cash >= 5000) {
    s.flags.invest = true;
    say(s, "You have more cash than you need this month. You could invest it.");
  }
  if (!s.loan.unlocked && s.port.value >= CFG.lineUnlockPortfolio) {
    s.loan.unlocked = true;
    say(s, "Your bank offers a line of credit secured by your portfolio.");
  }
  if (!s.flags.resign && s.job.employed && s.loan.unlocked && s.port.value * CFG.drift >= level(s).salary + level(s).stock) {
    s.flags.resign = true;
    say(s, "Your portfolio now grows more in a typical year than your job pays.");
  }
}

function yearEnd(s: State) {
  if (s.job.employed && s.job.bonusAccrued > 0) {
    const b = s.job.bonusAccrued;
    const w = b * CFG.supplementalWithholding;
    s.ytd.wages += b; s.ytd.withheld += w;
    s.totals.wages += b; s.totals.tax += w;
    s.flows.bonus += b; s.flows.tax += w;
    receive(s, b - w);
    s.job.bonusAccrued = 0;
  }
  const due = ordinaryTax(s.ytd.wages).total;
  const diff = due - s.ytd.withheld;
  s.totals.tax += diff; s.flows.tax += diff;
  const income = s.flows.salary + s.flows.bonus + s.flows.stock + s.ytd.gains;
  const taxYear = Math.max(0, s.flows.tax);
  const short = diff > 1 ? ` Withholding fell short. You owe ${usd(diff)} more.` : "";
  say(s, income > 0
    ? `Year closed. Income ${usd(income)}. Tax ${usd(taxYear)} (${Math.round((100 * taxYear) / income)}%).${short}`
    : `Year closed. Taxable income ${usd(0)}. Tax ${usd(taxYear)}.`);
  if (diff > 1) fund(s, diff);
  else if (diff < -1) receive(s, -diff);
  s.lastYear = s.flows;
  s.flows = zeroFlows();
  s.ytd = { wages: 0, withheld: 0, gains: 0 };
}

function die(s: State) {
  const assets = s.cash + s.port.value + s.realEstate;
  const debts = loanDebt(s) + cardDebt(s);
  const net = assets - debts;
  const tax = estateTax(net);
  const gain = s.totals.wages + s.totals.realized + unrealized(s);
  s.estate = {
    generation: s.generation,
    ageAtDeath: Math.floor(age(s)),
    assets, debts, net,
    untaxedGains: unrealized(s),
    estateTax: tax,
    toHeirs: net - tax,
    lifetimeTax: s.totals.tax,
    lifetimeGain: gain,
    lifetimeRate: gain > 0 ? s.totals.tax / gain : 0,
    lifetimeInterest: s.totals.interest,
    lifetimeBorrowed: s.totals.borrowed,
  };
  s.dead = true;
  say(s, `You died at ${Math.floor(age(s))}.`);
}

// ---------- Clock ----------

/** Advance the game by `years`, in fixed small steps. */
export function advance(s: State, years: number) {
  let left = years;
  while (left > 0 && !s.dead) {
    const dt = Math.min(CFG.stepYears, left);
    left -= dt;
    s.t += dt;
    stepMarket(s, dt);
    marginCheck(s);
    while (Math.floor(s.t * 12 + 1e-9) > s.months && !s.dead) month(s);
    if (age(s) >= s.deathAge) die(s);
  }
}

// ---------- Player actions ----------

export function work(s: State) {
  if (s.dead || !s.job.employed) return;
  const lv = level(s);
  s.job.perf++;
  s.job.bonusAccrued = Math.min(lv.salary * CFG.bonusCap, s.job.bonusAccrued + lv.salary * CFG.bonusPerClick);
  promoteIfDue(s);
}

export function invest(s: State, fraction: number) {
  const x = s.cash * fraction;
  if (s.dead || x < 1) return;
  s.cash -= x;
  s.port.value += x; s.port.basis += x;
  s.flows.invested += x;
  unlocks(s);
}

export function sell(s: State, fraction: number) {
  if (s.dead || s.port.value <= 0) return;
  const r = sellGross(s, s.port.value * fraction);
  s.cash += r.net;
  say(s, r.tax > 0
    ? `Sold ${usd(r.gross)}. Gain ${usd(r.gain)}. Tax ${usd(r.tax)}. You keep ${usd(r.net)}.`
    : `Sold ${usd(r.gross)}. No gain. No tax.`);
  marginCheck(s);
}

export function borrow(s: State, fraction: number) {
  if (s.dead) return;
  s.cash += drawLine(s, lineHeadroom(s) * fraction);
}

export function repay(s: State, fraction: number) {
  const x = Math.min(s.cash, loanDebt(s)) * fraction;
  if (s.dead || x < 1) return;
  s.cash -= x;
  const r = repayLoan(s, x);
  say(s, `Paid ${usd(x)} to the bank: ${usd(r.toInt)} interest, ${usd(r.toPrin)} principal.`);
}

export function canBuy(s: State, id: string): boolean {
  const item = LIFESTYLE.find((i) => i.id === id);
  return !!item && !s.life.owned.includes(id) && s.cash + lineHeadroom(s) >= item.price;
}

export function buy(s: State, id: string) {
  if (s.dead || !canBuy(s, id)) return;
  const item = LIFESTYLE.find((i) => i.id === id)!;
  const c = Math.min(s.cash, item.price);
  s.cash -= c;
  if (item.price > c) drawLine(s, item.price - c);
  if (item.asset) { s.realEstate += item.price; s.flows.invested += item.price; }
  else s.flows.living += item.price;
  s.life.owned.push(id);
  const monthly = item.recurring.reduce((a, [, v]) => a + v, 0);
  say(s, `${item.note} New monthly costs: ${item.recurring.map(([n, v]) => `${n} ${usd(v)}`).join(", ")}. Total ${usd(monthly)} a month.`);
}

export function resign(s: State) {
  if (s.dead || !s.job.employed || !s.flags.resign) return;
  s.job.employed = false;
  s.job.bonusAccrued = 0;
  s.lastPay = null;
  say(s, "You resigned. You no longer have a salary.");
}

export function setPayLivingFromLine(s: State, on: boolean) { s.loan.payLivingFromLine = on; }
export function setPayInterestInCash(s: State, on: boolean) { s.loan.payInterestInCash = on; }

export function visibleLifestyle(s: State) {
  const nw = netWorth(s);
  return LIFESTYLE.filter((i) => {
    if (s.life.owned.includes(i.id)) return true;
    if (nw >= i.unlockNetWorth) s.flags["seen_" + i.id] = true;
    return !!s.flags["seen_" + i.id];
  });
}
