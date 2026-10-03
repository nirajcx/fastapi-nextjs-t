"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, LogOut, LogIn, Activity, RefreshCw } from "lucide-react";
import { LoginModal } from "./LoginModal";

export function Navbar() {
  const { user, token, logout, rateLimit, refreshProfile } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshProfile();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const getRateLimitColor = () => {
    const percent = (rateLimit.remaining / rateLimit.limit) * 100;
    if (percent > 60) return "badge-emerald";
    if (percent > 20) return "badge-amber";
    return "badge-rose";
  };

  return (
    <>
      <header
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          background: "rgba(10, 14, 26, 0.8)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          className="container"
          style={{
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo & Title */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "var(--primary-gradient)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 20px rgba(99, 102, 241, 0.4)",
              }}
            >
              <ShieldCheck size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h1 style={{ fontSize: "1.15rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                  Homelab Stack
                </h1>
                <span className="badge badge-indigo" style={{ fontSize: "0.65rem" }}>
                  Keycloak + Redis
                </span>
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                FastAPI Resource Server · todo-realm
              </p>
            </div>
          </div>

          {/* Right Action Area */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {/* Redis Rate Limit Meter */}
            <div
              className={`badge ${getRateLimitColor()}`}
              title={`Redis Rate Limit: ${rateLimit.remaining}/${rateLimit.limit} requests remaining. Resets every 60s.`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
                padding: "6px 12px",
              }}
              onClick={handleRefresh}
            >
              <Activity size={14} />
              <span>
                Redis: <strong>{rateLimit.remaining}</strong>/{rateLimit.limit} reqs
              </span>
            </div>

            {token && user ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {/* User Pill */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid var(--border-subtle)",
                    padding: "6px 12px",
                    borderRadius: "var(--radius-full)",
                  }}
                >
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "#fff",
                    }}
                  >
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{user.username}</span>
                </div>

                {/* Refresh button */}
                <button
                  onClick={handleRefresh}
                  className="btn btn-secondary"
                  style={{ padding: "8px 12px" }}
                  title="Refresh Session Profile"
                >
                  <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                </button>

                {/* Logout Button */}
                <button
                  onClick={logout}
                  className="btn btn-danger"
                  style={{ padding: "8px 14px", fontSize: "0.8rem" }}
                >
                  <LogOut size={14} />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsLoginOpen(true)}
                className="btn btn-primary"
                style={{ padding: "8px 18px" }}
              >
                <LogIn size={15} />
                <span>Login with Keycloak</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Login Modal */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </>
  );
}
