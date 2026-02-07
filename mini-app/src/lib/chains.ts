import {
  sepolia,
  base,
  mainnet,
  arbitrum,
  optimism,
  polygon,
} from "viem/chains";
import type { Chain } from "viem";

export const CHAIN_MAP: Record<
  number,
  { chain: Chain; rpcEnvKey: string; explorer: string }
> = {
  11155111: {
    chain: sepolia,
    rpcEnvKey: "SEPOLIA_RPC_URL",
    explorer: "https://sepolia.etherscan.io",
  },
  8453: {
    chain: base,
    rpcEnvKey: "BASE_RPC_URL",
    explorer: "https://basescan.org",
  },
  1: {
    chain: mainnet,
    rpcEnvKey: "ETH_MAINNET_RPC_URL",
    explorer: "https://etherscan.io",
  },
  42161: {
    chain: arbitrum,
    rpcEnvKey: "ARBITRUM_RPC_URL",
    explorer: "https://arbiscan.io",
  },
  10: {
    chain: optimism,
    rpcEnvKey: "OPTIMISM_RPC_URL",
    explorer: "https://optimistic.etherscan.io",
  },
  137: {
    chain: polygon,
    rpcEnvKey: "POLYGON_RPC_URL",
    explorer: "https://polygonscan.com",
  },
};

export function getSupportedChainIds(): number[] {
  return (process.env.NEXT_PUBLIC_SUPPORTED_CHAIN_IDS ?? "")
    .split(",")
    .map(Number)
    .filter(Boolean);
}
