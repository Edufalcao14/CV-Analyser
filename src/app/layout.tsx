import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CV Analyser",
  description:
    "Get a blunt, recruiter-grade analysis of your CV against a specific job offer.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
