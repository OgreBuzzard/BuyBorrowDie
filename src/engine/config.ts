// Every tunable number lives here.

export const CFG = {
  secondsPerYear: 120, // one month = 10 seconds
  startAge: 22,
  startNetWorth: -80_000, // student debt
  salary: 100_000,

  // Loan interest. Rates are APY: the monthly charge is (1 + rate)^(1/12) - 1.
  loanRateStart: 0.06,
  loanRateMean: 0.07,
  loanRateMin: 0.04,
  loanRateMax: 0.12,
  loanRateStep: 0.0025,
  loanRateMoveChance: 0.35, // per month

  foodBase: 1800, // per month, with the meter empty
  foodPerNotch: 600,
  foodNotches: 5,
  busFare: 100,
  carMonthlyBase: 350, // gas, insurance, maintenance
  carMonthlyPerDollar: 0.0065,

  tapsToFill: 8,
  missedMonthsToLoseJob: 3,
  joblessMonths: 3,
  rehirePayCut: 0.1,
  salaryFloor: 30_000,

  taxMonth: 4, // last year's tax is charged at the end of this month
  taxDrainSeconds: 3, // how long a tax bill or bonus takes to move through net worth
  taxFlashSeconds: 5,

  // Year-end bonus, as a share of salary.
  bonusBase: 0.13, // a diligent year with no extra work lands near 15%
  bonusPerFullMonth: 0.002, // each month the work bar was filled
  bonusPerMissedMonth: -0.06, // each month it was not
  bonusPerExtraMonth: 0.025, // each month the extra-work bar was filled
  bonusNoiseSd: 0.04,
  bonusMax: 0.5,

  // Extra work: a second bar that appears once the first is full.
  extraTapsPerNotch: 5,

  // Retirement account, offered by pop-up a few months into a job.
  retireOfferAfterMonths: 3,
  retireChoices: [0, 0.05, 0.1],
  retireMaxRate: 0.1,
  retireStep: 0.01,
  retireMatchCap: 0.05, // the employer matches contributions up to this share of pay
  retireAnnualLimit: 24_500, // 2026 employee limit
  growthStart: 0.05, // annualized, applied monthly
  growthMean: 0.05,
  growthMin: -0.05,
  growthMax: 0.15,
  growthPull: 0.15, // monthly pull back toward the mean
  growthShock: 0.02, // monthly random move

  quitRelief: 8, // well-being lift from quitting
  quitPayCut: 0.05, // next job pays this much less after quitting (10% after being let go)

  buyNotches: 5,
  buyDefaultLevel: 3, // offers open at the middle of the meter

  // Housing
  rentDepositMonths: 1, // charged on moving in
  downPaymentMin: 0.1, // down payment meter: 10% to 25% in six steps
  downPaymentStep: 0.03,
  downRateAtMin: 0.005, // rate penalty at the smallest down payment
  downRatePerStep: -0.0015, // each step up lowers the rate
  houseClosingCosts: 0.03,
  mortgageSpread: 0.01, // mortgage rates start from the loan rate plus this

  // Raises, once a year
  raiseMin: 0.02,
  raiseMax: 0.08,
  raiseWellbeingFloor: 45,
  raiseMaxMissedMonths: 1,
  raiseWellWeight: 0.4, // how much well-being moves the raise toward the top of its range
  raiseExtraWeight: 0.85, // how much a full year of extra work does
  estateExemption: 15_000_000,
  estateRate: 0.4,
  deathMean: 87,
  deathSd: 5,
  deathMin: 70,
  deathMax: 99,
  stepYears: 1 / 1200,
};

// Tax year 2026, single filer. Federal: IRS Rev. Proc. 2025-32. California: FTB Tax News, October 2026.
export const TAX = {
  fedStandardDeduction: 16_100,
  fedBrackets: [
    [12_400, 0.1], [50_400, 0.12], [105_700, 0.22], [201_775, 0.24],
    [256_225, 0.32], [640_600, 0.35], [Infinity, 0.37],
  ] as [number, number][],
  caStandardDeduction: 5_900,
  caExemptionCredit: 158,
  caBrackets: [
    [11_456, 0.01], [27_157, 0.02], [42_861, 0.04], [59_498, 0.06], [75_197, 0.08],
    [384_109, 0.093], [460_927, 0.103], [768_213, 0.113], [Infinity, 0.123],
  ] as [number, number][],
  caMillionaireThreshold: 1_000_000, // extra 1% above this
  caMillionaireRate: 0.01,
  socialSecurityRate: 0.062,
  socialSecurityWageBase: 184_500,
  medicareRate: 0.0145,
  medicareExtraRate: 0.009,
  medicareExtraThreshold: 200_000,
};

