import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumia AI Agent",
  description: "Multi-agent AI coding platform powered by BeeLimited and RwaCodex."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}