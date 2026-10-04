import { notify } from "@/store/useToastStore";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Todo, UserProfile, RateLimitInfo } from "@/lib/types";
import { api, loginWithKeycloakPassword, exchangeCodeForToken, getLatestRateLimit, getKeycloakLogoutUrl, responseError } from "@/lib/api";



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
  loginWithKeycloakCode: (code: string) => Promise<void>;
  loginDirect: (email: string, password: string) => Promise<void>;

  registerDirect: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;

  // Todo actions
  fetchTodos: () => Promise<void>;
  createTodo: (title: string, description?: string, file?: File | null) => Promise<void>;
  toggleTodo: (todo: Todo) => Promise<void>;
  updateTodo: (id: string, title: string, description: string) => Promise<void>;
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
          set({ token: res.access_token, authMode: "keycloak" });

          // Fetch profile using Bearer token from FastAPI
          const profile = await api.getMe(res.access_token);
          set({ user: profile, isLoadingAuth: false });
          notify("Welcome back! You’re signed in.");
          get().updateRateLimit();
          get().fetchTodos();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Keycloak login failed";
          set({ authError: msg, isLoadingAuth: false, user: null, token: null });
          notify(msg, "error");
          throw err;
        }
      },

      loginWithKeycloakCode: async (code: string) => {
        set({ isLoadingAuth: true, authError: null });
        try {
          const res = await exchangeCodeForToken(code);
          set({ token: res.access_token, authMode: "keycloak" });

          // Remove ?code=... from browser URL address bar cleanly
          if (typeof window !== "undefined") {
            window.history.replaceState({}, document.title, window.location.pathname);
          }

          // Fetch profile using Bearer token from FastAPI
          const profile = await api.getMe(res.access_token);
          set({ user: profile, isLoadingAuth: false });
          notify("Welcome back! You’re signed in.");
          get().updateRateLimit();
          get().fetchTodos();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Keycloak authorization failed";
          set({ authError: msg, isLoadingAuth: false, user: null, token: null });
          notify(msg, "error");
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
            throw await responseError(res, res.status === 401 ? "Invalid email or password." : "Sign-in could not be completed.");
          }

          await res.json();
          // Verify the browser accepted the HttpOnly cookie before opening the workspace.
          const profile = await api.getMe("");
          set({ user: profile, token: null, authMode: "direct", isLoadingAuth: false });
          notify("Welcome back! You’re signed in.");
          get().updateRateLimit();
          get().fetchTodos();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Direct login failed";
          set({ authError: msg, isLoadingAuth: false, user: null, token: null });
          notify(msg, "error");
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
            throw await responseError(res, "Registration could not be completed.");
          }

          notify("Account created. Signing you in…");
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Registration failed";
          set({ authError: msg, isLoadingAuth: false, user: null, token: null });
          notify(msg, "error");
          throw err;
        }
        await get().loginDirect(email, password);
      },

      logout: async () => {
        const { token, authMode } = get();
        try {
          await fetch(`${API_BASE}/auth/logout`, {
            method: "POST",
            credentials: "include",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
        } catch {
          // Ignore server errors during cleanup
        } finally {
          set({ user: null, token: null, todos: [], authError: null, todosError: null, filter: "all", searchQuery: "" });
          if (authMode === "keycloak" && typeof window !== "undefined") {
            const logoutUrl = getKeycloakLogoutUrl();
            if (logoutUrl) {
              window.location.href = logoutUrl;
              return;
            }
          }
          notify("You’re signed out.", "success");
        }
      },

      refreshProfile: async () => {
        const { token } = get();
        if (!token && get().authMode === "keycloak") return;
        try {
          const profile = await api.getMe(token || "");
          set({ user: profile });
          get().updateRateLimit();
        } catch (err) {
          set({ user: null, token: null, todos: [] });
          notify(err instanceof Error ? err.message : "Please sign in again.", "error");
        }
      },

      fetchTodos: async () => {
        const { token } = get();
        if (!token && get().authMode === "keycloak") return;
        set({ isLoadingTodos: true, todosError: null });
        try {
          const data = await api.getTodos(token || "");
          set({ todos: data, isLoadingTodos: false });
          get().updateRateLimit();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to load todos";
          set({ todosError: msg, isLoadingTodos: false });
          notify(msg, "error");
        }
      },

      createTodo: async (title, description, file) => {
        const { token } = get();
        if (!token && get().authMode === "keycloak") return;
        try {
          let attachmentFields = {};

          if (file) {
            // ── Step 1: Get a one-time signed PUT URL from FastAPI ──────────────
            const { upload_url, s3_key } = await api.presignUpload(
              { file_name: file.name, content_type: file.type || "application/octet-stream" },
              token || ""
            );

            // ── Step 2: PUT raw bytes directly to MinIO (bypasses FastAPI) ──────
            await api.uploadToS3(upload_url, file);

            // ── Step 3: Build the metadata payload for the todo row ─────────────
            attachmentFields = {
              attachment_key: s3_key,
              attachment_name: file.name,
              attachment_size: file.size,
              attachment_content_type: file.type || "application/octet-stream",
            };
          }

          // ── Step 4: Create the todo row in Postgres via FastAPI ───────────────
          const created = await api.createTodo(
            { title, description: description || undefined, ...attachmentFields },
            token || ""
          );
          set((state) => ({ todos: [created, ...state.todos], todosError: null }));
          notify(file ? "Task added with attachment." : "Task added.");
          get().updateRateLimit();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to create task";
          set({ todosError: msg });
          notify(msg, "error");
          throw err;
        }
      },

      toggleTodo: async (todo) => {
        const { token } = get();
        if (!token && get().authMode === "keycloak") return;
        try {
          const updated = await api.updateTodo(
            todo.id,
            { is_completed: !todo.is_completed },
            token || ""
          );
          set((state) => ({
            todos: state.todos.map((t) => (t.id === todo.id ? updated : t)), todosError: null,
          }));
          notify(updated.is_completed ? "Task completed. Nice work!" : "Task marked active.");
          get().updateRateLimit();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to update task";
          set({ todosError: msg });
          notify(msg, "error");
        }
      },

      updateTodo: async (id, title, description) => {
        try {
          const updated = await api.updateTodo(id, { title, description }, get().token || "");
          set((state) => ({ todos: state.todos.map((todo) => todo.id === id ? updated : todo), todosError: null }));
          get().updateRateLimit();
          notify("Task updated.");
        } catch (error) {
          notify(error instanceof Error ? error.message : "Could not update task.", "error");
          throw error;
        }
      },

      deleteTodo: async (id) => {
        const { token } = get();
        if (!token && get().authMode === "keycloak") return;
        try {
          await api.deleteTodo(id, token || "");
          set((state) => ({ todos: state.todos.filter((t) => t.id !== id), todosError: null }));
          notify("Task deleted.");
          get().updateRateLimit();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to delete task";
          set({ todosError: msg });
          notify(msg, "error");
        }
      },
    }),
    {
      name: "homelab-app-storage",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (persisted) => {
        const state = persisted as Pick<AppState, "token" | "authMode" | "user">;
        return { ...state, token: state.authMode === "direct" ? null : state.token };
      },
      partialize: (state) => ({
        token: state.token,
        authMode: state.authMode,
        user: state.user,
      }),
    }
  )
);
