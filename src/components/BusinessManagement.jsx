import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Package,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { calculateDeliveredOrderTotals, calculateOrderFinancials } from "../lib/businessCalculations.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const preferencesKey = "nexavion:preferences";
const statuses = ["ACCEPTED", "PO", "DELIVERED"];
const categories = [
  "Raw Materials",
  "Manufacturing",
  "Transportation",
  "Packaging",
  "Labour",
  "Marketing",
  "Maintenance",
  "Other Expenses",
];
const statusColors = { ACCEPTED: "#f59e0b", PO: "#38bdf8", DELIVERED: "#34d399" };
const chartColors = ["#8b5cf6", "#38bdf8", "#34d399", "#f59e0b", "#fb7185", "#22d3ee"];
const today = new Date().toISOString().slice(0, 10);
const emptyItem = () => ({
  productId: "",
  productName: "",
  description: "",
  quantity: "1",
  deliveredQuantity: "0",
  purchaseCost: "0",
  sellingPrice: "0",
});
const emptyOrder = () => ({
  clientId: "",
  orderDate: today,
  status: "ACCEPTED",
  orderValue: "0",
  advancePayment: "0",
  poNumber: "",
  poDate: "",
  supplierId: "",
  poAmount: "0",
  purchaseCost: "0",
  expectedDeliveryDate: "",
  actualDeliveryDate: "",
  deliveryQuantity: "0",
  deliveryConfirmation: "",
  notes: "",
  items: [emptyItem()],
});
const emptyExpense = () => ({
  expenseName: "",
  category: "Other Expenses",
  orderId: "",
  productId: "",
  expenseDate: today,
  amount: "",
  paymentMethod: "",
  description: "",
});
const emptyClient = () => ({
  clientName: "",
  companyName: "",
  contactNumber: "",
  email: "",
  address: "",
  gstNumber: "",
  notes: "",
});
const emptyProduct = () => ({
  productName: "",
  sku: "",
  category: "",
  description: "",
  purchaseCost: "0",
  sellingPrice: "0",
  availableStock: "",
  supplierId: "",
});
const emptySupplier = () => ({ supplierName: "", contactNumber: "", email: "" });

