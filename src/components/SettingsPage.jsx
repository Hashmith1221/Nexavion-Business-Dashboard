import { useState } from "react";
import { Check, KeyRound, SlidersHorizontal, UserRound } from "lucide-react";

const preferencesKey = "nexavion:preferences";

function readPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(preferencesKey) || "{}");
    return {
      currency: ["USD", "EUR", "GBP", "INR"].includes(stored.currency) ? stored.currency : "USD",
      defaultRange: ["7d", "30d", "90d"].includes(stored.defaultRange) ? stored.defaultRange : "7d",
    };
  } catch {
    return { currency: "USD", defaultRange: "7d" };
  }
}

const tabs = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "security", label: "Security", icon: KeyRound },
];

export default function SettingsPage({ user, supabase, previewOnly, onProfileSaved, onPreferencesSaved }) {
  const [tab, setTab] = useState("profile");
  const [profile, setProfile] = useState({
    fullName: user?.user_metadata?.full_name || user?.user_metadata?.name || "",
    companyName: user?.user_metadata?.company_name || "",
  });
  const [preferences, setPreferences] = useState(readPreferences);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function showError(reason) {
    setError(reason instanceof Error ? reason.message : "Could not save your settings.");
    setMessage("");
  }

  async function saveProfile(event) {
    event.preventDefault();
    const fullName = profile.fullName.trim();
    const companyName = profile.companyName.trim();
    if (!fullName) {
      setError("Enter your name before saving.");
      return;
    }
    if (!user || previewOnly) {
      setError("Sign in to update your profile.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: { full_name: fullName, company_name: companyName },
      });
      if (updateError) throw updateError;
      onProfileSaved(data.user);
      setMessage("Profile saved.");
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }

  function savePreferences(event) {
    event.preventDefault();
    try {
      localStorage.setItem(preferencesKey, JSON.stringify(preferences));
      onPreferencesSaved(preferences);
      setError("");
      setMessage("Preferences saved on this device.");
    } catch (reason) {
      showError(reason);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    if (!user || previewOnly) {
      setError("Sign in to update your password.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new password and confirmation do not match.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated.");
    } catch (reason) {
      showError(reason);
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100";

  return (
    <section className="mt-5 space-y-5" aria-label="Settings">
      {previewOnly ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6 text-sm text-violet-800">
          Settings are linked to your account. Sign in to view and update them.
          <a href="/" className="ml-1 font-semibold underline underline-offset-2">Return to sign in</a>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
          <nav className="h-fit rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Settings sections">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setTab(id); setError(""); setMessage(""); }}
                aria-current={tab === id ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${tab === id ? "bg-violet-50 text-violet-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
              >
                <Icon size={17} />{label}
              </button>
            ))}
          </nav>

          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            {tab === "profile" && <>
              <div className="mb-6 border-b border-slate-100 pb-5">
                <h2 className="font-display text-lg font-bold text-slate-900">Profile</h2>
                <p className="mt-1 text-xs text-slate-500">Manage the personal and business details associated with your account.</p>
              </div>
              <form onSubmit={saveProfile} className="max-w-xl space-y-4">
                <label className="block text-xs font-semibold text-slate-600">Full name
                  <input required autoComplete="name" maxLength={120} value={profile.fullName} onChange={(event) => setProfile({ ...profile, fullName: event.target.value })} className={inputClass} />
                </label>
                <label className="block text-xs font-semibold text-slate-600">Company / organization
                  <input autoComplete="organization" maxLength={160} value={profile.companyName} onChange={(event) => setProfile({ ...profile, companyName: event.target.value })} className={inputClass} placeholder="Optional" />
                </label>
                <label className="block text-xs font-semibold text-slate-600">Email address
                  <input value={user?.email || ""} readOnly className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-500`} />
                  <span className="mt-1.5 block text-[11px] font-normal text-slate-400">Email is managed by your sign-in provider.</span>
                </label>
                <button disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50">{busy ? "Saving..." : "Save profile"}<Check size={14} /></button>
              </form>
            </>}

            {tab === "preferences" && <>
              <div className="mb-6 border-b border-slate-100 pb-5">
                <h2 className="font-display text-lg font-bold text-slate-900">Preferences</h2>
                <p className="mt-1 text-xs text-slate-500">Choose how amounts and date ranges are shown in this browser.</p>
              </div>
              <form onSubmit={savePreferences} className="max-w-xl space-y-4">
                <label className="block text-xs font-semibold text-slate-600">Display currency
                  <select value={preferences.currency} onChange={(event) => setPreferences({ ...preferences, currency: event.target.value })} className={inputClass}>
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — Pound Sterling</option>
                    <option value="INR">INR — Indian Rupee</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-600">Default analytics date range
                  <select value={preferences.defaultRange} onChange={(event) => setPreferences({ ...preferences, defaultRange: event.target.value })} className={inputClass}>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                  </select>
                </label>
                <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-[11px] leading-relaxed text-slate-500">Preferences are saved in this browser and do not change the stored amounts or convert between currencies.</p>
                <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-700">Save preferences<Check size={14} /></button>
              </form>
            </>}

            {tab === "security" && <>
              <div className="mb-6 border-b border-slate-100 pb-5">
                <h2 className="font-display text-lg font-bold text-slate-900">Security</h2>
                <p className="mt-1 text-xs text-slate-500">Update the password used to sign in with email.</p>
              </div>
              <form onSubmit={savePassword} className="max-w-xl space-y-4">
                <label className="block text-xs font-semibold text-slate-600">New password
                  <input required type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClass} />
                </label>
                <label className="block text-xs font-semibold text-slate-600">Confirm new password
                  <input required type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass} />
                </label>
                <button disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50">{busy ? "Updating..." : "Update password"}<KeyRound size={14} /></button>
              </form>
            </>}

            {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-700">{error}</p>}
            {message && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs text-emerald-700">{message}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
