import { Type } from "@sinclair/typebox";
import { jsonResult } from "openclaw/plugin-sdk";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  defineChain,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { messageWithIntent, toSerializedSignature } from "@mysten/sui/cryptography";
import { publicKeyFromRawBytes } from "@mysten/sui/verify";
import { base58 } from "@scure/base";
import { PrivyClient } from "@privy-io/node";

const PLUGIN_VERSION = "0.2.0";
const LOG_PREFIX = `[defi-agent-plugin v${PLUGIN_VERSION}]`;

function log(msg: string, ...args: unknown[]) {
  console.warn(LOG_PREFIX, msg, ...args);
}

/** Safely parse a value (hex string, decimal string, number, or bigint) into BigInt without precision loss. */
function toBigInt(raw: unknown): bigint {
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "number") return BigInt(raw);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s || s === "0") return 0n;
    // Hex strings (0x...) — pass directly to BigInt which handles them natively
    if (s.startsWith("0x") || s.startsWith("0X")) return BigInt(s);
    // Decimal strings
    return BigInt(s);
  }
  return 0n;
}

const DEFAULT_GAS_SINGLE = BigInt(800000);
const DEFAULT_GAS_BATCH = BigInt(1500000);

type ToolContext = { sessionKey?: string };

const DEBUG = process.env.DEFI_AGENT_DEBUG === "1" || process.env.DEFI_AGENT_DEBUG === "true";

function extractPeerId(sessionKey?: string): string {
  if (!sessionKey) return "default";
  const parts = sessionKey.split(":");
  const dmIdx = parts.indexOf("dm");
  const peerId = dmIdx >= 0 && parts[dmIdx + 1] ? (parts[dmIdx + 1] as string) : "default";
  if (DEBUG) log("sessionKey=%s peerId=%s", sessionKey, peerId);
  return peerId;
}

const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

