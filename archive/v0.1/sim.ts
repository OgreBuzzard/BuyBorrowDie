// Headless playthroughs for tuning: `npm run sim`.
import * as G from "../src/engine/game";
import { fedTax, ordinaryTax } from "../src/engine/tax";

function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const m = (n: number) => (Math.abs(n) >= 1e6 ? "$" + (n / 1e6).toFixed(2) + "M" : "$" + Math.round(n).toLocaleString());

console.log("fedTax(140k) =", fedTax(140_000), "(expect 22900)");
console.log("ordinaryTax(140k) =", ordinaryTax(140_000).total, "(expect 42010)");

type Bot = { name: string; clicksPerYear: number; borrows: boolean; buys: boolean; leverage: number };
const bots: Bot[] = [
  { name: "saver, never borrows", clicksPerYear: 150, borrows: false, buys: false, leverage: 0 },
  { name: "spender, never invests much", clicksPerYear: 150, borrows: false, buys: true, leverage: 0 },
  { name: "borrower, lives on the line", clicksPerYear: 150, borrows: true, buys: true, leverage: 0.3 },
  { name: "borrower, max leverage", clicksPerYear: 150, borrows: true, buys: false, leverage: 0.4 },
];

for (const bot of bots) {
  for (const seed of [1, 2, 3]) {
    G.setRng(mulberry(seed * 977));
    const s = G.newGame();
    let milestones = "";
    const seen = new Set<number>();
    while (!s.dead) {
      // one month of play
      for (let i = 0; i < bot.clicksPerYear / 12; i++) G.work(s);
      G.advance(s, 1 / 12);
      if (s.cash > 15_000) G.invest(s, (s.cash - 15_000) / s.cash);
      if (bot.buys) for (const item of G.visibleLifestyle(s)) if (G.canBuy(s, item.id) && G.netWorth(s) > item.price * 4) G.buy(s, item.id);
      if (bot.borrows && s.loan.unlocked) {
        G.setPayLivingFromLine(s, true);
        if (s.flags.resign && s.job.employed) G.resign(s);
        if (G.ltv(s) < bot.leverage) { G.borrow(s, 0.2); G.invest(s, 1); }
      }
      const a = Math.floor(G.age(s));
      if ([30, 40, 50, 60, 70, 80].includes(a) && !seen.has(a)) { seen.add(a); milestones += ` ${a}:${m(G.netWorth(s))}`; }
    }
    const e = s.estate!;
    const calls = s.log.filter((l) => l.msg.startsWith("Margin call")).length;
    console.log(`${bot.name} #${seed} | died ${e.ageAtDeath} | net ${m(e.net)} | life tax ${m(e.lifetimeTax)} (${(e.lifetimeRate * 100).toFixed(1)}%) | untaxed ${m(e.untaxedGains)} | estate tax ${m(e.estateTax)} | level ${s.job.level} |${milestones}`);
    if (calls) console.log("   margin calls in recent log:", calls);
  }
}
