import { TAX } from "./config";

function progressive(taxable: number, brackets: [number, number][]): number {
  let tax = 0, floor = 0;
  for (const [ceiling, rate] of brackets) {
    if (taxable <= floor) break;
    tax += (Math.min(taxable, ceiling) - floor) * rate;
    floor = ceiling;
  }
  return tax;
}

export function federalIncomeTax(wages: number): number {
  return progressive(Math.max(0, wages - TAX.fedStandardDeduction), TAX.fedBrackets);
}

export function californiaIncomeTax(wages: number): number {
  const taxable = Math.max(0, wages - TAX.caStandardDeduction);
  const base = progressive(taxable, TAX.caBrackets);
  const surtax = Math.max(0, taxable - TAX.caMillionaireThreshold) * TAX.caMillionaireRate;
  return Math.max(0, base - TAX.caExemptionCredit) + surtax;
}

/** Social Security and Medicare, employee share. */
export function payrollTax(wages: number): number {
  return Math.min(wages, TAX.socialSecurityWageBase) * TAX.socialSecurityRate
    + wages * TAX.medicareRate
    + Math.max(0, wages - TAX.medicareExtraThreshold) * TAX.medicareExtraRate;
}

/** `deferred` is pay put into a retirement account: free of income tax for now, but not of payroll tax. */
export function taxOnWages(wages: number, deferred = 0) {
  const federal = federalIncomeTax(wages - deferred);
  const state = californiaIncomeTax(wages - deferred);
  const payroll = payrollTax(wages);
  const total = federal + state + payroll;
  return { federal, state, payroll, total, rate: wages > 0 ? total / wages : 0 };
}
