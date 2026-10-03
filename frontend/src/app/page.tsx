"use client";

import React, { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { AuthCard } from "@/components/AuthCard";
import { TodoList } from "@/components/TodoList";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Server, KeyRound, Cpu, Database } from "lucide-react";

export default function Home() {
  const { user, refreshProfile, fetchTodos } = useAppStore();

  useEffect(() => {
    refreshProfile();
    fetchTodos();
  }, [refreshProfile, fetchTodos]);

  const services = [
    { name: "FastAPI Backend", host: "localhost:8000", icon: Server, color: "text-indigo-400" },
    { name: "Keycloak OIDC", host: "192.168.1.3:8080", icon: KeyRound, color: "text-purple-400" },
    { name: "Redis Limiter", host: "192.168.1.3:6379", icon: Cpu, color: "text-rose-400" },
    { name: "PostgreSQL DB", host: "192.168.1.3:5432", icon: Database, color: "text-cyan-400" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/40 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight">Homelab Todo Stack</span>
                <Badge variant="indigo" className="text-[10px] px-2 py-0.5">
                  v0.1.0
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">FastAPI · Keycloak · Redis</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">Stack:</span>
            <Badge variant="outline" className="text-[11px] border-emerald-500/40 text-emerald-400">
              🟢 All Systems Operational
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {services.map((svc, i) => {
            const Icon = svc.icon;
            return (
              <Card key={i} className="p-3 border-border/40 bg-card/40 backdrop-blur-sm">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-md bg-muted/60">
                    <Icon className={`w-4 h-4 ${svc.color}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{svc.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate">{svc.host}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Dynamic Auth or Dashboard */}
        {!user ? (
          <div className="py-8">
            <AuthCard />
          </div>
        ) : (
          <TodoList />
        )}
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        FastAPI Resource Server + Keycloak OIDC Authentication + Redis Sliding Window Rate Limiting
      </footer>
    </div>
  );
}
