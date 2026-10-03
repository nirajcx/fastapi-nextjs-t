import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Todo, UserProfile, RateLimitInfo } from "@/lib/types";
import { api, loginWithKeycloakPassword, getLatestRateLimit } from "@/lib/api";

export type AuthProviderMode = "keycloak" | "direct";

interface AppState {
  // Auth state
  authMode: AuthProviderMode;
  user: UserProfile | null;
  token: string | null;
  isLoadingAuth: boolean;
  authError: string | null;

  // Rate Limiting
  rateLimit: RateLimitInfo;

  // Todos state
  todos: Todo[];
  isLoadingTodos: boolean;
  todosError: string | null;
  filter: "all" | "active" | "completed";
  searchQuery: string;

  // Actions
  setAuthMode: (mode: AuthProviderMode) => void;
  setFilter: (filter: "all" | "active" | "completed") => void;
  setSearchQuery: (query: string) => void;
  clearErrors: () => void;
  updateRateLimit: () => void;

  // Auth actions
  loginKeycloak: (username: string, password: string) => Promise<void>;
  loginDirect: (email: string, password: string) => Promise<void>;
  registerDirect: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;

  // Todo actions
  fetchTodos: () => Promise<void>;
  createTodo: (title: string, description?: string) => Promise<void>;
  toggleTodo: (todo: Todo) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      authMode: "keycloak",
      user: null,
      token: null,
      isLoadingAuth: false,
      authError: null,

      rateLimit: {
        limit: 60,
        remaining: 60,
        reset: 60,
      },

      todos: [],
      isLoadingTodos: false,
      todosError: null,
      filter: "all",
      searchQuery: "",

      setAuthMode: (mode) => set({ authMode: mode, authError: null }),
      setFilter: (filter) => set({ filter }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      clearErrors: () => set({ authError: null, todosError: null }),

      updateRateLimit: () => {
        set({ rateLimit: { ...getLatestRateLimit() } });
      },

      loginKeycloak: async (username, password) => {
        set({ isLoadingAuth: true, authError: null });
        try {
          const res = await loginWithKeycloakPassword(username, password);
          set({ token: res.access_token });

          // Fetch profile using Bearer token from FastAPI
          const profile = await api.getMe(res.access_token);
          set({ user: profile, isLoadingAuth: false });
          get().updateRateLimit();
          get().fetchTodos();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Keycloak login failed";
          set({ authError: msg, isLoadingAuth: false });
          throw err;
        }
      },

      loginDirect: async (email, password) => {
        set({ isLoadingAuth: true, authError: null });
        try {
          const res = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || "Direct API login failed");
          }

          const data = await res.json();
          // Direct login returns { session_token, user_id, email, username }
          const profile: UserProfile = {
            id: data.user_id,
            email: data.email,
            username: data.username,
            is_active: true,
          };

          set({
            user: profile,
            token: data.session_token,
            isLoadingAuth: false,
          });
          get().updateRateLimit();
          get().fetchTodos();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Direct login failed";
          set({ authError: msg, isLoadingAuth: false });
          throw err;
        }
      },

      registerDirect: async (email, username, password) => {
        set({ isLoadingAuth: true, authError: null });
        try {
          const res = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, username, password }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || "Registration failed");
          }

          // Auto-login after direct registration
          await get().loginDirect(email, password);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Registration failed";
          set({ authError: msg, isLoadingAuth: false });
          throw err;
        }
      },

      logout: async () => {
        const { token } = get();
        try {
          if (token) {
            await fetch(`${API_BASE}/auth/logout`, {
              method: "POST",
              credentials: "include",
              headers: { Authorization: `Bearer ${token}` },
            }).catch(() => {});
          }
        } finally {
          set({ user: null, token: null, todos: [] });
        }
      },

      refreshProfile: async () => {
        const { token } = get();
        if (!token) return;
        try {
          const profile = await api.getMe(token);
          set({ user: profile });
          get().updateRateLimit();
        } catch (err) {
          console.error("Failed to refresh profile:", err);
        }
      },

      fetchTodos: async () => {
        const { token } = get();
        if (!token) return;
        set({ isLoadingTodos: true, todosError: null });
        try {
          const data = await api.getTodos(token);
          set({ todos: data, isLoadingTodos: false });
          get().updateRateLimit();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to load todos";
          set({ todosError: msg, isLoadingTodos: false });
        }
      },

      createTodo: async (title, description) => {
        const { token } = get();
        if (!token) return;
        try {
          const created = await api.createTodo(
            { title, description: description || undefined },
            token
          );
          set((state) => ({ todos: [created, ...state.todos] }));
          get().updateRateLimit();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to create task";
          set({ todosError: msg });
          throw err;
        }
      },

      toggleTodo: async (todo) => {
        const { token } = get();
        if (!token) return;
        try {
          const updated = await api.updateTodo(
            todo.id,
            { is_completed: !todo.is_completed },
            token
          );
          set((state) => ({
            todos: state.todos.map((t) => (t.id === todo.id ? updated : t)),
          }));
          get().updateRateLimit();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to update task";
          set({ todosError: msg });
        }
      },

      deleteTodo: async (id) => {
        const { token } = get();
        if (!token) return;
        try {
          await api.deleteTodo(id, token);
          set((state) => ({ todos: state.todos.filter((t) => t.id !== id) }));
          get().updateRateLimit();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to delete task";
          set({ todosError: msg });
        }
      },
    }),
    {
      name: "homelab-app-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        authMode: state.authMode,
        user: state.user,
      }),
    }
  )
);
