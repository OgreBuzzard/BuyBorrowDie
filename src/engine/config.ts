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

  // Retirement account, offered by pop-up at 23 years 6 months, after the first bonus and tax bill.
  // If declined (or not employed then), offered again a few months into each new job.
  retireOfferAtMonth: 18,
  retireOfferAfterMonths: 3,
  retireChoices: [0, 0.06, 0.1],
  retireMaxRate: 0.1,
  retireStep: 0.01,
  retireMatchCap: 0.06, // the employer matches contributions up to this share of pay
  retireAnnualLimit: 24_500, // 2026 employee limit
  growthStart: 0.05, // annualized, applied monthly
  growthMean: 0.05,
  growthMin: -0.05,
  growthMax: 0.15,
  growthPull: 0.15, // monthly pull back toward the mean
  growthShock: 0.02, // monthly random move

  // Health care, offered by pop-up at 24 years 6 months.
  healthOfferAtMonth: 30,
  healthCost: { none: 0, bad: 100, good: 300 } as Record<string, number>, // per month while employed
  healthJoblessGraceMonths: 6, // coverage continues this long without a job
  healthJoblessMultiplier: 6, // then it costs this much more, if kept: the full premium

  // Year-end bonus messages.
  bonusPraiseAbove: 0.2,
  bonusPraise: "You worked hard. Good job. Keep at it.",
  bonusWarnBelow: 0.15,
  bonusWarn: "Your performance is adequate. There are rumors of layoffs coming. Work harder.",

  // The one offer. It comes once, after years of work. Declining it is permanent.
  founderOfferMonths: [66, 84], // somewhere between 27 years 6 months and 29
  founderSalaryFactor: 0.6, // founders pay themselves less
  founderStake: 0.4,
  founderWorkMultiplier: 2, // both work bars take twice the taps and show twice the notches
  founderDormantMonths: [18, 30], // the stake is worth nothing for this long
  founderFailChance: [0.6, 0.35, 0], // by attempt: most first companies fail
  founderExitPackage: [80_000, 250_000], // what the founder leaves a failed company with
  founderFirstValuation: [600_000, 2_500_000],
  stakeGrowth: 0.08, // annualized drift between event cards; the cards do the real work
  stakeNoise: 0.03, // monthly
  founderEaseTapsPerMonth: 1, // after the first valuation the work bar loses a notch a month, down to one tap
  cardNegativeChance: 0.25, // one event card a year, at a random month

  // Credit line against the ownership stake.
  creditMinStake: 1_000_000,
  creditAfterMonths: 3, // months after the first valuation
  creditLimit: 0.4, // share of the stake's value
  creditRateDiscount: 0.01, // below the ordinary loan rate
  creditRateFloor: 0.03,
  declinedDeathAge: [55, 67],
  declinedCauses: [
    "Heart disease", "Stroke", "Complications of type 2 diabetes", "Colon cancer", "Pulmonary embolism",
    "Kidney failure", "Heart failure", "Liver disease", "Complications of high blood pressure", "Pneumonia",
  ],

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

/** Wealth tiers. What Buy offers depends on the highest tier the player has reached. */
export const TIERS = [
  { name: "", netWorth: 0 },
  { name: "Millionaire", netWorth: 1_000_000 },
  { name: "Billionaire", netWorth: 1_000_000_000 },
];
/** A price: fixed, or [cheap, nice] for a meter. */
export type Price = number | [number, number] | null;

export interface BuyItem {
  id: string;
  name: string;
  prices: [Price, Price, Price]; // by tier; null means not offered at that tier
  once?: boolean; // not offered again while owned or after purchase
  oncePerTier?: boolean; // can be bought again after moving up a tier
  requires?: string; // at the first tier, only offered after this item has been bought
  perMonth?: boolean; // price is a monthly charge, not a one-time cost
  upkeep?: number; // monthly cost of owning it, as a share of the price
  upkeepBase?: number; // plus this much a month
  exit?: "Sell" | "Quit"; // owned things with upkeep appear in Expenses with this button
}
export const RESALE = 0.4; // share of the price returned on selling

