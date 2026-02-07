import { NextResponse } from "next/server";
import {
  createWalletClient,
  createPublicClient,
  http,
  encodeFunctionData,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN_MAP } from "@/lib/chains";

const BOT_PRIVATE_KEY = process.env.BOT_PRIVATE_KEY ?? "";
const DELEGATE_CONTRACT_ADDRESS = (process.env.DELEGATE_CONTRACT_ADDRESS ?? "") as Address;

const initializeOperatorAbi = [
  {
    name: "initializeOperator",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "operator", type: "address" }],
  },
] as const;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const walletAddress = typeof body?.walletAddress === "string" ? (body.walletAddress.trim() as Address) : null;
    const authorizations = Array.isArray(body?.authorizations) ? body.authorizations : null;

    if (!walletAddress || !authorizations || authorizations.length === 0) {
      return NextResponse.json(
        { error: "walletAddress and authorizations (non-empty array) required" },
        { status: 400 }
      );
    }
    if (!BOT_PRIVATE_KEY || !DELEGATE_CONTRACT_ADDRESS) {
      return NextResponse.json({ error: "Bot or delegate not configured" }, { status: 500 });
    }

    const botAccount = privateKeyToAccount(
      (BOT_PRIVATE_KEY.startsWith("0x") ? BOT_PRIVATE_KEY : `0x${BOT_PRIVATE_KEY}`) as Hex
    );

    const initializeOperatorData = encodeFunctionData({
      abi: initializeOperatorAbi,
      functionName: "initializeOperator",
      args: [botAccount.address],
    });

    const results = await Promise.allSettled(
      authorizations.map(async (auth: { chainId: number; contractAddress: string; nonce: number; r: string; s: string; yParity: number }) => {
        const chainId = Number(auth.chainId);
        const conf = CHAIN_MAP[chainId];
        if (!conf) {
          return { chainId, status: "error" as const, error: "Unknown chain" };
        }
        const rpcUrl = process.env[conf.rpcEnvKey];
        if (!rpcUrl) {
          return { chainId, status: "error" as const, error: "RPC not configured", explorer: conf.explorer };
        }

        const walletClient = createWalletClient({
          account: botAccount,
          chain: conf.chain,
          transport: http(rpcUrl),
        });
        const publicClient = createPublicClient({
          chain: conf.chain,
          transport: http(rpcUrl),
        });

        const signedAuth = {
          address: auth.contractAddress as Address,
          chainId,
          nonce: Number(auth.nonce),
          r: auth.r as Hex,
          s: auth.s as Hex,
          yParity: auth.yParity as 0 | 1,
        };

        try {
          const hash = await walletClient.sendTransaction({
            type: "eip7702",
            chainId,
            to: walletAddress,
            data: initializeOperatorData,
            authorizationList: [signedAuth],
            gas: BigInt(200000),
          });

          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          if (receipt.status === "success") {
            return { chainId, txHash: hash, status: "success" as const, explorer: conf.explorer };
          }
          return { chainId, txHash: hash, status: "already_active" as const, explorer: conf.explorer };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes("AlreadyInitialized") || message.includes("revert")) {
            return { chainId, status: "already_active" as const, explorer: conf.explorer };
          }
          return { chainId, status: "error" as const, error: message, explorer: conf.explorer };
        }
      })
    );

    const outputResults = results.map((r) => {
      if (r.status === "fulfilled") return r.value;
      return { chainId: 0, status: "error" as const, error: r.reason?.message ?? "Unknown error" };
    });

    return NextResponse.json({
      walletAddress,
      results: outputResults,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Setup failed";
    console.error("[api/setup]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
