// Game engine. No DOM access here: the UI reads State, calls actions, and drains `events`.

import { CATALOG, CFG, LOANS, WELL } from "./config";
import type { BuyItem, LoanKind } from "./config";
import { taxOnWages } from "./tax";

export type GameEvent =
  | { kind: "interest"; amount: number }
  | { kind: "pay"; amount: number }
  | { kind: "retire"; amount: number }
  | { kind: "buy"; name: string; amount: number }
  | { kind: "mortgage"; amount: number }
  | { kind: "doctor"; amount: number }
  | { kind: "raise"; salary: number }
  | { kind: "quit" }
  | { kind: "fired" }
  | { kind: "hired"; salary: number };

export interface Estate {
  generation: number;
  ageAtDeath: number;
  net: number;
  estateTax: number;
  toHeirs: number;
  lifetimePay: number;
  lifetimeTax: number;
  lifetimeInterest: number;
  cause?: string;
}

/** A message that stops the clock until the player answers. One choice is a plain confirmation. */
export interface Popup {
  id: string;
  title?: string;
  text: string;
  choices: { label: string; value: string }[];
  amount?: number; // money that moves once the player answers
}
export type HealthPlan = "unoffered" | "none" | "bad" | "good";

/** `down` and `loan` are used only by the House offer. */
export interface Offer { id: string; level: number; down: number; loan: LoanKind }

export interface Mortgage {
  kind: LoanKind;
  termMonths: number;
  elapsed: number; // payments made
  ioLeft: number; // interest-only months remaining
  homeValue: number;
  original: number; // amount borrowed
  balance: number; // principal still owed
  rate: number; // annual. Fixed, except an interest-only loan after its first ten years.
  payment: number; // monthly principal and interest
  interestPaid: number;
  lastInterest: number; // split of the most recent payment
  lastPrincipal: number;
}

export interface State {
  v: 8;
  generation: number; // hook for heirs
  t: number; // years since start
  months: number; // whole months processed
  deathAge: number; // hidden
  dead: boolean;
  estate: Estate | null;

  cash: number; // liquid balance. Negative means debt at the loan rate.
  job: {
    employed: boolean; salary: number; joblessLeft: number;
    taps: number; // regular work bar this month
    extraTaps: number; // extra-work bar this month
    missed: number; // unfilled months in a row
    missedThisYear: number; fullThisYear: number; extraThisYear: number; // extraThisYear counts in months, fractions allowed
    nextPayCut: number; // applied when the next job starts
    monthsInJob: number;
  };
  loanRate: number; // APY, drifts month to month
  food: number; // notches above the base food budget
  car: { monthly: number } | null; // replaces bus fare once bought
  gym: { level: number; monthly: number } | null;
  /** The cofounder offer and what follows from it. */
  venture: {
    offerAt: number; // month the offer arrives, if employed
    offered: boolean;
    declined: boolean;
    active: boolean; // currently a founder
    attempt: number; // which company this is
    monthsIn: number;
    dormantFor: number; // months before the stake is worth anything, or the company fails
    valued: boolean;
    value: number; // the player's stake. Counts toward net worth. Cannot be sold.
  };
  cause: string | null; // cause of death, when the game has decided one
  home: { kind: "none" } | { kind: "apartment"; level: number; rent: number } | { kind: "house" };
  mortgage: Mortgage | null;
  shop: { offers: Offer[]; next: number; bought: string[] };
  well: {
    w: number; // 0 to 100, hidden
    sickLeft: number;
    sinceRest: number; // months of full work since the last rest
    crushLeft: number;
    dates: number;
    togetherLeft: number;
    lowStreak: number;
    graceLeft: number; // months before low well-being can cost the job again
    lastBought: Record<string, number>; // month index of last purchase, by item
  };
  retire: {
    offered: boolean;
    enrolled: boolean; // once true, the Retirement line stays
    rate: number; // share of each paycheck contributed
    balance: number;
    growth: number; // annualized, drifts month to month
    ytd: number; // contributed this year, against the annual limit
  };
  health: {
    plan: HealthPlan;
    offered: boolean;
    resumePlan: HealthPlan | null; // plan dropped while out of work, restored by a new job
    extended: boolean; // kept past the grace period, at the higher price
    joblessMonths: number; // months in a row without a job
    uninsuredMonths: number; // lifetime, never resets
    noGymMonths: number; // lifetime, never resets
  };
  popups: Popup[]; // shown one at a time; the clock waits
  ytdPay: number;
  ytdDeferred: number;
  lastYearPay: number; // taxed at the end of month 4
  lastYearDeferred: number;
  moving: { left: number; perYear: number }[]; // tax bills and bonuses passing through cash over a few seconds
  totals: { pay: number; tax: number; interest: number; spent: number };
  events: GameEvent[];
}

