"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { Todo } from "@/lib/types";
import { api } from "@/lib/api";
import {
  CheckCircle,
  Circle,
  Trash2,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Lock,
  Sparkles,
  Layers,
  ArrowRight,
} from "lucide-react";
import { LoginModal } from "./LoginModal";

export function TodoDashboard() {
  const { token, user, updateRateLimitInfo } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form inputs
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Filter & Search
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Fetch todos when user/token changes
  useEffect(() => {
    if (!token) {
      setTodos([]);
      return;
    }

    async function loadTodos() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.getTodos(token!);
        setTodos(data);
        updateRateLimitInfo();
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadTodos();
  }, [token, updateRateLimitInfo]);

  // Handle Add Todo
  const handleCreateTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newTitle.trim()) return;

    setIsCreating(true);
    setError(null);
    try {
      const created = await api.createTodo(
        {
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
        },
        token
      );
      setTodos((prev) => [created, ...prev]);
      setNewTitle("");
      setNewDescription("");
      updateRateLimitInfo();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Toggle Complete
  const handleToggleTodo = async (todo: Todo) => {
    if (!token) return;
    try {
      const updated = await api.updateTodo(
        todo.id,
        { is_completed: !todo.is_completed },
        token
      );
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
      updateRateLimitInfo();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    }
  };

  // Handle Delete Todo
  const handleDeleteTodo = async (id: string) => {
    if (!token) return;
    try {
      await api.deleteTodo(id, token);
      setTodos((prev) => prev.filter((t) => t.id !== id));
      updateRateLimitInfo();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    }
  };

  // Filtered Todos
  const filteredTodos = useMemo(() => {
    return todos.filter((todo) => {
      const matchesSearch =
        todo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (todo.description && todo.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;
      if (filter === "active") return !todo.is_completed;
      if (filter === "completed") return todo.is_completed;
      return true;
    });
  }, [todos, filter, searchQuery]);

  const stats = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter((t) => t.is_completed).length;
    const active = total - completed;
    return { total, completed, active };
  }, [todos]);

  // Unauthenticated Hero View
  if (!token || !user) {
    return (
      <div
        className="glass-panel"
        style={{
          padding: "60px 32px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-50px",
            right: "-50px",
            width: "250px",
            height: "250px",
            background: "radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(40px)",
          }}
        />

        <div
          style={{
            width: "68px",
            height: "68px",
            borderRadius: "20px",
            background: "var(--primary-gradient)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "24px",
            boxShadow: "0 0 35px rgba(99, 102, 241, 0.4)",
          }}
        >
          <Lock size={32} color="#ffffff" />
        </div>

        <h2 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "12px", letterSpacing: "-0.03em" }}>
          Keycloak Protected API
        </h2>
        <p
          style={{
            color: "var(--text-muted)",
            maxWidth: "540px",
            margin: "0 auto 28px",
            lineHeight: 1.6,
            fontSize: "1rem",
          }}
        >
          Sign in with your Homelab Keycloak identity provider. Your requests will be validated using
          cryptographic RS256 JWT tokens and rate-limited via Redis.
        </p>

        <button
          onClick={() => setIsLoginModalOpen(true)}
          className="btn btn-primary"
          style={{ padding: "14px 28px", fontSize: "1rem" }}
        >
          <span>Sign In to Access Dashboard</span>
          <ArrowRight size={18} />
        </button>

        <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      </div>
    );
  }

  return (
    <div>
      {/* Error alert banner */}
      {error && (
        <div
          style={{
            background: "rgba(244, 63, 94, 0.12)",
            border: "1px solid rgba(244, 63, 94, 0.3)",
            borderRadius: "var(--radius-sm)",
            padding: "12px 16px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#fb7185",
            fontSize: "0.875rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            style={{ background: "none", border: "none", color: "#fb7185", cursor: "pointer", fontSize: "0.8rem" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stats Summary Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <div className="glass-panel" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
            Total Tasks
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: "4px" }}>{stats.total}</div>
        </div>

        <div className="glass-panel" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
            In Progress
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fbbf24", marginTop: "4px" }}>
            {stats.active}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
            Completed
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#34d399", marginTop: "4px" }}>
            {stats.completed}
          </div>
        </div>
      </div>

      {/* Create Todo Card */}
      <div className="glass-panel" style={{ padding: "24px", marginBottom: "28px" }}>
        <h3
          style={{
            fontSize: "1rem",
            fontWeight: 700,
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Sparkles size={18} color="var(--primary)" />
          <span>Create New Task</span>
        </h3>

        <form onSubmit={handleCreateTodo} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            type="text"
            className="input-field"
            placeholder="Task Title (e.g., Configure Keycloak Roles in FastAPI)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            required
          />

          <input
            type="text"
            className="input-field"
            placeholder="Description (optional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="btn btn-primary" disabled={isCreating || !newTitle.trim()}>
              <Plus size={16} />
              <span>{isCreating ? "Adding..." : "Add Task"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Search & Filter Controls */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "18px",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", minWidth: "260px", flex: 1 }}>
          <input
            type="text"
            className="input-field"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: "38px", height: "42px" }}
          />
          <Search
            size={16}
            color="var(--text-dim)"
            style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: "flex", gap: "8px" }}>
          {(["all", "active", "completed"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`btn ${filter === t ? "btn-primary" : "btn-secondary"}`}
              style={{
                padding: "8px 14px",
                fontSize: "0.8rem",
                textTransform: "capitalize",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Todo List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {isLoading && todos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
            Loading your tasks from FastAPI...
          </div>
        ) : filteredTodos.length === 0 ? (
          <div
            className="glass-panel"
            style={{
              padding: "48px 24px",
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            <Layers size={36} color="var(--text-dim)" style={{ marginBottom: "12px" }} />
            <p style={{ fontWeight: 600 }}>No tasks found</p>
            <p style={{ fontSize: "0.85rem", color: "var(--text-dim)", marginTop: "4px" }}>
              {searchQuery ? "Try searching for a different keyword" : "Create a task above to get started!"}
            </p>
          </div>
        ) : (
          filteredTodos.map((todo) => (
            <div
              key={todo.id}
              className="glass-panel-interactive animate-fade-in"
              style={{
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                opacity: todo.is_completed ? 0.65 : 1,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1 }}>
                {/* Completion Toggle */}
                <button
                  onClick={() => handleToggleTodo(todo)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                  }}
                  title={todo.is_completed ? "Mark as Incomplete" : "Mark as Completed"}
                >
                  {todo.is_completed ? (
                    <CheckCircle size={22} color="var(--accent-emerald)" />
                  ) : (
                    <Circle size={22} color="var(--text-dim)" />
                  )}
                </button>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      textDecoration: todo.is_completed ? "line-through" : "none",
                      color: todo.is_completed ? "var(--text-muted)" : "var(--text-main)",
                    }}
                  >
                    {todo.title}
                  </div>
                  {todo.description && (
                    <div
                      style={{
                        fontSize: "0.825rem",
                        color: "var(--text-dim)",
                        marginTop: "2px",
                        textDecoration: todo.is_completed ? "line-through" : "none",
                      }}
                    >
                      {todo.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Delete Action */}
              <button
                onClick={() => handleDeleteTodo(todo.id)}
                className="btn btn-danger"
                style={{ padding: "8px 10px" }}
                title="Delete task"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
