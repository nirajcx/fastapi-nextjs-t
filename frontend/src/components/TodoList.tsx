"use client";

import React, { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Circle,
  Trash2,
  Plus,
  Search,
  AlertCircle,
  Inbox,
  LogOut,
  User,
  Shield,
  Zap,
} from "lucide-react";

export function TodoList() {
  const {
    user,
    authMode,
    logout,
    todos,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    isLoadingTodos,
    todosError,
    createTodo,
    toggleTodo,
    deleteTodo,
    rateLimit,
  } = useAppStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      await createTodo(title.trim(), description.trim() || undefined);
      setTitle("");
      setDescription("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTodos = todos.filter((todo) => {
    const match =
      todo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (todo.description && todo.description.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!match) return false;
    if (filter === "active") return !todo.is_completed;
    if (filter === "completed") return todo.is_completed;
    return true;
  });

  const totalCount = todos.length;
  const completedCount = todos.filter((t) => t.is_completed).length;
  const activeCount = totalCount - completedCount;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* User Header & Logout */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-md">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center font-bold text-white shadow-md">
              {user?.username ? user.username.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{user?.username}</span>
                <Badge variant={authMode === "keycloak" ? "indigo" : "emerald"} className="text-[10px]">
                  {authMode === "keycloak" ? "Keycloak RS256" : "Direct API"}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">{user?.email}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Redis Rate Limit Meter */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-background/50">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Redis: <strong>{rateLimit.remaining}</strong>/{rateLimit.limit} reqs
              </span>
            </div>

            <Button variant="destructive" size="sm" onClick={() => logout()} className="h-8 gap-1.5 text-xs">
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 border-border/50 bg-card/40">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase">Total Tasks</div>
          <div className="text-2xl font-bold mt-1">{totalCount}</div>
        </Card>
        <Card className="p-4 border-border/50 bg-card/40">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase">Pending</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{activeCount}</div>
        </Card>
        <Card className="p-4 border-border/50 bg-card/40">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase">Completed</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{completedCount}</div>
        </Card>
      </div>

      {/* Create Task Card */}
      <Card className="border-border/60 bg-card/70 backdrop-blur-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            <span>Create New Task</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddTodo} className="space-y-3">
            <Input
              placeholder="Task title (e.g., Update Keycloak client redirect URIs)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <Input
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting || !title.trim()} size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" />
                <span>{isSubmitting ? "Adding..." : "Add Task"}</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Error alert */}
      {todosError && (
        <div className="flex items-center gap-2 p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{todosError}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex gap-1.5">
          {(["all", "active", "completed"] as const).map((t) => (
            <Button
              key={t}
              variant={filter === t ? "default" : "secondary"}
              size="sm"
              onClick={() => setFilter(t)}
              className="h-9 capitalize text-xs"
            >
              {t}
            </Button>
          ))}
        </div>
      </div>

      {/* Todos List */}
      <div className="space-y-2">
        {isLoadingTodos && todos.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">Loading tasks...</div>
        ) : filteredTodos.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-border/60 bg-transparent">
            <Inbox className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <div className="text-sm font-medium">No tasks found</div>
            <div className="text-xs text-muted-foreground mt-1">
              {searchQuery ? "No matches for your query" : "Add your first task above!"}
            </div>
          </Card>
        ) : (
          filteredTodos.map((todo) => (
            <Card
              key={todo.id}
              className={`p-3.5 flex items-center justify-between gap-3 border-border/50 transition-colors hover:border-primary/40 ${
                todo.is_completed ? "opacity-60 bg-card/30" : "bg-card/70"
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => toggleTodo(todo)}
                  className="cursor-pointer text-muted-foreground hover:text-emerald-400 transition-colors"
                >
                  {todo.is_completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium truncate ${
                      todo.is_completed ? "line-through text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {todo.title}
                  </div>
                  {todo.description && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {todo.description}
                    </div>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteTodo(todo.id)}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
