"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ArrowUpRight, LogOut } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { AuthCard } from "@/components/AuthCard";
import { TodoList } from "@/components/TodoList";
import { notify } from "@/store/useToastStore";

export default function Home() {
  const { user, logout } = useAppStore();
  const initialized = useRef(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    async function initialize() {
      if (!useAppStore.persist.hasHydrated()) await useAppStore.persist.rehydrate();
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) await useAppStore.getState().loginWithKeycloakCode(code);
      else if (params.has("error")) {
        notify("Sign-in was cancelled or could not be completed. Please try again.", "error");
        window.history.replaceState({}, "", window.location.pathname);
      } else if (useAppStore.getState().user) {
        await useAppStore.getState().refreshProfile();
        if (useAppStore.getState().user) await useAppStore.getState().fetchTodos();
      }
      setReady(true);
    }
    void initialize();
  }, []);
  return <div className="app-shell">
    <header className="app-header"><Link className="brand" href="/"><span className="brand-mark"><Check size={23} strokeWidth={3} /></span>Daymark<span className="brand-label">YOUR PERSONAL WORKSPACE</span></Link>
      {ready && user ? <div className="header-account"><span>{user.username}</span><button className="text-button" onClick={() => void logout()}><LogOut size={16} />Sign out</button></div> : <span className="header-note">Make space for what matters.</span>}
    </header>
    <main>{!ready ? <div className="loading-state" role="status">Opening your workspace…</div> : user ? <TodoList /> : <div className="welcome-layout">
      <section className="welcome-copy"><span className="eyebrow">SMALL STEPS. MEANINGFUL DAYS.</span><h1>A clearer mind.<br />A better <em>day.</em></h1><p>Bring your tasks together, find your focus, and turn the things you want to do into things you’ve done.</p>
        <div className="preview-note"><div className="preview-heading"><span>ONE THING AT A TIME</span><ArrowUpRight size={20} /></div><div className="sample-task"><span className="sample-check"><Check size={16} /></span><s>Make a little room for yourself</s></div><div className="sample-task"><span className="sample-circle" />Start something that matters</div><div className="preview-bottom"><span>Less noise. More progress.</span><span>✦</span></div></div>
      </section><AuthCard />
    </div>}</main>
    <footer className="app-footer"><span>Daymark — a little more done.</span><span>Your day, at your pace.</span></footer>
  </div>;
}
