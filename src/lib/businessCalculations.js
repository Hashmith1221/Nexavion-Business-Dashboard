function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateOrderFinancials(order, expenses = []) {
  const items = order.items || [];
  const orderExpenses = expenses.filter((expense) => expense.order_id === order.id);
  const quantity = items.reduce((total, item) => total + amount(item.quantity), 0);
  const deliveredQuantity = items.reduce((total, item) => total + amount(item.delivered_quantity), 0);
  const orderValue = items.reduce((total, item) => total + amount(item.quantity) * amount(item.selling_price), 0);
  const revenue = order.status === "DELIVERED"
    ? items.reduce((total, item) => total + amount(item.delivered_quantity) * amount(item.selling_price), 0)
    : 0;
  const purchaseCost = items.reduce((total, item) => total + amount(item.quantity) * amount(item.purchase_cost), 0);
  const deliveredPurchaseCost = items.reduce((total, item) => total + amount(item.delivered_quantity) * amount(item.purchase_cost), 0);
  const additionalExpenses = orderExpenses.reduce((total, expense) => total + amount(expense.amount), 0);
  const investment = purchaseCost + additionalExpenses;
  const profit = order.status === "DELIVERED" ? revenue - deliveredPurchaseCost - additionalExpenses : 0;
  const received = (order.payments || []).reduce((total, payment) => total + amount(payment.amount), 0) + amount(order.advance_payment);

  return {
    quantity,
    deliveredQuantity,
    orderValue,
    revenue,
    purchaseCost,
    deliveredPurchaseCost,
    additionalExpenses,
    investment,
    profit,
    profitMargin: revenue ? (profit / revenue) * 100 : 0,
    received,
    outstanding: Math.max(0, revenue - received),
  };
}

export function calculateDeliveredOrderTotals(orders, expenses) {
  const delivered = orders.filter((order) => order.status === "DELIVERED");
  const revenue = delivered.reduce((sum, order) => sum + (order.items || []).reduce((lineTotal, item) => (
    lineTotal + amount(item.delivered_quantity) * amount(item.selling_price)
  ), 0), 0);
  const purchaseCost = delivered.reduce((sum, order) => sum + (order.items || []).reduce((lineTotal, item) => (
    lineTotal + amount(item.delivered_quantity) * amount(item.purchase_cost)
  ), 0), 0);
  const orderExpenseTotal = expenses.filter((expense) => expense.order_id)
    .reduce((sum, expense) => sum + amount(expense.amount), 0);
  const generalExpenses = expenses.filter((expense) => !expense.order_id)
    .reduce((sum, expense) => sum + amount(expense.amount), 0);
  const received = orders.reduce((sum, order) => sum
    + (order.payments || []).reduce((paymentTotal, payment) => paymentTotal + amount(payment.amount), 0)
    + amount(order.advance_payment), 0);
  const pending = delivered.reduce((sum, order) => {
    const orderRevenue = (order.items || []).reduce((total, item) => (
      total + amount(item.delivered_quantity) * amount(item.selling_price)
    ), 0);
    const paid = (order.payments || []).reduce((total, payment) => total + amount(payment.amount), amount(order.advance_payment));
    return sum + Math.max(0, orderRevenue - paid);
  }, 0);
  const expensesTotal = orderExpenseTotal + generalExpenses;
  const profit = revenue - purchaseCost - expensesTotal;

  return {
    revenue,
    purchaseCost,
    orderExpenseTotal,
    generalExpenses,
    expenses: expensesTotal,
    grossProfit: revenue - purchaseCost,
    profit,
    margin: revenue ? (profit / revenue) * 100 : 0,
    received,
    pending,
  };
}
