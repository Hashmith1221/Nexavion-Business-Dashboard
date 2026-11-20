import "dotenv/config";
import cors from "cors";
import express from "express";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { registerBusinessRoutes } from "./businessRoutes.js";
import { registerChatRoute } from "./chatRoutes.js";
import { coreSchemaSetupMessage, isMissingDatabaseObject } from "./databaseErrors.js";
import { loadOverviewData } from "./overviewData.js";

const app = express();
const port = Number(process.env.PORT) || 4000;
const frontendDistPath = fileURLToPath(new URL("../dist", import.meta.url));
const frontendUrl = process.env.FRONTEND_URL?.trim();
if (!frontendUrl) throw new Error("FRONTEND_URL must be configured.");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAuth = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey ? createClient(supabaseUrl, supabaseServiceRoleKey) : null;
const allowedOrigins = frontendUrl
  .split(",")
  .map((origin) => origin.trim());
const contactRateLimits = new Map();
const contactRateLimitWindowMs = 15 * 60 * 1000;
const contactRateLimitMax = 5;

app.set("trust proxy", 1);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS."));
  },
}));
app.use(express.json({ limit: "512kb" }));

async function requireAuth(request, response, next) {
  const authorization = request.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return response.status(401).json({ error: "Sign in to access your workspace." });
  if (!supabaseAuth) return response.status(503).json({ error: "Authentication is not configured on this server." });

  try {
    const { data, error } = await supabaseAuth.auth.getUser(token);
    if (error || !data.user) return response.status(401).json({ error: "Your session is invalid or expired. Please sign in again." });
    request.user = data.user;
    request.supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    return next();
  } catch (error) {
    return next(error);
  }
}

function getUserName(user) {
  const metadataName = [user.user_metadata?.full_name, user.user_metadata?.name]
    .find((value) => typeof value === "string" && value.trim());
  return metadataName ? metadataName.trim() : user.email || "";
}

function contactRateLimit(request, response, next) {
  const now = Date.now();
  const key = request.ip || request.socket.remoteAddress || "unknown";
  const previous = contactRateLimits.get(key);
  if (!previous || now - previous.startedAt >= contactRateLimitWindowMs) {
    if (contactRateLimits.size > 1000) {
      for (const [ip, limit] of contactRateLimits) {
        if (now - limit.startedAt >= contactRateLimitWindowMs) contactRateLimits.delete(ip);
      }
    }
    contactRateLimits.set(key, { startedAt: now, count: 1 });
    return next();
  }
  if (previous.count >= contactRateLimitMax) {
    const retryAfter = Math.max(1, Math.ceil((contactRateLimitWindowMs - (now - previous.startedAt)) / 1000));
    response.set("Retry-After", String(retryAfter));
    return response.status(429).json({ error: "Too many messages were sent. Please wait a little before trying again." });
  }
  previous.count += 1;
  return next();
}

