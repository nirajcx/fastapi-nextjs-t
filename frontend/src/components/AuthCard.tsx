"use client";

import React, { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { KeyRound, Server, AlertCircle, ArrowRight, UserPlus, Sparkles } from "lucide-react";

export function AuthCard() {
  const {
    authMode,
    setAuthMode,
    loginKeycloak,
    loginDirect,
    registerDirect,
    isLoadingAuth,
    authError,
    clearErrors,
  } = useAppStore();

  // Keycloak inputs
  const [kcUsername, setKcUsername] = useState("");
  const [kcPassword, setKcPassword] = useState("");

  // Direct API inputs
  const [directEmail, setDirectEmail] = useState("");
  const [directUsername, setDirectUsername] = useState("");
  const [directPassword, setDirectPassword] = useState("");
  const [directTab, setDirectTab] = useState<"login" | "register">("login");

  const handleKeycloakLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginKeycloak(kcUsername, kcPassword);
  };

  const handleDirectAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (directTab === "login") {
      await loginDirect(directEmail, directPassword);
    } else {
      await registerDirect(directEmail, directUsername, directPassword);
    }
  };

  const fillKeycloakDemo = () => {
    setKcUsername("niraj");
    setKcPassword("password123");
  };

  const fillDirectDemo = () => {
    setDirectEmail("test@example.com");
    setDirectUsername("testuser");
    setDirectPassword("password123");
  };

  return (
    <Card className="w-full max-w-md mx-auto border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center mb-3 shadow-lg shadow-indigo-500/25">
          {authMode === "keycloak" ? (
            <KeyRound className="w-6 h-6 text-white" />
          ) : (
            <Server className="w-6 h-6 text-white" />
          )}
        </div>
        <CardTitle className="text-xl font-bold">
          {authMode === "keycloak" ? "Keycloak OIDC Sign In" : "Direct API Authentication"}
        </CardTitle>
        <CardDescription className="text-xs">
          {authMode === "keycloak"
            ? "Authenticating with Homelab Keycloak (todo-realm)"
            : "Direct FastAPI sessions with Redis caching"}
        </CardDescription>

        {/* Mode Selector */}
        <div className="flex justify-center gap-2 pt-3">
          <Badge
            variant={authMode === "keycloak" ? "indigo" : "outline"}
            className="cursor-pointer px-3 py-1 text-xs"
            onClick={() => {
              setAuthMode("keycloak");
              clearErrors();
            }}
          >
            🟣 Keycloak OIDC
          </Badge>
          <Badge
            variant={authMode === "direct" ? "emerald" : "outline"}
            className="cursor-pointer px-3 py-1 text-xs"
            onClick={() => {
              setAuthMode("direct");
              clearErrors();
            }}
          >
            ⚡ Direct FastAPI API
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error Alert */}
        {authError && (
          <div className="flex items-center gap-2 p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        {/* Mode 1: Keycloak Login */}
        {authMode === "keycloak" ? (
          <form onSubmit={handleKeycloakLogin} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Username / Email</label>
              <Input
                type="text"
                placeholder="niraj"
                value={kcUsername}
                onChange={(e) => setKcUsername(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Password</label>
              <Input
                type="password"
                placeholder="••••••••••••"
                value={kcPassword}
                onChange={(e) => setKcPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium"
              disabled={isLoadingAuth}
            >
              {isLoadingAuth ? (
                "Authenticating with Keycloak..."
              ) : (
                <>
                  <span>Sign In via Keycloak</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>
        ) : (
          /* Mode 2: Direct API Login / Register */
          <div className="space-y-3">
            <Tabs
              value={directTab}
              onValueChange={(val) => {
                setDirectTab(val as "login" | "register");
                clearErrors();
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="pt-2">
                <form onSubmit={handleDirectAuth} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Email</label>
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      value={directEmail}
                      onChange={(e) => setDirectEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Password</label>
                    <Input
                      type="password"
                      placeholder="••••••••••••"
                      value={directPassword}
                      onChange={(e) => setDirectPassword(e.target.value)}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoadingAuth}>
                    {isLoadingAuth ? "Logging in..." : "Sign In to API"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="pt-2">
                <form onSubmit={handleDirectAuth} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Email</label>
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      value={directEmail}
                      onChange={(e) => setDirectEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Username</label>
                    <Input
                      type="text"
                      placeholder="myusername"
                      value={directUsername}
                      onChange={(e) => setDirectUsername(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Password</label>
                    <Input
                      type="password"
                      placeholder="••••••••••••"
                      value={directPassword}
                      onChange={(e) => setDirectPassword(e.target.value)}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoadingAuth}>
                    {isLoadingAuth ? "Creating account..." : "Register & Sign In"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0 flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full text-xs text-muted-foreground hover:text-foreground"
          onClick={authMode === "keycloak" ? fillKeycloakDemo : fillDirectDemo}
        >
          <Sparkles className="w-3.5 h-3.5 mr-1 text-primary" />
          Fill Test Credentials (niraj / password123)
        </Button>
      </CardFooter>
    </Card>
  );
}
