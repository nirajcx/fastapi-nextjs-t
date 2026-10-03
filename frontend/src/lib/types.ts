export interface Todo {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface TodoCreateInput {
  title: string;
  description?: string;
  is_completed?: boolean;
}

export interface TodoUpdateInput {
  title?: string;
  description?: string;
  is_completed?: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  is_active: boolean;
}

export interface KeycloakTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: string;
  session_state?: string;
  scope?: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}
