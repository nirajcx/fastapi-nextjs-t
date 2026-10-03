import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Homelab API Dashboard — Keycloak & Redis",
  description: "Next.js + shadcn UI with Keycloak OIDC, FastAPI backend, and Redis rate limiting",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-primary/20 selection:text-primary">
        {children}
      </body>
    </html>
  );
}
