"use client";
import { useState } from "react";
import { ArrowRight, KeyRound, LockKeyhole } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { getKeycloakLoginUrl } from "@/lib/api";

export function AuthCard() {
  const { authMode, setAuthMode, loginKeycloak, loginDirect, registerDirect, isLoadingAuth, authError } = useAppStore();
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (authMode === "keycloak") await loginKeycloak(username, password);
      else if (register) await registerDirect(email, username, password);
      else await loginDirect(email, password);
    } catch { /* The store displays the error and toast; keep form values for retry. */ }
  }
  const fields = <>
    {(authMode === "keycloak" || register) && <label>Username<input autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your username" /></label>}
    {authMode === "direct" && <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>}
    <label>Password<input type="password" autoComplete={register ? "new-password" : "current-password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" /></label>
    <button className="primary-button" disabled={isLoadingAuth}>{isLoadingAuth ? "Signing you in…" : register && authMode === "direct" ? "Create account" : "Sign in"}<ArrowRight size={17} /></button>
  </>;
  return <section className="auth-card panel">
    <div className="icon-tile"><LockKeyhole size={23} /></div>
    <h2>{register && authMode === "direct" ? "Make room for progress." : "Welcome to your workspace."}</h2>
    <p className="muted">Sign in to pick up where you left off.</p>
    <div className="segmented" aria-label="Sign-in method">
      <button aria-pressed={authMode === "keycloak"} onClick={() => { setAuthMode("keycloak"); setPassword(""); }}>Keycloak</button>
      <button aria-pressed={authMode === "direct"} onClick={() => { setAuthMode("direct"); setPassword(""); }}>Email & password</button>
    </div>
    {authError && <p className="inline-error" role="alert">{authError}</p>}
    {authMode === "keycloak" ? <>
      <div className="auth-explainer"><KeyRound size={21} /><p>Use your organization’s account to access your tasks with a single sign-in.</p></div>
      <button className="primary-button" disabled={isLoadingAuth} onClick={() => { window.location.href = getKeycloakLoginUrl(); }}>Continue with Keycloak<ArrowRight size={17} /></button>
      <details className="alternate-login"><summary>Use in-app Keycloak credentials</summary><form onSubmit={submit}>{fields}</form></details>
    </> : <><form onSubmit={submit}>{fields}</form><button className="text-button auth-switch" onClick={() => setRegister(!register)}>{register ? "Already have an account? Sign in" : "New here? Create an account"}</button></>}
    <p className="auth-footnote">A little focus. A little progress. Every day.</p>
  </section>;
}
