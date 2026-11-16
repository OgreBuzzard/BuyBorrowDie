// Headless checks: `npm run sim`.
import { CFG } from "../src/engine/config";
import * as G from "../src/engine/game";
import { taxOnWages } from "../src/engine/tax";

const usd = (n: number) => (n < 0 ? "-" : "") + "$" + Math.round(Math.abs(n)).toLocaleString("en-US");
const t100 = taxOnWages(100_000);
console.log(`tax on $100,000: ${usd(t100.total)} (${(t100.rate * 100).toFixed(1)}%)`);

type Bot = { name: string; food: number; buyEvery: number; apartment: boolean; extra?: number; health?: string };
const bots: Bot[] = [
  { name: "ascetic: no food upgrade, buys nothing", food: 0, buyEvery: 0, apartment: false },
  { name: "food 3, buys nothing", food: 3, buyEvery: 0, apartment: false },
  { name: "food 3, apartment, buys every 3 months", food: 3, buyEvery: 3, apartment: true },
  { name: "food 2, apartment, buys every 3 months", food: 2, buyEvery: 3, apartment: true },
  { name: "food 3, apartment, buys every 3 months, no health care", food: 3, buyEvery: 3, apartment: true, health: "none" },
  { name: "food 3, apartment, buys every 3 months, good health care", food: 3, buyEvery: 3, apartment: true, health: "good" },
  { name: "food 3, apartment, buys every 3 months, full extra work", food: 3, buyEvery: 3, apartment: true, extra: 40 },
  { name: "food 5, apartment, buys every month", food: 5, buyEvery: 1, apartment: true },
];
for (const bot of bots) {
  const s = G.newGame();
  s.deathAge = 200;
  for (let i = 0; i < bot.food; i++) G.setFood(s, 1);
  let faces = "", fired = 0, sick = 0;
  for (let m = 1; m <= 480; m++) {
    for (let i = 0; i < CFG.tapsToFill + (bot.extra ?? 0); i++) G.work(s);
    G.advance(s, 1 / 12);
    while (s.popups.length) { const id = s.popups[0].id; G.answer(s, id === "retirement-offer" ? "0.05" : id === "health-offer" ? (bot.health ?? "bad") : id === "health-continue" ? "keep" : "ok"); G.advance(s, m / 12 - s.t); }
    s.t = m / 12;
    for (const e of s.events.splice(0)) { if (e.kind === "fired") fired++; if (e.kind === "doctor") sick++; }
    if (bot.buyEvery && m % bot.buyEvery === 0) {
      // buy the cheapest eligible offer; take the apartment and house when possible
      const offers = s.shop.offers.map((o, i) => ({ o, i })).filter(({ o }) => G.canBuy(s, o) && (bot.apartment || o.id !== "apartment") && o.id !== "house");
      s.shop.offers.forEach((o, i) => { if (o.id === "apartment") for (let k = 0; k < 5; k++) G.setOfferLevel(s, i, -1); else for (let k = 0; k < 2; k++) G.setOfferLevel(s, i, -1); });
      const rest = s.shop.offers.findIndex((o) => ["vacation", "ski", "family"].includes(o.id));
      if (G.face(s) === "😅" && rest >= 0) { G.buy(s, rest); continue; }
      const house = s.shop.offers.findIndex((o) => o.id === "house" && G.canBuy(s, o));
      if (house >= 0) G.buy(s, house);
      else if (offers.length) G.buy(s, offers.sort((a, b) => G.upfrontCost(s, a.o) - G.upfrontCost(s, b.o))[0].i);
    }
    if (m % 12 === 0 && m <= 120) faces += G.face(s);
  }
  const mg = s.mortgage;
  console.log(`${bot.name}\n  faces by year ${faces} | after 40y: net worth ${usd(G.netWorth(s))} (retirement ${usd(s.retire.balance)}, growth now ${(s.retire.growth * 100).toFixed(1)}%), salary ${usd(s.job.salary)}, fired ${fired}x, sick ${sick}x${mg ? `, house ${usd(mg.homeValue)} owes ${usd(mg.balance)} at ${(mg.rate * 100).toFixed(2)}%, ${G.monthsLeft(mg)} months left` : ""}`);
}

// Mortgage arithmetic against the textbook formula: $400,000 at 7.18% for 30 years is about $2,710 a month.
const r = 0.0718 / 12, pay = (400_000 * r) / (1 - (1 + r) ** -360);
console.log("check: $400,000 at 7.18% for 30 years =", usd(pay), "a month");
