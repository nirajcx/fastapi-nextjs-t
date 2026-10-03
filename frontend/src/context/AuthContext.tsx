"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { UserProfile, RateLimitInfo } from "@/lib/types";
import { api, loginWithKeycloakPassword, getLatestRateLimit } from "@/lib/api";

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
  rateLimit: RateLimitInfo;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  updateRateLimitInfo: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo>({
    limit: 60,
    remaining: 60,
    reset: 60,
  });

  const updateRateLimitInfo = useCallback(() => {
    setRateLimit({ ...getLatestRateLimit() });
  }, []);

  const refreshProfile = useCallback(async (jwtToken?: string) => {
    const activeToken = jwtToken || token;
    if (!activeToken) return;

    try {
      const profile = await api.getMe(activeToken);
      setUser(profile);
      updateRateLimitInfo();
    } catch (err: unknown) {
      console.error("Failed to load profile:", err);
      if (err instanceof Error && err.message.includes("401")) {
        logout();
      }
    }
  }, [token, updateRateLimitInfo]);

  // Load token from storage on startup
  useEffect(() => {
    const savedToken = localStorage.getItem("kc_token");
    const savedRefresh = localStorage.getItem("kc_refresh");

    if (savedToken) {
      setToken(savedToken);
      setRefreshToken(savedRefresh);
      refreshProfile(savedToken).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [refreshProfile]);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await loginWithKeycloakPassword(username, password);
      setToken(response.access_token);
      setRefreshToken(response.refresh_token);

      localStorage.setItem("kc_token", response.access_token);
      localStorage.setItem("kc_refresh", response.refresh_token);

      await refreshProfile(response.access_token);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    localStorage.removeItem("kc_token");
    localStorage.removeItem("kc_refresh");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        refreshToken,
        isLoading,
        error,
        rateLimit,
        login,
        logout,
        refreshProfile: () => refreshProfile(),
        updateRateLimitInfo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
