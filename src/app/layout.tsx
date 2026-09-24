import type { Metadata } from "next";
import { Mukta, Saira, Saira_Semi_Condensed } from "next/font/google";
import "./globals.css";

const mukta = Mukta({ subsets: ["latin", "devanagari"], weight: ["400", "500", "700"], variable: "--f-mukta" });
const saira = Saira({ subsets: ["latin"], weight: "800", style: "italic", variable: "--f-saira" });
const sairaSc = Saira_Semi_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--f-sc" });

export const metadata: Metadata = {
  title: "Brotherhood Mobility",
  description: "Electric scooter rentals. Ride. Earn. Grow.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${mukta.variable} ${saira.variable} ${sairaSc.variable}`}>
      <body>{children}</body>
    </html>
  );
}
