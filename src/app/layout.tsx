import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "FreshCampaign AI Studio",
  description: "AI-first SaaS to generate branded social campaigns"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

