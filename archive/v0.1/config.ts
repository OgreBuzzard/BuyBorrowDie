// All tunable numbers live here. Tax figures are simplified and rounded on
// purpose; see the design doc, section 6.

export const CFG = {
  secondsPerYear: 180,
  startAge: 22,
  startCash: 2000,
  stepYears: 1 / 720, // simulation step: half a game-day

  // --- Tax (simplified) ---
  fedBrackets: [
    [15_000, 0],
    [65_000, 0.12],
    [120_000, 0.22],
    [210_000, 0.24],
    [270_000, 0.32],
    [650_000, 0.35],
    [Infinity, 0.37],
  ] as [number, number][],
  payrollCap: 180_000,
  payrollLow: 0.0765,
  payrollHigh: 0.0235,
  stateRate: 0.06,
  supplementalWithholding: 0.4, // bonuses and stock
  gainsLow: 0.15,
  gainsHigh: 0.2,
  gainsHighThreshold: 500_000,
  gainsSurtax: 0.038,
  estateExemption: 15_000_000,
  estateRate: 0.4,

  // --- Career ---
  levels: [
    { title: "Software Engineer", salary: 140_000, stock: 0, perf: 80 },
    { title: "Senior Engineer", salary: 185_000, stock: 60_000, perf: 200 },
    { title: "Staff Engineer", salary: 240_000, stock: 180_000, perf: 400 },
    { title: "Principal Engineer", salary: 310_000, stock: 300_000, perf: 700 },
    { title: "Director", salary: 380_000, stock: 550_000, perf: 1100 },
    { title: "Vice President", salary: 480_000, stock: 1_000_000, perf: Infinity },
  ],
  passivePerfPerMonth: 2,
  bonusPerClick: 0.0003, // share of salary
  bonusCap: 0.2, // share of salary per year
  retireAge: 65,
  retirementBenefitMonthly: 4500,
  bankruptcyFloor: 100_000, // net worth below minus this (minus a year's salary) triggers bankruptcy

  // --- Living ---
  baseLivingMonthly: 4200,
  lifestyleCreep: 1.18, // multiplier on each promotion

  // --- Market ---
  drift: 0.075,
  vol: 0.15,
  crashDrift: -0.9,
  crashVol: 0.25,
  crashYears: 0.5,
  recoverDrift: 0.2,
  recoverYears: 2.5,

  // --- Credit ---
  lineUnlockPortfolio: 500_000,
  lineMaxLtv: 0.5,
  lineCallLtv: 0.7,
  rateMean: 0.045,
  rateRevert: 0.08,
  rateShock: 0.004,
  rateMin: 0.005,
  rateMax: 0.11,
  spreads: [
    [5_000_000, 0.025],
    [25_000_000, 0.0175],
    [Infinity, 0.01],
  ] as [number, number][],
  cardApr: 0.22,

  // --- Death ---
  deathMean: 87,
  deathSd: 5,
  deathMin: 70,
  deathMax: 99,
};

export interface LifestyleItem {
  id: string;
  name: string;
  price: number;
  unlockNetWorth: number;
  asset: boolean; // counts toward net worth at purchase price
  recurring: [string, number][]; // monthly, revealed after purchase
  note: string; // log line on purchase
}

export const LIFESTYLE: LifestyleItem[] = [
  { id: "apt", name: "Apartment, no roommates", price: 4_000, unlockNetWorth: 0, asset: false,
    recurring: [["Rent increase", 1400], ["Furniture, financed", 180]], note: "You live alone now." },
  { id: "car", name: "New car", price: 48_000, unlockNetWorth: 30_000, asset: false,
    recurring: [["Car insurance", 210], ["Parking", 280], ["Car maintenance", 130]], note: "You own a car." },
  { id: "trip", name: "Two weeks abroad", price: 14_000, unlockNetWorth: 60_000, asset: false,
    recurring: [["Annual travel", 1200]], note: "You take a trip like this every year now." },
  { id: "condo", name: "Condo, two bedrooms", price: 850_000, unlockNetWorth: 400_000, asset: true,
    recurring: [["Condo property tax", 700], ["HOA dues", 900], ["Condo upkeep", 600], ["Condo insurance", 150]], note: "You own a home." },
  { id: "boat", name: "Boat, 32 feet", price: 240_000, unlockNetWorth: 750_000, asset: false,
    recurring: [["Moorage", 850], ["Fuel", 500], ["Boat maintenance", 1400], ["Boat insurance", 380]], note: "You own a boat." },
  { id: "club", name: "Club membership", price: 120_000, unlockNetWorth: 1_500_000, asset: false,
    recurring: [["Club dues", 1900], ["Club minimum spend", 600]], note: "You are a member." },
  { id: "cabin", name: "Second home, mountains", price: 2_800_000, unlockNetWorth: 4_000_000, asset: true,
    recurring: [["Second home property tax", 2300], ["Caretaker", 1800], ["Second home upkeep", 2400], ["Second home utilities", 700], ["Second home insurance", 900]], note: "You own a second home." },
  { id: "staff", name: "Household staff", price: 0, unlockNetWorth: 8_000_000, asset: false,
    recurring: [["Chef", 9000], ["House manager", 11000]], note: "You employ people at home." },
  { id: "jet", name: "Jet card, 50 hours", price: 550_000, unlockNetWorth: 15_000_000, asset: false,
    recurring: [["Jet card renewal", 46000]], note: "You no longer fly commercial." },
  { id: "estate", name: "Waterfront residence", price: 14_000_000, unlockNetWorth: 40_000_000, asset: true,
    recurring: [["Residence property tax", 11600], ["Grounds and staff", 9000], ["Security", 12000], ["Residence insurance", 5000]], note: "You own a larger home." },
  { id: "yacht", name: "Yacht, 50 meters", price: 45_000_000, unlockNetWorth: 150_000_000, asset: false,
    recurring: [["Crew", 150000], ["Yacht fuel", 60000], ["Dockage", 40000], ["Yacht maintenance", 125000]], note: "You own a yacht." },
];