// Offered three at a time, in this order, then around again.
export const CATALOG: BuyItem[] = [
  { id: "apartment", name: "Apartment", prices: [[1400, 5500], null, null], once: true, perMonth: true },
  { id: "clothes", name: "Clothes", prices: [[150, 2500], [3000, 60_000], [50_000, 1_500_000]] },
  { id: "family", name: "Visit family", prices: [450, 6000, 80_000] },
  { id: "furniture", name: "Furniture", prices: [[300, 8000], [10_000, 250_000], [500_000, 20_000_000]] },
  { id: "vacation", name: "Vacation", prices: [[900, 12_000], [20_000, 250_000], [500_000, 5_000_000]] },
  { id: "car", name: "Car", prices: [[8000, 65_000], null, null], once: true },
  { id: "gym", name: "Gym", prices: [[30, 250], [30, 250], [30, 250]], once: true, perMonth: true }, // offered again after quitting
  { id: "house", name: "House", prices: [[450_000, 3_500_000], [3_000_000, 40_000_000], [50_000_000, 300_000_000]], oncePerTier: true, requires: "apartment" },
  { id: "watch", name: "Watch", prices: [[150, 12_000], [20_000, 400_000], [500_000, 10_000_000]] },
  { id: "ski", name: "Ski trip", prices: [[900, 7000], [15_000, 120_000], [200_000, 2_000_000]] },

  // Incidental once you are a millionaire: no longer listed.
  { id: "phone", name: "Phone", prices: [[500, 1600], null, null] },
  { id: "concert", name: "Concert tickets", prices: [[120, 900], null, null] },
  { id: "laptop", name: "Laptop", prices: [[900, 4000], null, null] },
  { id: "bike", name: "Bike", prices: [[400, 6000], null, null] },
  { id: "dinner", name: "Dinner out", prices: [[60, 600], null, null] },
  { id: "gift", name: "Wedding gift", prices: [150, null, null] },
  { id: "mattress", name: "Mattress", prices: [[400, 5000], null, null] },
  { id: "tv", name: "TV", prices: [[350, 4000], null, null] },
  { id: "headphones", name: "Headphones", prices: [[80, 550], null, null] },
  { id: "dentist", name: "Dentist", prices: [350, null, null] },
  { id: "shoes", name: "Shoes", prices: [[90, 900], null, null] },
  { id: "couch", name: "Couch", prices: [[600, 9000], null, null] },

  // Millionaire. Each is bought once and then costs money every month.
  { id: "boat", name: "Boat", prices: [null, [80_000, 2_000_000], null], once: true, upkeep: 0.01, exit: "Sell" },
  { id: "cabin", name: "Cabin", prices: [null, [400_000, 5_000_000], null], once: true, upkeep: 0.004, exit: "Sell" },
  { id: "club", name: "Club", prices: [null, [50_000, 500_000], null], once: true, upkeep: 0.015, exit: "Quit" },
  { id: "horse", name: "Horse", prices: [null, [20_000, 250_000], null], once: true, upkeep: 0.012, upkeepBase: 1500, exit: "Sell" },
  { id: "sportscar", name: "Sports car", prices: [null, [120_000, 3_000_000], null], once: true, upkeep: 0.005, exit: "Sell" },

  // Billionaire.
  { id: "yacht", name: "Yacht", prices: [null, null, [30_000_000, 600_000_000]], once: true, upkeep: 0.0085, exit: "Sell" },
  { id: "jet", name: "Jet", prices: [null, null, [15_000_000, 90_000_000]], once: true, upkeep: 0.005, exit: "Sell" },
  { id: "estate", name: "Estate", prices: [null, null, [40_000_000, 400_000_000]], once: true, upkeep: 0.0025, exit: "Sell" },
  { id: "bunker", name: "Bunker", prices: [null, null, [10_000_000, 200_000_000]], once: true, upkeep: 0.002, exit: "Sell" },
  { id: "island", name: "Island", prices: [null, null, [20_000_000, 500_000_000]], once: true, upkeep: 0.003, exit: "Sell" },
  { id: "helicopter", name: "Helicopter", prices: [null, null, [4_000_000, 30_000_000]], once: true, upkeep: 0.006, exit: "Sell" },
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
  dateItems: ["dinner", "concert", "clothes", "vacation", "ski", "boat", "yacht"],
  // A purchase lifts well-being at once; the lift then fades with the monthly pull.
  purchaseBase: 4,
  purchasePerDecade: 3, // extra per tenfold increase in price above $50...
  purchaseDecadeCap: 2, // ...up to $5,000. Beyond that, a higher price buys no more happiness.
  purchaseLuck: [0.3, 1.5], // each purchase lands somewhere in this range
  repeatMonths: 6, // buying the same thing again this soon does less
  repeatFactor: 0.4,
  restBonus: 5,
  gymEffect: [1, 1, 2, 2, 3, 3], // by gym level, while a member
  sickChance: 0.015, // per month at 22
  sickChanceDoublesAfterYears: 25, // age raises it steadily
  sickChanceLowWell: 0.05, // added below 30
  sickChanceBadFood: 0.04, // added with the food meter empty
  // Neglect adds up for good: every month without health care, and every month without a gym.
  sickPerUninsuredMonth: 0.0004, sickUninsuredCap: 0.05,
  sickPerNoGymMonth: 0.00015, sickNoGymCap: 0.03,
  // By health plan. "unoffered" is the time before the pop-up.
  health: {
    unoffered: { target: 0, sickFactor: 1, longChance: 0.3, months: 1, bill: [200, 1500] },
    none: { target: -8, sickFactor: 1.4, longChance: 0.4, months: 2, bill: [800, 6000] },
    bad: { target: -1, sickFactor: 1, longChance: 0.3, months: 1, bill: [200, 1500] },
    good: { target: 2, sickFactor: 0.75, longChance: 0, months: 1, bill: [40, 300] },
  } as Record<string, { target: number; sickFactor: number; longChance: number; months: number; bill: number[] }>,
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

/** Event cards. One a year once the company has a value. Nearly all point the same way. */
export interface Card {
  id: string;
  title: string;
  text: string;
  factor: number; // the stake is multiplied by this at once
  recoverMonths?: number; // negative cards: the loss is made back over this long
  minStake?: number;
  after?: string; // only drawn once this other card has been played
  next?: string; // this card follows next year
}
export const CARDS: Card[] = [
  { id: "acquire", title: "Acquisition", text: "You acquire your largest competitor. Regulators approve.", factor: 1.5 },
  { id: "incentive", title: "Tax Incentive", text: "A city offers ten years without property tax if you open an office there. You accept.", factor: 1.2 },
  { id: "lobby", title: "Lobbying", text: "You fund an industry group. A bill that would have cost you money dies in committee.", factor: 1.25 },
  { id: "prices", title: "Pricing", text: "Your customers have nowhere else to go. You raise prices.", factor: 1.3 },
  { id: "contractors", title: "Contractors", text: "You reclassify your workforce as contractors. Their benefits are no longer your expense.", factor: 1.25 },
  { id: "supplier", title: "Supplier", text: "You buy the supplier your competitors depend on.", factor: 1.35 },
  { id: "patents", title: "Patents", text: "You move the company's patents to a subsidiary in a low-tax country.", factor: 1.2 },
  { id: "votes", title: "Voting Shares", text: "You issue yourself a class of shares with ten votes each. You control the board.", factor: 1.15 },
  { id: "contract", title: "Government Contract", text: "A government contract arrives without competitive bidding.", factor: 1.4 },
  { id: "noncompete", title: "Non-Competes", text: "Employees now sign agreements not to work for competitors. Wages stop rising.", factor: 1.15 },
  { id: "startup", title: "Startup", text: "You buy a promising startup and shut it down.", factor: 1.2 },
  { id: "ipo", title: "Public Offering", text: "The company goes public. The share price doubles on the first day.", factor: 2, minStake: 20_000_000 },
  { id: "layoffs", title: "Layoffs", text: "You lay off 12% of the staff. The share price rises.", factor: 1.2 },
  { id: "buyback", title: "Buyback", text: "The company borrows cheaply and buys back its own shares.", factor: 1.25, after: "ipo" },
  { id: "standard", title: "Industry Standard", text: "An industry standard is written around your product.", factor: 1.3 },
  { id: "settlement", title: "Settlement", text: "You settle an antitrust case for less than one week of revenue.", factor: 1.15 },
  { id: "election", title: "Election", text: "A landslide election puts pro-business politicians in power. The proposed regulation is withdrawn.", factor: 1.4, after: "regulation" },

  { id: "scandal", title: "Scandal", text: "Your cofounder is caught in an infidelity scandal. Investors are nervous.", factor: 0.6, recoverMonths: 8 },
  { id: "regulation", title: "Regulation", text: "A senator proposes regulating your industry.", factor: 0.7, recoverMonths: 10, next: "election" },
  { id: "breach", title: "Data Breach", text: "Hackers publish your customers' records. You offer them a year of credit monitoring.", factor: 0.8, recoverMonths: 6 },
  { id: "strike", title: "Strike", text: "Warehouse staff walk out for two weeks.", factor: 0.85, recoverMonths: 5 },
  { id: "whistleblower", title: "Whistleblower", text: "A former employee talks to a newspaper.", factor: 0.75, recoverMonths: 7 },
  { id: "hearing", title: "Hearing", text: "You are called to testify before Congress. You do not recall.", factor: 0.85, recoverMonths: 4 },
];