let rng: () => number = Math.random;
export function setRng(fn: () => number) { rng = fn; }

function gauss(): number {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const between = ([lo, hi]: number[]) => lo + (hi - lo) * rng();

export const item = (id: string): BuyItem => CATALOG.find((i) => i.id === id)!;
const offerFor = (it: BuyItem): Offer => ({ id: it.id, level: it.max ? CFG.buyDefaultLevel : 0, down: CFG.buyDefaultLevel, loan: "fixed30" });

export function newGame(generation = 1): State {
  return {
    v: 8,
    generation,
    t: 0,
    months: 0,
    deathAge: clamp(CFG.deathMean + CFG.deathSd * gauss(), CFG.deathMin, CFG.deathMax),
    dead: false,
    estate: null,
    cash: CFG.startNetWorth,
    job: { employed: true, salary: CFG.salary, joblessLeft: 0, taps: 0, extraTaps: 0, missed: 0, missedThisYear: 0, fullThisYear: 0, extraThisYear: 0, nextPayCut: CFG.rehirePayCut, monthsInJob: 0 },
    loanRate: CFG.loanRateStart,
    food: 0,
    car: null,
    gym: null,
    venture: {
      offerAt: Math.round(between(CFG.founderOfferMonths)), offered: false, declined: false, active: false,
      attempt: 0, monthsIn: 0, dormantFor: 0, valued: false, value: 0,
    },
    cause: null,
    home: { kind: "none" },
    mortgage: null,
    shop: { offers: CATALOG.slice(0, 3).map(offerFor), next: 3, bought: [] },
    well: { w: WELL.start, sickLeft: 0, sinceRest: 0, crushLeft: 0, dates: 0, togetherLeft: 0, lowStreak: 0, graceLeft: 0, lastBought: {} },
    health: { plan: "unoffered", offered: false, resumePlan: null, extended: false, joblessMonths: 0, uninsuredMonths: 0, noGymMonths: 0 },
    retire: { offered: false, enrolled: false, rate: 0, balance: 0, growth: CFG.growthStart, ytd: 0 },
    popups: [],
    ytdPay: 0,
    ytdDeferred: 0,
    lastYearPay: 0,
    lastYearDeferred: 0,
    moving: [],
    totals: { pay: 0, tax: 0, interest: 0, spent: 0 },
    events: [],
  };
}

// ---------- Derived values ----------

export const ageYears = (s: State) => CFG.startAge + Math.floor(s.months / 12);
export const ageMonths = (s: State) => s.months % 12;
/** Position within the current month, 0 to 1. */
export const monthFraction = (s: State) => clamp(s.t * 12 - s.months, 0, 1);
export const salaryNow = (s: State) => (s.job.employed ? s.job.salary : 0);
export const canWork = (s: State) => s.job.employed && s.well.sickLeft <= 0;
export const homeEquity = (s: State) => (s.mortgage ? s.mortgage.homeValue - s.mortgage.balance : 0);
export const netWorth = (s: State) => s.cash + homeEquity(s) + s.retire.balance + s.venture.value;
/** Taps to fill the regular work bar. Founders need twice as many. */
export const tapsNeeded = (s: State) => CFG.tapsToFill * (s.venture.active ? CFG.founderWorkMultiplier : 1);

export const foodMonthly = (s: State) => CFG.foodBase + CFG.foodPerNotch * s.food;
export const transportMonthly = (s: State) => (s.car ? s.car.monthly : CFG.busFare);
export const rentMonthly = (s: State) => (s.home.kind === "apartment" ? s.home.rent : 0);
/** Costs that drain continuously. The mortgage is paid in one piece at month end. */
export const healthMonthly = (s: State) =>
  (CFG.healthCost[s.health.plan] ?? 0) * (s.health.extended ? CFG.healthJoblessMultiplier : 1);
export const gymMonthly = (s: State) => (s.gym ? s.gym.monthly : 0);
export const monthlyExpenses = (s: State) => foodMonthly(s) + transportMonthly(s) + rentMonthly(s) + healthMonthly(s) + gymMonthly(s);
const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
export const housingLabel = (s: State) => (s.home.kind === "apartment" ? "Rent" : s.home.kind === "house" ? "Mortgage" : "");

/** Price at a meter level: cheap at 0, nice at the top, evenly spaced by ratio. */
export function priceOf(it: BuyItem, level: number): number {
  if (!it.max) return it.min;
  const raw = it.min * (it.max / it.min) ** (level / CFG.buyNotches);
  const mag = 10 ** (Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / mag) * mag; // two significant figures
}
export const offerPrice = (o: Offer) => priceOf(item(o.id), o.level);

const amortized = (balance: number, annualRate: number, months: number) => {
  const r = annualRate / 12;
  return months <= 0 ? balance : (balance * r) / (1 - (1 + r) ** -months);
};

/** Everything the House offer would mean at its current settings. */
export function houseTerms(s: State, o: Offer) {
  const price = offerPrice(o);
  const loan = LOANS[o.loan];
  const downPct = CFG.downPaymentMin + CFG.downPaymentStep * o.down;
  const down = Math.round(price * downPct);
  const closing = Math.round(price * CFG.houseClosingCosts);
  const borrowed = price - down;
  const raw = s.loanRate + CFG.mortgageSpread + CFG.downRateAtMin + CFG.downRatePerStep * o.down + loan.rateAdj;
  const rate = Math.round(Math.max(0.02, raw) * 10000) / 10000;
  const payment = loan.ioYears ? (borrowed * rate) / 12 : amortized(borrowed, rate, loan.years * 12);
  return { price, downPct, down, closing, upfront: down + closing, borrowed, rate, payment, loan, kind: o.loan };
}

/** Cash needed up front to buy the offer. */
export function upfrontCost(s: State, o: Offer): number {
  const price = offerPrice(o);
  if (o.id === "house") return houseTerms(s, o).upfront;
  if (o.id === "apartment") return price * CFG.rentDepositMonths;
  // A gym charges the first month on joining.
  return price;
}
/** A house needs its down payment in cash. Everything else can go on debt. */
export const canBuy = (s: State, o: Offer) => o.id !== "house" || s.cash >= upfrontCost(s, o);

/** What the mortgage costs this month: interest on what is owed, and what comes off the principal. */
export function nextPayment(m: Mortgage) {
  if (m.balance <= 0.005) return { interest: 0, principal: 0, total: 0 };
  const interest = (m.balance * m.rate) / 12;
  const principal = m.ioLeft > 0 ? 0 : Math.min(m.balance, Math.max(0, m.payment - interest));
  return { interest, principal, total: interest + principal };
}

export function monthsLeft(m: Mortgage): number {
  if (m.balance <= 0.005) return 0;
  if (m.ioLeft > 0) return m.termMonths - m.elapsed;
  const r = m.rate / 12;
  const x = 1 - (m.balance * r) / m.payment;
  return x <= 0 ? Infinity : Math.ceil(-Math.log(x) / Math.log(1 + r) - 1e-9);
}
/** Interest still to be paid if only the regular payment is made. An estimate for loans whose rate can change. */
export function interestRemaining(s: State, m: Mortgage): number {
  if (m.ioLeft > 0) {
    const later = m.termMonths - m.elapsed - m.ioLeft;
    const resetRate = s.loanRate + (LOANS[m.kind].resetSpread ?? 0);
    return (m.ioLeft * m.balance * m.rate) / 12 + later * amortized(m.balance, resetRate, later) - m.balance;
  }
  const n = monthsLeft(m);
  return n === Infinity ? Infinity : Math.max(0, n * m.payment - m.balance);
}

/** The face. Everything behind it stays hidden. */
export function face(s: State): string {
  const k = s.well;
  if (k.sickLeft > 0) return "🤒";
  if (k.w >= 35) {
    if (s.job.employed && k.sinceRest >= WELL.overworkedAfterMonths) return "😅";
    if (k.togetherLeft > 0) return "😘";
    if (k.crushLeft > 0) return "😍";
  }
  const scale: [number, string][] = [
    [85, "😀"], [68, "🙂"], [56, "😐"], [48, "😕"], [40, "😟"], [33, "🙁"],
    [26, "😞"], [20, "☹️"], [13, "😣"], [7, "😖"],
  ];
  for (const [floor, f] of scale) if (k.w >= floor) return f;
  return "😩";
}

// ---------- Well-being ----------

function bump(s: State, d: number) { s.well.w = clamp(s.well.w + d, 0, 100); }

function wellMonth(s: State, workedFully: boolean, extraShare: number) {
  const k = s.well;
  const wasSick = k.sickLeft > 0;
  let target = WELL.base + WELL.foodEffect[s.food];
  target += s.home.kind === "none" ? WELL.noHome : s.home.kind === "apartment" ? WELL.apartmentEffect[s.home.level] : WELL.houseEffect;
  if (!s.job.employed) target += WELL.joblessEffect;
  const care = WELL.health[s.health.plan];
  target += care.target;
  if (s.health.plan === "none") s.health.uninsuredMonths++;
  if (s.gym) target += WELL.gymEffect[s.gym.level];
  else s.health.noGymMonths++;
  let hit = WELL.extraNotchHit * CFG.tapsToFill * extraShare;

  // A full bar of extra work wears you down twice as fast.
  k.sinceRest = workedFully ? k.sinceRest + (extraShare >= 1 ? 2 : 1) : Math.max(0, k.sinceRest - 1);
  if (s.job.employed && k.sinceRest >= WELL.overworkedAfterMonths) target += WELL.overworkedEffect;
  if (k.graceLeft > 0) k.graceLeft--;

  // Someone catches your eye. It may or may not go anywhere.
  if (k.togetherLeft > 0) {
    target += WELL.togetherEffect;
    if (--k.togetherLeft === 0) hit += WELL.breakupHit;
  } else if (k.crushLeft > 0) {
    target += WELL.crushEffect;
    if (--k.crushLeft === 0) {
      if (k.dates > 0 && rng() < WELL.togetherChance) k.togetherLeft = 6 + Math.floor(rng() * 12);
      else hit += WELL.fizzleHit;
    }
  } else if (k.w >= WELL.crushWellFloor && rng() < WELL.crushChance) {
    k.crushLeft = WELL.crushMonths;
    k.dates = 0;
  }

  // Sickness: more likely when run down or badly fed, less with a gym habit.
  if (wasSick) {
    target += WELL.sickEffect;
    k.sickLeft--;
  } else {
    // Age raises the odds. So does every month ever spent without health care or exercise.
    const years = s.months / 12;
    let p = WELL.sickChance * (1 + years / WELL.sickChanceDoublesAfterYears)
      + Math.min(WELL.sickUninsuredCap, WELL.sickPerUninsuredMonth * s.health.uninsuredMonths)
      + Math.min(WELL.sickNoGymCap, WELL.sickPerNoGymMonth * s.health.noGymMonths)
      + (k.w < 30 ? WELL.sickChanceLowWell : 0) + (s.food === 0 ? WELL.sickChanceBadFood : 0);
    p *= care.sickFactor;
    if (s.gym) p /= 2;
    if (rng() < p) {
      k.sickLeft = care.months + (rng() < care.longChance ? 1 : 0);
      const bill = Math.round(between(care.bill) / 10) * 10;
      s.cash -= bill;
      s.totals.spent += bill;
      s.events.push({ kind: "doctor", amount: bill });
    }
  }

  bump(s, WELL.pull * (target - k.w) + hit + WELL.noise * (rng() * 2 - 1));
  k.lowStreak = k.w < WELL.fireBelow && k.graceLeft <= 0 ? k.lowStreak + 1 : 0;
}

function wellPurchase(s: State, it: BuyItem, price: number) {
  const k = s.well;
  let boost = WELL.purchaseBase + WELL.purchasePerDecade * Math.max(0, Math.log10(price / 50));
  boost *= between(WELL.purchaseLuck);
  const last = k.lastBought[it.id];
  if (last !== undefined && s.months - last < WELL.repeatMonths) boost *= WELL.repeatFactor;
  k.lastBought[it.id] = s.months;
  if (WELL.restItems.includes(it.id)) { k.sinceRest = 0; boost += WELL.restBonus; }
  if (WELL.dateItems.includes(it.id) && k.crushLeft > 0) k.dates++;
  bump(s, boost);
}

// ---------- Clock ----------

function loseJob(s: State, payCut = CFG.rehirePayCut) {
  const j = s.job;
  j.employed = false;
  j.missed = 0;
  j.taps = 0;
  j.extraTaps = 0;
  j.nextPayCut = payCut;
  j.monthsInJob = 0;
  j.joblessLeft = CFG.joblessMonths + (s.well.w < WELL.slowRehireBelow ? WELL.slowRehireExtraMonths : 0);
  s.well.lowStreak = 0;
  // A founder who walks away or is pushed out leaves the stake behind.
  const v = s.venture;
  if (v.active) { v.active = false; v.valued = false; v.value = 0; }
}

function month(s: State) {
  s.months++;

  // 1. Interest on debt, before the paycheck lands.
  if (s.cash < 0) {
    const int = -s.cash * ((1 + s.loanRate) ** (1 / 12) - 1);
    s.cash -= int;
    s.totals.interest += int;
    s.events.push({ kind: "interest", amount: int });
  }

  // 2. Paycheck, then the monthly work check. A sick month is not held against you.
  const j = s.job;
  const sick = s.well.sickLeft > 0;
  const workedFully = j.employed && j.taps >= tapsNeeded(s);
  // Share of the extra-work bar filled, counted in whole notches.
  const extraShare = j.employed ? Math.floor(j.extraTaps / CFG.extraTapsPerNotch) / tapsNeeded(s) : 0;
  if (j.employed) {
    const pay = j.salary / 12;
    // Retirement contributions come out of the paycheck; the employer matches up to a cap.
    const r = s.retire;
    const contrib = Math.max(0, Math.min(pay * r.rate, CFG.retireAnnualLimit - r.ytd));
    const match = Math.min(contrib, pay * CFG.retireMatchCap);
    r.balance += contrib + match;
    r.ytd += contrib;
    s.ytdDeferred += contrib;
    s.cash += pay - contrib;
    s.ytdPay += pay;
    s.totals.pay += pay;
    s.events.push({ kind: "pay", amount: pay - contrib });
    if (contrib > 0) s.events.push({ kind: "retire", amount: contrib + match });
    if (!sick) {
      if (workedFully) { j.missed = 0; j.fullThisYear++; j.extraThisYear += extraShare; }
      else { j.missed++; j.missedThisYear++; }
    }
    j.taps = 0;
    j.extraTaps = 0;
    if (j.missed >= CFG.missedMonthsToLoseJob) { loseJob(s); s.events.push({ kind: "fired" }); }
    else {
      j.monthsInJob++;
      const first = !r.offered && s.months >= CFG.retireOfferAtMonth;
      const again = r.offered && !r.enrolled && j.monthsInJob === CFG.retireOfferAfterMonths;
      if (first || again) {
        r.offered = true;
        s.popups.push({
          id: "retirement-offer",
          text: `Your employer has offered to match your contribution to a retirement account, up to ${Math.round(CFG.retireMatchCap * 100)}% of your income. How much of your income would you like to contribute?`,
          choices: CFG.retireChoices.map((c) => ({ label: `${Math.round(c * 100)}%`, value: String(c) })),
        });
      }
    }
  } else if (--j.joblessLeft <= 0) {
    j.employed = true;
    j.salary = Math.max(CFG.salaryFloor, Math.round(j.salary * (1 - j.nextPayCut)));
    j.monthsInJob = 0;
    // A new job brings back health care at the usual price.
    const h = s.health;
    h.extended = false;
    if (h.resumePlan) { h.plan = h.resumePlan; h.resumePlan = null; }
    s.well.graceLeft = WELL.fireGraceMonths;
    s.events.push({ kind: "hired", salary: j.salary });
  }

  // Health care: offered once by pop-up. Without a job it runs on for a while, then costs more or ends.
  const hc = s.health;
  hc.joblessMonths = j.employed ? 0 : hc.joblessMonths + 1;
  if (!hc.offered && s.months >= CFG.healthOfferAtMonth) {
    hc.offered = true;
    s.popups.push(healthOffer());
  }
  if (hc.joblessMonths === CFG.healthJoblessGraceMonths && !hc.extended && (hc.plan === "bad" || hc.plan === "good")) {
    const cost = CFG.healthCost[hc.plan] * CFG.healthJoblessMultiplier;
    s.popups.push({
      id: "health-continue",
      title: "Health Care",
      text: `You have been out of work for six months. Keeping your health care now costs ${usd(cost)} a month.`,
      choices: [{ label: "KEEP", value: "keep" }, { label: "NONE", value: "none" }],
    });
  }

  // Retirement savings grow every month at the current annualized rate, which then drifts.
  s.retire.balance *= (1 + s.retire.growth) ** (1 / 12);
  s.retire.growth = clamp(
    s.retire.growth + CFG.growthPull * (CFG.growthMean - s.retire.growth) + CFG.growthShock * gauss(),
    CFG.growthMin, CFG.growthMax,
  );

  // 3. Mortgage payment: interest first, the rest comes off the principal.
  const m = s.mortgage;
  if (m && m.balance > 0.005) {
    const pay = nextPayment(m);
    m.balance -= pay.principal;
    m.interestPaid += pay.interest;
    m.lastInterest = pay.interest;
    m.lastPrincipal = pay.principal;
    m.elapsed++;
    s.cash -= pay.total;
    s.totals.interest += pay.interest;
    s.events.push({ kind: "mortgage", amount: pay.total });

    // An interest-only loan: when the first ten years end, and every year after, the rate resets
    // above the market and the payment is recalculated over the time that remains.
    const reset = LOANS[m.kind].resetSpread;
    if (reset !== undefined) {
      const ended = m.ioLeft > 0 && --m.ioLeft === 0;
      if (ended || (m.ioLeft === 0 && m.elapsed % 12 === 0)) {
        m.rate = Math.round((s.loanRate + reset) * 10000) / 10000;
        m.payment = amortized(m.balance, m.rate, m.termMonths - m.elapsed);
      } else if (m.ioLeft > 0) {
        m.payment = (m.balance * m.rate) / 12;
      }
    }
  }

  // 4. Well-being, and what it costs when it stays low.
  wellMonth(s, workedFully, extraShare);
  if (j.employed && s.well.lowStreak >= WELL.fireMonths) { loseJob(s); s.events.push({ kind: "fired" }); }

  // The loan rate drifts in quarter-point steps, pulled toward its long-run mean.
  if (rng() < CFG.loanRateMoveChance) {
    const up = clamp(0.5 + (CFG.loanRateMean - s.loanRate) * 8, 0.1, 0.9);
    const next = s.loanRate + (rng() < up ? CFG.loanRateStep : -CFG.loanRateStep);
    s.loanRate = Math.round(clamp(next, CFG.loanRateMin, CFG.loanRateMax) * 10000) / 10000;
  }

  // 5. Last year's taxes come due at the end of month 4.
  if (s.months % 12 === CFG.taxMonth && s.lastYearPay > 0) {
    const t = taxOnWages(s.lastYearPay, s.lastYearDeferred);
    s.lastYearPay = 0;
    s.lastYearDeferred = 0;
    s.totals.tax += t.total;
    s.popups.push({
      id: "tax", title: "Taxes Due",
      text: `${Math.round(t.rate * 100)}% of last year's income: ${usd(t.total)}`,
      choices: [{ label: "OKAY", value: "ok" }], amount: -t.total,
    });
  }

  ventureMonth(s);

  // 6. Year end: bonus, then a raise, both shaped by the year's work. Founders get neither.
  if (s.months % 12 === 0) {
    if (j.employed && !s.venture.active) {
      const pct = clamp(
        CFG.bonusBase + CFG.bonusPerFullMonth * j.fullThisYear + CFG.bonusPerMissedMonth * j.missedThisYear
          + CFG.bonusPerExtraMonth * j.extraThisYear + CFG.bonusNoiseSd * gauss(),
        0, CFG.bonusMax,
      );
      const bonus = Math.round(j.salary * pct);
      s.ytdPay += bonus;
      s.totals.pay += bonus;
      s.popups.push({
        id: "bonus", title: "Year-End Bonus",
        text: `${Math.round(pct * 100)}% of your salary: ${usd(bonus)}`
          + (pct > CFG.bonusPraiseAbove ? `\n\n${CFG.bonusPraise}` : pct < CFG.bonusWarnBelow ? `\n\n${CFG.bonusWarn}` : ""),
        choices: [{ label: "OKAY", value: "ok" }], amount: bonus,
      });

      if (j.missedThisYear <= CFG.raiseMaxMissedMonths) {
        const well = Math.max(0, (s.well.w - CFG.raiseWellbeingFloor) / (100 - CFG.raiseWellbeingFloor));
        const share = clamp(CFG.raiseWellWeight * well + (CFG.raiseExtraWeight * j.extraThisYear) / 12, 0, 1);
        const raised = Math.round((j.salary * (1 + CFG.raiseMin + (CFG.raiseMax - CFG.raiseMin) * share)) / 100) * 100;
        // Unhappy and no extra work: no raise.
        if (share > 0) { j.salary = raised; s.events.push({ kind: "raise", salary: j.salary }); }
      }
    }
    j.missedThisYear = 0; j.fullThisYear = 0; j.extraThisYear = 0;
    s.lastYearPay += s.ytdPay;
    s.lastYearDeferred += s.ytdDeferred;
    s.ytdPay = 0;
    s.ytdDeferred = 0;
    s.retire.ytd = 0;
  }
}

/** The cofounder offer, the worthless years, and what the company becomes. */
function ventureMonth(s: State) {
  const v = s.venture, j = s.job;
  if (!v.offered && j.employed && s.months >= v.offerAt) {
    v.offered = true;
    s.popups.push({
      id: "founder-offer",
      title: "An Offer",
      text: `A coworker is leaving to start a company and wants you as a cofounder. The pay is lower and the hours are longer. You would own ${Math.round(CFG.founderStake * 100)}% of a company that does not exist yet.`,
      choices: [{ label: "QUIT AND JOIN", value: "join" }, { label: "STAY", value: "stay" }],
    });
    return;
  }
  if (!v.active) return;
  v.monthsIn++;
  if (v.valued) {
    v.value = Math.max(0, v.value * (1 + CFG.stakeGrowth) ** (1 / 12) * (1 + CFG.stakeNoise * gauss()));
    return;
  }
  if (v.monthsIn < v.dormantFor) return;
  const failChance = CFG.founderFailChance[Math.min(v.attempt, CFG.founderFailChance.length) - 1];
  if (rng() < failChance) {
    // The company folds. The staff lose their jobs; the founder leaves with a package and starts the next one.
    const pkg = Math.round(between(CFG.founderExitPackage) / 1000) * 1000;
    v.attempt++;
    v.monthsIn = 0;
    v.dormantFor = Math.round(between(CFG.founderDormantMonths));
    s.popups.push({
      id: "venture-failed", title: "The Company Has Failed",
      text: `The staff have been laid off. You leave with ${usd(pkg)}.\n\nAn investor from this company has already funded your next one.`,
      choices: [{ label: "OKAY", value: "ok" }], amount: pkg,
    });
  } else {
    v.valued = true;
    v.value = Math.round(between(CFG.founderFirstValuation) / 10000) * 10000;
    s.popups.push({
      id: "venture-valued", title: "Ownership",
      text: `An investor has bought into the company. Your ${Math.round(CFG.founderStake * 100)}% is now worth ${usd(v.value)}.\n\nYou cannot sell it.`,
      choices: [{ label: "OKAY", value: "ok" }],
    });
  }
}

/** Pass an amount through cash over a few seconds, so the player watches it happen. */
function move(s: State, amount: number) {
  s.moving.push({ left: amount, perYear: Math.abs(amount) / (CFG.taxDrainSeconds / CFG.secondsPerYear) });
}

function die(s: State) {
  const net = netWorth(s);
  const estateTax = Math.max(0, net - CFG.estateExemption) * CFG.estateRate;
  s.estate = {
    generation: s.generation,
    ageAtDeath: ageYears(s),
    net,
    estateTax,
    toHeirs: net - estateTax,
    lifetimePay: s.totals.pay,
    lifetimeTax: s.totals.tax,
    lifetimeInterest: s.totals.interest,
    cause: s.cause ?? undefined,
  };
  s.dead = true;
}

/** Advance the game by `years`, in small fixed steps. */
export function advance(s: State, years: number) {
  let left = years;
  while (left > 0 && !s.dead && s.popups.length === 0) {
    const dt = Math.min(CFG.stepYears, left);
    left -= dt;
    s.t += dt;

    const spend = monthlyExpenses(s) * 12 * dt;
    s.cash -= spend;
    s.totals.spent += spend;

    for (const mv of s.moving) {
      const d = Math.sign(mv.left) * Math.min(Math.abs(mv.left), mv.perYear * dt);
      mv.left -= d;
      s.cash += d;
    }
    if (s.moving.length && Math.abs(s.moving[0].left) < 0.005) s.moving.shift();

    while (Math.floor(s.t * 12 + 1e-9) > s.months && !s.dead) month(s);
    if (CFG.startAge + s.t >= s.deathAge) {
      for (const mv of s.moving) s.cash += mv.left;
      s.moving = [];
      die(s);
    }
  }
}

// ---------- Player actions ----------

export const extraUnlocked = (s: State) => s.job.taps >= tapsNeeded(s);
export const extraTapsToFill = (s: State) => tapsNeeded(s) * CFG.extraTapsPerNotch;

/** One tap of work. Fills the regular bar first, then the extra-work bar. Returns true if it counted. */
export function work(s: State): boolean {
  if (s.dead || !canWork(s)) return false;
  const j = s.job;
  if (j.taps < tapsNeeded(s)) { j.taps++; return true; }
  if (j.extraTaps < extraTapsToFill(s)) { j.extraTaps++; return true; }
  return false;
}

function healthOffer(): Popup {
  return {
    id: "health-offer",
    title: "Health Care",
    text: "Sometimes you get sick. If you want to be able to do anything about it, you need this.",
    choices: [{ label: "NONE", value: "none" }, { label: "BAD", value: "bad" }, { label: "GOOD", value: "good" }],
  };
}
/** Reopen the health care choice from the Expenses row. */
export function changeHealth(s: State) {
  if (!s.dead && s.health.offered && s.popups.length === 0) s.popups.push(healthOffer());
}

/** Answer the pop-up on screen. */
export function answer(s: State, value: string) {
  const p = s.popups.shift();
  if (!p) return;
  if (p.amount) move(s, p.amount);
  if (p.id === "health-offer" && (value === "none" || value === "bad" || value === "good")) {
    s.health.plan = value;
    s.health.resumePlan = null;
  }
  if (p.id === "health-continue") {
    if (value === "keep") s.health.extended = true;
    else { s.health.resumePlan = s.health.plan; s.health.plan = "none"; }
  }
  if (p.id === "founder-offer") {
    const v = s.venture, j = s.job;
    if (value === "join" && j.employed) {
      v.active = true;
      v.attempt = 1;
      v.monthsIn = 0;
      v.dormantFor = Math.round(between(CFG.founderDormantMonths));
      j.salary = Math.max(CFG.salaryFloor, Math.round((j.salary * CFG.founderSalaryFactor) / 100) * 100);
      j.taps = 0; j.extraTaps = 0; j.missed = 0;
    } else {
      // The offer does not come again. A desk for life, and a shorter one.
      v.declined = true;
      s.deathAge = Math.min(s.deathAge, between(CFG.declinedDeathAge));
      s.cause = CFG.declinedCauses[Math.floor(rng() * CFG.declinedCauses.length)];
    }
  }
  if (p.id === "retirement-offer") {
    const rate = Number(value) || 0;
    s.retire.rate = rate;
    if (rate > 0) s.retire.enrolled = true;
  }
}

export function adjustRetirement(s: State, delta: number) {
  const next = s.retire.rate + delta * CFG.retireStep;
  s.retire.rate = Math.round(clamp(next, 0, CFG.retireMaxRate) * 100) / 100;
}

/** Walk out. Relief now, no pay for a while, a slightly worse job after. */
export function quit(s: State) {
  if (s.dead || !s.job.employed) return;
  loseJob(s, CFG.quitPayCut);
  s.well.sinceRest = 0;
  bump(s, CFG.quitRelief);
  s.events.push({ kind: "quit" });
}

/** Move to a different apartment. Costs a new deposit. */
export function moveApartment(s: State, level: number) {
  if (s.dead || s.home.kind !== "apartment") return;
  const lv = clamp(level, 0, CFG.buyNotches);
  const rent = priceOf(item("apartment"), lv);
  const deposit = rent * CFG.rentDepositMonths;
  s.cash -= deposit;
  s.totals.spent += deposit;
  s.home = { kind: "apartment", level: lv, rent };
  s.events.push({ kind: "buy", name: "Move", amount: deposit });
  bump(s, 3 * between(WELL.purchaseLuck));
}

export function setFood(s: State, delta: number) {
  s.food = clamp(s.food + delta, 0, CFG.foodNotches);
}

export function setOfferLevel(s: State, slot: number, delta: number) {
  const o = s.shop.offers[slot];
  if (o && item(o.id).max) o.level = clamp(o.level + delta, 0, CFG.buyNotches);
}
export function setOfferDown(s: State, slot: number, delta: number) {
  const o = s.shop.offers[slot];
  if (o) o.down = clamp(o.down + delta, 0, CFG.buyNotches);
}
export function setOfferLoan(s: State, slot: number, kind: LoanKind) {
  const o = s.shop.offers[slot];
  if (o && LOANS[kind]) o.loan = kind;
}

/** Buy the offer in a slot. A new offer takes its place. */
export function buy(s: State, slot: number) {
  const o = s.shop.offers[slot];
  if (s.dead || !o || !canBuy(s, o)) return;
  const it = item(o.id);
  const price = offerPrice(o);
  const upfront = upfrontCost(s, o);
  s.cash -= upfront;

  if (it.id === "house") {
    const h = houseTerms(s, o);
    s.mortgage = {
      kind: h.kind, termMonths: h.loan.years * 12, elapsed: 0, ioLeft: (h.loan.ioYears ?? 0) * 12,
      homeValue: price, original: h.borrowed, balance: h.borrowed, rate: h.rate, payment: h.payment,
      interestPaid: 0, lastInterest: 0, lastPrincipal: 0,
    };
    s.home = { kind: "house" };
    s.totals.spent += h.closing; // the down payment becomes equity
  } else {
    s.totals.spent += upfront;
    if (it.id === "apartment") s.home = { kind: "apartment", level: o.level, rent: price };
    if (it.id === "gym") s.gym = { level: o.level, monthly: price };
    if (it.id === "car") s.car = { monthly: Math.round(CFG.carMonthlyBase + price * CFG.carMonthlyPerDollar) };
  }
  s.events.push({ kind: "buy", name: it.name, amount: upfront });
  s.shop.bought.push(it.id);
  wellPurchase(s, it, it.perMonth ? price * 12 : price);

  // Next catalog item that is eligible and not already on offer.
  const showing = s.shop.offers.map((x) => x.id);
  for (let i = 0; i < CATALOG.length; i++) {
    const cand = CATALOG[(s.shop.next + i) % CATALOG.length];
    if (showing.includes(cand.id)) continue;
    if (cand.once && s.shop.bought.includes(cand.id)) continue;
    if (cand.requires && !s.shop.bought.includes(cand.requires)) continue;
    s.shop.offers[slot] = offerFor(cand);
    s.shop.next = (s.shop.next + i + 1) % CATALOG.length;
    return;
  }
}

/** Cancel the gym. It can be joined again later from Buy. */
export function quitGym(s: State) {
  if (s.dead || !s.gym) return;
  s.gym = null;
  s.shop.bought = s.shop.bought.filter((id) => id !== "gym");
}

/** Extra payment toward the mortgage principal. */
export function payMortgage(s: State, amount: number) {
  const m = s.mortgage;
  if (s.dead || !m) return;
  const x = Math.min(amount, m.balance, Math.max(0, s.cash));
  if (x <= 0) return;
  s.cash -= x;
  m.balance -= x;
  if (m.balance < 0.005) m.balance = 0;
}
