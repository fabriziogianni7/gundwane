"use client";

import { usePrivy, useLoginWithTelegram, useSign7702Authorization } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/extended-chains";
import { useEffect, useMemo, useState } from "react";
import { CHAIN_MAP, getSupportedChains } from "@/lib/chains";

const API_BASE = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_API_BASE ?? "") : "";
const DELEGATE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_DELEGATE_CONTRACT ?? "";

type ChainResult = {
  key: string;
  name: string;
  chainId?: number;
  txHash?: string;
  status: string;
  explorer?: string;
};

export default function Home() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { login: loginWithTelegram } = useLoginWithTelegram();
  const { signAuthorization } = useSign7702Authorization();
  const { createWallet: createExtendedWallet } = useCreateWallet();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<{
    walletAddress?: string;
    results?: ChainResult[];
    error?: string;
  }>({});

  const supportedChainKeys = useMemo(() => getSupportedChains(), []);
  const supportedChains = useMemo(
    () => supportedChainKeys.map((key) => ({ key, conf: CHAIN_MAP[key]! })).filter(({ conf }) => conf),
    [supportedChainKeys]
  );

  const telegramAccount = user?.linkedAccounts?.find((a) => a.type === "telegram");
  const telegramUserId =
    telegramAccount && "telegramUserId" in telegramAccount ? telegramAccount.telegramUserId : undefined;
  const embeddedWallet = user?.linkedAccounts?.find((a) => a.type === "wallet" && (!("chainType" in a) || (a as { chainType?: string }).chainType === "ethereum"));
  const walletAddress =
    embeddedWallet && "address" in embeddedWallet ? (embeddedWallet.address as string) : undefined;
  const hasSuiWallet = !!user?.linkedAccounts?.find(
    (a) => a.type === "wallet" && "chainType" in a && (a as { chainType: string }).chainType === "sui"
  );

  const connectedChains = useMemo(() => {
    const status: Record<string, boolean> = {};
    for (const { key, conf } of supportedChains) {
      if (conf.type === "evm") {
        status[key] = !!walletAddress;
      } else if (conf.type === "sui") {
        status[key] = hasSuiWallet;
      }
    }
    return status;
  }, [supportedChains, walletAddress, hasSuiWallet]);

  const missingChains = useMemo(
    () => supportedChains.filter(({ key }) => !connectedChains[key]),
    [supportedChains, connectedChains]
  );
  const allConnected = missingChains.length === 0;

  const handleActivate = async () => {
    if (supportedChains.length === 0) {
      setResult({ error: "No supported chains configured" });
      setStatus("error");
      return;
    }
    if (supportedChains.some(({ conf }) => conf.type === "evm") && (!walletAddress || !DELEGATE_CONTRACT_ADDRESS)) {
      setResult({ error: "Missing wallet or delegate contract address" });
      setStatus("error");
      return;
    }
    setStatus("loading");
    setResult({});
    const results: ChainResult[] = [];
    try {
      // 1. Create missing non-EVM wallets (e.g. Sui)
      for (const { key, conf } of missingChains) {
        if (conf.type === "sui") {
          try {
            await createExtendedWallet({ chainType: "sui" });
            results.push({ key, name: conf.name, status: "connected" });
          } catch (e) {
            results.push({ key, name: conf.name, status: "error", explorer: conf.explorer });
          }
        }
      }

      // 2. EIP-7702 for all configured EVM chains
      const evmChains = supportedChains.filter(({ conf }) => conf.type === "evm");
      if (evmChains.length > 0 && walletAddress && DELEGATE_CONTRACT_ADDRESS) {
        const supportedChainIds = evmChains.map(({ key }) => Number(key)).filter((n) => !Number.isNaN(n));
        const noncesRes = await fetch(`${API_BASE}/api/nonces?address=${encodeURIComponent(walletAddress)}`);
        const noncesData = await noncesRes.json().catch(() => ({}));
        if (!noncesRes.ok) {
          setResult({ error: noncesData.error ?? "Failed to fetch nonces" });
          setStatus("error");
          return;
        }
        const nonces = noncesData.nonces as Record<string, number>;

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
        const setupResults = (data.results ?? []) as Array<{ chainId: number; txHash?: string; status: string; explorer?: string }>;
        for (const r of setupResults) {
          const conf = CHAIN_MAP[String(r.chainId)];
          results.push({
            key: String(r.chainId),
            name: conf?.name ?? `Chain ${r.chainId}`,
            chainId: r.chainId,
            txHash: r.txHash,
            status: r.status,
            explorer: r.explorer ?? conf?.explorer,
          });
        }
      }

      setResult({ walletAddress: walletAddress ?? undefined, results });
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
          Welcome to Gundwane
        </h1>
        <div className="max-w-sm space-y-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
          <p className="font-medium text-zinc-700 dark:text-zinc-300">
            First steps
          </p>
          <ol className="list-decimal list-inside text-left space-y-2">
            <li>Sign in with Telegram below — we’ll create a wallet for you in this app.</li>
            <li>Tap “Activate” to connect your wallet to the agent on all supported chains.</li>
            <li>Go back to Telegram and chat with the bot to swap, bridge, check balances, set alerts, or run DCA.</li>
          </ol>
          <p>
            The agent can swap and bridge across chains, show your portfolio, set price alerts, and automate DCA — all via simple chat. Your keys stay with you; you can revoke access anytime.
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Gundwane is built on OpenClaw. You can customize your agent’s behavior, skills, and preferences however you want.
          </p>
        </div>
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

      {supportedChains.length > 0 && (
        <ul className="w-full max-w-sm space-y-2 text-left text-sm">
          {supportedChains.map(({ key, conf }) => (
            <li key={key} className="flex items-center justify-between gap-2">
              <span className="text-zinc-600 dark:text-zinc-400">
                {connectedChains[key] ? "✓" : "○"} {conf.name}
                {connectedChains[key] ? " connected" : " not connected"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {status === "idle" && (
        <>
          <div className="max-w-sm space-y-3 text-center text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              Connect all chains below so the agent can swap, bridge, and manage your portfolio on your behalf. You stay in control and can revoke access anytime.
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              Built on OpenClaw — customize your agent however you want.
            </p>
          </div>
          <button
            type="button"
            onClick={handleActivate}
            disabled={supportedChains.length === 0}
            className="rounded-full bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {allConnected ? "All chains connected" : "Activate your DeFi Agent"}
          </button>
        </>
      )}

      {status === "loading" && (
        <p className="text-zinc-600 dark:text-zinc-400">Signing &amp; broadcasting…</p>
      )}

      {status === "success" && result.results && result.results.length > 0 && (
        <div className="max-w-sm space-y-3 text-center">
          <p className="text-emerald-600 dark:text-emerald-400 font-medium">
            Your wallet is ready!
          </p>
          {result.walletAddress && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {result.walletAddress.slice(0, 6)}…{result.walletAddress.slice(-4)}
            </p>
          )}
          <ul className="space-y-1 text-left text-sm">
            {result.results.map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-2">
                <span className="text-zinc-600 dark:text-zinc-400">
                  {r.name}
                  {r.status === "already_active" ? " (already active)" : r.txHash ? " ✓" : r.status === "connected" ? " ✓" : ""}
                </span>
                {r.txHash && r.explorer && (
                  <a
                    href={`${r.explorer}/tx/${r.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline"
                  >
                    View tx
                  </a>
                )}
              </li>
            ))}
          </ul>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Go back to Telegram and chat with the bot: swap, bridge, check portfolio, set alerts, or run DCA. Gundwane is built on OpenClaw — customize your agent however you want.
          </p>
        </div>
      )}

      {status === "success" && (!result.results || result.results.length === 0) && (
        <div className="max-w-sm space-y-3 text-center">
          <p className="text-emerald-600 dark:text-emerald-400 font-medium">
            All set.
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Go back to Telegram and chat with the bot. You can customize your agent (OpenClaw) however you want.
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
