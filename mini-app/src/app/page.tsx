"use client";

import { usePrivy, useLoginWithTelegram, useSign7702Authorization, useWallets } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { CHAIN_MAP, getSupportedChainIds } from "@/lib/chains";

const API_BASE = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_API_BASE ?? "") : "";
const DELEGATE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_DELEGATE_CONTRACT ?? "";

type ChainResult = {
  chainId: number;
  txHash?: string;
  status: string;
  explorer?: string;
};

export default function Home() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { login: loginWithTelegram } = useLoginWithTelegram();
  const { signAuthorization } = useSign7702Authorization();
  const { wallets } = useWallets();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<{
    walletAddress?: string;
    results?: ChainResult[];
    error?: string;
  }>({});

  const telegramAccount = user?.linkedAccounts?.find((a) => a.type === "telegram");
  const telegramUserId =
    telegramAccount && "telegramUserId" in telegramAccount ? telegramAccount.telegramUserId : undefined;
  const embeddedWallet = user?.linkedAccounts?.find((a) => a.type === "wallet");
  const walletAddress =
    embeddedWallet && "address" in embeddedWallet ? (embeddedWallet.address as string) : undefined;

  const handleActivate = async () => {
    if (!walletAddress || !DELEGATE_CONTRACT_ADDRESS) {
      setResult({ error: "Missing wallet or delegate contract address" });
      setStatus("error");
      return;
    }
    const supportedChainIds = getSupportedChainIds();
    if (supportedChainIds.length === 0) {
      setResult({ error: "No supported chains configured" });
      setStatus("error");
      return;
    }
    setStatus("loading");
    setResult({});
    try {
      // 1. Fetch nonces per chain from server
      const noncesRes = await fetch(`${API_BASE}/api/nonces?address=${encodeURIComponent(walletAddress)}`);
      const noncesData = await noncesRes.json().catch(() => ({}));
      if (!noncesRes.ok) {
        setResult({ error: noncesData.error ?? "Failed to fetch nonces" });
        setStatus("error");
        return;
      }
      const nonces = noncesData.nonces as Record<string, number>;

      // 2. Sign one EIP-7702 authorization per chain
      const authorizations: Array<{
        chainId: number;
        contractAddress: string;
        nonce: number;
        r: string;
        s: string;
        yParity: number;
      }> = [];
      for (const chainId of supportedChainIds) {
        const nonce = nonces[String(chainId)] ?? 0;
        const authorization = await signAuthorization(
          {
            contractAddress: DELEGATE_CONTRACT_ADDRESS as `0x${string}`,
            chainId,
            nonce,
          },
          { address: walletAddress }
        );
        const contractAddress =
          (authorization as Record<string, unknown>).contractAddress ??
          (authorization as Record<string, unknown>).address ??
          DELEGATE_CONTRACT_ADDRESS;
        authorizations.push({
          chainId: Number(authorization.chainId),
          contractAddress: String(contractAddress),
          nonce: Number(authorization.nonce),
          r: authorization.r,
          s: authorization.s,
          yParity: authorization.yParity as number,
        });
      }

      // 3. Send all authorizations to the server to broadcast
      const res = await fetch(`${API_BASE}/api/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, authorizations }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ error: data.error ?? data.message ?? `HTTP ${res.status}` });
        setStatus("error");
        return;
      }
      setResult({ walletAddress: data.walletAddress, results: data.results ?? [] });
      setStatus("success");
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : "Request failed" });
      setStatus("error");
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && (window as unknown as { Telegram?: { WebApp?: { ready: () => void } } }).Telegram?.WebApp) {
      (window as unknown as { Telegram: { WebApp: { ready: () => void } } }).Telegram.WebApp.ready();
    }
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <p className="text-zinc-600 dark:text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 px-4 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          DeFi Agent Setup
        </h1>
        <p className="max-w-sm text-center text-zinc-600 dark:text-zinc-400">
          Sign in with Telegram to create your wallet and activate the DeFi agent.
        </p>
        <button
          type="button"
          onClick={() => loginWithTelegram()}
          className="rounded-full bg-[#0088cc] px-6 py-3 font-medium text-white hover:bg-[#0077b5]"
        >
          Login with Telegram
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 px-4 dark:bg-zinc-900">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        DeFi Agent Setup
      </h1>

      {walletAddress && (
        <p className="max-w-sm text-center text-sm text-zinc-600 dark:text-zinc-400">
          Wallet: <span className="font-mono">{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span>
        </p>
      )}

      {status === "idle" && (
        <>
          <p className="max-w-sm text-center text-zinc-600 dark:text-zinc-400">
            One-time setup: delegate your wallet to the DeFi agent so the bot can execute swaps on your behalf. You stay in control and can revoke anytime.
          </p>
          <button
            type="button"
            onClick={handleActivate}
            className="rounded-full bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700"
          >
            Activate your DeFi Agent
          </button>
        </>
      )}

      {status === "loading" && (
        <p className="text-zinc-600 dark:text-zinc-400">Signing &amp; broadcasting…</p>
      )}

      {status === "success" && result.walletAddress && (
        <div className="max-w-sm space-y-3 text-center">
          <p className="text-emerald-600 dark:text-emerald-400 font-medium">
            Your wallet is ready!
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {result.walletAddress.slice(0, 6)}…{result.walletAddress.slice(-4)}
          </p>
          {result.results && result.results.length > 0 && (
            <ul className="space-y-1 text-left text-sm">
              {result.results.map((r) => {
                const conf = CHAIN_MAP[r.chainId];
                const explorer = r.explorer ?? conf?.explorer;
                return (
                  <li key={r.chainId} className="flex items-center justify-between gap-2">
                    <span className="text-zinc-600 dark:text-zinc-400">
                      Chain {r.chainId}
                      {r.status === "already_active" ? " (already active)" : r.txHash ? " ✓" : ""}
                    </span>
                    {r.txHash && explorer && (
                      <a
                        href={`${explorer}/tx/${r.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline"
                      >
                        View tx
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Go back to Telegram and start chatting with the bot.
          </p>
        </div>
      )}

      {status === "error" && result.error && (
        <div className="max-w-sm space-y-2 text-center">
          <p className="text-red-600 dark:text-red-400">{result.error}</p>
          <button
            type="button"
            onClick={() => { setStatus("idle"); setResult({}); }}
            className="text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            Try again
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => logout()}
        className="text-sm text-zinc-500 dark:text-zinc-500"
      >
        Sign out
      </button>
    </div>
  );
}
