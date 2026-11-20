import { useEffect, useRef, useState } from "react";
import { ArrowRight, BarChart3, Check, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { getAuthSettings, supabaseClient, supabaseConfigured } from "../lib/supabase.js";

export default function AuthPage() {
  const visualCanvas = useRef(null);
  const [mode, setMode] = useState("sign-in");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [checkingGoogle, setCheckingGoogle] = useState(supabaseConfigured);
  const [providerCheckError, setProviderCheckError] = useState("");

  useEffect(() => {
    const canvas = visualCanvas.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frameId = 0;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let startTime = 0;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      draw(startTime);
    };

    const draw = (timestamp) => {
      if (!width || !height) return;
      if (!startTime) startTime = timestamp;
      const elapsed = motionPreference.matches ? 0 : (timestamp - startTime) / 1000;
      const chartLeft = width * 0.08;
      const chartRight = width * 0.96;
      const chartTop = height * 0.1;
      const chartBottom = height * 0.92;
      const chartWidth = chartRight - chartLeft;
      const chartHeight = chartBottom - chartTop;

      context.clearRect(0, 0, width, height);

      const glow = context.createRadialGradient(width * 0.72, height * 0.52, 0, width * 0.72, height * 0.52, Math.max(width, height) * 0.7);
      glow.addColorStop(0, "rgba(91, 33, 182, 0.2)");
      glow.addColorStop(0.48, "rgba(8, 145, 178, 0.095)");
      glow.addColorStop(0.78, "rgba(16, 185, 129, 0.035)");
      glow.addColorStop(1, "rgba(9, 10, 13, 0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      context.lineWidth = 1;
      context.strokeStyle = "rgba(148, 163, 184, 0.15)";
      const gridSize = 72;
      for (let x = chartLeft % gridSize; x < width; x += gridSize) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = chartTop % gridSize; y < height; y += gridSize) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }

      const bars = 15;
      const slotWidth = chartWidth / bars;
      const barWidth = Math.max(4, Math.min(34, slotWidth * 0.36));
      for (let index = 0; index < bars; index += 1) {
        const progress = (index + 0.5) / bars;
        const baseline = 0.83 - progress * 0.39;
        const pulse = motionPreference.matches ? 0 : Math.sin(elapsed * 1.15 - index * 0.58) * 0.035;
        const barHeight = chartHeight * Math.max(0.12, baseline + pulse);
        const x = chartLeft + index * slotWidth + (slotWidth - barWidth) / 2;
        const y = chartBottom - barHeight;
        const gradient = context.createLinearGradient(0, y, 0, chartBottom);
        gradient.addColorStop(0, index % 4 === 3 ? "rgba(52, 211, 153, 0.62)" : "rgba(139, 92, 246, 0.58)");
        gradient.addColorStop(1, index % 2 ? "rgba(34, 211, 238, 0.16)" : "rgba(139, 92, 246, 0.08)");
        context.globalAlpha = motionPreference.matches ? 0.76 : 0.58 + (Math.sin(elapsed * 1.5 + index) + 1) * 0.11;
        context.fillStyle = gradient;
        context.beginPath();
        context.roundRect(x, y, barWidth, barHeight, Math.min(8, barWidth / 2));
        context.fill();
      }
      context.globalAlpha = 1;

      const points = Array.from({ length: 44 }, (_, index) => {
        const progress = index / 43;
        const trend = 0.77 - progress * 0.46;
        const wave = motionPreference.matches
          ? 0
          : Math.sin(progress * 17 - elapsed * 0.72) * 0.024
            + Math.sin(progress * 31 + elapsed * 0.42) * 0.009;
        return {
          x: chartLeft + progress * chartWidth,
          y: chartTop + chartHeight * (trend + wave),
        };
      });

      context.beginPath();
      context.moveTo(points[0].x, chartBottom);
      context.lineTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];
        const midpoint = (previous.x + current.x) / 2;
        context.quadraticCurveTo(previous.x, previous.y, midpoint, (previous.y + current.y) / 2);
      }
      context.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      context.lineTo(chartRight, chartBottom);
      context.closePath();
      const area = context.createLinearGradient(0, chartTop, 0, chartBottom);
      area.addColorStop(0, "rgba(139, 92, 246, 0.34)");
      area.addColorStop(1, "rgba(139, 92, 246, 0)");
      context.fillStyle = area;
      context.fill();

      const stroke = context.createLinearGradient(chartLeft, chartBottom, chartRight, chartTop);
      stroke.addColorStop(0, "#22d3ee");
      stroke.addColorStop(0.55, "#8b5cf6");
      stroke.addColorStop(1, "#34d399");
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];
        const midpoint = (previous.x + current.x) / 2;
        context.quadraticCurveTo(previous.x, previous.y, midpoint, (previous.y + current.y) / 2);
      }
      context.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      context.strokeStyle = stroke;
      context.lineWidth = 3.5;
      context.shadowColor = "rgba(139, 92, 246, 0.78)";
      context.shadowBlur = 22;
      context.stroke();
      context.shadowBlur = 0;

      for (let index = 7; index < points.length; index += 9) {
        const point = points[index];
        const pulse = motionPreference.matches ? 1 : 0.72 + (Math.sin(elapsed * 2.5 - index) + 1) * 0.14;
        context.beginPath();
        context.arc(point.x, point.y, 3.2 * pulse, 0, Math.PI * 2);
        context.fillStyle = "rgba(9, 10, 13, 0.92)";
        context.fill();
        context.lineWidth = 1.5;
        context.strokeStyle = "rgba(103, 232, 249, 0.9)";
        context.stroke();
      }

      if (!motionPreference.matches) {
        const scanProgress = (elapsed * 0.12) % 1;
        const scanIndex = Math.min(points.length - 1, Math.round(scanProgress * (points.length - 1)));
        const scanPoint = points[scanIndex];
        const scanGlow = context.createRadialGradient(scanPoint.x, scanPoint.y, 0, scanPoint.x, scanPoint.y, 26);
        scanGlow.addColorStop(0, "rgba(103, 232, 249, 0.68)");
        scanGlow.addColorStop(1, "rgba(103, 232, 249, 0)");
        context.fillStyle = scanGlow;
        context.fillRect(scanPoint.x - 26, scanPoint.y - 26, 52, 52);
      }

      const fade = context.createLinearGradient(0, 0, 0, height);
      fade.addColorStop(0, "rgba(9, 10, 13, 0.02)");
      fade.addColorStop(0.48, "rgba(9, 10, 13, 0.04)");
      fade.addColorStop(1, "rgba(9, 10, 13, 0.45)");
      context.fillStyle = fade;
      context.fillRect(0, 0, width, height);

      const panelWidth = Math.min(248, Math.max(168, width * 0.19));
      const panelHeight = 112;
      const panels = [
        { x: width * 0.06, y: height * 0.69, title: "SALES ACTIVITY", color: "#22d3ee", phase: 0.4 },
        { x: width * 0.55, y: height * 0.08, title: "BUSINESS GROWTH", color: "#a78bfa", phase: 2.2 },
        { x: width * 0.74, y: height * 0.76, title: "PIPELINE HEALTH", color: "#34d399", phase: 4.1 },
      ];
      for (const panel of panels) {
        const x = Math.min(panel.x, width - panelWidth - 16);
        const y = Math.min(height - panelHeight - 22, Math.max(18, panel.y + (motionPreference.matches ? 0 : Math.sin(elapsed * 0.65 + panel.phase) * 9)));
        const panelGradient = context.createLinearGradient(x, y, x + panelWidth, y + panelHeight);
        panelGradient.addColorStop(0, "rgba(24, 28, 42, 0.9)");
        panelGradient.addColorStop(1, "rgba(17, 19, 30, 0.82)");
        context.fillStyle = panelGradient;
        context.strokeStyle = "rgba(167, 139, 250, 0.4)";
        context.lineWidth = 1;
        context.shadowColor = `${panel.color}33`;
        context.shadowBlur = 28;
        context.beginPath();
        context.roundRect(x, y, panelWidth, panelHeight, 13);
        context.fill();
        context.shadowBlur = 0;
        context.stroke();

        context.fillStyle = "rgba(226, 232, 240, 0.92)";
        context.font = "600 9px ui-sans-serif, system-ui, sans-serif";
        context.fillText(panel.title, x + 14, y + 20);
        context.beginPath();
        context.arc(x + panelWidth - 15, y + 16, 3, 0, Math.PI * 2);
        context.fillStyle = panel.color;
        context.shadowColor = panel.color;
        context.shadowBlur = 10;
        context.fill();
        context.shadowBlur = 0;

        const miniLeft = x + 14;
        const miniRight = x + panelWidth - 14;
        const miniTop = y + 34;
        const miniBottom = y + panelHeight - 13;
        context.strokeStyle = "rgba(148, 163, 184, 0.22)";
        context.lineWidth = 1;
        for (let guide = 0; guide < 3; guide += 1) {
          const guideY = miniTop + ((miniBottom - miniTop) * guide) / 2;
          context.beginPath();
          context.moveTo(miniLeft, guideY);
          context.lineTo(miniRight, guideY);
          context.stroke();
        }

        const miniPoints = Array.from({ length: 18 }, (_, index) => {
          const progress = index / 17;
          const wave = motionPreference.matches ? 0 : Math.sin(progress * 12 - elapsed * 1.15 + panel.phase) * 7;
          const trend = (1 - progress) * 26;
          return {
            x: miniLeft + progress * (miniRight - miniLeft),
            y: miniBottom - 7 - trend + wave,
          };
        });
        context.beginPath();
        context.moveTo(miniPoints[0].x, miniBottom);
        for (const point of miniPoints) context.lineTo(point.x, point.y);
        context.lineTo(miniPoints[miniPoints.length - 1].x, miniBottom);
        context.closePath();
        const miniFill = context.createLinearGradient(0, miniTop, 0, miniBottom);
        miniFill.addColorStop(0, `${panel.color}55`);
        miniFill.addColorStop(1, `${panel.color}00`);
        context.fillStyle = miniFill;
        context.fill();
        context.beginPath();
        miniPoints.forEach((point, index) => {
          if (index === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        context.strokeStyle = panel.color;
        context.lineWidth = 1.8;
        context.shadowColor = panel.color;
        context.shadowBlur = 8;
        context.stroke();
        context.shadowBlur = 0;
      }

      const particleCount = Math.min(30, Math.floor(width / 42));
      for (let index = 0; index < particleCount; index += 1) {
        const seed = index * 127.1;
        const baseX = ((Math.sin(seed) + 1) / 2) * width;
        const baseY = ((Math.cos(seed * 0.73) + 1) / 2) * height;
        const drift = motionPreference.matches ? 0 : Math.sin(elapsed * 0.42 + index) * 12;
        const particleX = baseX + drift;
        const particleY = baseY + Math.cos(elapsed * 0.35 + index * 0.6) * (motionPreference.matches ? 0 : 10);
        context.beginPath();
        context.arc(particleX, particleY, index % 5 === 0 ? 1.8 : 1.1, 0, Math.PI * 2);
        context.fillStyle = index % 3 === 0 ? "rgba(103, 232, 249, 0.42)" : "rgba(196, 181, 253, 0.3)";
        context.fill();
      }

      if (!motionPreference.matches) frameId = window.requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    motionPreference.addEventListener("change", resize);
    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      motionPreference.removeEventListener("change", resize);
    };
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return undefined;
    let active = true;
    getAuthSettings()
      .then((settings) => {
        if (active) setGoogleEnabled(settings.google);
      })
      .catch((settingsError) => {
        if (active) setProviderCheckError(settingsError.message || "Could not check Google sign-in settings.");
      })
      .finally(() => {
        if (active) setCheckingGoogle(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!supabaseClient) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "sign-up") {
        if (!fullName.trim()) throw new Error("Enter your name to create an account.");
        const { data, error: authError } = await supabaseClient.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (authError) throw authError;
        if (!data.session) {
          setNotice("Check your email to confirm your account, then sign in.");
          setMode("sign-in");
        }
      } else {
        const { error: authError } = await supabaseClient.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
      }
    } catch (authError) {
      setError(authError.message || "Unable to authenticate. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (!supabaseClient) return;
    setBusy(true);
    setError("");
    try {
      const { error: authError } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (authError) throw authError;
    } catch (authError) {
      setError(authError.message || "Google sign-in could not be started.");
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!supabaseClient) return;
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    setBusy(true);
    try {
      const { error: authError } = await supabaseClient.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (authError) throw authError;
      setNotice("If an account exists for this email, a password reset link is on its way.");
    } catch (authError) {
      setError(authError.message || "Could not send the password reset email.");
    } finally {
      setBusy(false);
    }
  }

  const isSignUp = mode === "sign-up";

  return (
    <main className="auth-shell relative isolate min-h-screen overflow-hidden px-5 py-10 sm:px-8">
      <div className="auth-visual" aria-hidden="true">
        <canvas ref={visualCanvas} className="auth-visual-canvas" />
      </div>
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-between">
        <a href="/" aria-label="Nexavion Business Intelligence home" className="inline-flex w-fit items-center">
          <img src="/assets/nexavion-logo-dark.svg" alt="Nexavion Business Intelligence" className="h-8 w-auto sm:h-10" />
        </a>

        <div className="grid items-center gap-12 py-12 lg:grid-cols-[1fr_430px] lg:gap-20">
          <section className="hidden max-w-xl lg:block">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-violet-300"><BarChart3 size={25} /></div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-300">Your data. Your decisions.</p>
            <h1 className="mt-4 font-display text-5xl font-extrabold leading-tight tracking-tight text-white">Business insights, built around <span className="bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text text-transparent">your numbers.</span></h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-slate-400">Add your own sales figures and team details. Your workspace is private to your account.</p>
            <div className="mt-8 flex items-center gap-3 text-xs text-slate-400"><Check size={15} className="text-emerald-400" /> No sample names or seeded revenue</div>
            <div className="mt-3 flex items-center gap-3 text-xs text-slate-400"><LockKeyhole size={15} className="text-emerald-400" /> Sign in to access your workspace</div>
          </section>

          <section className="mx-auto w-full max-w-[430px] rounded-3xl border border-slate-800 bg-[#111318] p-6 shadow-2xl shadow-black/30 sm:p-8">
            <div className="mb-7">
              <p className="text-[11px] font-bold uppercase tracking-[.15em] text-violet-300">{isSignUp ? "Create your workspace" : "Welcome back"}</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-white">{isSignUp ? "Create an account" : "Sign in to Nexavion"}</h2>
              <p className="mt-2 text-xs leading-5 text-slate-400">{isSignUp ? "Set up your profile to start adding your own data." : "Use Google or your email and password to continue."}</p>
            </div>

            {error && <div role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3.5 py-3 text-xs text-rose-300">{error}</div>}
            {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-3 text-xs text-emerald-300">{notice}</div>}
            {!supabaseConfigured && <div role="alert" className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3.5 py-3 text-xs leading-5 text-amber-200">
              <p className="font-semibold">Supabase is not configured for this app.</p>
              <p className="mt-1.5">Create a local <code className="rounded bg-black/20 px-1">.env</code> file with <code className="rounded bg-black/20 px-1">VITE_SUPABASE_URL</code> and <code className="rounded bg-black/20 px-1">VITE_SUPABASE_ANON_KEY</code> from your Supabase project, then restart Vite.</p>
              <p className="mt-1.5">Also add the Google OAuth client in Supabase Authentication → Providers. Keep the Supabase service-role key server-side; never put it in a <code className="rounded bg-black/20 px-1">VITE_</code> variable.</p>
            </div>}

            {supabaseConfigured && !checkingGoogle && !googleEnabled && <div role="status" className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3.5 py-3 text-xs leading-5 text-amber-200">
              {providerCheckError || "Google sign-in is disabled in this Supabase project. Enable Google under Authentication → Providers, then reload this page."}
            </div>}

            <button type="button" onClick={signInWithGoogle} disabled={!supabaseConfigured || checkingGoogle || !googleEnabled || busy} className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-700 bg-slate-900/60 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              <span className="font-display text-sm font-extrabold text-white">G</span> {checkingGoogle ? "Checking Google sign-in..." : "Continue with Google"}
            </button>
            <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-slate-800" /><span className="text-[10px] font-medium text-slate-500">OR USE EMAIL</span><span className="h-px flex-1 bg-slate-800" /></div>

            <form onSubmit={submit} className="space-y-4">
              {isSignUp && <label className="block text-xs font-semibold text-slate-300">Full name<span className="relative mt-1.5 block"><UserRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input autoComplete="name" required maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" className="auth-input h-11 w-full rounded-xl border border-slate-700 bg-slate-900/50 pl-9 pr-3 text-sm outline-none transition focus:border-violet-400" /></span></label>}
              <label className="block text-xs font-semibold text-slate-300">Email address<span className="relative mt-1.5 block"><Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="auth-input h-11 w-full rounded-xl border border-slate-700 bg-slate-900/50 pl-9 pr-3 text-sm outline-none transition focus:border-violet-400" /></span></label>
              <label className="block text-xs font-semibold text-slate-300">Password<span className="relative mt-1.5 block"><LockKeyhole size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input type="password" autoComplete={isSignUp ? "new-password" : "current-password"} required minLength={isSignUp ? 8 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isSignUp ? "At least 8 characters" : "Enter your password"} className="auth-input h-11 w-full rounded-xl border border-slate-700 bg-slate-900/50 pl-9 pr-3 text-sm outline-none transition focus:border-violet-400" /></span></label>
              {!isSignUp && <button type="button" disabled={!supabaseConfigured || busy} onClick={resetPassword} className="text-[11px] font-semibold text-violet-300 hover:text-violet-200 disabled:opacity-50">Forgot password?</button>}
              <button type="submit" disabled={!supabaseConfigured || busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-xs font-bold text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? <><LoaderCircle size={15} className="animate-spin" /> Please wait...</> : <>{isSignUp ? "Create account" : "Sign in"}<ArrowRight size={15} /></>}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-400">{isSignUp ? "Already have an account?" : "New to Nexavion?"}{" "}
              <button type="button" disabled={busy} onClick={() => { setError(""); setNotice(""); setMode(isSignUp ? "sign-in" : "sign-up"); }} className="font-bold text-violet-300 hover:text-violet-200">{isSignUp ? "Sign in" : "Create account"}</button>
            </p>
          </section>
        </div>
        <p className="text-center text-[10px] text-slate-600">© 2026 Nexavion Business Intelligence</p>
      </div>
    </main>
  );
}
