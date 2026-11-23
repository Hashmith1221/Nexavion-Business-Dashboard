import { useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  LockKeyhole,
  Mail,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";
import { parseJsonResponse } from "../lib/response.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const initialValues = {
  fullName: "",
  email: "",
  phone: "",
  company: "",
  subject: "",
  message: "",
};

const fieldLabels = {
  fullName: "Full name",
  email: "Email address",
  phone: "Phone number",
  company: "Company / organization",
  subject: "Subject",
  message: "Message",
};

function validateField(name, value) {
  const trimmed = value.trim();
  if (!trimmed) return `${fieldLabels[name]} is required.`;

  if (name === "fullName" && trimmed.length > 120) {
    return "Please keep your name under 120 characters.";
  }
  if (name === "email") {
    if (trimmed.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      return "Enter a valid email address.";
    }
  }
  if (name === "phone") {
    const digits = trimmed.replace(/\D/g, "");
    if (trimmed.length > 25 || !/^[+()\d.\s-]+$/.test(trimmed) || digits.length < 7 || digits.length > 15) {
      return "Enter a valid phone number with 7–15 digits.";
    }
  }
  if (name === "company" && trimmed.length > 160) {
    return "Please keep your company name under 160 characters.";
  }
  if (name === "subject" && trimmed.length > 120) {
    return "Please keep your subject under 120 characters.";
  }
  if (name === "message") {
    if (trimmed.length < 10) return "Please add at least 10 characters.";
    if (trimmed.length > 5000) return "Please keep your message under 5,000 characters.";
  }
  return "";
}