function validateContactSubmission(body) {
  const fields = {};
  const requiredText = (key, label, maxLength) => {
    const value = typeof body[key] === "string" ? body[key].trim() : "";
    if (!value) fields[key] = `${label} is required.`;
    else if (value.length > maxLength) fields[key] = `${label} must be ${maxLength} characters or fewer.`;
    return value;
  };

  const fullName = requiredText("fullName", "Full name", 120);
  const email = requiredText("email", "Email address", 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fields.email = "Enter a valid email address.";
  const phone = requiredText("phone", "Phone number", 25);
  const phoneDigits = phone.replace(/\D/g, "");
  if (phone && (!/^[+()\d.\s-]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15)) {
    fields.phone = "Enter a valid phone number with 7–15 digits.";
  }
  const company = requiredText("company", "Company / organization", 160);
  const subject = requiredText("subject", "Subject", 120);
  const message = requiredText("message", "Message", 5000);
  if (message && message.length < 10) fields.message = "Please add at least 10 characters.";

  return {
    fields,
    submission: { full_name: fullName, email, phone, company, subject, message },
  };
}

function makeOverview(events, range, sales) {
  const now = new Date();
  const days = Number.parseInt(range, 10) || 7;
  const start = new Date(now);
  start.setDate(now.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  const previousStart = new Date(start);
  previousStart.setDate(start.getDate() - days);
  const currentEvents = events.filter((event) => new Date(event.created_at) >= start);
  const previousEvents = events.filter((event) => {
    const date = new Date(event.created_at);
    return date >= previousStart && date < start;
  });
  const views = currentEvents.filter((event) => event.action === "Viewed dashboard").length;
  const previousViews = previousEvents.filter((event) => event.action === "Viewed dashboard").length;
  const users = new Set(currentEvents.map((event) => event.user_email).filter(Boolean)).size;
  const previousUsers = new Set(previousEvents.map((event) => event.user_email).filter(Boolean)).size;
  const durationTotal = currentEvents.reduce((total, event) => total + (Number(event.duration_seconds) || 0), 0);
  const avgMinutes = currentEvents.length ? Math.round(durationTotal / currentEvents.length / 60) : 0;
  const previousDuration = previousEvents.reduce((total, event) => total + (Number(event.duration_seconds) || 0), 0);
  const previousAvgMinutes = previousEvents.length ? Math.round(previousDuration / previousEvents.length / 60) : 0;
  const completed = currentEvents.filter((event) => event.action !== "Viewed dashboard").length;
  const completionRate = currentEvents.length ? Math.round((completed / currentEvents.length) * 100) : 0;
  const previousCompleted = previousEvents.filter((event) => event.action !== "Viewed dashboard").length;
  const previousCompletionRate = previousEvents.length ? Math.round((previousCompleted / previousEvents.length) * 100) : 0;
  const daily = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);
    const dayEvents = currentEvents.filter((event) => {
      const eventDate = new Date(event.created_at);
      return eventDate >= date && eventDate < nextDate;
    });
    daily.push({
      date: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      views: dayEvents.filter((event) => event.action === "Viewed dashboard").length,
      users: new Set(dayEvents.map((event) => event.user_email).filter(Boolean)).size,
    });
  }
  const dashboardCounts = new Map();
  currentEvents.filter((event) => event.action === "Viewed dashboard").forEach((event) => {
    const name = event.dashboard_name || "Other";
    dashboardCounts.set(name, (dashboardCounts.get(name) || 0) + 1);
  });
  const dashboards = [...dashboardCounts.entries()]
    .map(([name, count]) => ({ name, views: count, share: views ? Math.round((count / views) * 100) : 0 }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 4);
  const deviceCounts = new Map();
  currentEvents.forEach((event) => {
    const name = event.device || "Other";
    deviceCounts.set(name, (deviceCounts.get(name) || 0) + 1);
  });
  const deviceTotal = [...deviceCounts.values()].reduce((sum, count) => sum + count, 0);
  const devices = [...deviceCounts.entries()].map(([name, count]) => ({
    name,
    views: count,
    share: deviceTotal ? Math.round((count / deviceTotal) * 100) : 0,
  }));
  const recentActivity = [...currentEvents]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 20)
    .map((event) => ({
      id: event.id,
      user: event.user_name || event.user_email || "Unknown user",
      email: event.user_email || "",
      dashboard: event.dashboard_name || "Unknown dashboard",
      action: event.action || "Viewed dashboard",
      time: new Date(event.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      device: event.device || "Web",
      status: event.action === "Viewed dashboard" ? "Viewed" : "Completed",
      initials: (event.user_name || event.user_email || "?")
        .split(/[ @._-]/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join(""),
    }));

  const closedWon = sales.opportunities.filter((opportunity) =>
    opportunity.stage === "Closed Won"
    && opportunity.closed_at
    && new Date(opportunity.closed_at) >= start
    && new Date(opportunity.closed_at) <= now,
  );
  const closedLost = sales.opportunities.filter((opportunity) =>
    opportunity.stage === "Closed Lost"
    && opportunity.closed_at
    && new Date(opportunity.closed_at) >= start
    && new Date(opportunity.closed_at) <= now,
  );
  const revenue = closedWon.reduce((total, opportunity) => total + Number(opportunity.amount || 0), 0);
  const profit = closedWon.reduce((total, opportunity) => total + Number(opportunity.profit_amount || 0), 0);
  const loss = closedLost.reduce((total, opportunity) => total + Number(opportunity.loss_amount || 0), 0);
  const activeStages = ["Lead", "Qualified", "Proposal", "Negotiation"];
  const stageColors = {
    Lead: "#8b5cf6",
    Qualified: "#38bdf8",
    Proposal: "#f59e0b",
    Negotiation: "#ec4899",
  };
  const pipeline = activeStages.map((stage) => {
    const stageOpportunities = sales.opportunities.filter((opportunity) => opportunity.stage === stage);
    return {
      stage,
      count: stageOpportunities.length,
      value: stageOpportunities.reduce((total, opportunity) => total + Number(opportunity.amount || 0), 0),
      color: stageColors[stage],
    };
  });
  const salesTrend = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);
    const closedThatDay = sales.opportunities.filter((opportunity) => {
      if (!opportunity.closed_at) return false;
      const closedDate = new Date(opportunity.closed_at);
      return closedDate >= date && closedDate < nextDate;
    });
    salesTrend.push({
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      revenue: closedThatDay
        .filter((opportunity) => opportunity.stage === "Closed Won")
        .reduce((total, opportunity) => total + Number(opportunity.amount || 0), 0),
      profit: closedThatDay
        .filter((opportunity) => opportunity.stage === "Closed Won")
        .reduce((total, opportunity) => total + Number(opportunity.profit_amount || 0), 0),
      loss: closedThatDay
        .filter((opportunity) => opportunity.stage === "Closed Lost")
        .reduce((total, opportunity) => total + Number(opportunity.loss_amount || 0), 0),
    });
  }
  const performerMap = new Map();
  closedWon.forEach((opportunity) => {
    const key = opportunity.owner_email || opportunity.owner_name || "Unassigned";
    const current = performerMap.get(key) || {
      name: opportunity.owner_name || "Unassigned",
      email: opportunity.owner_email || "",
      revenue: 0,
      deals: 0,
      profit: 0,
    };
    current.revenue += Number(opportunity.amount || 0);
    current.profit += Number(opportunity.profit_amount || 0);
    current.deals += 1;
    performerMap.set(key, current);
  });
  const topPerformers = [...performerMap.values()]
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 5);
  const salesActivity = [...sales.opportunities]
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
    .slice(0, 8)
    .map((opportunity) => ({
      id: opportunity.id,
      type: opportunity.stage === "Closed Won" ? "Deal won" : opportunity.stage === "Closed Lost" ? "Deal lost" : `${opportunity.stage} opportunity`,
      company: opportunity.company_name,
      owner: opportunity.owner_name,
      amount: Number(opportunity.stage === "Closed Lost" ? opportunity.loss_amount : opportunity.amount || 0),
      time: new Date(opportunity.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      tone: opportunity.stage === "Closed Won" ? "profit" : opportunity.stage === "Closed Lost" ? "loss" : "neutral",
    }));

  return {
    source: "supabase",
    metrics: {
      views,
      users,
      avgMinutes,
      completionRate,
      viewsChange: percentageChange(views, previousViews),
      usersChange: percentageChange(users, previousUsers),
      timeChange: percentageChange(avgMinutes, previousAvgMinutes),
      completionChange: percentageChange(completionRate, previousCompletionRate),
    },
    daily,
    dashboards,
    devices,
    recentActivity,
    sales: {
      recordCount: sales.opportunities.length,
      revenue,
      profit,
      loss,
      closedWonCount: closedWon.length,
      closedLostCount: closedLost.length,
      pipeline,
      pipelineValue: pipeline.reduce((total, stage) => total + stage.value, 0),
      salesTrend,
      salesActivity,
      topPerformers,
    },
  };
}