export type LoanKind = "fixed30" | "fixed15" | "io";
export const LOANS: Record<LoanKind, { name: string; years: number; rateAdj: number; ioYears?: number; resetSpread?: number }> = {
  fixed30: { name: "30-year fixed", years: 30, rateAdj: 0 },
  fixed15: { name: "15-year fixed", years: 15, rateAdj: -0.006 },
  // Low payments at a teaser rate, nothing off the principal for ten years, then the rate floats well above market.
  io: { name: "Interest only", years: 30, rateAdj: -0.01, ioYears: 10, resetSpread: 0.03 },
};

export interface BuyItem {
  id: string;
  name: string;
  min: number; // price of the cheap version
  max?: number; // price of the nice version; omit for a fixed price
  once?: boolean; // never offered again after purchase
  requires?: string; // only offered after this item has been bought
  perMonth?: boolean; // price is a monthly rent, not a one-time cost
}

// Offered three at a time, in this order, then around again.
export const CATALOG: BuyItem[] = [
  { id: "apartment", name: "Apartment", min: 1400, max: 5500, once: true, perMonth: true },
  { id: "clothes", name: "Clothes", min: 150, max: 2500 },
  { id: "family", name: "Visit family", min: 450 },
  { id: "furniture", name: "Furniture", min: 300, max: 8000 },
  { id: "vacation", name: "Vacation", min: 900, max: 12000 },
  { id: "car", name: "Car", min: 8000, max: 65000, once: true },
  { id: "gym", name: "Gym", min: 400, max: 3000 },
  { id: "house", name: "House", min: 450_000, max: 3_500_000, once: true, requires: "apartment" },
  { id: "phone", name: "Phone", min: 500, max: 1600 },
  { id: "concert", name: "Concert tickets", min: 120, max: 900 },
  { id: "laptop", name: "Laptop", min: 900, max: 4000 },
  { id: "bike", name: "Bike", min: 400, max: 6000 },
  { id: "dinner", name: "Dinner out", min: 60, max: 600 },
  { id: "gift", name: "Wedding gift", min: 150 },
  { id: "mattress", name: "Mattress", min: 400, max: 5000 },
  { id: "tv", name: "TV", min: 350, max: 4000 },
  { id: "headphones", name: "Headphones", min: 80, max: 550 },
  { id: "dentist", name: "Dentist", min: 350 },
  { id: "watch", name: "Watch", min: 150, max: 12000 },
  { id: "ski", name: "Ski trip", min: 900, max: 7000 },
  { id: "shoes", name: "Shoes", min: 90, max: 900 },
  { id: "couch", name: "Couch", min: 600, max: 9000 },
];

// Well-being. Hidden from the player on purpose: they see only a face.
export const WELL = {
  start: 70,
  // Each month well-being moves part of the way toward a target set by how the player lives.
  pull: 0.1,
  base: 45,
  foodEffect: [-28, -12, -3, 2, 5, 7], // by food notch
  noHome: -8,
  apartmentEffect: [0, 2, 3, 4, 6, 7], // by apartment level
  houseEffect: 10,
  overworkedAfterMonths: 10, // months of full work without a rest
  overworkedEffect: -15,
  joblessEffect: -10,
  sickEffect: -15,
  crushEffect: 4,
  togetherEffect: 12,
  noise: 1.5,
  restItems: ["vacation", "ski", "family"],
  dateItems: ["dinner", "concert", "clothes", "vacation", "ski"],
  // A purchase lifts well-being at once; the lift then fades with the monthly pull.
  purchaseBase: 4,
  purchasePerDecade: 3, // extra per tenfold increase in price above $50
  purchaseLuck: [0.3, 1.5], // each purchase lands somewhere in this range
  repeatMonths: 6, // buying the same thing again this soon does less
  repeatFactor: 0.4,
  restBonus: 5,
  gymMonths: 12,
  sickChance: 0.015,
  sickChanceLowWell: 0.05, // added below 30
  sickChanceBadFood: 0.04, // added with the food meter empty
  doctorBill: [200, 1500],
  crushChance: 0.05, // per month, when doing well
  crushWellFloor: 55,
  crushMonths: 3,
  togetherChance: 0.75,
  breakupHit: -8,
  fizzleHit: -3,
  extraNotchHit: -0.2, // per notch of extra work, each month
  fireBelow: 12, // this low for three months in a row costs the job
  fireMonths: 3,
  fireGraceMonths: 12, // after a new job, before it can happen again
  slowRehireBelow: 30,
  slowRehireExtraMonths: 2,
};
