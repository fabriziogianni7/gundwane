import {
  sepolia,
  base,
  mainnet,
  arbitrum,
  optimism,
  polygon,
} from "viem/chains";
import type { Chain } from "viem";

/** Numeric chain ID for Sui (e.g. for LI.FI fromChain/toChain). */
export const SUI_CHAIN_ID = 9270000000000000;

export type ChainType = "evm" | "sui";

export type ChainConfig = {
  name: string;
  type: ChainType;
  explorer: string;
  /** EVM-only: viem chain object */
  chain?: Chain;
  /** EVM-only: env var name for RPC URL */
  rpcEnvKey?: string;
};

export const CHAIN_MAP: Record<string, ChainConfig> = {
  "11155111": {
    name: "Sepolia",
    type: "evm",
    chain: sepolia,
    rpcEnvKey: "SEPOLIA_RPC_URL",
    explorer: "https://sepolia.etherscan.io",
  },
  "8453": {
    name: "Base",
    type: "evm",
    chain: base,
    rpcEnvKey: "BASE_RPC_URL",
    explorer: "https://basescan.org",
  },
  "1": {
    name: "Ethereum",
    type: "evm",
    chain: mainnet,
    rpcEnvKey: "ETH_MAINNET_RPC_URL",
    explorer: "https://etherscan.io",
  },
  "42161": {
    name: "Arbitrum",
    type: "evm",
    chain: arbitrum,
    rpcEnvKey: "ARBITRUM_RPC_URL",
    explorer: "https://arbiscan.io",
  },
  "10": {
    name: "Optimism",
    type: "evm",
    chain: optimism,
    rpcEnvKey: "OPTIMISM_RPC_URL",
    explorer: "https://optimistic.etherscan.io",
  },
  "137": {
    name: "Polygon",
    type: "evm",
    chain: polygon,
    rpcEnvKey: "POLYGON_RPC_URL",
    explorer: "https://polygonscan.com",
  },
  [String(SUI_CHAIN_ID)]: {
    name: "Sui",
    type: "sui",
    explorer: "https://suiscan.xyz",
  },
};

/** Supported chain keys from env (e.g. "8453,9270000000000000"). "sui" in env is normalized to SUI_CHAIN_ID. */
export function getSupportedChains(): string[] {
  const raw = process.env.NEXT_PUBLIC_SUPPORTED_CHAIN_IDS ?? "";
  return raw
    .split(",")
    .map((s) => (s.trim().toLowerCase() === "sui" ? String(SUI_CHAIN_ID) : s.trim()))
    .filter((s) => s && s in CHAIN_MAP);
}

/** @deprecated Use getSupportedChains() and CHAIN_MAP[key] for EVM chain IDs when needed. */
export function getSupportedChainIds(): number[] {
  return getSupportedChains()
    .filter((key) => CHAIN_MAP[key]?.type === "evm")
    .map(Number)
    .filter((n) => !Number.isNaN(n));
}
