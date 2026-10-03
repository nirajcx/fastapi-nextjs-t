import { Todo, TodoCreateInput, TodoUpdateInput, UserProfile, KeycloakTokenResponse, RateLimitInfo } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const KEYCLOAK_URL = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://192.168.1.3:8080";
const KEYCLOAK_REALM = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "todo-realm";
const KEYCLOAK_CLIENT_ID = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "todo-app";

let lastRateLimit: RateLimitInfo = {
  limit: 60,
  remaining: 60,
  reset: 60,
};

export const getLatestRateLimit = (): RateLimitInfo => lastRateLimit;

export async function loginWithKeycloakPassword(
  username: string,
  password: string
): Promise<KeycloakTokenResponse> {
  const tokenEndpoint = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;

  const body = new URLSearchParams();
  body.append("client_id", KEYCLOAK_CLIENT_ID);
  body.append("grant_type", "password");
  body.append("username", username);
  body.append("password", password);

  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error_description || errorData.error || "Authentication failed. Check credentials.");
  }

  return res.json();
}

export async function refreshKeycloakToken(refreshToken: string): Promise<KeycloakTokenResponse> {
  const tokenEndpoint = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;

  const body = new URLSearchParams();
  body.append("client_id", KEYCLOAK_CLIENT_ID);
  body.append("grant_type", "refresh_token");
  body.append("refresh_token", refreshToken);

  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error("Failed to refresh token");
  }

  return res.json();
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers,
  });

  // Extract rate-limit headers from Redis middleware
  const limitHeader = res.headers.get("X-RateLimit-Limit");
  const remainingHeader = res.headers.get("X-RateLimit-Remaining");
  const resetHeader = res.headers.get("X-RateLimit-Reset");

  if (limitHeader && remainingHeader) {
    lastRateLimit = {
      limit: parseInt(limitHeader, 10),
      remaining: parseInt(remainingHeader, 10),
      reset: resetHeader ? parseInt(resetHeader, 10) : 60,
    };
  }

  if (res.status === 429) {
    throw new Error(`Rate limit exceeded! Please wait ${lastRateLimit.reset}s before trying again.`);
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errBody.detail || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Todos
  getTodos: (token: string): Promise<Todo[]> => apiRequest<Todo[]>("/todos/", { method: "GET" }, token),

  getTodoById: (id: string, token: string): Promise<Todo> =>
    apiRequest<Todo>(`/todos/${id}`, { method: "GET" }, token),

  createTodo: (data: TodoCreateInput, token: string): Promise<Todo> =>
    apiRequest<Todo>("/todos/create", { method: "POST", body: JSON.stringify(data) }, token),

  updateTodo: (id: string, data: TodoUpdateInput, token: string): Promise<Todo> =>
    apiRequest<Todo>(`/todos/update/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),

  deleteTodo: (id: string, token: string): Promise<{ message: string }> =>
    apiRequest<{ message: string }>(`/todos/delete/${id}`, { method: "DELETE" }, token),

  // Auth / User
  getMe: (token: string): Promise<UserProfile> => apiRequest<UserProfile>("/auth/me", { method: "GET" }, token),

  // Backend Health
  getHealth: async (): Promise<{ status: string; db: string }> => {
    const healthUrl = API_BASE.replace("/api/v1", "/health");
    const res = await fetch(healthUrl);
    return res.json();
  },
};
