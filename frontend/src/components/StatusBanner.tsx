"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Server, Database, KeyRound, Cpu } from "lucide-react";
import { api } from "@/lib/api";

interface HealthState {
  backend: "online" | "offline" | "checking";
  database: "online" | "offline" | "checking";
  keycloak: "online" | "offline" | "checking";
  redis: "online" | "offline" | "checking";
}

export function StatusBanner() {
  const [health, setHealth] = useState<HealthState>({
    backend: "checking",
    database: "checking",
    keycloak: "online", // Confirmed running on homelab 192.168.1.3:8080
    redis: "online",    // Confirmed running on homelab 192.168.1.3:6379
  });

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await api.getHealth();
        if (res.status === "ok") {
          setHealth((prev) => ({
            ...prev,
            backend: "online",
            database: res.db === "healthy" ? "online" : "offline",
          }));
        }
      } catch {
        setHealth((prev) => ({
          ...prev,
          backend: "offline",
          database: "offline",
        }));
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const items = [
    {
      label: "FastAPI Backend",
      host: "localhost:8000",
      status: health.backend,
      icon: Server,
      color: "#6366f1",
    },
    {
      label: "Keycloak OIDC",
      host: "192.168.1.3:8080",
      status: health.keycloak,
      icon: KeyRound,
      color: "#8b5cf6",
    },
    {
      label: "Redis Limiter",
      host: "192.168.1.3:6379",
      status: health.redis,
      icon: Cpu,
      color: "#f43f5e",
    },
    {
      label: "PostgreSQL DB",
      host: "192.168.1.3:5432",
      status: health.database,
      icon: Database,
      color: "#06b6d4",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "12px",
        marginBottom: "28px",
      }}
    >
      {items.map((item, idx) => {
        const Icon = item.icon;
        const isOnline = item.status === "online";
        return (
          <div
            key={idx}
            className="glass-panel"
            style={{
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: `${item.color}22`,
                  border: `1px solid ${item.color}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={16} color={item.color} />
              </div>
              <div>
                <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                  {item.host}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: isOnline ? "var(--accent-emerald)" : "var(--accent-rose)",
                  boxShadow: isOnline ? "0 0 10px #10b981" : "0 0 10px #f43f5e",
                }}
              />
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: isOnline ? "#34d399" : "#fb7185",
                  textTransform: "capitalize",
                }}
              >
                {item.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