function percentageChange(current, previous) {
  if (!previous) return current ? "+100%" : "0%";
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change > 0 ? "+" : ""}${change}%`;
}

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    source: supabaseAuth ? "supabase" : "unconfigured",
    contactStorage: supabaseAdmin ? "available" : "admin key required",
  });
});

app.get("/api/overview", requireAuth, async (request, response, next) => {
  const range = ["7d", "30d", "90d"].includes(request.query.range) ? request.query.range : "7d";
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - Number.parseInt(range, 10) * 2 - 1);
  try {
    const overviewData = await loadOverviewData(request.supabase, request.user.id, startDate.toISOString());
    response.json({
      ...makeOverview(overviewData.events, range, overviewData.sales),
      warnings: overviewData.warnings,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/events", requireAuth, async (request, response, next) => {
  const { dashboard, action, durationSeconds, device } = request.body || {};
  if (typeof dashboard !== "string" || !dashboard.trim() || dashboard.length > 120) {
    return response.status(400).json({ error: "A dashboard name (up to 120 characters) is required." });
  }
  const allowedActions = ["Viewed dashboard", "Exported report", "Shared dashboard", "Applied filters"];
  if (!allowedActions.includes(action)) {
    return response.status(400).json({ error: "Choose a supported dashboard activity." });
  }

  const email = request.user.email || "";
  const profileName = getUserName(request.user);
  const event = {
    user_id: request.user.id,
    user_name: profileName,
    user_email: email,
    dashboard_name: dashboard.trim(),
    action,
    device: typeof device === "string" ? device.slice(0, 40) : "Web",
    duration_seconds: Math.min(Math.max(Number(durationSeconds) || 0, 0), 86400),
    created_at: new Date().toISOString(),
  };
  try {
    const { data, error } = await request.supabase.from("dashboard_usage").insert(event).select("id").single();
    if (error) throw new Error(`Supabase insert failed: ${error.message}`);
    return response.status(201).json({ id: data.id, source: "supabase" });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/opportunities", requireAuth, async (request, response, next) => {
  const body = request.body || {};
  const stages = ["Lead", "Qualified", "Proposal", "Negotiation", "Closed Won", "Closed Lost"];
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  const stage = body.stage;
  const amount = Number(body.amount);
  const profitAmount = Number(body.profitAmount);
  const lossAmount = Number(body.lossAmount);
  if (!companyName || companyName.length > 160) {
    return response.status(400).json({ error: "Enter a record name of 1–160 characters." });
  }
  if (!stages.includes(stage)) return response.status(400).json({ error: "Choose a valid pipeline stage." });
  if (![amount, profitAmount, lossAmount].every((value) => Number.isFinite(value) && value >= 0 && value <= 1_000_000_000_000)) {
    return response.status(400).json({ error: "Revenue, profit, and loss must be valid non-negative amounts." });
  }

  const email = request.user.email;
  if (!email) return response.status(400).json({ error: "Your account must have an email address to add a sales record." });
  const ownerName = getUserName(request.user);
  const closedAt = stage === "Closed Won" || stage === "Closed Lost" ? new Date().toISOString() : null;
  const record = {
    user_id: request.user.id,
    company_name: companyName,
    stage,
    amount,
    profit_amount: profitAmount,
    loss_amount: lossAmount,
    owner_name: ownerName,
    owner_email: email,
    closed_at: closedAt,
  };
  try {
    const { data, error } = await request.supabase.from("sales_opportunities").insert(record).select("id").single();
    if (error) throw new Error(`Supabase sales record insert failed: ${error.message}`);
    return response.status(201).json({ id: data.id, source: "supabase" });
  } catch (error) {
    return next(error);
  }
});

registerBusinessRoutes(app, requireAuth);
registerChatRoute(app, requireAuth);

app.post("/api/contact", contactRateLimit, async (request, response, next) => {
  if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
    return response.status(400).json({ error: "A valid contact request is required." });
  }
  const { fields, submission } = validateContactSubmission(request.body);
  if (Object.keys(fields).length) {
    return response.status(400).json({ error: "Please review the highlighted fields.", fields });
  }

  try {
    if (!supabaseAdmin) return response.status(503).json({ error: "Contact submissions are temporarily unavailable because the server database key is not configured." });
    const { data, error } = await supabaseAdmin
      .from("contact_submissions")
      .insert(submission)
      .select("id")
      .single();
    if (error) throw new Error(`Supabase contact insert failed: ${error.message}`);
    return response.status(201).json({ id: data.id, source: "supabase" });
  } catch (error) {
    return next(error);
  }
});

app.use(express.static(frontendDistPath));
app.get("*", (request, response, next) => {
  if (request.path.startsWith("/api/")) return next();
  response.sendFile(fileURLToPath(new URL("../dist/index.html", import.meta.url)), (error) => {
    if (error) next(error);
  });
});

app.use((error, _request, response, _next) => {
  if (isMissingDatabaseObject(error)) {
    return response.status(503).json({ error: coreSchemaSetupMessage });
  }
  console.error(error);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  response.status(status).json({ error: status === 500 ? "An unexpected server error occurred." : "The request could not be processed." });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Nexavion API listening on port ${port} (${supabaseAuth ? "Supabase auth ready" : "authentication unavailable: missing Supabase configuration"})`);
});
