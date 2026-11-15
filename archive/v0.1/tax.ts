import { CFG } from "./config";

/** Federal income tax on a year's ordinary income. */
export function fedTax(income: number): number {
  let tax = 0;
  let floor = 0;
  for (const [ceiling, rate] of CFG.fedBrackets) {
    if (income <= floor) break;
    tax += (Math.min(income, ceiling) - floor) * rate;
    floor = ceiling;
  }
  return tax;
}

export function payrollTax(wages: number): number {
  const low = Math.min(wages, CFG.payrollCap);
  return low * CFG.payrollLow + Math.max(0, wages - CFG.payrollCap) * CFG.payrollHigh;
}

export function stateTax(wages: number): number {
  return wages * CFG.stateRate;
}

export function ordinaryTax(income: number) {
  const fed = fedTax(income);
  const payroll = payrollTax(income);
  const state = stateTax(income);
  return { fed, payroll, state, total: fed + payroll + state };
}

/** Combined rate on a realized capital gain, given other income this year. */
export function gainsRate(incomeThisYear: number): number {
  const base = incomeThisYear > CFG.gainsHighThreshold ? CFG.gainsHigh : CFG.gainsLow;
  return base + CFG.gainsSurtax + CFG.stateRate;
}

export function estateTax(netEstate: number): number {
  return Math.max(0, netEstate - CFG.estateExemption) * CFG.estateRate;
}
