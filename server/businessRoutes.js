import { businessSchemaSetupMessage, isMissingDatabaseObject } from "./databaseErrors.js";

const statuses = ["ACCEPTED", "PO", "DELIVERED"];
const expenseCategories = [
  "Raw Materials",
  "Manufacturing",
  "Transportation",
  "Packaging",
  "Labour",
  "Marketing",
  "Maintenance",
  "Other Expenses",
];
const orderSelect = "*,client:business_clients(id,client_name,company_name,contact_number,email),supplier:business_suppliers(id,supplier_name),items:business_order_items(*,product:business_products(id,product_name,sku)),expenses:business_expenses(*),payments:business_payments(*),statusHistory:business_order_status_history(*)";

function text(value, maxLength, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : fallback;
}

function optionalUuid(value, label) {
  if (!value) return null;
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw Object.assign(new Error(`${label} is invalid.`), { status: 400 });
  }
  return value;
}

function amount(value, label, { required = false, min = 0 } = {}) {
  if ((value === "" || value == null) && !required) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > 999_999_999_999.99) {
    throw Object.assign(new Error(`${label} must be a valid amount.`), { status: 400 });
  }
  return parsed;
}

function requiredText(value, label, maxLength) {
  const normalized = text(value, maxLength);
  if (!normalized) throw Object.assign(new Error(`${label} is required.`), { status: 400 });
  return normalized;
}

