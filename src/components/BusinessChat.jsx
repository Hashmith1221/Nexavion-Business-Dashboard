import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bot, Sparkles, X } from "lucide-react";
import { parseJsonResponse } from "../lib/response.js";

const suggestedQuestions = [
  "Why did profit drop last month?",
  "Which products should I stop selling?",
  "How can I cut costs?",
];

function renderInline(text, keyPrefix) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => (
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={`${keyPrefix}-${index}`} className="font-semibold text-slate-100">{part.slice(2, -2)}</strong>
      : part
  ));
}

function renderMarkdown(content) {
  const blocks = [];
  let list = [];
  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`list-${blocks.length}`} className="my-2 list-disc space-y-1 pl-5">
        {list.map((line, index) => <li key={index}>{renderInline(line, `list-${blocks.length}-${index}`)}</li>)}
      </ul>,
    );
    list = [];
  };

  content.split(/\r?\n/).forEach((line) => {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      list.push(bullet[1]);
      return;
    }
    flushList();
    if (line.trim()) {
      blocks.push(<p key={`paragraph-${blocks.length}`} className="my-1.5">{renderInline(line, `paragraph-${blocks.length}`)}</p>);
    }
  });
  flushList();
  return blocks;
}

export default function BusinessChat({ accessToken, previewOnly = false }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  async function sendMessage(rawMessage) {
    const message = rawMessage.trim();
    if (!message || loading || previewOnly) return;
    if (!accessToken) {
      setError("Your session has expired. Sign in again to continue.");
      return;
    }

    const history = messages.slice(-5).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: "user", content: message }]);
    setDraft("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ message, history }),
      });
      const result = await parseJsonResponse(response, "The assistant request");
      if (!response.ok) throw new Error(result.error || "The assistant could not answer right now.");
      if (typeof result.reply !== "string" || !result.reply.trim()) throw new Error("The assistant returned an empty answer. Please try again.");
      setMessages((current) => [...current, { role: "assistant", content: result.reply }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The assistant could not answer right now.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    sendMessage(draft);
  }

  return (
    <>
      {open && (
        <section aria-label="Business AI analyst" className="fixed bottom-24 right-4 z-50 flex h-[min(620px,calc(100dvh-8rem))] w-[calc(100vw-2rem)] max-w-[390px] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#111318] shadow-2xl shadow-black/50 sm:bottom-24 sm:right-6">
          <div className="flex shrink-0 items-center gap-3 border-b border-slate-800 px-4 py-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-violet-400/20 bg-violet-400/10 text-violet-300"><Bot size={19} /></span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-sm font-bold text-slate-100">Business AI analyst</h2>
              <p className="mt-1 text-[10px] text-slate-400">Insights from your business data</p>
            </div>
            <button type="button" aria-label="Close business analyst chat" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><X size={17} /></button>
          </div>

          <div ref={messagesRef} aria-live="polite" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {!messages.length && (
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-400/10 text-violet-300"><Bot size={15} /></span>
                <p className="max-w-2xl rounded-2xl rounded-tl-md border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs leading-5 text-slate-300">
                  Ask about profitability, product performance, expenses, or month-over-month changes. I’ll base suggestions only on the business data recorded in your workspace.
                </p>
              </div>
            )}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
                {message.role === "assistant" && <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-400/10 text-violet-300"><Bot size={15} /></span>}
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-5 sm:max-w-[78%] ${message.role === "user" ? "rounded-tr-md bg-violet-600 text-white" : "rounded-tl-md border border-slate-800 bg-slate-900/70 text-slate-300"}`}>
                  {message.role === "assistant" ? renderMarkdown(message.content) : message.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-3" role="status" aria-label="Assistant is typing">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-400/10 text-violet-300"><Bot size={15} /></span>
                <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-slate-800 bg-slate-900/70 px-4 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-300 [animation-delay:-.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-300 [animation-delay:-.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-300" />
                </div>
              </div>
            )}
          </div>

          {error && <p role="alert" className="mx-4 mb-2 shrink-0 rounded-xl border border-rose-400/20 bg-rose-400/[.07] px-3.5 py-2.5 text-xs text-rose-300">{error}</p>}

          <div className="shrink-0 border-t border-slate-800 px-4 py-3.5">
            <p className="mb-2 text-[10px] font-semibold text-slate-500">Try asking</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {suggestedQuestions.map((question) => (
                <button key={question} type="button" disabled={loading || previewOnly} onClick={() => sendMessage(question)} className="rounded-full border border-slate-700 px-2.5 py-1.5 text-[9px] font-medium text-slate-300 transition hover:border-violet-400/50 hover:bg-violet-400/[.06] hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-50">{question}</button>
              ))}
            </div>
            {previewOnly ? (
              <p className="rounded-xl border border-slate-800 bg-slate-900/50 px-3.5 py-3 text-xs text-slate-400">Sign in to ask questions about your private business data.</p>
            ) : (
              <form onSubmit={submit} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-1.5 pl-3 focus-within:border-violet-400/60">
                <input ref={inputRef} aria-label="Ask the business analyst" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={loading} maxLength={1200} placeholder="Ask a question about your business..." className="h-9 min-w-0 flex-1 bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-500 disabled:opacity-60" />
                <button type="submit" disabled={loading || !draft.trim()} aria-label="Send message" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp size={16} /></button>
              </form>
            )}
            <p className="mt-2 text-[9px] text-slate-500">Decision support, not financial advice.</p>
          </div>
        </section>
      )}

      <button
        type="button"
        aria-label={open ? "Close business analyst chat" : "Open business analyst chat"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="fixed bottom-5 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-violet-300/30 bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-xl shadow-violet-950/40 transition hover:scale-105 hover:shadow-violet-900/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-400/40 sm:bottom-6 sm:right-6"
      >
        {open ? <X size={22} /> : <Bot size={25} strokeWidth={1.9} />}
        {!open && <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#090a0d] bg-emerald-400" />}
      </button>
      {!open && <span className="pointer-events-none fixed bottom-[5.15rem] right-[4.75rem] z-50 hidden rounded-lg border border-slate-700 bg-[#111318] px-2.5 py-1.5 text-[10px] font-medium text-slate-200 shadow-lg sm:block">Ask AI</span>}
    </>
  );
}