const DELEGATE_ABI = [
  {
    name: "execute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ type: "bytes" }],
  },
  {
    name: "executeBatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
] as const;

const configSchema = Type.Object({
  backendUrl: Type.Optional(Type.String()),
  delegateContractAddress: Type.Optional(Type.String()),
  chains: Type.Optional(
    Type.Record(
      Type.String(),
      Type.Object({
        rpcUrl: Type.Optional(Type.String()),
        blockExplorerUrl: Type.Optional(Type.String()),
      })
    )
  ),
});

type Config = {
  backendUrl?: string;
  delegateContractAddress?: string;
  chains?: Record<string, { rpcUrl?: string; blockExplorerUrl?: string }>;
};

/** Replace ${VAR_NAME} with process.env.VAR_NAME so RPC URLs can be kept in .env */
function substituteEnv(s: string): string {
  return s.replace(/\$\{([A-Za-z0-9_]+)\}/g, (_, name) => process.env[name] ?? "");
}

function parseConfig(value: unknown): Config {
  if (value == null || typeof value !== "object") return {};
  const o = value as Record<string, unknown>;
  const backendUrl = typeof o.backendUrl === "string" ? o.backendUrl.trim() : undefined;
  const delegateContractAddress = typeof o.delegateContractAddress === "string" ? o.delegateContractAddress.trim() : undefined;
  let chains: Config["chains"];
  if (o.chains != null && typeof o.chains === "object" && !Array.isArray(o.chains)) {
    chains = {};
    for (const [k, v] of Object.entries(o.chains)) {
      if (v != null && typeof v === "object" && !Array.isArray(v)) {
        const c = v as Record<string, unknown>;
        chains[k] = {
          rpcUrl: typeof c.rpcUrl === "string" ? c.rpcUrl.trim() : undefined,
          blockExplorerUrl: typeof c.blockExplorerUrl === "string" ? c.blockExplorerUrl.trim() : undefined,
        };
      }
    }
  }
  return { backendUrl, delegateContractAddress, chains };
}

/** Resolve chain RPC/explorer URLs, substituting ${ENV_VAR} from process.env. Empty after substitute falls back to DEFAULT_CHAINS. */
function resolveChainsWithEnv(chains: Record<string, { rpcUrl?: string; blockExplorerUrl?: string }>): Record<string, { rpcUrl: string; blockExplorerUrl?: string }> {
  const out: Record<string, { rpcUrl: string; blockExplorerUrl?: string }> = {};
  for (const [chainId, c] of Object.entries(chains)) {
    const rpcUrl = (c?.rpcUrl && substituteEnv(c.rpcUrl).trim()) || "";
    const blockExplorerUrl = c?.blockExplorerUrl ? substituteEnv(c.blockExplorerUrl).trim() || undefined : undefined;
    if (rpcUrl) {
      out[chainId] = { rpcUrl, blockExplorerUrl };
    } else if (DEFAULT_CHAINS[chainId]) {
      out[chainId] = DEFAULT_CHAINS[chainId];
    }
  }
  return out;
}

/** Numeric chain ID for Sui (e.g. for LI.FI fromChain/toChain). */
const SUI_CHAIN_ID = 9270000000000000;

const DEFAULT_CHAINS: Record<string, { rpcUrl: string; blockExplorerUrl?: string }> = {
  "1": { rpcUrl: "https://eth.llamarpc.com", blockExplorerUrl: "https://etherscan.io" },
  "11155111": { rpcUrl: "https://rpc.sepolia.org", blockExplorerUrl: "https://sepolia.etherscan.io" },
  "8453": { rpcUrl: "https://mainnet.base.org", blockExplorerUrl: "https://basescan.org" },
  "42161": { rpcUrl: "https://arb1.arbitrum.io/rpc", blockExplorerUrl: "https://arbiscan.io" },
  "137": { rpcUrl: "https://polygon.llamarpc.com", blockExplorerUrl: "https://polygonscan.com" },
  "10": { rpcUrl: "https://mainnet.optimism.io", blockExplorerUrl: "https://optimistic.etherscan.io" },
  [String(SUI_CHAIN_ID)]: { rpcUrl: "https://fullnode.mainnet.sui.io:443", blockExplorerUrl: "https://suiscan.xyz" },
};

const CHAIN_NAMES: Record<string, string> = {
  "1": "Ethereum",
  "11155111": "Sepolia",
  "8453": "Base",
  "42161": "Arbitrum",
  "137": "Polygon",
  "10": "Optimism",
  [String(SUI_CHAIN_ID)]: "Sui",
};

const CHAIN_NATIVE_SYMBOLS: Record<string, string> = {
  "1": "ETH",
  "11155111": "ETH",
  "8453": "ETH",
  "42161": "ETH",
  "137": "POL",
  "10": "ETH",
  [String(SUI_CHAIN_ID)]: "SUI",
};

/** Well-known ERC-20 tokens per chain. Only mainnet chains (skip testnets). */
const KNOWN_TOKENS: Record<string, Array<{ address: Address; symbol: string; decimals: number }>> = {
  "1": [
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", decimals: 6 },
    { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI", decimals: 18 },
    { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC", decimals: 8 },
    { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18 },
  ],
  "8453": [
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
    { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", symbol: "DAI", decimals: 18 },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
    { address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", symbol: "cbBTC", decimals: 8 },
  ],
  "42161": [
    { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6 },
    { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", decimals: 6 },
    { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", symbol: "DAI", decimals: 18 },
    { address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", symbol: "WBTC", decimals: 8 },
    { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", symbol: "WETH", decimals: 18 },
  ],
  "137": [
    { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", symbol: "USDC", decimals: 6 },
    { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", symbol: "USDT", decimals: 6 },
    { address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", symbol: "DAI", decimals: 18 },
    { address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", symbol: "WBTC", decimals: 8 },
    { address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", symbol: "WETH", decimals: 18 },
  ],
  "10": [
    { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", decimals: 6 },
    { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", symbol: "USDT", decimals: 6 },
    { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", symbol: "DAI", decimals: 18 },
    { address: "0x68f180fcCe6836688e9084f035309E29Bf0A2095", symbol: "WBTC", decimals: 8 },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
  ],
};

/** Strategy storage directory (relative to process.cwd()) */
const STRATEGIES_DIR = join(process.cwd(), "workspace", "strategies");

const plugin = {
  id: "defi-agent-plugin",
  name: "DeFi Agent (EIP-7702)",
  description: "Non-custodial DeFi agent: resolve wallet via backend, execute via delegate contract.",
  configSchema,
  register(api: OpenClawPluginApi) {
    log("register() starting");
    const config = parseConfig(api.pluginConfig ?? {});
    const backendUrl = (config.backendUrl || process.env.DEFI_AGENT_BACKEND_URL || "").replace(/\/$/, "");
    const delegateAddress = (config.delegateContractAddress || process.env.DELEGATE_CONTRACT_ADDRESS || "") as Address;
    const botPrivateKey = process.env.BOT_PRIVATE_KEY ?? "";
    const rawChains = config.chains && Object.keys(config.chains).length > 0 ? config.chains : DEFAULT_CHAINS;
    const chains = resolveChainsWithEnv(rawChains);

    log("config backendUrl=%s delegateSet=%s botKeySet=%s chains=%d", backendUrl ? "set" : "NOT SET", !!delegateAddress, !!botPrivateKey, Object.keys(chains).length);
    if (!backendUrl) {
      log("backendUrl not set; defi_get_wallet will fail.");
    }
    if (!delegateAddress || !botPrivateKey) {
      log("BOT_PRIVATE_KEY or DELEGATE_CONTRACT_ADDRESS not set; execute tools will fail.");
    }

    const botAccount = botPrivateKey
      ? privateKeyToAccount((botPrivateKey.startsWith("0x") ? botPrivateKey : `0x${botPrivateKey}`) as Hex)
      : null;

    const suiRpcUrl = chains[String(SUI_CHAIN_ID)]?.rpcUrl ?? process.env.SUI_RPC_URL ?? "https://fullnode.mainnet.sui.io:443";
    const suiNetwork = (process.env.SUI_NETWORK as string) ?? "mainnet";
    const suiClient = new SuiJsonRpcClient({ url: suiRpcUrl, network: suiNetwork });

    const privyAppId = process.env.PRIVY_APP_ID ?? "";
    const privyAppSecret = process.env.PRIVY_APP_SECRET ?? "";
    const privyAuthKey = process.env.PRIVY_AUTHORIZATION_KEY ?? "";
    const privyClient =
      privyAppId && privyAppSecret
        ? new PrivyClient({ appId: privyAppId, appSecret: privyAppSecret })
        : null;

    type WalletData = { address: string | null; suiAddress: string | null; suiWalletId: string | null; suiWalletPublicKey: string | null };

    async function getWalletData(ctx: ToolContext): Promise<WalletData> {
      const peerId = extractPeerId(ctx.sessionKey);
      if (!backendUrl) {
        log("getWalletData skipped: backendUrl not set peerId=%s", peerId);
        return { address: null, suiAddress: null, suiWalletId: null, suiWalletPublicKey: null };
      }
      const url = `${backendUrl}/api/wallet/${encodeURIComponent(peerId)}`;
      try {
        const res = await fetch(url);
        const data = (await res.json()) as { address?: string; suiAddress?: string; suiWalletId?: string; suiWalletPublicKey?: string; error?: string };
        if (!res.ok) return { address: null, suiAddress: null, suiWalletId: null, suiWalletPublicKey: null };
        return {
          address: data.address ?? null,
          suiAddress: data.suiAddress ?? null,
          suiWalletId: data.suiWalletId ?? null,
          suiWalletPublicKey: data.suiWalletPublicKey ?? null,
        };
      } catch (err) {
        log("getWalletData peerId=%s fetch failed:", peerId, err);
        return { address: null, suiAddress: null, suiWalletId: null, suiWalletPublicKey: null };
      }
    }

    async function getWalletAddress(ctx: ToolContext): Promise<Address | null> {
      const data = await getWalletData(ctx);
      return data.address ? (data.address as Address) : null;
    }

    function getPublicClient(chainId: number) {
      const c = chains[String(chainId)] ?? Object.values(chains)[0];
      const rpcUrl = c?.rpcUrl ?? `https://rpc.ankr.com/eth`;
      return createPublicClient({
        chain: getChain(chainId),
        transport: http(rpcUrl),
      });
    }

    function getChain(chainId: number) {
      const c = chains[String(chainId)] ?? Object.values(chains)[0];
      const rpcUrl = (c as { rpcUrl?: string })?.rpcUrl ?? "https://rpc.ankr.com/eth";
      return defineChain({ id: chainId, name: "custom", nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" }, rpcUrls: { default: { http: [rpcUrl] } } });
    }

    function getWalletClient(chainId: number) {
      if (!botAccount) return null;
      const chain = getChain(chainId);
      const c = chains[String(chainId)] ?? Object.values(chains)[0];
      const rpcUrl = (c as { rpcUrl?: string })?.rpcUrl ?? "https://rpc.ankr.com/eth";
      return createWalletClient({
        account: botAccount,
        chain,
        transport: http(rpcUrl),
      });
    }

    const withErrors =
      (handler: (params: Record<string, unknown>) => Promise<unknown>) =>
      async (_toolCallId: string, params: Record<string, unknown>) => {
        try {
          return jsonResult(await handler(params));
        } catch (error) {
          return jsonResult({ error: error instanceof Error ? error.message : String(error) });
        }
      };

    api.registerTool((ctx: ToolContext) => ({
      name: "defi_get_wallet",
      label: "Get user wallet",
      description:
        "Resolve the Telegram user's wallet address from the backend (Privy). Returns address (EVM) and suiAddress when the user has completed setup in the Mini App; otherwise returns ok: false with a hint for the user.",
      parameters: Type.Object({}),
      execute: withErrors(async () => {
        const data = await getWalletData(ctx);
        if (data.address || data.suiAddress) {
          return {
            address: data.address,
            suiAddress: data.suiAddress,
            ok: true,
            message: "Wallet is linked. Use address for EVM and suiAddress for Sui.",
          };
        }
        return {
          address: null,
          suiAddress: null,
          ok: false,
          hint: "No wallet found for this user. They should open the Telegram Mini App, log in with Telegram, and tap 'Activate your DeFi Agent' to link their wallet.",
        };
      }),
    }));

    api.registerTool((ctx: ToolContext) => ({
      name: "defi_get_balance",
      label: "Get balance",
      description: "Get native (ETH) balance for the user's wallet on the given chain.",
      parameters: Type.Object({
        chainId: Type.Number(),
      }),
      execute: withErrors(async (params) => {
        const address = await getWalletAddress(ctx);
        if (!address) throw new Error("No wallet for this user. Ask them to complete setup in the Mini App.");
        const chainId = Number(params.chainId) || 11155111;
        const client = getPublicClient(chainId);
        const balance = await client.getBalance({ address });
        return { address, chainId, balanceWei: balance.toString(), balanceEth: Number(balance) / 1e18 };
      }),
    }));

    api.registerTool((ctx: ToolContext) => ({
      name: "defi_get_sui_balance",
      label: "Get Sui balance",
      description: "Get SUI and token balances for the user's Sui wallet.",
      parameters: Type.Object({}),
      execute: withErrors(async () => {
        const data = await getWalletData(ctx);
        if (!data.suiAddress) throw new Error("No Sui wallet for this user. Ask them to complete setup in the Mini App (Activate and connect Sui).");
        const balance = await suiClient.getBalance({ owner: data.suiAddress });
        const allBalances = await suiClient.getAllBalances({ owner: data.suiAddress });
        const tokens = allBalances.map((b: { coinType: string; totalBalance: string }) => ({
          coinType: b.coinType,
          amount: b.totalBalance,
          symbol: b.coinType.split("::").pop() ?? "unknown",
        }));
        return {
          chainId: SUI_CHAIN_ID,
          suiAddress: data.suiAddress,
          suiBalance: balance.totalBalance,
          suiBalanceMist: balance.totalBalance,
          tokens,
        };
      }),
    }));

    api.registerTool((ctx: ToolContext) => ({
      name: "defi_send_sui_transaction",
      label: "Send Sui transaction",
      description:
        "Sign and submit a Sui transaction using the user's Sui wallet (Privy rawSign). Pass the transaction block bytes (hex) from LI.FI quote or built with @mysten/sui. Returns txDigest and status.",
      parameters: Type.Object({
        transactionBytes: Type.String({ description: "Serialized transaction block bytes (hex with 0x prefix)" }),
        publicKeyBase58: Type.Optional(Type.String({ description: "Sui wallet public key (base58). Omit if backend returns suiWalletPublicKey." })),
      }),
      execute: withErrors(async (params) => {
        const data = await getWalletData(ctx);
        if (!data.suiAddress || !data.suiWalletId) throw new Error("No Sui wallet for this user.");
        if (!privyClient) throw new Error("Privy not configured (PRIVY_APP_ID, PRIVY_APP_SECRET).");
        const txBytesHex = (params.transactionBytes as string).trim().replace(/^0x/, "") as string;
        const rawBytes = Buffer.from(txBytesHex, "hex");
        const intentMessage = messageWithIntent("TransactionData" as "TransactionData", rawBytes);
        const bytesHex = Buffer.from(intentMessage).toString("hex");

        const rawSignRes = await privyClient.wallets().rawSign(data.suiWalletId, {
          params: { bytes: bytesHex, encoding: "hex", hash_function: "blake2b256" },
        });
        const sig = (rawSignRes as { data?: { signature?: string }; signature?: string }).data?.signature ?? (rawSignRes as { signature?: string }).signature ?? "";
        const sigBytes = Buffer.from(sig.startsWith("0x") ? sig.slice(2) : sig, "hex");

        const publicKeyBase58 = (params.publicKeyBase58 as string)?.trim() ?? data.suiWalletPublicKey ?? "";
        if (!publicKeyBase58) throw new Error("Sui wallet public key (base58) required for signing. Backend should return suiWalletPublicKey or pass publicKeyBase58.");
        const publicKey = publicKeyFromRawBytes("ED25519", base58.decode(publicKeyBase58));
        const serializedSig = toSerializedSignature({
          signature: sigBytes,
          signatureScheme: "ED25519",
          publicKey,
        });

        const result = await suiClient.executeTransactionBlock({
          transactionBlock: rawBytes,
          signature: serializedSig,
          options: { showEffects: true },
        });
        const digest = result.digest;
        const explorerUrl = chains[String(SUI_CHAIN_ID)]?.blockExplorerUrl ?? "https://suiscan.xyz";
        return {
          chainId: SUI_CHAIN_ID,
          txDigest: digest,
          status: result.effects?.status?.status ?? "success",
          explorer: `${explorerUrl}/txblock/${digest}`,
        };
      }),
    }));

    api.registerTool((ctx: ToolContext) => ({
      name: "defi_get_portfolio",
      label: "Get multi-chain portfolio",
      description:
        "Get the user's full portfolio across ALL configured chains: native token balances plus major ERC-20 tokens (USDC, USDT, DAI, WBTC, WETH, etc.). Returns aggregated totals and per-chain breakdown. No parameters needed — it checks every chain automatically.",
      parameters: Type.Object({}),
      execute: withErrors(async () => {
        const data = await getWalletData(ctx);
        const address = data.address;
        if (!address && !data.suiAddress) throw new Error("No wallet for this user. Ask them to complete setup in the Mini App.");

        type TokenBalance = { symbol: string; balance: string; decimals: number; address: string };
        type ChainResult = {
          chainId: string;
          chainName: string;
          nativeSymbol: string;
          nativeBalance: string;
          tokens: TokenBalance[];
        };

        const chainResults: ChainResult[] = [];

        // EVM chains only (skip testnet and non-EVM like Sui)
        const evmChainEntries = Object.entries(chains).filter(
          ([id]) => id !== "11155111" && id !== String(SUI_CHAIN_ID) && !Number.isNaN(Number(id))
        );
        const results = await Promise.allSettled(
          address
            ? evmChainEntries.map(async ([chainId]) => {
                const client = getPublicClient(Number(chainId));
            const nativeSymbol = CHAIN_NATIVE_SYMBOLS[chainId] || "ETH";
            const chainName = CHAIN_NAMES[chainId] || `Chain ${chainId}`;

            // Get native balance
            const nativeBal = await client.getBalance({ address: address as Address });

            // Get ERC-20 balances via multicall
            const knownTokens = KNOWN_TOKENS[chainId] || [];
            const tokenBalances: TokenBalance[] = [];

            if (knownTokens.length > 0) {
              try {
                const multicallResults = await client.multicall({
                  contracts: knownTokens.map((t) => ({
                    address: t.address,
                    abi: ERC20_ABI,
                    functionName: "balanceOf",
                    args: [address as Address],
                  })),
                  allowFailure: true,
                });

                for (let i = 0; i < knownTokens.length; i++) {
                  const result = multicallResults[i];
                  if (result && result.status === "success" && result.result) {
                    const raw = BigInt(result.result as unknown as string | bigint);
                    if (raw > 0n) {
                      const token = knownTokens[i]!;
                      tokenBalances.push({
                        symbol: token.symbol,
                        balance: (Number(raw) / 10 ** token.decimals).toString(),
                        decimals: token.decimals,
                        address: token.address,
                      });
                    }
                  }
                }
              } catch (err) {
                log("multicall failed for chain %s: %s", chainId, err);
                // Fall back to individual calls
                for (const token of knownTokens) {
                  try {
                    const bal = await client.readContract({
                      address: token.address,
                      abi: ERC20_ABI,
                      functionName: "balanceOf",
                      args: [address as Address],
                    });
                    const raw = BigInt(bal as bigint);
                    if (raw > 0n) {
                      tokenBalances.push({
                        symbol: token.symbol,
                        balance: (Number(raw) / 10 ** token.decimals).toString(),
                        decimals: token.decimals,
                        address: token.address,
                      });
                    }
                  } catch {
                    // skip failing tokens
                  }
                }
              }
            }

                return {
                  chainId,
                  chainName,
                  nativeSymbol,
                  nativeBalance: (Number(nativeBal) / 1e18).toString(),
                  tokens: tokenBalances,
                };
              })
            : []
        );

        for (const r of results) {
          if (r.status === "fulfilled") {
            chainResults.push(r.value);
          }
        }

        // Sui chain
        if (chains[String(SUI_CHAIN_ID)] && data.suiAddress) {
          try {
            const suiBalance = await suiClient.getBalance({ owner: data.suiAddress });
            const suiAllBalances = await suiClient.getAllBalances({ owner: data.suiAddress });
            const suiTokens: TokenBalance[] = suiAllBalances.map((b: { coinType: string; totalBalance: string }) => ({
              symbol: b.coinType.split("::").pop() ?? "unknown",
              balance: b.totalBalance,
              decimals: 9,
              address: b.coinType,
            }));
            const suiNative = (Number(suiBalance.totalBalance) / 1e9).toString();
            chainResults.push({
              chainId: String(SUI_CHAIN_ID),
              chainName: CHAIN_NAMES[String(SUI_CHAIN_ID)] ?? "Sui",
              nativeSymbol: CHAIN_NATIVE_SYMBOLS[String(SUI_CHAIN_ID)] ?? "SUI",
              nativeBalance: suiNative,
              tokens: suiTokens,
            });
          } catch (err) {
            log("defi_get_portfolio Sui failed: %s", err);
          }
        }

        // Aggregate (EVM native only; exclude Sui)
        let totalNativeEth = 0;
        for (const c of chainResults) {
          if (c.chainId !== String(SUI_CHAIN_ID)) totalNativeEth += parseFloat(c.nativeBalance) || 0;
        }

        return {
          address: address ?? undefined,
          suiAddress: data.suiAddress ?? undefined,
          totalNativeBalanceEth: totalNativeEth.toString(),
          chains: chainResults.filter(
            (c) => parseFloat(c.nativeBalance) > 0 || c.tokens.length > 0
          ),
        };
      }),
    }));

    api.registerTool((ctx: ToolContext) => ({
      name: "defi_check_delegation",
      label: "Check delegation",
      description: "Check if the user's wallet has active EIP-7702 delegation to the DeFi agent contract on the given chain.",
      parameters: Type.Object({
        chainId: Type.Optional(Type.Number()),
      }),
      execute: withErrors(async (params) => {
        const address = await getWalletAddress(ctx);
        if (!address) return { delegated: false, address: null };
        const chainId = Number(params?.chainId) || 11155111;
        const client = getPublicClient(chainId);
        const code = await client.getCode({ address });
        const delegationPrefix = "0xef0100";
        const delegated = !!code && code.startsWith(delegationPrefix as Hex) && code.length === 2 + 6 + 40;
        return { address, chainId, delegated };
      }),
    }));

    api.registerTool((ctx: ToolContext) => ({
      name: "defi_approve",
      label: "Approve ERC-20 token",
      description:
        "Approve an ERC-20 token for spending by a contract (e.g. LI.FI approvalAddress). Pass the token contract address, the spender address (from the LI.FI quote's estimate.approvalAddress), and optionally an amount (defaults to unlimited). This tool handles ABI encoding — do NOT construct approve calldata manually.",
      parameters: Type.Object({
        chainId: Type.Number(),
        token: Type.String({ description: "ERC-20 token contract address" }),
        spender: Type.String({ description: "Address to approve (e.g. LI.FI estimate.approvalAddress)" }),
        amount: Type.Optional(Type.String({ description: "Amount in raw token units (wei). Omit for unlimited approval." })),
        gasLimit: Type.Optional(Type.Union([Type.String(), Type.Number()])),
      }),
      execute: withErrors(async (params) => {
        const userAddress = await getWalletAddress(ctx);
        if (!userAddress) throw new Error("No wallet for this user.");
        if (!botAccount || !delegateAddress) throw new Error("Bot or delegate not configured.");
        const chainId = Number(params.chainId) || 8453;
        const token = (params.token as string).trim() as Address;
        const spender = (params.spender as string).trim() as Address;
        const amount = params.amount ? toBigInt(params.amount) : MAX_UINT256;
        const gas = params.gasLimit ? toBigInt(params.gasLimit) : DEFAULT_GAS_SINGLE;

        // ABI-encode approve(spender, amount) using viem
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [spender, amount],
        });

        // Wrap in delegate execute(token, 0, approveData)
        const calldata = encodeFunctionData({
          abi: DELEGATE_ABI,
          functionName: "execute",
          args: [token, 0n, approveData],
        });

        const walletClient = getWalletClient(chainId);
        if (!walletClient) throw new Error("Wallet client not available.");
        const hash = await walletClient.sendTransaction({
          to: userAddress,
          data: calldata,
          gas,
        });
        log("defi_approve token=%s spender=%s amount=%s tx=%s", token, spender, amount.toString(), hash);
        return { txHash: hash, chainId, token, spender, amount: amount.toString() };
      }),
    }));

    api.registerTool((ctx: ToolContext) => ({
      name: "defi_approve_and_send",
      label: "Approve and send transaction",
      description:
        "Approve an ERC-20 token and send a transaction (e.g. LI.FI bridge/swap) in a single atomic batch. Use this when a LI.FI quote requires token approval (estimate.approvalAddress is set and value is 0x0). Pass the token, spender (approvalAddress), approval amount, and the transactionRequest fields (to, value, data, gasLimit) from the LI.FI quote.",
      parameters: Type.Object({
        chainId: Type.Number(),
        token: Type.String({ description: "ERC-20 token contract address to approve" }),
        spender: Type.String({ description: "Approval spender address (from LI.FI estimate.approvalAddress)" }),
        approveAmount: Type.Optional(Type.String({ description: "Approval amount in raw token units. Omit for unlimited." })),
        to: Type.String({ description: "Target contract for the main transaction (e.g. LI.FI Diamond)" }),
        value: Type.Optional(Type.Union([Type.String(), Type.Number()])),
        data: Type.String({ description: "Transaction calldata (e.g. from LI.FI transactionRequest.data)" }),
        gasLimit: Type.Optional(Type.Union([Type.String(), Type.Number()])),
      }),
      execute: withErrors(async (params) => {
        const userAddress = await getWalletAddress(ctx);
        if (!userAddress) throw new Error("No wallet for this user.");
        if (!botAccount || !delegateAddress) throw new Error("Bot or delegate not configured.");
        const chainId = Number(params.chainId) || 8453;
        const token = (params.token as string).trim() as Address;
        const spender = (params.spender as string).trim() as Address;
        const approveAmount = params.approveAmount ? toBigInt(params.approveAmount) : MAX_UINT256;
        const to = (params.to as string).trim() as Address;
        const value = toBigInt(params.value);
        const data = (params.data as string).trim() as Hex;
        const gas = params.gasLimit ? toBigInt(params.gasLimit) : DEFAULT_GAS_BATCH;

        // ABI-encode approve(spender, amount)
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [spender, approveAmount],
        });

        // Batch: [approve, main tx]
        const calls = [
          { target: token, value: 0n, data: approveData },
          { target: to, value, data },
        ];

        const calldata = encodeFunctionData({
          abi: DELEGATE_ABI,
          functionName: "executeBatch",
          args: [calls],
        });

        const walletClient = getWalletClient(chainId);
        if (!walletClient) throw new Error("Wallet client not available.");
        const hash = await walletClient.sendTransaction({
          to: userAddress,
          data: calldata,
          gas,
        });
        log("defi_approve_and_send token=%s spender=%s to=%s tx=%s", token, spender, to, hash);
        return { txHash: hash, chainId, token, spender, approveAmount: approveAmount.toString() };
      }),
    }));

    api.registerTool((ctx: ToolContext) => ({
      name: "defi_execute",
      label: "Execute call",
      description: "Execute a single call on the user's delegated wallet (bot as operator).",
      parameters: Type.Object({
        chainId: Type.Number(),
        to: Type.String(),
        value: Type.Optional(Type.Union([Type.String(), Type.Number()])),
        data: Type.Optional(Type.String()),
        gasLimit: Type.Optional(Type.Union([Type.String(), Type.Number()])),
      }),
      execute: withErrors(async (params) => {
        const userAddress = await getWalletAddress(ctx);
        if (!userAddress) throw new Error("No wallet for this user.");
        if (!botAccount || !delegateAddress) throw new Error("Bot or delegate not configured.");
        const chainId = Number(params.chainId) || 11155111;
        const to = (params.to as string).trim() as Address;
        const value = toBigInt(params.value);
        const data = (params.data as string)?.trim() ? ((params.data as string).trim() as Hex) : "0x";
        const gas = params.gasLimit ? toBigInt(params.gasLimit) : DEFAULT_GAS_SINGLE;
        const walletClient = getWalletClient(chainId);
        if (!walletClient) throw new Error("Wallet client not available.");
        const calldata = encodeFunctionData({
          abi: DELEGATE_ABI,
          functionName: "execute",
          args: [to, value, data],
        });
        const hash = await walletClient.sendTransaction({
          to: userAddress,
          data: calldata,
          gas,
        });
        return { txHash: hash, chainId };
      }),
    }));

    api.registerTool((ctx: ToolContext) => ({
      name: "defi_execute_batch",
      label: "Execute batch",
      description: "Execute a batch of calls on the user's delegated wallet (e.g. approve + swap).",
      parameters: Type.Object({
        chainId: Type.Number(),
        calls: Type.Array(
          Type.Object({
            target: Type.String(),
            value: Type.Optional(Type.Union([Type.String(), Type.Number()])),
            data: Type.Optional(Type.String()),
          })
        ),
        gasLimit: Type.Optional(Type.Union([Type.String(), Type.Number()])),
      }),
      execute: withErrors(async (params) => {
        const userAddress = await getWalletAddress(ctx);
        if (!userAddress) throw new Error("No wallet for this user.");
        if (!botAccount || !delegateAddress) throw new Error("Bot or delegate not configured.");
        const chainId = Number(params.chainId) || 11155111;
        const calls = (params.calls as Array<{ target: string; value?: string | number; data?: string }>) ?? [];
        if (calls.length === 0) throw new Error("calls array is required and must not be empty.");
        const formatted = calls.map((c) => ({
          target: c.target.trim() as Address,
          value: toBigInt(c.value),
          data: (c.data?.trim() ? c.data.trim() : "0x") as Hex,
        }));
        const gas = params.gasLimit ? toBigInt(params.gasLimit) : DEFAULT_GAS_BATCH;
        const calldata = encodeFunctionData({
          abi: DELEGATE_ABI,
          functionName: "executeBatch",
          args: [formatted],
        });
        const walletClient = getWalletClient(chainId);
        if (!walletClient) throw new Error("Wallet client not available.");
        const hash = await walletClient.sendTransaction({
          to: userAddress,
          data: calldata,
          gas,
        });
        return { txHash: hash, chainId };
      }),
    }));

    api.registerTool((ctx: ToolContext) => ({
      name: "defi_send_transaction",
      label: "Send transaction",
      description:
        "Send a transaction from the user's delegated wallet. Use the transactionRequest format (to, value, data, gasLimit) as returned by LI.FI quote. Always pass gasLimit from the quote to ensure enough gas for DEX swaps.",
      parameters: Type.Object({
        chainId: Type.Number(),
        to: Type.String(),
        value: Type.Optional(Type.Union([Type.String(), Type.Number()])),
        data: Type.Optional(Type.String()),
        gasLimit: Type.Optional(Type.Union([Type.String(), Type.Number()])),
      }),
      execute: withErrors(async (params) => {
        const userAddress = await getWalletAddress(ctx);
        if (!userAddress) throw new Error("No wallet for this user.");
        if (!botAccount || !delegateAddress) throw new Error("Bot or delegate not configured.");
        const chainId = Number(params.chainId) || 11155111;
        const to = (params.to as string).trim() as Address;
        const value = toBigInt(params.value);
        const data = (params.data as string)?.trim() ? ((params.data as string).trim() as Hex) : "0x";
        const gas = params.gasLimit ? toBigInt(params.gasLimit) : DEFAULT_GAS_SINGLE;
        const walletClient = getWalletClient(chainId);
        if (!walletClient) throw new Error("Wallet client not available.");
        const calldata = encodeFunctionData({
          abi: DELEGATE_ABI,
          functionName: "execute",
          args: [to, value, data],
        });
        const hash = await walletClient.sendTransaction({
          to: userAddress,
          data: calldata,
          gas,
        });
        return { txHash: hash, chainId };
      }),
    }));

    // ── Strategy tools ──

    api.registerTool((ctx: ToolContext) => ({
      name: "defi_get_strategy",
      label: "Get user strategy",
      description:
        "Read the user's stored DeFi strategy and preferences (target allocations, slippage, profile mode, personality preferences). Call this silently at the start of every session — no permission needed. Returns null if no strategy is set.",
      parameters: Type.Object({}),
      execute: withErrors(async () => {
        const peerId = extractPeerId(ctx.sessionKey);
        try {
          const filePath = join(STRATEGIES_DIR, `${peerId}.json`);
          const raw = await readFile(filePath, "utf-8");
          return { strategy: JSON.parse(raw), peerId };
        } catch {
          return { strategy: null, peerId, hint: "No strategy set yet. User can set one by telling you their preferences." };
        }
      }),
    }));

    api.registerTool((ctx: ToolContext) => ({
      name: "defi_set_strategy",
      label: "Set user strategy",
      description:
        "Store or update the user's DeFi strategy and preferences. Pass a JSON object with any of: profile (object with mode, description, language, name), allocations (object mapping token symbols to percentages), slippage (number, e.g. 0.10 for 10%), rebalanceFrequency (string), notifications (boolean). Merges with existing strategy.",
      parameters: Type.Object({
        strategy: Type.Object({
          profile: Type.Optional(
            Type.Object({
              mode: Type.Optional(Type.String({ description: "conservative, balanced, or aggressive" })),
              description: Type.Optional(Type.String({ description: "Free-form personality description" })),
              language: Type.Optional(Type.String({ description: "Preferred language (e.g. en, es, it)" })),
              name: Type.Optional(Type.String({ description: "How user wants to be called" })),
            })
          ),
          allocations: Type.Optional(
            Type.Record(Type.String(), Type.Number(), { description: "Target allocation: e.g. { WBTC: 30, ETH: 40, USDC: 30 }" })
          ),
          slippage: Type.Optional(Type.Number({ description: "Custom slippage as decimal, e.g. 0.10 for 10%" })),
          rebalanceFrequency: Type.Optional(Type.String({ description: "How often to check: daily, weekly, etc." })),
          notifications: Type.Optional(Type.Boolean({ description: "Whether to send proactive notifications" })),
        }),
      }),
      execute: withErrors(async (params) => {
        const peerId = extractPeerId(ctx.sessionKey);
        const newStrategy = params.strategy as Record<string, unknown>;
        const filePath = join(STRATEGIES_DIR, `${peerId}.json`);

        // Merge with existing strategy if present
        let existing: Record<string, unknown> = {};
        try {
          const raw = await readFile(filePath, "utf-8");
          existing = JSON.parse(raw);
        } catch {
          // No existing strategy
        }

        // Deep merge profile
        if (newStrategy.profile && existing.profile) {
          newStrategy.profile = { ...(existing.profile as Record<string, unknown>), ...(newStrategy.profile as Record<string, unknown>) };
        }

        const merged = { ...existing, ...newStrategy, updatedAt: new Date().toISOString() };

        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, JSON.stringify(merged, null, 2), "utf-8");
        log("defi_set_strategy peerId=%s saved", peerId);
        return { ok: true, strategy: merged, peerId };
      }),
    }));

    api.registerTool((ctx: ToolContext) => ({
      name: "defi_tx_status",
      label: "Transaction status",
      description: "Check the status of a transaction by hash.",
      parameters: Type.Object({
        chainId: Type.Number(),
        txHash: Type.String(),
      }),
      execute: withErrors(async (params) => {
        const chainId = Number(params.chainId) || 11155111;
        const txHash = (params.txHash as string).trim() as Hex;
        const client = getPublicClient(chainId);
        const receipt = await client.getTransactionReceipt({ hash: txHash });
        if (!receipt) return { txHash, status: "pending" };
        return { txHash, status: receipt.status, blockNumber: receipt.blockNumber.toString() };
      }),
    }));

    log("register() done; 14 tools registered");
  },
};

export { plugin };
export default plugin;
