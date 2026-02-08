import { NextResponse } from "next/server";
import { createPublicClient, http, type Address } from "viem";
import { CHAIN_MAP, getSupportedChainIds } from "@/lib/chains";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address")?.trim() as Address | undefined;
    if (!address || !address.startsWith("0x")) {
      return NextResponse.json(
        { error: "address query parameter required (0x...)" },
        { status: 400 }
      );
    }

    const supportedChainIds = getSupportedChainIds();
    if (supportedChainIds.length === 0) {
      return NextResponse.json(
        { error: "No supported chains configured (NEXT_PUBLIC_SUPPORTED_CHAIN_IDS)" },
        { status: 500 }
      );
    }

    const results = await Promise.all(
      supportedChainIds.map(async (chainId) => {
        const conf = CHAIN_MAP[String(chainId)];
        if (!conf || conf.type !== "evm" || !conf.rpcEnvKey) return { chainId, nonce: 0 };
        const rpcUrl = process.env[conf.rpcEnvKey];
        if (!rpcUrl) return { chainId, nonce: 0 };
        const client = createPublicClient({
          transport: http(rpcUrl),
        });
        const nonce = await client.getTransactionCount({ address });
        return { chainId, nonce };
      })
    );

    const nonces: Record<string, number> = {};
    for (const { chainId, nonce } of results) {
      nonces[String(chainId)] = nonce;
    }

    return NextResponse.json({ nonces });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch nonces";
    console.error("[api/nonces]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
