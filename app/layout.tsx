import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Payment Recovery Demo",
  description: "Automatic failed-payment recovery for subscriptions, built on Stripe and Resend.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <a href="/" className="brand">Payment Recovery</a>
          <nav><a href="/">How it works</a><a href="/dashboard">Dashboard</a></nav>
        </header>
        <main>{children}</main>
        <footer>Built by Zakariya Mahadalle · Stripe test mode, no real money moves</footer>
      </body>
    </html>
  );
}