function Field({ name, label, value, onChange, onBlur, error, ...props }) {
  const id = `contact-${name}`;
  const errorId = `${id}-error`;
  const controlClass = `mt-2 block w-full rounded-xl border bg-white px-3.5 text-[13px] text-slate-800 outline-none transition duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 ${
    error ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : "border-slate-200"
  }`;

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-[12px] font-semibold text-slate-700">
        {label}<span aria-hidden="true" className="ml-1 text-rose-500">*</span>
      </label>
      {name === "message" ? (
        <textarea
          {...props}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`${controlClass} min-h-[140px] resize-y py-3 leading-relaxed`}
        />
      ) : (
        <input
          {...props}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`${controlClass} h-11`}
        />
      )}
      {error && <p id={errorId} className="mt-1.5 text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}

function ContactForm() {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submissionLock = useRef(false);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      return { ...current, [name]: validateField(name, value) };
    });
    setFormError("");
    setStatus("");
  }

  function validateAll() {
    return Object.fromEntries(
      Object.entries(values)
        .map(([name, value]) => [name, validateField(name, value)])
        .filter(([, error]) => error),
    );
  }

  function clearForm() {
    setValues(initialValues);
    setErrors({});
    setFormError("");
    setStatus("");
  }

  async function submitForm(event) {
    event.preventDefault();
    if (submissionLock.current) return;

    const validationErrors = validateAll();
    setErrors(validationErrors);
    setFormError("");
    setStatus("");
    if (Object.keys(validationErrors).length) {
      document.getElementById(`contact-${Object.keys(validationErrors)[0]}`)?.focus();
      return;
    }

    submissionLock.current = true;
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await parseJsonResponse(response, "Sending your message");
      if (!response.ok) {
        const submissionError = new Error(result.error || "We couldn't send your message. Please try again.");
        submissionError.fields = result.fields;
        throw submissionError;
      }

      setValues(initialValues);
      setErrors({});
      setStatus("Thanks for reaching out. Your message has been received, and our team will be in touch soon.");
    } catch (error) {
      if (error.fields && typeof error.fields === "object") setErrors(error.fields);
      setFormError(
        error.name === "TypeError"
          ? "We couldn't reach the server. Check your connection and try again."
          : error.message || "We couldn't send your message. Please try again.",
      );
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  }

  const inputProps = {
    onChange: updateField,
    onBlur: (event) => {
      const { name, value } = event.target;
      setErrors((current) => ({ ...current, [name]: validateField(name, value) }));
    },
  };

  return (
    <section className="form-enter">
      <div className="mb-5">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-violet-700">
          <Sparkles size={12} /> Let’s connect
        </div>
        <h2 className="font-display text-[25px] font-extrabold tracking-tight text-slate-900 sm:text-[30px]">We’d love to hear from you.</h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-slate-500">Share a little about what you need, and the right person on our team will get back to you.</p>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(260px,.8fr)]">
        <form onSubmit={submitForm} noValidate className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card sm:p-7 lg:p-8">
          <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h3 className="font-display text-[15px] font-bold text-slate-900">Send us a message</h3>
              <p className="mt-1 text-[11px] text-slate-400">Fields marked <span className="text-rose-500">*</span> are required.</p>
            </div>
            <span className="hidden h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 sm:flex"><MessageCircle size={19} /></span>
          </div>

          {status && <div role="status" aria-live="polite" className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-[12px] leading-relaxed text-emerald-800"><Check size={16} className="mt-0.5 shrink-0" />{status}</div>}
          {formError && <div id="contact-form-error" role="alert" aria-live="assertive" className="mb-5 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-[12px] leading-relaxed text-rose-700">{formError}</div>}
          {Object.values(errors).some(Boolean) && <p className="sr-only" role="status" aria-live="polite">Please correct the highlighted fields.</p>}

          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
            <Field name="fullName" label="Full name" autoComplete="name" maxLength={120} placeholder="Enter your full name" value={values.fullName} error={errors.fullName} {...inputProps} />
            <Field name="email" label="Email address" type="email" inputMode="email" autoComplete="email" maxLength={254} placeholder="Enter your email address" value={values.email} error={errors.email} {...inputProps} />
            <Field name="phone" label="Phone number" type="tel" inputMode="tel" autoComplete="tel" maxLength={25} placeholder="+1 (555) 000-0000" value={values.phone} error={errors.phone} {...inputProps} />
            <Field name="company" label="Company / organization" autoComplete="organization" maxLength={160} placeholder="Enter your organization" value={values.company} error={errors.company} {...inputProps} />
            <div className="sm:col-span-2">
              <Field name="subject" label="Subject" maxLength={120} placeholder="How can we help?" value={values.subject} error={errors.subject} {...inputProps} />
            </div>
            <div className="sm:col-span-2">
              <Field name="message" label="Message / description" maxLength={5000} placeholder="Tell us a little more about what you're looking for..." value={values.message} error={errors.message} {...inputProps} />
              <div className="mt-1.5 text-right text-[10px] text-slate-400">{values.message.length.toLocaleString()} / 5,000</div>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={clearForm} disabled={submitting} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-50">
              <RotateCcw size={14} /> Clear all
            </button>
            <button type="submit" disabled={submitting} aria-describedby={formError ? "contact-form-error" : undefined} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-xs font-bold text-white shadow-md shadow-violet-200 transition duration-200 hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70">
              {submitting ? <><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Sending message...</> : <><Send size={14} /> Send message <ArrowRight size={14} /></>}
            </button>
          </div>
        </form>

        <aside className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#322b75] via-[#5145b8] to-[#7769eb] p-5 text-white shadow-lg shadow-violet-200/60 sm:p-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/15"><Mail size={18} /></span>
          <h3 className="mt-5 font-display text-[17px] font-bold">A little context goes a long way.</h3>
          <p className="mt-2 text-[12px] leading-relaxed text-violet-100">Tell us what you’re hoping to accomplish. We’ll make sure your message reaches the right person.</p>

          <div className="my-5 h-px bg-white/15" />
          <div className="space-y-4">
            <div className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10"><Clock3 size={14} /></span>
              <div><p className="text-[11px] font-semibold">A thoughtful reply</p><p className="mt-0.5 text-[10px] leading-relaxed text-violet-100">We typically respond within one business day.</p></div>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10"><LockKeyhole size={14} /></span>
              <div><p className="text-[11px] font-semibold">Your details stay private</p><p className="mt-0.5 text-[10px] leading-relaxed text-violet-100">We’ll only use your information to follow up on this request.</p></div>
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-white/15 bg-white/10 p-3.5">
            <p className="text-[10px] leading-relaxed text-violet-50">The more detail you share, the better we can prepare a useful response.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default ContactForm;