function currency(value) {
  let currencyCode = "USD";
  try {
    const stored = JSON.parse(localStorage.getItem(preferencesKey) || "{}");
    if (["USD", "EUR", "GBP", "INR"].includes(stored.currency)) currencyCode = stored.currency;
  } catch {
    currencyCode = "USD";
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode, maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function errorText(error) {
  return error instanceof Error ? error.message : "The business data request could not be completed.";
}

function downloadCsv(filename, rows) {
  if (!rows.length) return false;
  const keys = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [keys.map(escape).join(","), ...rows.map((row) => keys.map((key) => escape(row[key])).join(","))].join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  return true;
}

function Metric({ label, value, icon: Icon, tone = "violet", money = false }) {
  const tones = {
    violet: "bg-violet-50 text-violet-600",
    blue: "bg-sky-50 text-sky-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-rose-50 text-rose-600",
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={17} /></span>
      </div>
      <p className="mt-3 font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{money ? currency(value) : typeof value === "number" ? new Intl.NumberFormat("en-US").format(value) : value}</p>
    </article>
  );
}

function Field({ label, value, onChange, type = "text", required = false, min, step, options, placeholder, className = "" }) {
  const shared = "mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100";
  return (
    <label className={`block text-xs font-semibold text-slate-600 ${className}`}>
      {label}
      {options ? (
        <select required={required} value={value} onChange={(event) => onChange(event.target.value)} className={shared}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className={`${shared} h-auto py-2`} />
      ) : (
        <input required={required} type={type} min={min} step={step} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={shared} />
      )}
    </label>
  );
}

export default function BusinessManagement({ accessToken, previewOnly = false }) {
  const [data, setData] = useState({ clients: [], products: [], suppliers: [], orders: [], expenses: [] });
  const [loading, setLoading] = useState(!previewOnly);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [section, setSection] = useState("Overview");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [dateFilter, setDateFilter] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [sort, setSort] = useState({ key: "order_date", direction: "desc" });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [modal, setModal] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [orderForm, setOrderForm] = useState(emptyOrder);
  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [paymentForm, setPaymentForm] = useState({ paymentDate: today, amount: "", paymentMethod: "", reference: "", notes: "" });
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [clientForm, setClientForm] = useState(emptyClient);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [supplierForm, setSupplierForm] = useState(emptySupplier);

  const api = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    if (response.status === 204) return null;
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    return result;
  }, [accessToken]);

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    setError("");
    try {
      setData(await api("/api/business"));
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!previewOnly) load(true);
  }, [load, previewOnly]);

  const inDateRange = useCallback((value) => {
    if (!value || dateFilter === "all") return true;
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dateFilter === "Today") return date.getTime() === startOfToday.getTime();
    if (dateFilter === "This week") return date >= new Date(startOfToday.getTime() - startOfToday.getDay() * 86_400_000);
    if (dateFilter === "This month") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    if (dateFilter === "Last month") {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return date.getFullYear() === lastMonth.getFullYear() && date.getMonth() === lastMonth.getMonth();
    }
    if (dateFilter === "Last 3 months") return date >= new Date(now.getFullYear(), now.getMonth() - 2, 1);
    if (dateFilter === "This year") return date.getFullYear() === now.getFullYear();
    if (dateFilter === "Custom") {
      if (customStart && date < new Date(`${customStart}T00:00:00`)) return false;
      if (customEnd && date > new Date(`${customEnd}T00:00:00`)) return false;
    }
    return true;
  }, [customEnd, customStart, dateFilter]);

  const orderRows = useMemo(() => {
    const rows = data.orders.map((order) => {
      const items = order.items || [];
      return {
        ...order,
        ...calculateOrderFinancials(order, data.expenses),
        client_name: order.client?.client_name || "",
        contact: order.client?.contact_number || "",
        primaryProduct: items.map((item) => item.product_name).join(", "),
      };
    });
    const filtered = rows.filter((order) => {
      const searchable = [
        order.client?.client_name,
        order.client?.company_name,
        order.client?.contact_number,
        order.primaryProduct,
        order.notes,
        order.po_number,
      ].join(" ").toLowerCase();
      if (query && !searchable.includes(query.toLowerCase())) return false;
      if (statusFilter !== "All statuses" && order.status !== statusFilter) return false;
      if (!inDateRange(order.order_date)) return false;
      return true;
    });
    const direction = sort.direction === "asc" ? 1 : -1;
    return filtered.sort((left, right) => {
      const a = left[sort.key] ?? "";
      const b = right[sort.key] ?? "";
      if (typeof a === "number" && typeof b === "number") return (a - b) * direction;
      return String(a).localeCompare(String(b)) * direction;
    });
  }, [data, dateFilter, inDateRange, query, sort, statusFilter]);

  const totals = useMemo(() => {
    const periodOrders = data.orders.filter((order) => inDateRange(order.actual_delivery_date || order.order_date));
    const periodExpenses = data.expenses.filter((expense) => inDateRange(expense.expense_date));
    const financials = calculateDeliveredOrderTotals(periodOrders, periodExpenses);
    return {
      clients: data.clients.length,
      orders: periodOrders.length,
      accepted: periodOrders.filter((order) => order.status === "ACCEPTED").length,
      po: periodOrders.filter((order) => order.status === "PO").length,
      delivered: periodOrders.filter((order) => order.status === "DELIVERED").length,
      ...financials,
    };
  }, [data, inDateRange]);

  const monthlyData = useMemo(() => {
    const months = new Map();
    for (const order of data.orders) {
      if (order.status !== "DELIVERED") continue;
      if (!inDateRange(order.actual_delivery_date || order.order_date)) continue;
      const month = String(order.actual_delivery_date || order.order_date).slice(0, 7);
      const aggregate = months.get(month) || { month, revenue: 0, purchaseCost: 0 };
      for (const item of order.items || []) {
        aggregate.revenue += number(item.delivered_quantity) * number(item.selling_price);
        aggregate.purchaseCost += number(item.delivered_quantity) * number(item.purchase_cost);
      }
      months.set(month, aggregate);
    }
    for (const expense of data.expenses) {
      if (!inDateRange(expense.expense_date)) continue;
      const month = String(expense.expense_date).slice(0, 7);
      if (!months.has(month)) months.set(month, { month, revenue: 0, purchaseCost: 0 });
    }
    return [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12)
      .map((month) => ({ ...month, expenses: data.expenses.filter((expense) => String(expense.expense_date).slice(0, 7) === month.month && inDateRange(expense.expense_date)).reduce((sum, expense) => sum + number(expense.amount), 0) }));
  }, [data, inDateRange]);

  const statusData = useMemo(() => statuses.map((status) => ({
    name: status,
    value: data.orders.filter((order) => order.status === status && inDateRange(order.order_date)).length,
  })), [data.orders, inDateRange]);
  const expenseBreakdown = useMemo(() => {
    const breakdown = new Map();
    for (const expense of data.expenses) {
      if (!inDateRange(expense.expense_date)) continue;
      breakdown.set(expense.category, (breakdown.get(expense.category) || 0) + number(expense.amount));
    }
    return [...breakdown].map(([name, value]) => ({ name, value })).filter((item) => item.value > 0);
  }, [data.expenses, inDateRange]);

  const pagedOrders = useMemo(() => orderRows.slice(page * pageSize, (page + 1) * pageSize), [orderRows, page, pageSize]);
  const pageCount = Math.max(1, Math.ceil(orderRows.length / pageSize));

  async function saveRecord(path, method, payload) {
    setSaving(true);
    setError("");
    try {
      await api(path, { method, body: JSON.stringify(payload) });
      setNotice("Changes saved");
      setModal("");
      setEditingId(null);
      await load();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setSaving(false);
    }
  }

  function openNewOrder() {
    if (!data.clients.length) {
      setError("Add a client before creating an order.");
      setSection("Clients");
      return;
    }
    setOrderForm({ ...emptyOrder(), clientId: data.clients[0].id });
    setEditingId(null);
    setModal("order");
  }

  function editOrder(order) {
    setEditingId(order.id);
    setOrderForm({
      clientId: order.client_id,
      orderDate: order.order_date,
      status: order.status,
      orderValue: String(order.order_value || 0),
      advancePayment: String(order.advance_payment || 0),
      poNumber: order.po_number || "",
      poDate: order.po_date || "",
      supplierId: order.supplier_id || "",
      poAmount: String(order.po_amount || 0),
      purchaseCost: String(order.purchase_cost || 0),
      expectedDeliveryDate: order.expected_delivery_date || "",
      actualDeliveryDate: order.actual_delivery_date || "",
      deliveryQuantity: String(order.delivery_quantity || 0),
      deliveryConfirmation: order.delivery_confirmation || "",
      notes: order.notes || "",
      items: (order.items || []).map((item) => ({
        productId: item.product_id || "",
        productName: item.product_name,
        description: item.product_description || "",
        quantity: String(item.quantity),
        deliveredQuantity: String(item.delivered_quantity || 0),
        purchaseCost: String(item.purchase_cost),
        sellingPrice: String(item.selling_price),
      })),
    });
    setModal("order");
  }

  function openPayment(order) {
    setPaymentOrder(order);
    setPaymentForm({ paymentDate: today, amount: "", paymentMethod: "", reference: "", notes: "" });
    setModal("payment");
  }

  function submitPayment(event) {
    event.preventDefault();
    if (!paymentOrder) return;
    saveRecord(`/api/business/orders/${paymentOrder.id}/payments`, "POST", {
      ...paymentForm,
      amount: number(paymentForm.amount),
    });
  }

  function changeOrderProduct(index, productId) {
    const product = data.products.find((item) => item.id === productId);
    setOrderForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index
        ? product
          ? {
            ...item,
            productId,
            productName: product.product_name,
            description: product.description || "",
            purchaseCost: String(product.purchase_cost),
            sellingPrice: String(product.selling_price),
          }
          : { ...item, productId: "", productName: "" }
        : item),
    }));
  }

  function submitOrder(event) {
    event.preventDefault();
    const items = orderForm.items.map((item) => ({
      ...item,
      quantity: number(item.quantity),
      deliveredQuantity: number(item.deliveredQuantity),
      purchaseCost: number(item.purchaseCost),
      sellingPrice: number(item.sellingPrice),
    }));
    saveRecord(
      editingId ? `/api/business/orders/${editingId}` : "/api/business/orders",
      editingId ? "PUT" : "POST",
      {
        ...orderForm,
        orderValue: items.reduce((sum, item) => sum + item.quantity * item.sellingPrice, 0),
        purchaseCost: items.reduce((sum, item) => sum + item.quantity * item.purchaseCost, 0),
        deliveryQuantity: items.reduce((sum, item) => sum + item.deliveredQuantity, 0),
        items,
      },
    );
  }

  async function changeStatus(order, status) {
    setSaving(true);
    setError("");
    try {
      await api(`/api/business/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setNotice(`Order status changed to ${status}`);
      await load();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function remove(path, label) {
    if (!window.confirm(`Delete this ${label}? This action cannot be undone.`)) return;
    setSaving(true);
    setError("");
    try {
      await api(path, { method: "DELETE" });
      setNotice(`${label[0].toUpperCase()}${label.slice(1)} deleted`);
      await load();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setSaving(false);
    }
  }

  function exportOrders() {
    const rows = orderRows.map((order, index) => ({
      "Sl. No.": index + 1,
      Date: order.order_date,
      Client: order.client?.client_name || "",
      Contact: order.client?.contact_number || "",
      Products: order.primaryProduct,
      Quantity: order.quantity,
      "Purchase cost": order.purchaseCost,
      "Additional expenditure": order.additionalExpenses,
      "Total investment": order.investment,
      "Sold for / order value": order.orderValue,
      "Delivered revenue": order.revenue,
      Profit: order.profit,
      Status: order.status,
      "Expected delivery": order.expected_delivery_date || "",
      "Actual delivery": order.actual_delivery_date || "",
      "Outstanding payment": order.outstanding,
      Notes: order.notes || "",
    }));
    if (!downloadCsv("nexavion-orders.csv", rows)) setNotice("There are no orders to export yet.");
  }

  const navigation = ["Overview", "Orders", "Clients", "Products", "Suppliers", "Expenditures", "Reports"];
  const tableSection = section === "Orders" || section === "Reports";
  const visibleOrders = pagedOrders;

  return (
    <section className="mt-5 min-w-0 space-y-5" aria-label="Business management">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-violet-700"><BriefcaseBusiness size={15} />Business management</div>
          <p className="mt-1 text-xs text-slate-500">Manage clients, orders, purchases, deliveries and expenses in one workspace.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {section !== "Clients" && section !== "Products" && section !== "Suppliers" && section !== "Expenditures" && <select aria-label="Business date range" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(0); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600"><option value="all">All dates</option>{["Today", "This week", "This month", "Last month", "Last 3 months", "This year", "Custom"].map((range) => <option key={range}>{range}</option>)}</select>}
          {!previewOnly && section === "Orders" && <button onClick={openNewOrder} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"><Plus size={15} />Add client order</button>}
          {!previewOnly && section === "Clients" && <button onClick={() => { setClientForm(emptyClient()); setEditingId(null); setModal("client"); }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"><Plus size={15} />Add client</button>}
          {!previewOnly && section === "Products" && <button onClick={() => { setProductForm(emptyProduct()); setEditingId(null); setModal("product"); }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"><Plus size={15} />Add product</button>}
          {!previewOnly && section === "Suppliers" && <button onClick={() => { setSupplierForm(emptySupplier()); setEditingId(null); setModal("supplier"); }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"><Plus size={15} />Add supplier</button>}
          {!previewOnly && section === "Expenditures" && <button onClick={() => { setExpenseForm(emptyExpense()); setEditingId(null); setModal("expense"); }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"><Plus size={15} />Add expenditure</button>}
        </div>
      </div>

      {previewOnly && <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs text-violet-800"><strong>Development preview</strong> · No account data is loaded. Sign in to manage and save business records.</div>}
      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5" aria-label="Business sections">
        {navigation.map((item) => <button key={item} onClick={() => { setSection(item); setPage(0); setError(""); }} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${section === item ? "bg-violet-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>{item}</button>)}
      </nav>

      {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError("")}><X size={15} /></button></div>}
      {notice && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={15} /></button></div>}
      {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-white shadow-sm" />)}</div> : null}

      {!loading && section === "Overview" && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          <Metric label="Total clients" value={totals.clients} icon={Users} tone="blue" />
          <Metric label="Total orders" value={totals.orders} icon={ClipboardList} />
          <Metric label="Accepted orders" value={totals.accepted} icon={Check} tone="amber" />
          <Metric label="PO orders" value={totals.po} icon={Package} tone="blue" />
          <Metric label="Delivered orders" value={totals.delivered} icon={Check} tone="green" />
          <Metric label="Total revenue" value={totals.revenue} icon={CircleDollarSign} money tone="green" />
          <Metric label="Gross profit" value={totals.revenue - totals.purchaseCost} icon={CircleDollarSign} money tone={totals.revenue - totals.purchaseCost < 0 ? "red" : "green"} />
          <Metric label="Total expenses" value={totals.expenses} icon={ArrowDownToLine} money tone="red" />
          <Metric label="Net profit" value={totals.profit} icon={CircleDollarSign} money tone={totals.profit < 0 ? "red" : "green"} />
          <Metric label="Pending payments" value={totals.pending} icon={CircleDollarSign} money tone="amber" />
          <Metric label="Amount received" value={totals.received} icon={Check} money tone="blue" />
          <Metric label="Profit margin" value={`${totals.margin.toFixed(1)}%`} icon={CircleDollarSign} tone={totals.margin < 0 ? "red" : "green"} />
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5"><h2 className="font-display text-sm font-bold text-slate-900">Revenue vs expenses</h2><p className="mt-1 text-xs text-slate-500">Monthly totals from delivered orders and recorded expenditures</p></div>
            <div className="h-[270px]">
              {monthlyData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyData}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 5" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => currency(value)} />
                <Legend />
                <Bar dataKey="revenue" name="Delivered revenue" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#fb7185" radius={[4, 4, 0, 0]} />
              </BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs text-slate-400">Delivered orders will appear here once recorded.</div>}
            </div>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4"><h2 className="font-display text-sm font-bold text-slate-900">Order status</h2><p className="mt-1 text-xs text-slate-500">Current order distribution</p></div>
            <div className="h-[230px]">
              {totals.orders ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={4}>{statusData.map((item) => <Cell key={item.name} fill={statusColors[item.name]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs text-slate-400">No orders yet.</div>}
            </div>
          </article>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-display text-sm font-bold text-slate-900">Top profitable clients</h2><p className="mt-1 text-xs text-slate-500">Net result on delivered client orders</p>
            <div className="mt-4 h-[230px]">{data.clients.length ? <ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={data.clients.map((client) => ({ name: client.client_name, profit: orderRows.filter((order) => order.client_id === client.id && order.status === "DELIVERED").reduce((sum, order) => sum + order.profit, 0) })).filter((client) => client.profit !== 0).sort((a, b) => b.profit - a.profit).slice(0, 10)}><CartesianGrid horizontal={false} stroke="#e2e8f0" strokeDasharray="3 5" /><XAxis type="number" /><YAxis type="category" dataKey="name" width={90} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => currency(value)} /><Bar dataKey="profit" name="Profit" fill="#34d399" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs text-slate-400">Add clients and delivered orders to compare profit.</div>}</div>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-display text-sm font-bold text-slate-900">Expenditure breakdown</h2><p className="mt-1 text-xs text-slate-500">Recorded expenses by category</p>
            <div className="mt-4 h-[230px]">{expenseBreakdown.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expenseBreakdown} dataKey="value" nameKey="name" outerRadius={85} paddingAngle={2}>{expenseBreakdown.map((item, index) => <Cell key={item.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip formatter={(value) => currency(value)} /><Legend /></PieChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs text-slate-400">No expenses recorded yet.</div>}</div>
          </article>
        </div>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-display text-sm font-bold text-slate-900">Top selling products</h2><p className="mt-1 text-xs text-slate-500">Delivered units by product</p>
          <div className="mt-4 h-[250px]">{data.products.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={data.products.map((product) => ({ name: product.product_name, quantity: data.orders.filter((order) => order.status === "DELIVERED" && inDateRange(order.actual_delivery_date || order.order_date)).flatMap((order) => order.items || []).filter((item) => item.product_id === product.id).reduce((sum, item) => sum + number(item.delivered_quantity), 0) })).filter((product) => product.quantity > 0).sort((a, b) => b.quantity - a.quantity).slice(0, 10)}><CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 5" /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="quantity" name="Delivered quantity" fill="#8b5cf6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs text-slate-400">Add products and delivered orders to see top sellers.</div>}</div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-sm font-bold text-slate-900">Recent orders</h2><p className="mt-1 text-xs text-slate-500">Current order status and accounting summary</p></div><button onClick={() => setSection("Orders")} className="text-xs font-semibold text-violet-700">View all orders</button></div>
          <OrderTable orders={orderRows.slice(0, 5)} onEdit={editOrder} onStatus={changeStatus} onDelete={(order) => remove(`/api/business/orders/${order.id}`, "order")} onPayment={openPayment} saving={saving} compact />
          {!orderRows.length && <EmptyState label="No orders yet. Create your first order to start tracking." />}
        </article>
      </>}

      {!loading && tableSection && <>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
          {dateFilter === "Custom" && <><label className="text-[10px] font-semibold text-slate-500">From<input aria-label="Start date" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="ml-2 h-9 rounded-lg border border-slate-200 px-2 text-xs" /></label><label className="text-[10px] font-semibold text-slate-500">To<input aria-label="End date" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="ml-2 h-9 rounded-lg border border-slate-200 px-2 text-xs" /></label></>}
          <label className="relative min-w-[190px] flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search clients, products, PO..." className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none focus:border-violet-400" /></label>
          <select aria-label="Filter by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600"><option>All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
          <button onClick={exportOrders} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"><ArrowDownToLine size={14} />Export CSV</button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1650px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr>
                {[
                  ["order_date", "Date"], ["client_name", "Client"], ["contact", "Contact"], ["primaryProduct", "Products"], ["quantity", "Qty."], ["purchaseCost", "Purchase cost"], ["additionalExpenses", "Extra expenses"], ["investment", "Total investment"], ["orderValue", "Order value"], ["revenue", "Delivered revenue"], ["profit", "Profit"], ["status", "Status"], ["expected_delivery_date", "Expected delivery"], ["actual_delivery_date", "Delivered on"], ["received", "Received"], ["outstanding", "Outstanding"], ["notes", "Notes"],
                ].map(([key, label]) => <th key={key} className="border-b border-slate-200 px-3 py-3 font-bold"><button onClick={() => setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }))} className="inline-flex items-center gap-1 whitespace-nowrap hover:text-violet-700">{label}<ChevronDown size={11} className={sort.key === key && sort.direction === "asc" ? "rotate-180" : ""} /></button></th>)}
                <th className="sticky right-0 border-b border-slate-200 bg-slate-50 px-3 py-3">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {visibleOrders.map((order, index) => <tr key={order.id} className="transition hover:bg-violet-50/40">
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{order.order_date}</td>
                  <td className="max-w-[160px] px-3 py-3"><div className="truncate font-semibold text-slate-800">{order.client?.client_name}</div><div className="truncate text-[10px] text-slate-400">{order.client?.company_name}</div></td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-500">{order.client?.contact_number || "—"}</td>
                  <td className="max-w-[210px] truncate px-3 py-3 text-slate-600">{order.primaryProduct}</td>
                  <td className="px-3 py-3 text-slate-600">{order.quantity}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{currency(order.purchaseCost)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{currency(order.additionalExpenses)}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">{currency(order.investment)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{currency(order.orderValue)}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-semibold text-sky-700">{currency(order.revenue)}</td>
                  <td className={`whitespace-nowrap px-3 py-3 font-bold ${order.profit < 0 ? "text-rose-600" : "text-emerald-700"}`}>{currency(order.profit)}</td>
                  <td className="px-3 py-3"><select aria-label={`Status for order ${order.client?.client_name}`} disabled={saving} value={order.status} onChange={(event) => onStatus(order, event.target.value)} className="rounded-lg border px-2 py-1.5 text-[10px] font-bold disabled:opacity-50" style={{ color: statusColors[order.status], borderColor: `${statusColors[order.status]}50`, backgroundColor: `${statusColors[order.status]}12` }}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-500">{order.expected_delivery_date || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-500">{order.actual_delivery_date || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-emerald-700">{currency(order.received)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-amber-700">{currency(order.outstanding)}</td>
                  <td className="max-w-[180px] truncate px-3 py-3 text-slate-500">{order.notes || "—"}</td>
                  <td className="sticky right-0 bg-white px-3 py-3"><div className="flex items-center gap-1"><button aria-label={`Record payment for order ${index + 1}`} onClick={() => onPayment(order)} className="rounded-md px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50">Payment</button><button aria-label={`Edit order ${index + 1}`} onClick={() => onEdit(order)} className="rounded-md px-2 py-1 text-[10px] font-semibold text-violet-700 hover:bg-violet-50">Edit</button><button aria-label={`Delete order ${index + 1}`} onClick={() => onDelete(order)} className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50"><Trash2 size={13} /></button></div></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          {!orderRows.length && <EmptyState label="No matching orders. Add an order to begin tracking." />}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>Showing {orderRows.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, orderRows.length)} of {orderRows.length} orders</span>
            <div className="flex items-center gap-2">
              <select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }} className="h-8 rounded-md border border-slate-200 px-2"><option value="10">10 rows</option><option value="20">20 rows</option><option value="50">50 rows</option></select>
              <button aria-label="Previous page" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40"><ChevronLeft size={15} /></button>
              <span>{page + 1} / {pageCount}</span>
              <button aria-label="Next page" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} className="rounded-md border border-slate-200 p-1.5 disabled:opacity-40"><ChevronRight size={15} /></button>
            </div>
          </div>
        </div>
      </>}

      {!loading && section === "Clients" && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.clients.map((client) => {
          const clientOrders = orderRows.filter((order) => order.client_id === client.id);
          const revenue = clientOrders.reduce((sum, order) => sum + order.revenue, 0);
          const profit = clientOrders.filter((order) => order.status === "DELIVERED").reduce((sum, order) => sum + order.profit, 0);
          return <article key={client.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><Building2 size={18} /></span><div className="flex gap-1"><button onClick={() => { setEditingId(client.id); setClientForm({ clientName: client.client_name, companyName: client.company_name || "", contactNumber: client.contact_number || "", email: client.email || "", address: client.address || "", gstNumber: client.gst_number || "", notes: client.notes || "" }); setModal("client"); }} className="rounded-md px-2 py-1 text-[10px] font-semibold text-violet-700 hover:bg-violet-50">Edit</button><button onClick={() => remove(`/api/business/clients/${client.id}`, "client")} className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50" aria-label={`Delete ${client.client_name}`}><Trash2 size={13} /></button></div></div>
            <h3 className="mt-4 font-display text-base font-bold text-slate-900">{client.client_name}</h3><p className="mt-0.5 text-xs text-slate-500">{client.company_name || "Individual client"}</p>
            <div className="mt-3 space-y-1 text-xs text-slate-500"><p>{client.contact_number || "No phone"}{client.email ? ` · ${client.email}` : ""}</p><p>{client.gst_number ? `GST ${client.gst_number}` : "GST not provided"}</p></div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center"><div><p className="text-[10px] text-slate-400">Orders</p><p className="mt-1 text-sm font-bold text-slate-800">{clientOrders.length}</p></div><div><p className="text-[10px] text-slate-400">Revenue</p><p className="mt-1 text-xs font-bold text-sky-700">{currency(revenue)}</p></div><div><p className="text-[10px] text-slate-400">Profit</p><p className={`mt-1 text-xs font-bold ${profit < 0 ? "text-rose-600" : "text-emerald-700"}`}>{currency(profit)}</p></div></div>
          </article>;
        })}
        {!data.clients.length && <EmptyState label="No clients added yet." />}
      </div>}

      {!loading && section === "Products" && <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr>{["Product", "SKU", "Category", "Purchase cost", "Selling price", "Stock", "Actions"].map((label) => <th key={label} className="border-b border-slate-200 px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.products.map((product) => <tr key={product.id}><td className="px-4 py-3"><p className="font-semibold text-slate-800">{product.product_name}</p><p className="text-[10px] text-slate-400">{product.description}</p></td><td className="px-4 py-3 text-slate-500">{product.sku || "—"}</td><td className="px-4 py-3 text-slate-500">{product.category || "—"}</td><td className="px-4 py-3 text-slate-600">{currency(product.purchase_cost)}</td><td className="px-4 py-3 font-semibold text-emerald-700">{currency(product.selling_price)}</td><td className="px-4 py-3 text-slate-500">{product.available_stock ?? "—"}</td><td className="px-4 py-3"><div className="flex gap-1"><button onClick={() => { setEditingId(product.id); setProductForm({ productName: product.product_name, sku: product.sku || "", category: product.category || "", description: product.description || "", purchaseCost: String(product.purchase_cost), sellingPrice: String(product.selling_price), availableStock: product.available_stock == null ? "" : String(product.available_stock), supplierId: product.supplier_id || "" }); setModal("product"); }} className="rounded-md px-2 py-1 text-[10px] font-semibold text-violet-700 hover:bg-violet-50">Edit</button><button onClick={() => remove(`/api/business/products/${product.id}`, "product")} aria-label={`Delete ${product.product_name}`} className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50"><Trash2 size={13} /></button></div></td></tr>)}</tbody></table>{!data.products.length && <EmptyState label="No products saved yet." />}</div>}

      {!loading && section === "Suppliers" && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.suppliers.map((supplier) => <article key={supplier.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Building2 size={18} /></span><div className="flex gap-1"><button onClick={() => { setEditingId(supplier.id); setSupplierForm({ supplierName: supplier.supplier_name, contactNumber: supplier.contact_number || "", email: supplier.email || "" }); setModal("supplier"); }} className="rounded-md px-2 py-1 text-[10px] font-semibold text-violet-700 hover:bg-violet-50">Edit</button><button onClick={() => remove(`/api/business/suppliers/${supplier.id}`, "supplier")} aria-label={`Delete ${supplier.supplier_name}`} className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50"><Trash2 size={13} /></button></div></div>
          <h3 className="mt-4 font-display text-base font-bold text-slate-900">{supplier.supplier_name}</h3><p className="mt-2 text-xs text-slate-500">{supplier.contact_number || "No phone"}{supplier.email ? ` · ${supplier.email}` : ""}</p>
        </article>)}
        {!data.suppliers.length && <EmptyState label="No suppliers saved yet." />}
      </div>}

      {!loading && section === "Expenditures" && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Metric label="All expenses" value={totals.expenses} icon={CircleDollarSign} money tone="red" /><Metric label="Order-linked expenses" value={totals.orderExpenseTotal} icon={ClipboardList} money tone="amber" /><Metric label="General expenses" value={totals.generalExpenses} icon={ArrowDownToLine} money tone="violet" /></div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr>{["Date", "Expense", "Category", "Order", "Product", "Payment method", "Amount", "Actions"].map((label) => <th key={label} className="border-b border-slate-200 px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.expenses.map((expense) => <tr key={expense.id}><td className="px-4 py-3 text-slate-500">{expense.expense_date}</td><td className="px-4 py-3"><p className="font-semibold text-slate-800">{expense.expense_name}</p><p className="text-[10px] text-slate-400">{expense.description}</p></td><td className="px-4 py-3 text-slate-600">{expense.category}</td><td className="px-4 py-3 text-slate-500">{expense.order_id ? expense.order?.order_date : "General"}</td><td className="px-4 py-3 text-slate-500">{expense.product?.product_name || "—"}</td><td className="px-4 py-3 text-slate-500">{expense.payment_method || "—"}</td><td className="px-4 py-3 font-semibold text-rose-600">{currency(expense.amount)}</td><td className="px-4 py-3"><div className="flex items-center gap-1"><button onClick={() => { setEditingId(expense.id); setExpenseForm({ expenseName: expense.expense_name, category: expense.category, orderId: expense.order_id || "", productId: expense.product_id || "", expenseDate: expense.expense_date, amount: String(expense.amount), paymentMethod: expense.payment_method || "", description: expense.description || "" }); setModal("expense"); }} className="rounded-md px-2 py-1 text-[10px] font-semibold text-violet-700 hover:bg-violet-50">Edit</button><button onClick={() => remove(`/api/business/expenses/${expense.id}`, "expense")} aria-label={`Delete ${expense.expense_name}`} className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50"><Trash2 size={13} /></button></div></td></tr>)}</tbody></table>{!data.expenses.length && <EmptyState label="No expenses recorded yet." />}</div>
      </>}

      {modal && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModal(""); }}>
        <div className="my-auto max-h-[92vh] w-full max-w-[900px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="font-display text-lg font-bold text-slate-900">{modal === "order" ? editingId ? "Edit client order" : "Add client order" : modal === "client" ? editingId ? "Edit client" : "Add client" : modal === "product" ? editingId ? "Edit product" : "Add product" : modal === "supplier" ? editingId ? "Edit supplier" : "Add supplier" : modal === "payment" ? "Record payment" : editingId ? "Edit expenditure" : "Record expenditure"}</h2><p className="mt-1 text-xs text-slate-500">Your changes are saved to your private workspace.</p></div><button aria-label="Close form" disabled={saving} onClick={() => setModal("")} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={17} /></button></div>
          {modal === "order" && <form onSubmit={submitOrder} className="space-y-5">
            {editingId && data.orders.find((order) => order.id === editingId)?.statusHistory?.length > 0 && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><h3 className="text-xs font-bold text-slate-700">Order status history</h3><div className="mt-2 flex flex-wrap gap-2">{data.orders.find((order) => order.id === editingId).statusHistory.map((entry) => <span key={entry.id} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] text-slate-600">{entry.from_status ? `${entry.from_status} → ` : ""}<strong style={{ color: statusColors[entry.to_status] }}>{entry.to_status}</strong><span className="ml-1 text-slate-400">{new Date(entry.changed_at).toLocaleDateString()}</span></span>)}</div></div>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div><Field label="Client" required value={orderForm.clientId} onChange={(value) => setOrderForm({ ...orderForm, clientId: value })} options={data.clients.map((client) => ({ value: client.id, label: client.client_name }))} />{data.clients.find((client) => client.id === orderForm.clientId) && <p className="mt-1 text-[10px] text-slate-400">{[data.clients.find((client) => client.id === orderForm.clientId)?.company_name, data.clients.find((client) => client.id === orderForm.clientId)?.contact_number, data.clients.find((client) => client.id === orderForm.clientId)?.email].filter(Boolean).join(" · ")}</p>}</div>
              <Field label="Order date" required type="date" value={orderForm.orderDate} onChange={(value) => setOrderForm({ ...orderForm, orderDate: value })} />
              <Field label="Status" value={orderForm.status} onChange={(value) => setOrderForm({ ...orderForm, status: value })} options={statuses.map((status) => ({ value: status, label: status }))} />
              <Field label="Advance payment" type="number" min="0" step="0.01" value={orderForm.advancePayment} onChange={(value) => setOrderForm({ ...orderForm, advancePayment: value })} />
            </div>
            <div className="rounded-xl border border-slate-200">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-3"><div><h3 className="text-xs font-bold text-slate-800">Order products</h3><p className="mt-1 text-[10px] text-slate-500">Line totals and order values are calculated automatically.</p></div><button type="button" onClick={() => setOrderForm((current) => ({ ...current, items: [...current.items, emptyItem()] }))} className="inline-flex h-8 items-center gap-1 rounded-lg bg-violet-600 px-2.5 text-[10px] font-semibold text-white"><Plus size={13} />Add product</button></div>
              <div className="space-y-3 p-3">{orderForm.items.map((item, index) => <div key={index} className="grid gap-2 rounded-lg border border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-6">
                <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">Saved product (optional)<select value={item.productId} onChange={(event) => changeOrderProduct(index, event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="">Enter product manually</option>{data.products.map((product) => <option key={product.id} value={product.id}>{product.product_name}</option>)}</select></label>
                <Field label="Product name" required value={item.productName} onChange={(value) => setOrderForm((current) => ({ ...current, items: current.items.map((row, i) => i === index ? { ...row, productName: value } : row) }))} />
                <Field label="Quantity" required type="number" min="0.001" step="0.001" value={item.quantity} onChange={(value) => setOrderForm((current) => ({ ...current, items: current.items.map((row, i) => i === index ? { ...row, quantity: value } : row) }))} />
                <Field label="Purchase / unit" required type="number" min="0" step="0.01" value={item.purchaseCost} onChange={(value) => setOrderForm((current) => ({ ...current, items: current.items.map((row, i) => i === index ? { ...row, purchaseCost: value } : row) }))} />
                <Field label="Selling / unit" required type="number" min="0" step="0.01" value={item.sellingPrice} onChange={(value) => setOrderForm((current) => ({ ...current, items: current.items.map((row, i) => i === index ? { ...row, sellingPrice: value } : row) }))} />
                {orderForm.status === "DELIVERED" && <Field label="Delivered qty." type="number" min="0" step="0.001" value={item.deliveredQuantity} onChange={(value) => setOrderForm((current) => ({ ...current, items: current.items.map((row, i) => i === index ? { ...row, deliveredQuantity: value } : row) }))} />}
                <Field label="Product description" value={item.description} onChange={(value) => setOrderForm((current) => ({ ...current, items: current.items.map((row, i) => i === index ? { ...row, description: value } : row) }))} className="sm:col-span-2 lg:col-span-4" />
                <div className="flex items-end justify-between gap-3 text-xs sm:col-span-2 lg:col-span-6"><span className="text-slate-500">Line total <strong className="ml-1 text-slate-800">{currency(number(item.quantity) * number(item.sellingPrice))}</strong></span>{orderForm.items.length > 1 && <button type="button" onClick={() => setOrderForm((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }))} className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600"><Trash2 size={12} />Remove line</button>}</div>
              </div>)}</div>
              <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs"><span>Order value: <strong>{currency(orderForm.items.reduce((sum, item) => sum + number(item.quantity) * number(item.sellingPrice), 0))}</strong></span><span>Purchase cost: <strong>{currency(orderForm.items.reduce((sum, item) => sum + number(item.quantity) * number(item.purchaseCost), 0))}</strong></span></div>
            </div>
            {orderForm.status === "PO" || orderForm.status === "DELIVERED" ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="PO number" value={orderForm.poNumber} onChange={(value) => setOrderForm({ ...orderForm, poNumber: value })} />
              <Field label="PO date" type="date" value={orderForm.poDate} onChange={(value) => setOrderForm({ ...orderForm, poDate: value })} />
              <Field label="Supplier" value={orderForm.supplierId} onChange={(value) => setOrderForm({ ...orderForm, supplierId: value })} options={[{ value: "", label: "Select supplier" }, ...data.suppliers.map((supplier) => ({ value: supplier.id, label: supplier.supplier_name }))]} />
              <Field label="PO amount" type="number" min="0" step="0.01" value={orderForm.poAmount} onChange={(value) => setOrderForm({ ...orderForm, poAmount: value })} />
            </div> : null}
            {orderForm.status === "DELIVERED" && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Actual delivery date" type="date" value={orderForm.actualDeliveryDate} onChange={(value) => setOrderForm({ ...orderForm, actualDeliveryDate: value })} /><Field label="Delivery confirmation" value={orderForm.deliveryConfirmation} onChange={(value) => setOrderForm({ ...orderForm, deliveryConfirmation: value })} /><Field label="Delivery notes" value={orderForm.notes} onChange={(value) => setOrderForm({ ...orderForm, notes: value })} /></div>}
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Expected delivery date" type="date" value={orderForm.expectedDeliveryDate} onChange={(value) => setOrderForm({ ...orderForm, expectedDeliveryDate: value })} /><Field label="Notes / remarks" value={orderForm.notes} onChange={(value) => setOrderForm({ ...orderForm, notes: value })} /></div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={saving} onClick={() => setModal("")} className="h-10 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600">Cancel</button><button disabled={saving} className="h-10 rounded-lg bg-violet-600 px-5 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : editingId ? "Save order" : "Create order"}</button></div>
          </form>}
          {modal === "client" && <form onSubmit={(event) => { event.preventDefault(); saveRecord(editingId ? `/api/business/clients/${editingId}` : "/api/business/clients", editingId ? "PATCH" : "POST", clientForm); }} className="grid gap-3 sm:grid-cols-2">
            <Field label="Client name" required value={clientForm.clientName} onChange={(value) => setClientForm({ ...clientForm, clientName: value })} />
            <Field label="Company name" value={clientForm.companyName} onChange={(value) => setClientForm({ ...clientForm, companyName: value })} />
            <Field label="Contact number" value={clientForm.contactNumber} onChange={(value) => setClientForm({ ...clientForm, contactNumber: value })} />
            <Field label="Email" type="email" value={clientForm.email} onChange={(value) => setClientForm({ ...clientForm, email: value })} />
            <Field label="GST number (optional)" value={clientForm.gstNumber} onChange={(value) => setClientForm({ ...clientForm, gstNumber: value })} />
            <Field label="Address" value={clientForm.address} onChange={(value) => setClientForm({ ...clientForm, address: value })} />
            <Field label="Notes" type="textarea" value={clientForm.notes} onChange={(value) => setClientForm({ ...clientForm, notes: value })} className="sm:col-span-2" />
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" onClick={() => setModal("")} className="h-10 rounded-lg border border-slate-200 px-4 text-xs">Cancel</button><button disabled={saving} className="h-10 rounded-lg bg-violet-600 px-5 text-xs font-semibold text-white">{saving ? "Saving..." : "Save client"}</button></div>
          </form>}
          {modal === "product" && <form onSubmit={(event) => { event.preventDefault(); saveRecord(editingId ? `/api/business/products/${editingId}` : "/api/business/products", editingId ? "PATCH" : "POST", { ...productForm, purchaseCost: number(productForm.purchaseCost), sellingPrice: number(productForm.sellingPrice), availableStock: productForm.availableStock === "" ? null : number(productForm.availableStock) }); }} className="grid gap-3 sm:grid-cols-2">
            <Field label="Product name" required value={productForm.productName} onChange={(value) => setProductForm({ ...productForm, productName: value })} />
            <Field label="SKU / product ID" value={productForm.sku} onChange={(value) => setProductForm({ ...productForm, sku: value })} />
            <Field label="Category" value={productForm.category} onChange={(value) => setProductForm({ ...productForm, category: value })} />
            <Field label="Default purchase cost" required type="number" min="0" step="0.01" value={productForm.purchaseCost} onChange={(value) => setProductForm({ ...productForm, purchaseCost: value })} />
            <Field label="Default selling price" required type="number" min="0" step="0.01" value={productForm.sellingPrice} onChange={(value) => setProductForm({ ...productForm, sellingPrice: value })} />
            <Field label="Available stock (optional)" type="number" min="0" step="0.001" value={productForm.availableStock} onChange={(value) => setProductForm({ ...productForm, availableStock: value })} />
            <Field label="Supplier (optional)" value={productForm.supplierId} onChange={(value) => setProductForm({ ...productForm, supplierId: value })} options={[{ value: "", label: "Select supplier" }, ...data.suppliers.map((supplier) => ({ value: supplier.id, label: supplier.supplier_name }))]} />
            <Field label="Description" type="textarea" value={productForm.description} onChange={(value) => setProductForm({ ...productForm, description: value })} className="sm:col-span-2" />
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" onClick={() => setModal("")} className="h-10 rounded-lg border border-slate-200 px-4 text-xs">Cancel</button><button disabled={saving} className="h-10 rounded-lg bg-violet-600 px-5 text-xs font-semibold text-white">{saving ? "Saving..." : "Save product"}</button></div>
          </form>}
          {modal === "supplier" && <form onSubmit={(event) => { event.preventDefault(); saveRecord(editingId ? `/api/business/suppliers/${editingId}` : "/api/business/suppliers", editingId ? "PATCH" : "POST", supplierForm); }} className="grid gap-3 sm:grid-cols-2">
            <Field label="Supplier name" required value={supplierForm.supplierName} onChange={(value) => setSupplierForm({ ...supplierForm, supplierName: value })} />
            <Field label="Contact number" value={supplierForm.contactNumber} onChange={(value) => setSupplierForm({ ...supplierForm, contactNumber: value })} />
            <Field label="Email" type="email" value={supplierForm.email} onChange={(value) => setSupplierForm({ ...supplierForm, email: value })} className="sm:col-span-2" />
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" onClick={() => setModal("")} className="h-10 rounded-lg border border-slate-200 px-4 text-xs">Cancel</button><button disabled={saving} className="h-10 rounded-lg bg-violet-600 px-5 text-xs font-semibold text-white">{saving ? "Saving..." : "Save supplier"}</button></div>
          </form>}
          {modal === "expense" && <form onSubmit={(event) => { event.preventDefault(); saveRecord(editingId ? `/api/business/expenses/${editingId}` : "/api/business/expenses", editingId ? "PATCH" : "POST", { ...expenseForm, orderId: expenseForm.orderId || null, productId: expenseForm.productId || null, amount: number(expenseForm.amount) }); }} className="grid gap-3 sm:grid-cols-2">
            <Field label="Expense name" required value={expenseForm.expenseName} onChange={(value) => setExpenseForm({ ...expenseForm, expenseName: value })} />
            <Field label="Category" required value={expenseForm.category} onChange={(value) => setExpenseForm({ ...expenseForm, category: value })} options={categories.map((category) => ({ value: category, label: category }))} />
            <Field label="Linked order (optional)" value={expenseForm.orderId} onChange={(value) => setExpenseForm({ ...expenseForm, orderId: value, productId: "" })} options={[{ value: "", label: "General business expense" }, ...data.orders.map((order) => ({ value: order.id, label: `${order.order_date} · ${order.client?.client_name || "Client"}` }))]} />
            <Field label="Product (optional)" value={expenseForm.productId} onChange={(value) => setExpenseForm({ ...expenseForm, productId: value })} options={[{ value: "", label: "No product" }, ...data.products.map((product) => ({ value: product.id, label: product.product_name }))]} />
            <Field label="Date" required type="date" value={expenseForm.expenseDate} onChange={(value) => setExpenseForm({ ...expenseForm, expenseDate: value })} />
            <Field label="Amount" required type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(value) => setExpenseForm({ ...expenseForm, amount: value })} />
            <Field label="Payment method" value={expenseForm.paymentMethod} onChange={(value) => setExpenseForm({ ...expenseForm, paymentMethod: value })} />
            <Field label="Description" type="textarea" value={expenseForm.description} onChange={(value) => setExpenseForm({ ...expenseForm, description: value })} className="sm:col-span-2" />
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" onClick={() => setModal("")} className="h-10 rounded-lg border border-slate-200 px-4 text-xs">Cancel</button><button disabled={saving} className="h-10 rounded-lg bg-violet-600 px-5 text-xs font-semibold text-white">{saving ? "Saving..." : "Save expense"}</button></div>
          </form>}
          {modal === "payment" && <form onSubmit={submitPayment} className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2"><p className="text-[10px] uppercase tracking-wide text-slate-500">Order</p><p className="mt-1 text-sm font-semibold text-slate-800">{paymentOrder?.client?.client_name} · outstanding {currency(paymentOrder?.outstanding)}</p></div>
            <Field label="Payment date" required type="date" value={paymentForm.paymentDate} onChange={(value) => setPaymentForm({ ...paymentForm, paymentDate: value })} />
            <Field label="Amount received" required type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(value) => setPaymentForm({ ...paymentForm, amount: value })} />
            <Field label="Payment method" value={paymentForm.paymentMethod} onChange={(value) => setPaymentForm({ ...paymentForm, paymentMethod: value })} />
            <Field label="Reference number" value={paymentForm.reference} onChange={(value) => setPaymentForm({ ...paymentForm, reference: value })} />
            <Field label="Notes" value={paymentForm.notes} onChange={(value) => setPaymentForm({ ...paymentForm, notes: value })} className="sm:col-span-2" />
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 sm:col-span-2"><button type="button" onClick={() => setModal("")} className="h-10 rounded-lg border border-slate-200 px-4 text-xs">Cancel</button><button disabled={saving} className="h-10 rounded-lg bg-violet-600 px-5 text-xs font-semibold text-white">{saving ? "Saving..." : "Record payment"}</button></div>
          </form>}
        </div>
      </div>}
    </section>
  );
}

function EmptyState({ label }) {
  return <div className="px-5 py-10 text-center text-xs text-slate-400">{label}</div>;
}

function OrderTable({ orders, onEdit, onStatus, onDelete, onPayment, saving, compact = false }) {
  if (!orders.length) return null;
  return <div className="mt-4 overflow-x-auto"><table className={`w-full ${compact ? "min-w-[1000px]" : "min-w-[1300px]"} text-left text-xs`}><thead className="text-[10px] uppercase tracking-wide text-slate-500"><tr>{["Date", "Client", "Products", "Investment", "Revenue", "Profit", "Status", "Expected delivery", "Actions"].map((label) => <th key={label} className="border-b border-slate-100 px-3 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{orders.map((order, index) => <tr key={order.id}><td className="whitespace-nowrap px-3 py-3 text-slate-500">{order.order_date}</td><td className="px-3 py-3 font-semibold text-slate-800">{order.client?.client_name}</td><td className="max-w-[180px] truncate px-3 py-3 text-slate-600">{order.primaryProduct}</td><td className="px-3 py-3 text-slate-600">{currency(order.investment)}</td><td className="px-3 py-3 text-sky-700">{currency(order.revenue)}</td><td className={`px-3 py-3 font-semibold ${order.profit < 0 ? "text-rose-600" : "text-emerald-700"}`}>{currency(order.profit)}</td><td className="px-3 py-3"><select aria-label={`Status for order ${index + 1}`} disabled={saving} value={order.status} onChange={(event) => onStatus(order, event.target.value)} className="rounded-md border bg-white px-2 py-1 text-[10px] font-semibold" style={{ color: statusColors[order.status] }}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></td><td className="whitespace-nowrap px-3 py-3 text-slate-500">{order.expected_delivery_date || "—"}</td><td className="px-3 py-3"><div className="flex items-center gap-1"><button onClick={() => onPayment(order)} className="rounded-md px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50">Payment</button><button onClick={() => onEdit(order)} className="rounded-md px-2 py-1 text-[10px] font-semibold text-violet-700 hover:bg-violet-50">Edit</button><button onClick={() => onDelete(order)} aria-label={`Delete order ${index + 1}`} className="rounded-md p-1 text-rose-500 hover:bg-rose-50"><Trash2 size={13} /></button></div></td></tr>)}</tbody></table></div>;
}
