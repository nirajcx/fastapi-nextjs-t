"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { KeyRound, Lock, User, X, AlertCircle, ArrowRight, Shield } from "lucide-react";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { login, isLoading, error } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      await login(username, password);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError("Invalid username or password");
      }
    }
  };

  const fillDemo = () => {
    setUsername("niraj");
    setPassword("password123");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(3, 5, 10, 0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "20px",
      }}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: "100%",
          maxWidth: "460px",
          padding: "32px",
          position: "relative",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), var(--shadow-glow)",
          border: "1px solid var(--border-active)",
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "transparent",
            border: "none",
            color: "var(--text-dim)",
            cursor: "pointer",
          }}
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "var(--primary-gradient)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
              boxShadow: "0 0 25px rgba(99, 102, 241, 0.4)",
            }}
          >
            <KeyRound size={28} color="#fff" />
          </div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "6px" }}>
            Keycloak Sign In
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Authenticate with <strong>todo-realm</strong> on your homelab Keycloak server.
          </p>
        </div>

        {/* Quick Fill Demo Button */}
        <div
          style={{
            background: "rgba(99, 102, 241, 0.08)",
            border: "1px dashed rgba(99, 102, 241, 0.3)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 14px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Shield size={16} color="var(--primary)" />
            <span style={{ fontSize: "0.8rem", color: "#c7d2fe" }}>
              Test User: <strong>niraj</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={fillDemo}
            className="btn btn-secondary"
            style={{ padding: "4px 10px", fontSize: "0.75rem" }}
          >
            Auto-fill Credentials
          </button>
        </div>

        {/* Error message */}
        {(localError || error) && (
          <div
            style={{
              background: "rgba(244, 63, 94, 0.12)",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 14px",
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#fb7185",
              fontSize: "0.85rem",
            }}
          >
            <AlertCircle size={16} />
            <span>{localError || error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-muted)",
                marginBottom: "6px",
              }}
            >
              Username / Email
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="input-field"
                placeholder="niraj"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{ paddingLeft: "40px" }}
              />
              <User
                size={16}
                color="var(--text-dim)"
                style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-muted)",
                marginBottom: "6px",
              }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingLeft: "40px" }}
              />
              <Lock
                size={16}
                color="var(--text-dim)"
                style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{ width: "100%", marginTop: "8px", padding: "12px" }}
          >
            {isLoading ? (
              <span>Authenticating with Keycloak...</span>
            ) : (
              <>
                <span>Sign In with Keycloak</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
