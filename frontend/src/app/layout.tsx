import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/Toaster";

export const metadata: Metadata = {
  title: "Daymark — Your personal workspace",
  description: "A calmer place to organize your tasks and make everyday progress.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-primary/20 selection:text-primary">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
