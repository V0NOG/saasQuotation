// backend/utils/quoteMath.js
function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Canonical storage:
 * - line.unitPriceExTax is always EX TAX
 * - pricingMode only affects UI display (inclusive/exclusive)
 */
function computeQuoteTotals({ lines = [], orgTaxRate = 0.1 }) {
  let subtotalExTax = 0;
  let taxTotal = 0;

  const computedLines = lines.map((l) => {
    const qty = Number(l.quantity ?? 1);
    const unitPriceExTax = Number(l.unitPriceExTax ?? 0);

    const rate = l.taxRate === null || l.taxRate === undefined ? Number(orgTaxRate) : Number(l.taxRate);
    const lineSubtotal = round2(qty * unitPriceExTax);
    const lineTax = round2(lineSubtotal * rate);
    const lineTotal = round2(lineSubtotal + lineTax);

    subtotalExTax = round2(subtotalExTax + lineSubtotal);
    taxTotal = round2(taxTotal + lineTax);

    return {
      ...l,
      quantity: qty,
      unitPriceExTax,
      taxRate: l.taxRate === undefined ? null : l.taxRate,
      lineSubtotalExTax: lineSubtotal,
      lineTax,
      lineTotalIncTax: lineTotal,
    };
  });

  const totalIncTax = round2(subtotalExTax + taxTotal);

  return { computedLines, subtotalExTax, taxTotal, totalIncTax };
}

module.exports = { computeQuoteTotals, round2 };