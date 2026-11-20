function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumMonthToDate(records, dateFor, valueFor, start, end) {
  return records.reduce((total, record) => {
    const date = dateFor(record);
    return date >= start && date <= end ? total + valueFor(record) : total;
  }, 0);
}

function monthWindow(now) {
  const today = now.toISOString().slice(0, 10);
  const [year, month, day] = today.split("-").map(Number);
  const currentMonthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const previousDate = new Date(Date.UTC(year, month - 2, 1));
  const previousYear = previousDate.getUTCFullYear();
  const previousMonth = previousDate.getUTCMonth() + 1;
  const daysInPreviousMonth = new Date(Date.UTC(previousYear, previousMonth, 0)).getUTCDate();
  return {
    currentStart: currentMonthStart,
    currentEnd: today,
    previousStart: `${previousYear}-${String(previousMonth).padStart(2, "0")}-01`,
    previousEnd: `${previousYear}-${String(previousMonth).padStart(2, "0")}-${String(Math.min(day, daysInPreviousMonth)).padStart(2, "0")}`,
  };
}

function growth(current, previous) {
  if (previous === 0) return { percent: null, direction: current > 0 ? "new" : "unchanged" };
  const percent = Number((((current - previous) / previous) * 100).toFixed(1));
  return { percent, direction: percent > 0 ? "up" : percent < 0 ? "down" : "unchanged" };
}

export function calculateBusinessMetrics(orders, expenses, now = new Date()) {
  const deliveredOrders = orders.filter((order) => order.status === "DELIVERED");
  const revenueByItem = new Map();
  const deliveredPurchaseCosts = [];
  const revenueRecords = [];

  for (const order of deliveredOrders) {
    const date = order.actual_delivery_date || order.order_date || "";
    for (const item of order.items || []) {
      const quantity = amount(item.delivered_quantity);
      if (quantity <= 0) continue;
      const revenue = quantity * amount(item.selling_price);
      const cost = quantity * amount(item.purchase_cost);
      revenueRecords.push({ date, amount: revenue });
      deliveredPurchaseCosts.push({ date, amount: cost });
      const name = typeof item.product_name === "string" && item.product_name.trim()
        ? item.product_name.trim()
        : "Unspecified item";
      const current = revenueByItem.get(name) || { revenue: 0, purchaseCost: 0, profit: 0 };
      current.revenue += revenue;
      current.purchaseCost += cost;
      current.profit += revenue - cost;
      revenueByItem.set(name, current);
    }
  }

  const totalRevenue = revenueRecords.reduce((sum, record) => sum + record.amount, 0);
  const totalPurchaseCost = deliveredPurchaseCosts.reduce((sum, record) => sum + record.amount, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + amount(expense.amount), 0);
  const totalCost = totalPurchaseCost + totalExpenses;
  const netProfit = totalRevenue - totalCost;
  const items = [...revenueByItem.entries()].map(([name, values]) => ({
    name,
    revenue: Number(values.revenue.toFixed(2)),
    purchaseCost: Number(values.purchaseCost.toFixed(2)),
    profit: Number(values.profit.toFixed(2)),
    profitMarginPercent: values.revenue ? Number(((values.profit / values.revenue) * 100).toFixed(1)) : 0,
  }));
  const windows = monthWindow(now);
  const currentRevenue = sumMonthToDate(revenueRecords, (record) => record.date, (record) => record.amount, windows.currentStart, windows.currentEnd);
  const previousRevenue = sumMonthToDate(revenueRecords, (record) => record.date, (record) => record.amount, windows.previousStart, windows.previousEnd);
  const currentCosts = sumMonthToDate(deliveredPurchaseCosts, (record) => record.date, (record) => record.amount, windows.currentStart, windows.currentEnd)
    + sumMonthToDate(expenses, (expense) => expense.expense_date || "", (expense) => amount(expense.amount), windows.currentStart, windows.currentEnd);
  const previousCosts = sumMonthToDate(deliveredPurchaseCosts, (record) => record.date, (record) => record.amount, windows.previousStart, windows.previousEnd)
    + sumMonthToDate(expenses, (expense) => expense.expense_date || "", (expense) => amount(expense.amount), windows.previousStart, windows.previousEnd);
  const revenueGrowth = growth(currentRevenue, previousRevenue);
  const costGrowth = growth(currentCosts, previousCosts);

  const expenseBreakdown = [...expenses.reduce((totals, expense) => {
    const category = typeof expense.category === "string" && expense.category.trim()
      ? expense.category.trim()
      : "Uncategorized";
    totals.set(category, (totals.get(category) || 0) + amount(expense.amount));
    return totals;
  }, new Map())]
    .map(([category, total]) => ({ category, amount: Number(total.toFixed(2)) }))
    .sort((a, b) => b.amount - a.amount);

  const issues = [];
  if (revenueGrowth.percent !== null && revenueGrowth.percent < 0) {
    issues.push(`Revenue is down ${Math.abs(revenueGrowth.percent)}% month to date compared with the same elapsed period last month.`);
  }
  if (costGrowth.percent !== null && costGrowth.percent > 0) {
    issues.push(`Costs are up ${costGrowth.percent}% month to date compared with the same elapsed period last month.`);
  } else if (costGrowth.direction === "new") {
    issues.push(`Costs are ${currentCosts.toFixed(2)} month to date compared with zero in the same elapsed period last month.`);
  }
  const lowMarginItems = items.filter((item) => item.revenue > 0 && item.profitMarginPercent < 10);
  for (const item of lowMarginItems.slice(0, 5)) {
    issues.push(`${item.name} has a low gross margin of ${item.profitMarginPercent}%.`);
  }
  if (!deliveredOrders.length) {
    issues.push("There are no delivered orders yet, so actual revenue and product profitability cannot be assessed.");
  }

  const topItems = [...items].sort((a, b) => b.profit - a.profit || a.name.localeCompare(b.name)).slice(0, 5);
  const bottomItems = [...items].sort((a, b) => a.profit - b.profit || a.name.localeCompare(b.name)).slice(0, 5);

  return {
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalCost: Number(totalCost.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    profitMarginPercent: totalRevenue ? Number(((netProfit / totalRevenue) * 100).toFixed(1)) : 0,
    monthOverMonth: {
      comparison: "month to date versus the same elapsed period last month",
      currentRevenue: Number(currentRevenue.toFixed(2)),
      previousRevenue: Number(previousRevenue.toFixed(2)),
      revenueGrowthPercent: revenueGrowth.percent,
      revenueGrowthDirection: revenueGrowth.direction,
      currentCost: Number(currentCosts.toFixed(2)),
      previousCost: Number(previousCosts.toFixed(2)),
      costGrowthPercent: costGrowth.percent,
      costGrowthDirection: costGrowth.direction,
    },
    topItems,
    bottomItems,
    itemProfitBasis: "Item profit is revenue less purchase cost before shared expenses, which are not allocated by item.",
    expenseBreakdown,
    detectedIssues: issues,
    dataCoverage: {
      deliveredOrders: deliveredOrders.length,
      orders: orders.length,
      expenses: expenses.length,
    },
  };
}