function dateValue(value, label, required = false) {
  if (!value) {
    if (required) throw Object.assign(new Error(`${label} is required.`), { status: 400 });
    return null;
  }
  const parsedDate = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00.000Z`)
    : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== value) {
    throw Object.assign(new Error(`${label} must be a valid date.`), { status: 400 });
  }
  return value;
}

function clientRecord(body) {
  const email = text(body.email, 254).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw Object.assign(new Error("Enter a valid client email address."), { status: 400 });
  }
  return {
    client_name: requiredText(body.clientName, "Client name", 160),
    company_name: text(body.companyName, 160),
    contact_number: text(body.contactNumber, 30),
    email,
    address: text(body.address, 1000),
    gst_number: text(body.gstNumber, 40),
    notes: text(body.notes, 2000),
  };
}

function productRecord(body) {
  return {
    product_name: requiredText(body.productName, "Product name", 160),
    sku: text(body.sku, 80),
    category: text(body.category, 100),
    description: text(body.description, 2000),
    purchase_cost: amount(body.purchaseCost ?? 0, "Purchase cost", { required: true }),
    selling_price: amount(body.sellingPrice ?? 0, "Selling price", { required: true }),
    available_stock: amount(body.availableStock, "Available stock"),
    supplier_id: optionalUuid(body.supplierId, "Supplier"),
  };
}

function supplierRecord(body) {
  const email = text(body.email, 254).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw Object.assign(new Error("Enter a valid supplier email address."), { status: 400 });
  }
  return {
    supplier_name: requiredText(body.supplierName, "Supplier name", 160),
    contact_number: text(body.contactNumber, 30),
    email,
  };
}

function orderPayload(body) {
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) {
    throw Object.assign(new Error("Add between 1 and 100 products to the order."), { status: 400 });
  }
  if (!statuses.includes(body.status || "ACCEPTED")) {
    throw Object.assign(new Error("Choose ACCEPTED, PO, or DELIVERED as the order status."), { status: 400 });
  }
  const items = body.items.map((item) => {
    const quantity = amount(item.quantity, "Quantity", { required: true, min: 0.001 });
    if (quantity > 99_999_999_999.999) {
      throw Object.assign(new Error("Quantity exceeds the supported range."), { status: 400 });
    }
    const deliveredQuantity = amount(item.deliveredQuantity ?? 0, "Delivered quantity", { required: true });
    if (deliveredQuantity > quantity) {
      throw Object.assign(new Error("Delivered quantity cannot exceed ordered quantity."), { status: 400 });
    }
    return {
      productId: optionalUuid(item.productId, "Product"),
      productName: requiredText(item.productName, "Product name", 160),
      description: text(item.description, 2000),
      quantity,
      deliveredQuantity: body.status === "DELIVERED" && deliveredQuantity === 0 ? quantity : deliveredQuantity,
      purchaseCost: amount(item.purchaseCost ?? 0, "Purchase cost", { required: true }),
      sellingPrice: amount(item.sellingPrice ?? 0, "Selling price", { required: true }),
    };
  });
  const orderValue = items.reduce((total, item) => total + item.quantity * item.sellingPrice, 0);
  const purchaseCost = items.reduce((total, item) => total + item.quantity * item.purchaseCost, 0);
  if (![orderValue, purchaseCost].every((value) => Number.isFinite(value) && value <= 999_999_999_999.99)) {
    throw Object.assign(new Error("The order total exceeds the supported amount."), { status: 400 });
  }
  return {
    order: {
      clientId: optionalUuid(requiredText(body.clientId, "Client", 80), "Client"),
      orderDate: dateValue(body.orderDate, "Order date", true),
      status: body.status || "ACCEPTED",
      orderValue: amount(body.orderValue ?? 0, "Order value", { required: true }),
      advancePayment: amount(body.advancePayment ?? 0, "Advance payment", { required: true }),
      poNumber: text(body.poNumber, 100),
      poDate: dateValue(body.poDate, "PO date"),
      supplierId: optionalUuid(body.supplierId, "Supplier"),
      poAmount: amount(body.poAmount ?? 0, "PO amount", { required: true }),
      purchaseCost: amount(body.purchaseCost ?? 0, "Purchase cost", { required: true }),
      expectedDeliveryDate: dateValue(body.expectedDeliveryDate, "Expected delivery date"),
      actualDeliveryDate: dateValue(body.actualDeliveryDate, "Actual delivery date"),
      deliveryQuantity: amount(body.deliveryQuantity ?? 0, "Delivery quantity", { required: true }),
      deliveryConfirmation: text(body.deliveryConfirmation, 1000),
      notes: text(body.notes, 4000),
    },
    items,
  };
}

function expenseRecord(body) {
  if (!expenseCategories.includes(body.category)) {
    throw Object.assign(new Error("Choose a supported expense category."), { status: 400 });
  }
  return {
    expense_name: requiredText(body.expenseName, "Expense name", 160),
    category: body.category,
    order_id: body.orderId || null,
    product_id: body.productId || null,
    expense_date: dateValue(body.expenseDate, "Expense date", true),
    amount: amount(body.amount, "Expense amount", { required: true }),
    payment_method: text(body.paymentMethod, 80),
    description: text(body.description, 2000),
  };
}

function sendFailure(response, error) {
  if (isMissingDatabaseObject(error)) {
    return response.status(503).json({ error: businessSchemaSetupMessage });
  }
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
    ? error.status
    : error.code === "23505" ? 409
      : error.code === "23503" || error.code === "23514" || error.code === "22023" ? 400
        : error.code === "P0002" ? 404 : 500;
  if (status === 500) console.error("Business management API error:", error);
  const message = status === 409
    ? "A record with the same unique identifier already exists."
    : status === 500 ? "Could not complete the business data request." : error.message;
  return response.status(status).json({ error: message });
}

export function registerBusinessRoutes(app, requireAuth) {
  app.get("/api/business", requireAuth, async (request, response) => {
    const client = request.supabase;
    const userId = request.user.id;
    try {
      const results = await Promise.all([
        client.from("business_clients").select("*").eq("user_id", userId).order("client_name").limit(5000),
        client.from("business_products").select("*,supplier:business_suppliers(id,supplier_name)").eq("user_id", userId).order("product_name").limit(5000),
        client.from("business_suppliers").select("*").eq("user_id", userId).order("supplier_name").limit(5000),
        client.from("business_orders").select(orderSelect).eq("user_id", userId).order("order_date", { ascending: false }).limit(5000),
        client.from("business_expenses").select("*,order:business_orders(id,order_date,status),product:business_products(id,product_name)").eq("user_id", userId).order("expense_date", { ascending: false }).limit(5000),
      ]);
      const failed = results.find((result) => result.error);
      if (failed) throw failed.error;
      return response.json({
        clients: results[0].data || [],
        products: results[1].data || [],
        suppliers: results[2].data || [],
        orders: results[3].data || [],
        expenses: results[4].data || [],
      });
    } catch (error) {
      return sendFailure(response, error);
    }
  });

  for (const [path, table, mapper] of [
    ["clients", "business_clients", clientRecord],
    ["products", "business_products", productRecord],
    ["suppliers", "business_suppliers", supplierRecord],
  ]) {
    app.post(`/api/business/${path}`, requireAuth, async (request, response) => {
      try {
        const { data, error } = await request.supabase.from(table)
          .insert({ ...mapper(request.body || {}), user_id: request.user.id })
          .select("*").single();
        if (error) throw error;
        return response.status(201).json(data);
      } catch (error) {
        return sendFailure(response, error);
      }
    });

    app.patch(`/api/business/${path}/:id`, requireAuth, async (request, response) => {
      try {
        const { data, error } = await request.supabase.from(table)
          .update(mapper(request.body || {}))
          .eq("id", request.params.id)
          .eq("user_id", request.user.id)
          .select("*").maybeSingle();
        if (error) throw error;
        if (!data) return response.status(404).json({ error: "Record not found." });
        return response.json(data);
      } catch (error) {
        return sendFailure(response, error);
      }
    });

    app.delete(`/api/business/${path}/:id`, requireAuth, async (request, response) => {
      try {
        const { data, error } = await request.supabase.from(table).delete()
          .eq("id", request.params.id)
          .eq("user_id", request.user.id)
          .select("id").maybeSingle();
        if (error) throw error;
        if (!data) return response.status(404).json({ error: "Record not found." });
        return response.status(204).end();
      } catch (error) {
        return sendFailure(response, error);
      }
    });
  }

  app.post("/api/business/orders", requireAuth, async (request, response) => {
    try {
      const payload = orderPayload(request.body || {});
      const { data, error } = await request.supabase.rpc("business_save_order", {
        p_order_id: null,
        p_order: payload.order,
        p_items: payload.items,
      });
      if (error) throw error;
      return response.status(201).json({ id: data });
    } catch (error) {
      return sendFailure(response, error);
    }
  });

  app.put("/api/business/orders/:id", requireAuth, async (request, response) => {
    try {
      const payload = orderPayload(request.body || {});
      const { data, error } = await request.supabase.rpc("business_save_order", {
        p_order_id: request.params.id,
        p_order: payload.order,
        p_items: payload.items,
      });
      if (error) throw error;
      return response.json({ id: data });
    } catch (error) {
      return sendFailure(response, error);
    }
  });

  app.patch("/api/business/orders/:id/status", requireAuth, async (request, response) => {
    const status = request.body?.status;
    if (!statuses.includes(status)) return response.status(400).json({ error: "Choose ACCEPTED, PO, or DELIVERED." });
    try {
      const actualDeliveryDate = dateValue(request.body?.actualDeliveryDate, "Actual delivery date");
      const { data, error } = await request.supabase.rpc("business_change_order_status", {
        p_order_id: request.params.id,
        p_status: status,
        p_actual_delivery_date: actualDeliveryDate,
      });
      if (error) throw error;
      return response.json({ id: data.id, status: data.status, actual_delivery_date: data.actual_delivery_date });
    } catch (error) {
      return sendFailure(response, error);
    }
  });

  app.delete("/api/business/orders/:id", requireAuth, async (request, response) => {
    try {
      const { data, error } = await request.supabase.from("business_orders").delete()
        .eq("id", request.params.id)
        .eq("user_id", request.user.id)
        .select("id").maybeSingle();
      if (error) throw error;
      if (!data) return response.status(404).json({ error: "Order not found." });
      return response.status(204).end();
    } catch (error) {
      return sendFailure(response, error);
    }
  });

  app.post("/api/business/expenses", requireAuth, async (request, response) => {
    try {
      const { data, error } = await request.supabase.from("business_expenses")
        .insert({ ...expenseRecord(request.body || {}), user_id: request.user.id })
        .select("*").single();
      if (error) throw error;
      return response.status(201).json(data);
    } catch (error) {
      return sendFailure(response, error);
    }
  });

  app.patch("/api/business/expenses/:id", requireAuth, async (request, response) => {
    try {
      const { data, error } = await request.supabase.from("business_expenses").update(expenseRecord(request.body || {}))
        .eq("id", request.params.id)
        .eq("user_id", request.user.id)
        .select("*").maybeSingle();
      if (error) throw error;
      if (!data) return response.status(404).json({ error: "Expense not found." });
      return response.json(data);
    } catch (error) {
      return sendFailure(response, error);
    }
  });

  app.delete("/api/business/expenses/:id", requireAuth, async (request, response) => {
    try {
      const { data, error } = await request.supabase.from("business_expenses").delete()
        .eq("id", request.params.id)
        .eq("user_id", request.user.id)
        .select("id").maybeSingle();
      if (error) throw error;
      if (!data) return response.status(404).json({ error: "Expense not found." });
      return response.status(204).end();
    } catch (error) {
      return sendFailure(response, error);
    }
  });

  app.post("/api/business/orders/:id/payments", requireAuth, async (request, response) => {
    try {
      const { data: order, error: orderError } = await request.supabase.from("business_orders")
        .select("id,status,order_value,advance_payment")
        .eq("id", request.params.id)
        .eq("user_id", request.user.id)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order) return response.status(404).json({ error: "Order not found." });
      const paymentAmount = amount(request.body?.amount, "Payment amount", { required: true, min: 0.01 });
      const { data: existingPayments, error: paymentQueryError } = await request.supabase.from("business_payments")
        .select("amount")
        .eq("order_id", request.params.id)
        .eq("user_id", request.user.id);
      if (paymentQueryError) throw paymentQueryError;
      const alreadyReceived = (existingPayments || []).reduce((total, payment) => total + Number(payment.amount || 0), Number(order.advance_payment || 0));
      if (alreadyReceived + paymentAmount > Number(order.order_value || 0) + 0.005) {
        return response.status(400).json({ error: "Payment exceeds the remaining order value." });
      }
      const payment = {
        user_id: request.user.id,
        order_id: request.params.id,
        payment_date: dateValue(request.body?.paymentDate, "Payment date", true),
        amount: paymentAmount,
        payment_method: text(request.body?.paymentMethod, 80),
        reference: text(request.body?.reference, 120),
        notes: text(request.body?.notes, 1000),
      };
      const { data, error } = await request.supabase.from("business_payments").insert(payment).select("*").single();
      if (error) throw error;
      return response.status(201).json(data);
    } catch (error) {
      return sendFailure(response, error);
    }
  });
}
