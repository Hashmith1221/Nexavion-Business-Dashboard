import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DollarSign,
  BriefcaseBusiness,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trophy,
  TrendingDown,
  TrendingUp,
  Users,
  UserRoundPen,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AuthPage from "./components/AuthPage.jsx";
import BusinessManagement from "./components/BusinessManagement.jsx";
import SettingsPage from "./components/SettingsPage.jsx";
import BusinessChat from "./components/BusinessChat.jsx";
import { supabaseClient, supabaseConfigured } from "./lib/supabase.js";
import { parseJsonResponse } from "./lib/response.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const preferencesStorageKey = "nexavion:preferences";
function getStoredPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(preferencesStorageKey) || "{}");
    return {
      currency: ["USD", "EUR", "GBP", "INR"].includes(stored.currency) ? stored.currency : "USD",
      defaultRange: ["7d", "30d", "90d"].includes(stored.defaultRange) ? stored.defaultRange : "7d",
    };
  } catch {
    return { currency: "USD", defaultRange: "7d" };
  }
}
const periods = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];
const navItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Business", icon: BriefcaseBusiness },
  { label: "Dashboards", icon: BarChart3 },
  { label: "Audience", icon: Users },
  { label: "Activity", icon: Activity },
];
const dashboardColors = ["#6558e8", "#8d82f0", "#b2aaf5", "#d4cffb"];
const performerColors = ["#a78bfa", "#38bdf8", "#34d399", "#fbbf24", "#fb7185"];
const emptyPreviewData = {
  source: "preview",
  metrics: {
    views: 0,
    viewsChange: "No data",
    users: 0,
    usersChange: "No data",
    avgMinutes: 0,
    timeChange: "No data",
    completionRate: 0,
    completionChange: "No data",
  },
  sales: {
    recordCount: 0,
    revenue: 0,
    profit: 0,
    loss: 0,
    closedWonCount: 0,
    closedLostCount: 0,
    pipelineValue: 0,
    pipeline: [],
    salesActivity: [],
    topPerformers: [],
    salesTrend: [],
  },
  dashboards: [],
  daily: [],
  recentActivity: [],
  devices: [],
};

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatCurrency(value, compact = false) {
  const currency = getStoredPreferences().currency;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(Number(value) || 0);
}

function formatDuration(minutes) {
  if (!minutes) return "0m";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
}

