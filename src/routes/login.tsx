import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { LogIn, UserPlus, LogOut, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SectionHeader } from "@/components/polysnitch/Primitives";
import { useAuth, supabaseConfigured } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in · PolySnitch" },
      { name: "description", content: "Create an account or sign in to PolySnitch." },
    ],
  }),
  component: LoginPage,
});

type Mode = "login" | "signup";

function LoginPage() {
  const { user, loading, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const fn = mode === "signup" ? signUp : signIn;
    const { error } = await fn(email.trim(), password);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    if (mode === "signup") {
      setNotice("Account created. Check your email for a confirmation link, then sign in.");
      setMode("login");
      setPassword("");
    }
    // on successful login, the auth state flips and the logged-in panel renders
  };

  return (
    <AppShell>
      <div className="px-4 md:px-8 py-6 md:py-8 max-w-md mx-auto">
        <SectionHeader eyebrow="ACCESS // ACCOUNT" title={user ? "Account" : mode === "signup" ? "Create account" : "Sign in"} />

        {!supabaseConfigured ? (
          <Notice tone="amber" title="SUPABASE // NOT_CONFIGURED">
            Auth needs Supabase credentials in <span className="font-mono text-cyan">.env.local</span>.
          </Notice>
        ) : loading ? (
          <div className="h-40 border border-border bg-surface rounded-sm animate-pulse" />
        ) : user ? (
          // ---- logged in ----
          <div className="border border-border bg-surface rounded-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-status-green" />
              <span className="mono-label text-status-green">SESSION // ACTIVE</span>
            </div>
            <div>
              <div className="mono-label">SIGNED IN AS</div>
              <div className="mt-1 text-sm font-medium break-all">{user.email}</div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground break-all">
                uid {user.id}
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest px-3 py-2 border border-border rounded-sm text-foreground transition hover:border-amber hover:text-amber"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        ) : (
          // ---- logged out: login / signup ----
          <>
            <div className="flex border border-border bg-surface rounded-sm overflow-hidden mb-5">
              {(["login", "signup"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setError(null);
                    setNotice(null);
                  }}
                  className={`flex-1 px-3 py-2 font-mono text-[11px] uppercase tracking-widest transition ${
                    mode === m ? "bg-amber text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                  }`}
                >
                  {m === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            {notice && (
              <Notice tone="green" title="CHECK YOUR EMAIL">{notice}</Notice>
            )}
            {error && (
              <Notice tone="red" title="AUTH_FAULT">{error}</Notice>
            )}

            <form onSubmit={onSubmit} className="border border-border bg-surface rounded-sm p-6 space-y-4">
              <label className="block">
                <span className="mono-label">EMAIL</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full bg-background border border-border rounded-sm px-3 py-2.5 text-sm outline-none focus:border-amber transition"
                  placeholder="you@example.com"
                />
              </label>
              <label className="block">
                <span className="mono-label">PASSWORD</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full bg-background border border-border rounded-sm px-3 py-2.5 text-sm outline-none focus:border-amber transition"
                  placeholder="••••••••"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-widest px-3 py-3 rounded-sm bg-amber text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
              >
                {mode === "signup" ? <UserPlus className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
                {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </form>

            <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Public records are readable without an account.{" "}
              <Link to="/feed" className="text-cyan hover:underline">Browse the feed</Link>
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Notice({ tone, title, children }: { tone: "amber" | "green" | "red"; title: string; children: React.ReactNode }) {
  const cls =
    tone === "green"
      ? "border-status-green/50 bg-status-green/5 text-status-green"
      : tone === "red"
        ? "border-status-red/50 bg-status-red/5 text-status-red"
        : "border-border bg-surface text-amber";
  return (
    <div className={`border rounded-sm p-4 mb-4 ${cls}`}>
      <div className="mono-label">{title}</div>
      <p className="mt-1 text-sm text-foreground">{children}</p>
    </div>
  );
}
