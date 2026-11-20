import { calculateBusinessMetrics } from "./businessMetrics.js";

const systemPrompt = "You are a business analyst assistant inside a BI dashboard. Use ONLY the data provided in the metrics summary. Never invent or calculate numbers yourself; quote the provided figures. If the data is insufficient to answer, say so and tell the user what data to add. Give specific, practical, prioritized actions to improve profit and productivity, with a short reason for each. Keep answers concise. Suggestions are decision support, not financial advice.";
const rateWindowMs = 60 * 1000;
const rateLimitMax = 8;
const rateLimits = new Map();
const pageSize = 1000;
const maxRows = 20_000;

async function loadUserRows(client, table, columns, userId) {
  const rows = [];
  for (let offset = 0; offset <= maxRows; offset += pageSize) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < pageSize) return rows;
    if (rows.length >= maxRows) {
      const { data: extraRows, error: extraError } = await client
        .from(table)
        .select("id")
        .eq("user_id", userId)
        .order("id", { ascending: true })
        .range(maxRows, maxRows);
      if (extraError) throw extraError;
      if (extraRows?.length) {
        throw Object.assign(new Error("This workspace has too many records to analyze in one request."), { status: 413 });
      }
      return rows;
    }
  }
  return rows;
}

function chatRateLimit(request, response, next) {
  const now = Date.now();
  const userId = request.user.id;
  if (rateLimits.size > 10_000) {
    for (const [key, limit] of rateLimits) {
      if (now - limit.startedAt >= rateWindowMs) rateLimits.delete(key);
    }
  }
  const previous = rateLimits.get(userId);
  if (!previous || now - previous.startedAt >= rateWindowMs) {
    rateLimits.set(userId, { startedAt: now, count: 1 });
    return next();
  }
  if (previous.count >= rateLimitMax) {
    response.set("Retry-After", String(Math.max(1, Math.ceil((rateWindowMs - (now - previous.startedAt)) / 1000))));
    return response.status(429).json({ error: "You’ve sent several questions in a minute. Please wait a moment and try again." });
  }
  previous.count += 1;
  return next();
}

function validateChatBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 1200) return null;
  if (body.history !== undefined && !Array.isArray(body.history)) return null;
  const history = (body.history || []).slice(-5);
  if (history.some((entry) => (
    !entry
    || !["user", "assistant"].includes(entry.role)
    || typeof entry.content !== "string"
    || !entry.content.trim()
    || entry.content.length > 6000
  ))) return null;
  return {
    message,
    history: history.map(({ role, content }) => ({ role, content: content.trim() })),
  };
}

export function registerChatRoute(app, requireAuth) {
  app.post("/api/chat", requireAuth, chatRateLimit, async (request, response) => {
    const input = validateChatBody(request.body);
    if (!input) {
      return response.status(400).json({ error: "Enter a message up to 1,200 characters and send a valid chat history." });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return response.status(503).json({ error: "The AI assistant is not configured yet. Ask your administrator to add the server’s Anthropic API key." });
    }

    try {
      const [orders, expenses] = await Promise.all([
        loadUserRows(
          request.supabase,
          "business_orders",
          "id,status,order_date,actual_delivery_date,items:business_order_items(product_name,quantity,delivered_quantity,purchase_cost,selling_price)",
          request.user.id,
        ),
        loadUserRows(request.supabase, "business_expenses", "category,amount,expense_date", request.user.id),
      ]);
      const metrics = calculateBusinessMetrics(orders, expenses);
      const messages = [
        ...input.history,
        { role: "user", content: input.message },
      ];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      let providerResponse;
      try {
        providerResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
            max_tokens: 900,
            system: `${systemPrompt}\n\nMetrics summary (JSON):\n${JSON.stringify(metrics)}`,
            messages,
          }),
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!providerResponse.ok) {
        const status = providerResponse.status === 401 || providerResponse.status === 403 ? 503
          : providerResponse.status === 429 || providerResponse.status === 529 ? 503 : 502;
        const message = status === 503
          ? "The AI assistant is temporarily unavailable. Please try again shortly."
          : "The AI assistant could not complete that request. Please try again.";
        return response.status(status).json({ error: message });
      }
      const result = await providerResponse.json();
      const reply = Array.isArray(result.content)
        ? result.content.filter((block) => block.type === "text").map((block) => block.text).join("\n").trim()
        : "";
      if (!reply) return response.status(502).json({ error: "The AI assistant returned an empty answer. Please try again." });
      return response.json({ reply });
    } catch (error) {
      if (error.name === "AbortError") {
        return response.status(504).json({ error: "The AI assistant took too long to respond. Please try again." });
      }
      if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
        return response.status(error.status).json({ error: error.message });
      }
      return response.status(500).json({ error: "Business data could not be analyzed right now. Please try again later." });
    }
  });
}