function MoneyMetric({ title, value, detail, icon: Icon, tone }) {
  const toneStyles = {
    cyan: "border-cyan-400/20 bg-cyan-400/[.07] text-cyan-300",
    green: "border-emerald-400/20 bg-emerald-400/[.07] text-emerald-300",
    red: "border-rose-400/20 bg-rose-400/[.07] text-rose-300",
    violet: "border-violet-400/20 bg-violet-400/[.07] text-violet-300",
  };
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-slate-400">{title}</p>
          <p className={`mt-3 font-display text-[25px] font-bold tracking-tight sm:text-[29px] ${tone === "green" ? "text-emerald-400" : tone === "red" ? "text-rose-400" : "text-slate-100"}`}>{formatCurrency(value, true)}</p>
          <p className="mt-2 text-[10px] text-slate-500">{detail}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${toneStyles[tone]}`}>
          <Icon size={18} />
        </span>
      </div>
    </article>
  );
}

function SalesChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const colors = { revenue: "#38bdf8", profit: "#34d399", loss: "#fb7185" };
  return (
    <div className="rounded-xl border border-slate-700 bg-[#15171d] px-3.5 py-3 shadow-xl shadow-black/30">
      <p className="mb-2 text-[11px] font-medium text-slate-400">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="flex items-center justify-between gap-5 py-0.5 text-[11px] font-semibold" style={{ color: colors[item.dataKey] }}>
          <span>{item.name}</span><span>{formatCurrency(item.value)}</span>
        </p>
      ))}
    </div>
  );
}

function MetricCard({ title, value, change, note, icon: Icon, tone = "violet", format = "number" }) {
  const hasTrend = /^[+-]?\d+(\.\d+)?%$/.test(String(change));
  const positive = !String(change).startsWith("-");
  const shown = format === "duration" ? formatDuration(value) : format === "text" ? value : formatNumber(value);
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-medium text-slate-500">{title}</p>
          <p className="mt-3 font-display text-[27px] font-bold tracking-tight text-slate-900 sm:text-[30px]">{shown}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone === "violet" ? "bg-violet-50 text-violet-600" : tone === "blue" ? "bg-blue-50 text-blue-600" : tone === "green" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
          <Icon size={18} strokeWidth={2} />
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs">
        <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 font-semibold ${hasTrend ? positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-500"}`}>
          {hasTrend && (positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />)}{change}
        </span>
        <span className="text-slate-400">{note}</span>
      </div>
    </article>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [period, setPeriod] = useState(() => getStoredPreferences().defaultRange);
  const [, setPreferencesRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeNav, setActiveNav] = useState("Overview");
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [eventForm, setEventForm] = useState({ dashboard: "", action: "Viewed dashboard" });
  const [submitting, setSubmitting] = useState(false);
  const [salesModalOpen, setSalesModalOpen] = useState(false);
  const [salesForm, setSalesForm] = useState({ companyName: "", stage: "", amount: "", profitAmount: "", lossAmount: "" });
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState("");
  const [notice, setNotice] = useState("");
  const previewMode = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get("preview") === "1"
    && !session;
  const displayData = previewMode ? emptyPreviewData : data;
  const dashboardData = displayData?.dashboards || [];

  useEffect(() => {
    if (!supabaseClient) {
      setAuthReady(true);
      return undefined;
    }
    let active = true;
    let authEventObserved = false;
    const { data: authListener } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      authEventObserved = true;
      if (active) {
        setSession(nextSession);
        setAuthReady(true);
      }
    });
    supabaseClient.auth.getSession().then(({ data: sessionData, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      if (!authEventObserved) setSession(sessionData.session);
      setAuthReady(true);
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/overview?range=${period}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await parseJsonResponse(response, "Loading analytics");
      if (!response.ok) {
        throw new Error(result.error || `Analytics request failed (${response.status}).`);
      }
      setData(result);
    } catch (requestError) {
      setError(requestError.message || "Unable to load analytics.");
    } finally {
      setLoading(false);
    }
  }, [period, session?.access_token]);

  useEffect(() => {
    if (session) loadData();
    else {
      setData(null);
      setLoading(false);
    }
  }, [loadData]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filteredActivity = useMemo(() => {
    const rows = displayData?.recentActivity || [];
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [row.user, row.dashboard, row.action, row.device].some((value) =>
        String(value || "").toLowerCase().includes(query),
      ),
    );
  }, [displayData, search]);

  const activeAudience = useMemo(() => {
    const users = new Map();
    for (const row of displayData?.recentActivity || []) {
      const key = row.email || row.user;
      if (!key || users.has(key)) continue;
      users.set(key, row);
    }
    return [...users.values()];
  }, [displayData]);

  const filteredDashboards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return dashboardData.filter((dashboard) => !query || dashboard.name.toLowerCase().includes(query));
  }, [dashboardData, search]);

  async function submitEvent(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...eventForm, durationSeconds: 0, device: "Web" }),
      });
      const result = await parseJsonResponse(response, "Recording activity");
      if (!response.ok) throw new Error(result.error || "Could not record this event.");
      setModalOpen(false);
      setEventForm({ dashboard: "", action: "Viewed dashboard" });
      setNotice("Activity recorded");
      await loadData();
    } catch (requestError) {
      setError(requestError.message || "Could not record this event.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSalesRecord(event) {
    event.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/opportunities`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          ...salesForm,
          amount: Number(salesForm.amount),
          profitAmount: Number(salesForm.profitAmount || 0),
          lossAmount: Number(salesForm.lossAmount || 0),
        }),
      });
      const result = await parseJsonResponse(response, "Saving the sales record");
      if (!response.ok) throw new Error(result.error || "Could not save this sales record.");
      setSalesModalOpen(false);
      setSalesForm({ companyName: "", stage: "", amount: "", profitAmount: "", lossAmount: "" });
      setNotice("Your sales record was saved");
      await loadData();
    } catch (requestError) {
      setError(requestError.message || "Could not save this sales record.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitProfile(event) {
    event.preventDefault();
    const fullName = profileNameInput.trim();
    if (!fullName || !supabaseClient) return;
    setSubmitting(true);
    setError("");
    try {
      const { error: updateError } = await supabaseClient.auth.updateUser({
        data: { full_name: fullName },
      });
      if (updateError) throw updateError;
      setProfileModalOpen(false);
      setNotice("Profile name updated");
    } catch (updateError) {
      setError(updateError.message || "Could not update your profile.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleProfileSaved(user) {
    setSession((current) => current ? { ...current, user } : current);
    setNotice("Profile settings saved");
  }

  function handlePreferencesSaved(preferences) {
    setPeriod(preferences.defaultRange);
    setPreferencesRevision((revision) => revision + 1);
  }

  function exportCsv() {
    const rows = filteredActivity;
    if (!rows.length) {
      setNotice("No activity to export");
      return;
    }
    const columns = ["user", "dashboard", "action", "time", "device", "status"];
    const csv = [columns.join(","), ...rows.map((row) => columns.map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nexavion-activity-${period}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Activity exported as CSV");
  }

  const metrics = displayData?.metrics;
  const sales = displayData?.sales;
  const authUser = session?.user;
  const profileName = [authUser?.user_metadata?.full_name, authUser?.user_metadata?.name]
    .find((name) => typeof name === "string" && name.trim())
    ?.trim() || authUser?.email || (previewMode ? "Preview mode" : "");
  const profileInitials = profileName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
  if (!authReady) {
    return <main className="auth-shell flex min-h-screen items-center justify-center text-sm text-slate-400">Loading your secure workspace...</main>;
  }
  if (!session && !previewMode) return <AuthPage />;

  const nav = (
    <>
      <a href="/" aria-label="Nexavion Business Intelligence home" className="mb-8 flex w-fit items-center px-1">
        <img src="/assets/nexavion-logo-dark.svg" alt="Nexavion Business Intelligence" className="h-8 w-auto sm:h-10" />
      </a>
      <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.13em] text-slate-400">Workspace</div>
      <div className="mb-7 flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-left">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 text-xs font-bold text-white">{profileInitials.slice(0, 1)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-slate-700">My workspace</span>
          <span className="block truncate text-[10px] text-slate-400">{previewMode ? "No account data" : authUser.email}</span>
        </span>
      </div>
      <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.13em] text-slate-400">Analytics</div>
      <div className="space-y-1">
        {navItems.map(({ label, icon: Icon, badge }) => (
          <button key={label} onClick={() => { setActiveNav(label); setMobileNavOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition ${activeNav === label ? "bg-violet-50 text-violet-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>
            <Icon size={17} strokeWidth={1.9} />
            <span className="flex-1">{label}</span>
            {badge && <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${activeNav === label ? "bg-white text-violet-600" : "bg-slate-100 text-slate-400"}`}>{badge}</span>}
          </button>
        ))}
      </div>
      <div className="mb-2 mt-8 px-3 text-[10px] font-bold uppercase tracking-[.13em] text-slate-400">Workspace</div>
      <button onClick={() => { setActiveNav("Settings"); setMobileNavOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${activeNav === "Settings" ? "bg-violet-50 text-violet-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>
        <Settings2 size={17} strokeWidth={1.9} /> Settings
      </button>
      <div className="mt-auto rounded-2xl bg-[#f7f5ff] p-4">
        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-violet-600 shadow-sm"><Sparkles size={16} /></div>
        <p className="text-xs font-bold text-slate-800">Make data work for you</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Add your own sales figures to build your overview.</p>
        {!previewMode && <button onClick={() => setModalOpen(true)} className="mt-3 flex items-center gap-1 text-[11px] font-bold text-violet-600">Track an event <ArrowRight size={12} /></button>}
      </div>
      <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-[11px] font-bold text-sky-700">{profileInitials || "U"}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-700">{profileName}</span><span className="block truncate text-[10px] text-slate-400">{previewMode ? "Read-only preview" : authUser.email}</span></span>
        {previewMode
          ? <a href="/" className="text-[10px] font-semibold text-violet-600 hover:text-violet-700">Sign in</a>
          : <>
            <button aria-label="Edit profile" onClick={() => { setProfileNameInput(profileName); setProfileModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-violet-600"><UserRoundPen size={16} /></button>
            <button aria-label="Sign out" onClick={async () => { const { error: signOutError } = await supabaseClient.auth.signOut(); if (signOutError) setError(signOutError.message); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><LogOut size={16} /></button>
          </>}
      </div>
    </>
  );

  return (
    <div className="app-shell min-h-screen bg-[#f7f8fc] text-slate-800">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[246px] flex-col overflow-y-auto border-r border-slate-100 bg-white px-5 py-6 lg:flex">
        {nav}
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 lg:hidden" onClick={() => setMobileNavOpen(false)}>
          <aside className="flex h-full w-[270px] flex-col overflow-y-auto bg-white px-5 py-6" onClick={(event) => event.stopPropagation()}>
            <button aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} className="mb-4 self-end text-slate-400"><X size={19} /></button>
            {nav}
          </aside>
        </div>
      )}

      <main className="min-h-screen lg:ml-[246px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-slate-100 bg-white/90 px-5 backdrop-blur-md sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <button aria-label="Open navigation" onClick={() => setMobileNavOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-50 lg:hidden"><Menu size={19} /></button>
            <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex"><span>Workspace</span><ChevronRight size={13} /><span className="font-semibold text-slate-700">{activeNav}</span></div>
            <span className="font-display text-sm font-bold text-slate-800 sm:hidden">{activeNav}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`relative ${activeNav === "Overview" || activeNav === "Dashboards" ? "hidden md:block" : "hidden"}`}>
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input aria-label={activeNav === "Overview" ? "Search activity" : "Search dashboards"} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={activeNav === "Overview" ? "Search activity..." : "Search dashboards..."} className="h-9 w-[205px] rounded-lg border border-slate-100 bg-slate-50 pl-9 pr-10 text-xs outline-none transition focus:border-violet-200 focus:bg-white" />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1 py-0.5 text-[9px] text-slate-400">⌘ K</span>
            </div>
            <button aria-label="Notifications" onClick={() => setNotice("You're all caught up")} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-50"><Bell size={17} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500 ring-2 ring-white" /></button>
            <span className="hidden h-6 border-l border-slate-100 sm:block" />
            {previewMode
              ? <a href="/" className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700">Sign in</a>
              : <button aria-label={`Signed in as ${profileName}`} onClick={async () => { const { error: signOutError } = await supabaseClient.auth.signOut(); if (signOutError) setError(signOutError.message); }} className="flex items-center gap-2 rounded-lg py-1.5 pl-1">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-700">{profileInitials || "U"}</span>
                <span className="hidden max-w-[130px] truncate text-xs font-medium text-slate-500 xl:block">{profileName}</span>
                <ChevronDown size={13} className="hidden text-slate-400 sm:block" />
              </button>}
          </div>
        </header>

        <div className="mx-auto max-w-[1480px] px-5 pb-10 pt-7 sm:px-8 lg:px-10 lg:pt-9">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${previewMode ? "bg-violet-500" : "bg-emerald-500"}`} />
                <span className={`text-[11px] font-semibold ${previewMode ? "text-violet-700" : "text-emerald-700"}`}>{previewMode ? "Development preview" : "All systems operational"}</span>
                <span className="text-slate-300">·</span>
                <span className="text-[11px] text-slate-400">{previewMode ? "No account data loaded" : data?.source === "supabase" ? "Your private data" : "Workspace data unavailable"}</span>
              </div>
              <h1 className="font-display text-[26px] font-extrabold tracking-tight text-slate-900 sm:text-[30px]">{activeNav === "Overview" ? "Business overview" : activeNav}</h1>
              <p className="mt-1.5 text-[13px] text-slate-500">
                {{
                  Overview: "A clear view of revenue, pipeline, and team performance.",
                  Business: "Manage clients, orders, products, deliveries, and expenses.",
                  Settings: "Manage your profile, display preferences, and account security.",
                  Dashboards: "Compare dashboard reach and engagement across your workspace.",
                  Audience: "Understand who is using your dashboards and how they engage.",
                  Activity: "Review and search the latest dashboard interactions.",
                }[activeNav]}
              </p>
            </div>
            {activeNav !== "Business" && activeNav !== "Settings" && <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <button onClick={() => setMenuOpen(!menuOpen)} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-sm hover:border-slate-300">
                  <CalendarDays size={15} className="text-slate-400" />{periods.find((item) => item.value === period)?.label}<ChevronDown size={13} className="text-slate-400" />
                </button>
                {menuOpen && <div className="absolute right-0 top-12 z-20 w-40 rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl">{periods.map((item) => <button key={item.value} onClick={() => { setPeriod(item.value); setMenuOpen(false); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs ${period === item.value ? "bg-violet-50 font-semibold text-violet-700" : "text-slate-600 hover:bg-slate-50"}`}>{item.label}{period === item.value && <Check size={14} />}</button>)}</div>}
              </div>
              {activeNav === "Activity" && <button onClick={exportCsv} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-sm hover:border-slate-300"><ArrowDownToLine size={15} className="text-slate-400" /><span className="hidden sm:inline">Export</span></button>}
              {!previewMode && activeNav === "Overview" && <button onClick={() => setSalesModalOpen(true)} className="flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-3.5 text-xs font-semibold text-white shadow-md shadow-violet-200 transition hover:bg-violet-700"><Plus size={16} />Add sales data</button>}
              {!previewMode && activeNav === "Activity" && <button onClick={() => setModalOpen(true)} className="flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-3.5 text-xs font-semibold text-white shadow-md shadow-violet-200 transition hover:bg-violet-700"><Plus size={16} />Track activity</button>}
            </div>}
          </div>

          {activeNav === "Business" ? (
            <BusinessManagement accessToken={session?.access_token || ""} previewOnly={previewMode} />
          ) : activeNav === "Settings" ? (
            <SettingsPage
              user={authUser}
              supabase={supabaseClient}
              previewOnly={previewMode}
              onProfileSaved={handleProfileSaved}
              onPreferencesSaved={handlePreferencesSaved}
            />
          ) : (
          <>
          {previewMode && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs text-violet-800"><span><strong>Development preview</strong> · Read-only; no account or sample data is loaded.</span><a href="/" className="font-semibold underline underline-offset-2">Return to sign in</a></div>}
          {error && <div role="alert" className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError("")}><X size={16} /></button></div>}
          {displayData?.warnings?.map((warning) => <div key={warning} role="status" className="mb-5 rounded-xl border border-amber-400/20 bg-amber-400/[.06] px-4 py-3 text-xs text-amber-200">{warning}</div>)}
          {loading && !displayData ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-[150px] animate-pulse rounded-2xl bg-white shadow-card" />)}</div> : null}

          {metrics && (
            <>
              {activeNav === "Overview" && <>
              {sales && sales.recordCount === 0 && <section className="dashboard-hero mb-5 rounded-2xl border border-violet-400/20 bg-violet-400/[.05] p-6 sm:p-8">
                <div className="mx-auto max-w-xl text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-violet-300"><BarChart3 size={22} /></span>
                  <h2 className="mt-4 font-display text-lg font-bold text-slate-100">Start with your own numbers</h2>
                  <p className="mt-2 text-xs leading-5 text-slate-400">There are no sales records in your workspace yet. Add a record to see your revenue, profit, pipeline, and team activity here.</p>
                  {!previewMode && <button onClick={() => setSalesModalOpen(true)} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white transition hover:bg-violet-500"><Plus size={15} />Add your first record</button>}
                </div>
              </section>}
              {sales && sales.recordCount > 0 && (
                <>
                  <section aria-label="Sales performance" className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                    <MoneyMetric title="Revenue closed" value={sales.revenue} detail={`${sales.closedWonCount} deals won this period`} icon={DollarSign} tone="cyan" />
                    <MoneyMetric title="Net profit" value={sales.profit} detail="Profit on closed-won deals" icon={TrendingUp} tone="green" />
                    <MoneyMetric title="Revenue lost" value={sales.loss} detail={`${sales.closedLostCount} deals lost this period`} icon={TrendingDown} tone="red" />
                    <MoneyMetric title="Open pipeline" value={sales.pipelineValue} detail={`${sales.pipeline.reduce((total, stage) => total + stage.count, 0)} active opportunities`} icon={Target} tone="violet" />
                  </section>

                  <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(285px,1fr)]">
                    <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card sm:p-6">
                      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="font-display text-sm font-bold text-slate-100">Revenue &amp; profit</h2>
                          <p className="mt-1 text-[11px] text-slate-400">Closed revenue, earned profit, and lost revenue by day</p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Sales performance
                        </span>
                      </div>
                      <div className="h-[245px] w-full sm:h-[285px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={sales.salesTrend} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                            <defs>
                              <linearGradient id="salesRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.25} />
                                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="#252932" strokeDasharray="3 5" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} dy={9} interval="preserveStartEnd" />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => formatCurrency(value, true)} />
                            <Tooltip content={<SalesChartTooltip />} />
                            <Legend verticalAlign="top" align="right" height={28} iconType="circle" iconSize={7} wrapperStyle={{ color: "#a1a1aa", fontSize: "10px" }} />
                            <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#38bdf8" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                            <Line type="monotone" dataKey="profit" name="Profit" stroke="#34d399" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                            <Line type="monotone" dataKey="loss" name="Loss" stroke="#fb7185" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </article>

                    <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div><h2 className="font-display text-sm font-bold text-slate-100">Pipeline by stage</h2><p className="mt-1 text-[11px] text-slate-400">Open deal value across your sales funnel</p></div>
                        <BriefcaseBusiness size={17} className="text-violet-300" />
                      </div>
                      <div className="mt-5 space-y-5">
                        {sales.pipeline.map((stage, index) => {
                          const largestStage = Math.max(...sales.pipeline.map((item) => item.value), 1);
                          const width = Math.max(stage.value ? 8 : 0, (stage.value / largestStage) * 100);
                          return (
                            <div key={stage.stage}>
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                                  <span className="truncate text-[11px] font-semibold text-slate-300">{stage.stage}</span>
                                  <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400">{stage.count}</span>
                                </div>
                                <span className="text-[11px] font-bold text-slate-200">{formatCurrency(stage.value, true)}</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${width}%`, backgroundColor: stage.color, boxShadow: `0 0 12px ${stage.color}66` }} />
                              </div>
                              {index === sales.pipeline.length - 1 && <p className="mt-3 text-right text-[9px] text-slate-500">Values reflect current open opportunities</p>}
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-700/70 bg-slate-800/40 px-3.5 py-3">
                        <span className="text-[10px] font-medium text-slate-400">Total open pipeline</span>
                        <span className="font-display text-[15px] font-bold text-violet-300">{formatCurrency(sales.pipelineValue)}</span>
                      </div>
                    </article>
                  </section>

                  <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(285px,1fr)]">
                    <article className="min-w-0 rounded-2xl border border-slate-100 bg-white shadow-card">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
                        <div><h2 className="font-display text-sm font-bold text-slate-100">Sales activity</h2><p className="mt-1 text-[11px] text-slate-400">The latest updates from your sales team</p></div>
                        <span className="rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-[10px] font-semibold text-slate-400">{sales.salesActivity.length} updates</span>
                      </div>
                      <div className="divide-y divide-slate-800/70">
                        {sales.salesActivity.map((item, index) => (
                          <div key={item.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: item.tone === "profit" ? "#34d39918" : item.tone === "loss" ? "#fb718518" : `${["#a78bfa", "#38bdf8", "#fbbf24"][index % 3]}18`, color: item.tone === "profit" ? "#34d399" : item.tone === "loss" ? "#fb7185" : ["#a78bfa", "#38bdf8", "#fbbf24"][index % 3] }}>
                              {item.tone === "profit" ? <TrendingUp size={15} /> : item.tone === "loss" ? <TrendingDown size={15} /> : <Activity size={15} />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11px] font-semibold text-slate-200">{item.type} <span className="font-medium text-slate-400">· {item.company}</span></p>
                              <p className="mt-1 text-[9px] text-slate-500">{item.owner} <span className="mx-1 text-slate-700">·</span> {item.time}</p>
                            </div>
                            {item.amount > 0 && <span className={`shrink-0 text-[11px] font-bold ${item.tone === "loss" ? "text-rose-400" : "text-emerald-400"}`}>{item.tone === "loss" ? "−" : "+"}{formatCurrency(item.amount, true)}</span>}
                          </div>
                        ))}
                        {!sales.salesActivity.length && <p className="px-6 py-10 text-center text-xs text-slate-500">No sales activity recorded for this period.</p>}
                      </div>
                    </article>

                    <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div><h2 className="font-display text-sm font-bold text-slate-100">Top performers</h2><p className="mt-1 text-[11px] text-slate-400">Ranked by closed-won revenue</p></div>
                        <Trophy size={17} className="text-amber-300" />
                      </div>
                      {sales.topPerformers.length ? (
                        <div className="mt-4 divide-y divide-slate-800/70">
                          {sales.topPerformers.map((member, index) => (
                            <div key={member.email || member.name} className="flex items-center gap-2.5 py-3">
                              <span className="w-4 text-[10px] font-bold text-slate-500">{String(index + 1).padStart(2, "0")}</span>
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-slate-950" style={{ backgroundColor: performerColors[index % performerColors.length] }}>{member.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</span>
                              <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-slate-200">{member.name}</p><p className="mt-0.5 text-[9px] text-slate-500">{member.deals} won {member.deals === 1 ? "deal" : "deals"}</p></div>
                              <div className="text-right"><p className="text-[10px] font-bold text-emerald-400">{formatCurrency(member.revenue, true)}</p><p className="mt-0.5 text-[9px] text-slate-500">revenue</p></div>
                            </div>
                          ))}
                        </div>
                      ) : <p className="mt-8 text-center text-xs text-slate-500">No closed-won deals for this period.</p>}
                      <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[.05] px-3 py-2.5">
                        <Trophy size={13} className="text-emerald-400" />
                        <p className="text-[9px] text-slate-400">Team profit this period <span className="ml-1 font-bold text-emerald-400">{formatCurrency(sales.profit, true)}</span></p>
                      </div>
                    </article>
                  </section>
                </>
              )}
              </>}

              {metrics && activeNav === "Dashboards" && (
                <section aria-label="Dashboard performance" className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <MetricCard title="Dashboards in ranking" value={dashboardData.length} change="Selected period" note="with recorded views" icon={BarChart3} tone="violet" />
                    <MetricCard title="Total dashboard views" value={metrics.views} change={metrics.viewsChange} note="vs. previous period" icon={Activity} tone="blue" />
                    <MetricCard title="Active users" value={metrics.users} change={metrics.usersChange} note="viewed a dashboard" icon={Users} tone="green" />
                  </div>
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
                    <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card sm:p-6">
                      <div className="mb-5">
                        <h2 className="font-display text-sm font-bold text-slate-100">Dashboard views over time</h2>
                        <p className="mt-1 text-[11px] text-slate-400">Daily views during the selected period</p>
                      </div>
                      <div className="h-[270px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={displayData.daily} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                            <defs>
                              <linearGradient id="dashboardViewsGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="#252932" strokeDasharray="3 5" />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} dy={9} interval="preserveStartEnd" />
                            <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip />
                            <Area type="monotone" dataKey="views" name="Views" stroke="#a78bfa" strokeWidth={2.5} fill="url(#dashboardViewsGradient)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </article>
                    <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card sm:p-6">
                      <div className="mb-5 flex items-start justify-between gap-3">
                        <div><h2 className="font-display text-sm font-bold text-slate-100">Most viewed</h2><p className="mt-1 text-[11px] text-slate-400">Ranked by views this period</p></div>
                        <Trophy size={17} className="text-amber-300" />
                      </div>
                      {filteredDashboards.length ? <div className="space-y-5">
                        {filteredDashboards.map((item, index) => {
                          const maxViews = Math.max(...dashboardData.map((dashboard) => dashboard.views), 1);
                          const color = dashboardColors[index % dashboardColors.length];
                          return <div key={item.name}>
                            <div className="mb-2 flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-lg text-[9px] font-bold text-slate-950" style={{ background: color }}>{index + 1}</span>
                              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-300">{item.name}</span>
                              <span className="text-[11px] font-semibold text-slate-100">{formatNumber(item.views)}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full" style={{ width: `${Math.max(4, (item.views / maxViews) * 100)}%`, background: color }} /></div>
                            <p className="mt-1.5 text-right text-[9px] text-slate-500">{item.share}% of dashboard views</p>
                          </div>;
                        })}
                      </div> : <p className="py-10 text-center text-xs text-slate-500">{dashboardData.length ? "No dashboards match your search." : "No dashboard views recorded in this period."}</p>}
                    </article>
                  </div>
                </section>
              )}

              {metrics && activeNav === "Audience" && (
                <section aria-label="Audience engagement" className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard title="Active users" value={metrics.users} change={metrics.usersChange} note="vs. previous period" icon={Users} tone="blue" />
                    <MetricCard title="Average time spent" value={metrics.avgMinutes} format="duration" change={metrics.timeChange} note="vs. previous period" icon={Clock3} tone="green" />
                    <MetricCard title="Views per user" value={metrics.users ? (metrics.views / metrics.users).toFixed(1) : "0.0"} format="text" change="Selected period" note="average engagement" icon={BarChart3} tone="violet" />
                    <MetricCard title="Devices used" value={displayData.devices.length} change="Tracked devices" note="in selected period" icon={Activity} tone="amber" />
                  </div>
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
                    <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card sm:p-6">
                      <div className="mb-5"><h2 className="font-display text-sm font-bold text-slate-100">Recently active audience</h2><p className="mt-1 text-[11px] text-slate-400">Unique users from the latest recorded interactions</p></div>
                      {activeAudience.length ? <div className="divide-y divide-slate-800/70">
                        {activeAudience.slice(0, 8).map((user, index) => <div key={user.email || user.user} className="flex items-center gap-3 py-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${["bg-violet-100 text-violet-700", "bg-sky-100 text-sky-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700"][index % 4]}`}>{user.initials || user.user.slice(0, 2).toUpperCase()}</span>
                          <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-slate-200">{user.user}</p><p className="truncate text-[10px] text-slate-500">{user.email || "Email not available"}</p></div>
                          <div className="text-right"><p className="text-[10px] font-medium text-slate-300">{user.dashboard}</p><p className="mt-0.5 text-[9px] text-slate-500">{user.time}</p></div>
                        </div>)}
                      </div> : <p className="py-10 text-center text-xs text-slate-500">No audience activity recorded in this period.</p>}
                    </article>
                    <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card sm:p-6">
                      <div className="mb-5"><h2 className="font-display text-sm font-bold text-slate-100">Device mix</h2><p className="mt-1 text-[11px] text-slate-400">Sessions by device type</p></div>
                      {displayData.devices.length ? <div className="space-y-5">
                        {displayData.devices.slice().sort((left, right) => right.views - left.views).map((device, index) => {
                          const color = dashboardColors[index % dashboardColors.length];
                          return <div key={device.name}>
                            <div className="mb-2 flex items-center justify-between gap-3"><span className="text-[11px] font-medium text-slate-300">{device.name}</span><span className="text-[10px] text-slate-400">{formatNumber(device.views)} events <span className="ml-1 font-semibold text-slate-200">{device.share}%</span></span></div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full" style={{ width: `${device.share}%`, backgroundColor: color }} /></div>
                          </div>;
                        })}
                      </div> : <p className="py-10 text-center text-xs text-slate-500">Device information is not available yet.</p>}
                    </article>
                  </div>
                </section>
              )}

              {metrics && activeNav === "Activity" && (
                <section aria-label="Activity log" className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <MetricCard title="Recent interactions" value={filteredActivity.length} change="Latest events" note="matching activity" icon={Activity} tone="violet" />
                    <MetricCard title="Users in activity log" value={activeAudience.length} change="Unique users" note="in latest interactions" icon={Users} tone="blue" />
                    <MetricCard title="Dashboards used" value={new Set((displayData.recentActivity || []).map((row) => row.dashboard)).size} change="Latest events" note="with recent activity" icon={BarChart3} tone="green" />
                  </div>
                  <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
                      <div><h2 className="font-display text-sm font-bold text-slate-100">All activity</h2><p className="mt-1 text-[11px] text-slate-400">Search and export the latest interactions</p></div>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input aria-label="Search activity log" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users, dashboards..." className="h-9 w-[220px] max-w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none focus:border-violet-400" />
                      </div>
                    </div>
                    <div className="scrollbar-hide overflow-x-auto">
                      <table className="w-full min-w-[690px] text-left">
                        <thead><tr className="text-[9px] font-bold uppercase tracking-[.1em] text-slate-400"><th className="px-6 py-3">User</th><th className="px-4 py-3">Dashboard</th><th className="px-4 py-3">Activity</th><th className="px-4 py-3">Time</th><th className="px-4 py-3">Device</th><th className="px-6 py-3">Status</th></tr></thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredActivity.map((row, index) => <tr key={row.id} className="transition hover:bg-slate-50/60">
                            <td className="px-6 py-3.5"><div className="flex items-center gap-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-[9px] font-bold text-violet-700">{row.initials || row.user?.slice(0, 2).toUpperCase()}</span><div><p className="text-[11px] font-semibold text-slate-700">{row.user}</p><p className="text-[9px] text-slate-400">{row.email || "team member"}</p></div></div></td>
                            <td className="px-4 py-3.5 text-[11px] font-medium text-slate-600">{row.dashboard}</td><td className="px-4 py-3.5 text-[11px] text-slate-500">{row.action}</td><td className="whitespace-nowrap px-4 py-3.5 text-[10px] text-slate-400">{row.time}</td><td className="px-4 py-3.5 text-[10px] text-slate-500">{row.device}</td><td className="px-6 py-3.5"><span className={`rounded-md px-2 py-1 text-[9px] font-semibold ${row.status === "Completed" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{row.status}</span></td>
                          </tr>)}
                          {!filteredActivity.length && <tr><td colSpan="6" className="px-6 py-10 text-center text-xs text-slate-400">No activity matches your search.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <div className="border-t border-slate-100 px-5 py-3.5 sm:px-6"><span className="text-[10px] text-slate-400">Showing <span className="font-semibold text-slate-600">{filteredActivity.length}</span> of <span className="font-semibold text-slate-600">{(displayData.recentActivity || []).length}</span> recent interactions</span></div>
                  </article>
                </section>
              )}

              {activeNav === "Overview" && <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="Dashboard views" value={metrics.views} change={metrics.viewsChange} note="vs. previous period" icon={BarChart3} tone="violet" />
                <MetricCard title="Active users" value={metrics.users} change={metrics.usersChange} note="vs. previous period" icon={Users} tone="blue" />
                <MetricCard title="Avg. time spent" value={metrics.avgMinutes} format="duration" change={metrics.timeChange} note="vs. previous period" icon={Clock3} tone="green" />
                <MetricCard title="Completion rate" value={`${metrics.completionRate}%`} change={metrics.completionChange} note="vs. previous period" icon={Activity} tone="amber" format="text" />
              </section>

              {dashboardData.length > 0 && (
                <section className="mt-5">
                  <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card sm:p-6">
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <div><h2 className="font-display text-sm font-bold text-slate-100">Top dashboards</h2><p className="mt-1 text-[11px] text-slate-400">Ranked by views this period</p></div>
                      <BarChart3 size={17} className="text-violet-300" />
                    </div>
                    <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                      {dashboardData.slice(0, 4).map((item, index) => {
                        const maxViews = Math.max(...dashboardData.map((dashboard) => dashboard.views), 1);
                        return (
                          <div key={item.name}>
                            <div className="mb-2 flex items-center gap-2">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold text-slate-950" style={{ background: dashboardColors[index % dashboardColors.length] }}>{index + 1}</span>
                              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-300">{item.name}</span>
                              <span className="text-[11px] font-semibold text-slate-100">{formatNumber(item.views)} <span className="font-normal text-slate-500">views</span></span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                              <div className="h-full rounded-full" style={{ width: `${Math.max(4, (item.views / maxViews) * 100)}%`, background: dashboardColors[index % dashboardColors.length] }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                </section>
              )}

              <section className="mt-5">
                <article className="min-w-0 rounded-2xl border border-slate-100 bg-white shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-50 px-5 py-5 sm:px-6">
                    <div><h2 className="font-display text-sm font-bold text-slate-900">Recent activity</h2><p className="mt-1 text-[11px] text-slate-400">What your team has been up to</p></div>
                    <div className="flex items-center gap-2">
                      <label className="relative md:hidden"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="h-8 w-28 rounded-lg border border-slate-100 bg-slate-50 pl-8 pr-2 text-[10px] outline-none focus:border-violet-200" /></label>
                      <button onClick={() => setNotice("Activity filters are up to date")} className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-100 px-2.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"><SlidersHorizontal size={13} /> Filter</button>
                      <button onClick={exportCsv} className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-100 px-2.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"><ArrowDownToLine size={13} /> <span className="hidden sm:inline">Export</span></button>
                    </div>
                  </div>
                  <div className="scrollbar-hide overflow-x-auto">
                    <table className="w-full min-w-[690px] text-left">
                      <thead><tr className="text-[9px] font-bold uppercase tracking-[.1em] text-slate-400"><th className="px-6 py-3">User</th><th className="px-4 py-3">Dashboard</th><th className="px-4 py-3">Activity</th><th className="px-4 py-3">Time</th><th className="px-4 py-3">Device</th><th className="px-6 py-3">Status</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredActivity.slice(0, 6).map((row, index) => <tr key={row.id} className="transition hover:bg-slate-50/60">
                          <td className="px-6 py-3.5"><div className="flex items-center gap-2.5"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-bold ${["bg-amber-100 text-amber-700", "bg-sky-100 text-sky-700", "bg-rose-100 text-rose-700", "bg-emerald-100 text-emerald-700", "bg-violet-100 text-violet-700", "bg-orange-100 text-orange-700"][index % 6]}`}>{row.initials || row.user?.slice(0, 2).toUpperCase()}</span><div><p className="text-[11px] font-semibold text-slate-700">{row.user}</p><p className="text-[9px] text-slate-400">{row.email || "team member"}</p></div></div></td>
                          <td className="px-4 py-3.5 text-[11px] font-medium text-slate-600">{row.dashboard}</td><td className="px-4 py-3.5 text-[11px] text-slate-500">{row.action}</td><td className="whitespace-nowrap px-4 py-3.5 text-[10px] text-slate-400">{row.time}</td><td className="px-4 py-3.5 text-[10px] text-slate-500">{row.device}</td><td className="px-6 py-3.5"><span className={`rounded-md px-2 py-1 text-[9px] font-semibold ${row.status === "Completed" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{row.status}</span></td>
                        </tr>)}
                        {!filteredActivity.length && <tr><td colSpan="6" className="px-6 py-10 text-center text-xs text-slate-400">No activity matches your search.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-50 px-5 py-3.5 sm:px-6"><span className="text-[10px] text-slate-400">Showing <span className="font-semibold text-slate-600">{Math.min(filteredActivity.length, 6)}</span> of <span className="font-semibold text-slate-600">{filteredActivity.length}</span> activities</span><div className="flex items-center gap-1"><button aria-label="Previous page" onClick={() => setNotice("You're on the latest activity")} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-50"><ChevronLeft size={14} /></button><button className="h-6 w-6 rounded-md bg-violet-50 text-[10px] font-bold text-violet-700">1</button><button aria-label="Next page" onClick={() => setNotice("You're viewing the latest activity")} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-50"><ChevronRight size={14} /></button></div></div>
                </article>

              </section>
              </>}
            </>
          )}

          {!loading && !displayData && !error && <div className="mt-5 rounded-2xl border border-slate-100 bg-white px-6 py-12 text-center text-sm text-slate-500">No analytics data is available yet.</div>}
          </>
          )}

          <BusinessChat accessToken={session?.access_token || ""} previewOnly={previewMode} />
          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400"><span>© 2026 Nexavion Business Intelligence.</span><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Data refreshes when you change the date range</span></footer>
        </div>
      </main>

      {profileModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileModalOpen(false); }}>
        <form onSubmit={submitProfile} className="w-full max-w-[420px] rounded-2xl border border-slate-800 bg-[#111318] p-6 shadow-2xl">
          <div className="mb-5 flex items-start justify-between"><div><h2 className="font-display text-lg font-bold text-slate-100">Edit profile</h2><p className="mt-1 text-xs text-slate-400">Update the name shown in your workspace.</p></div><button type="button" aria-label="Close profile form" onClick={() => setProfileModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"><X size={17} /></button></div>
          <label className="mb-4 block text-xs font-semibold text-slate-300">Full name<input required autoComplete="name" maxLength={120} value={profileNameInput} onChange={(event) => setProfileNameInput(event.target.value)} className="auth-input mt-1.5 h-10 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 text-sm font-normal outline-none focus:border-violet-400" /></label>
          <div className="mb-5 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5"><p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Email</p><p className="mt-1 truncate text-xs text-slate-300">{authUser.email}</p><p className="mt-1 text-[9px] text-slate-500">Email address is managed by your sign-in provider.</p></div>
          {error && <p role="alert" className="mb-4 text-xs text-rose-300">{error}</p>}
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setProfileModalOpen(false)} className="h-10 rounded-lg border border-slate-700 px-4 text-xs font-semibold text-slate-300">Cancel</button><button disabled={submitting} className="h-10 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-60">{submitting ? "Saving..." : "Save profile"}</button></div>
        </form>
      </div>}

      {salesModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/75 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSalesModalOpen(false); }}>
        <form onSubmit={submitSalesRecord} className="my-auto w-full max-w-[480px] rounded-2xl border border-slate-800 bg-[#111318] p-6 shadow-2xl">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div><h2 className="font-display text-lg font-bold text-slate-100">Add sales data</h2><p className="mt-1 text-xs text-slate-400">Enter a record for your own workspace.</p></div>
            <button type="button" aria-label="Close form" onClick={() => setSalesModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"><X size={17} /></button>
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5"><p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Name</p><p className="mt-1 truncate text-xs text-slate-200">{profileName}</p></div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5"><p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Email</p><p className="mt-1 truncate text-xs text-slate-200">{authUser.email}</p></div>
          </div>
          <label className="mb-4 block text-xs font-semibold text-slate-300">Record name<input required maxLength={160} value={salesForm.companyName} onChange={(event) => setSalesForm({ ...salesForm, companyName: event.target.value })} placeholder="Enter a name for this record" className="auth-input mt-1.5 h-10 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 text-sm font-normal outline-none focus:border-violet-400" /></label>
          <label className="mb-4 block text-xs font-semibold text-slate-300">Pipeline stage<select required value={salesForm.stage} onChange={(event) => setSalesForm({ ...salesForm, stage: event.target.value })} className="auth-input mt-1.5 h-10 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 text-sm font-normal outline-none focus:border-violet-400"><option value="">Select a stage</option>{["Lead", "Qualified", "Proposal", "Negotiation", "Closed Won", "Closed Lost"].map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select></label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-semibold text-slate-300">Revenue<input required type="number" min="0" max="1000000000000" step="0.01" value={salesForm.amount} onChange={(event) => setSalesForm({ ...salesForm, amount: event.target.value })} placeholder="0.00" className="auth-input mt-1.5 h-10 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 text-sm font-normal outline-none focus:border-violet-400" /></label>
            <label className="block text-xs font-semibold text-slate-300">Profit<input type="number" min="0" max="1000000000000" step="0.01" value={salesForm.profitAmount} onChange={(event) => setSalesForm({ ...salesForm, profitAmount: event.target.value })} placeholder="Optional" className="auth-input mt-1.5 h-10 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 text-sm font-normal outline-none focus:border-emerald-400" /></label>
            <label className="block text-xs font-semibold text-slate-300">Loss<input type="number" min="0" max="1000000000000" step="0.01" value={salesForm.lossAmount} onChange={(event) => setSalesForm({ ...salesForm, lossAmount: event.target.value })} placeholder="Optional" className="auth-input mt-1.5 h-10 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 text-sm font-normal outline-none focus:border-rose-400" /></label>
          </div>
          <p className="mt-3 text-[10px] leading-4 text-slate-500">Closed Won records count toward revenue and profit. Closed Lost records count toward losses.</p>
          {error && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
          <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setSalesModalOpen(false)} className="h-10 rounded-lg border border-slate-700 px-4 text-xs font-semibold text-slate-300">Cancel</button><button disabled={submitting} className="flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-60">{submitting ? "Saving..." : "Save record"}<ArrowRight size={14} /></button></div>
        </form>
      </div>}

      {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
        <form onSubmit={submitEvent} className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-5 flex items-start justify-between"><div><h2 className="font-display text-lg font-bold text-slate-900">Track activity</h2><p className="mt-1 text-xs text-slate-500">Record an interaction with one of your dashboards.</p></div><button type="button" aria-label="Close modal" onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"><X size={17} /></button></div>
          <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">Tracking as <span className="font-semibold text-slate-700">{profileName}</span> · {authUser.email}</p>
          <label className="mb-4 block text-xs font-semibold text-slate-600">Dashboard name<input required maxLength={120} value={eventForm.dashboard} onChange={(event) => setEventForm({ ...eventForm, dashboard: event.target.value })} placeholder="Enter a dashboard name" className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-400" /></label>
          <label className="mb-6 block text-xs font-semibold text-slate-600">Activity<select value={eventForm.action} onChange={(event) => setEventForm({ ...eventForm, action: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-violet-400">{["Viewed dashboard", "Exported report", "Shared dashboard", "Applied filters"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setModalOpen(false)} className="h-10 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600">Cancel</button><button disabled={submitting} className="flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60">{submitting ? "Recording..." : "Record event"}<ArrowRight size={14} /></button></div>
        </form>
      </div>}

      {notice && <div role="status" className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-xl"><Check size={15} className="text-emerald-400" />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification" className="ml-2 text-slate-400 hover:text-white"><X size={14} /></button></div>}
    </div>
  );
}

export default App;
