"use client";

import { useState, useEffect } from "react";
import { PrivyProvider } from "@privy-io/react-auth";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <p className="text-zinc-600">Loading…</p>
      </div>
    );
  }

  if (!PRIVY_APP_ID) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 text-center text-zinc-600">
        Set NEXT_PUBLIC_PRIVY_APP_ID to use this app.
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["telegram"],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        appearance: {
          theme: "light",
          accentColor: "#0ea5e9",
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
