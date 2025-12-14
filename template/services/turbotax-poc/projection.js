function buildPayloadFromTaxContext(taxContext) {
  const payload = {
    person: {
      name: taxContext.name || null,
      ssn: taxContext.ssn || null,
      filing_status: taxContext.filing_status || 'single'
    },
    incomes: [],
    expenses: [],
    rental_properties: []
  };

  if (Array.isArray(taxContext.income_sources)) {
    taxContext.income_sources.forEach(src => payload.incomes.push({
      type: src.type || 'other',
      amount: parseFloat(src.amount || 0),
      source: src.source || null
    }));
  }

  if (Array.isArray(taxContext.biz_expenses)) {
    taxContext.biz_expenses.forEach(exp => payload.expenses.push({
      category: exp.category || 'other',
      amount: parseFloat(exp.amount || 0)
    }));
  }

  if (Array.isArray(taxContext.rentals)) {
    taxContext.rentals.forEach(r => payload.rental_properties.push({
      address: r.address || null,
      net_income: parseFloat(r.net_income || 0)
    }));
  }

  return payload;
}

function sendProjection(payload) {
  let totalIncome = 0.0;
  payload.incomes.forEach(i => totalIncome += parseFloat(i.amount || 0));
  payload.rental_properties.forEach(r => totalIncome += parseFloat(r.net_income || 0));

  let totalExpenses = 0.0;
  payload.expenses.forEach(e => totalExpenses += parseFloat(e.amount || 0));

  const taxableIncome = Math.max(0, totalIncome - totalExpenses);
  const estimatedTax = Math.round(taxableIncome * 0.15 * 100) / 100; // 15% flat rate demo

  return {
    total_income: totalIncome,
    total_expenses: totalExpenses,
    taxable_income: taxableIncome,
    estimated_tax: estimatedTax,
    by_category: {income_tax: estimatedTax}
  };
}

module.exports = { buildPayloadFromTaxContext, sendProjection };
