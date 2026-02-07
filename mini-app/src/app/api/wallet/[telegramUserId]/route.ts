import { NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/node";

const PRIVY_APP_ID = process.env.PRIVY_APP_ID ?? "";
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? "";

type LinkedAccount = Record<string, unknown> & { type?: string; chain_type?: string; address?: string };

/** Prefer Privy embedded (wallet_client_type/connector_type), else any ethereum wallet. */
function pickEthereumWallet(accounts: LinkedAccount[]): { address: string } | null {
  const ethereumWallets = accounts.filter(
    (acc) => acc.type === "wallet" && acc.chain_type === "ethereum" && typeof acc.address === "string"
  ) as Array<{ address: string; wallet_client_type?: string; wallet_client?: string; connector_type?: string }>;
  if (ethereumWallets.length === 0) return null;
  const embedded = ethereumWallets.find(
    (w) => w.wallet_client_type === "privy" || w.wallet_client === "privy" || w.connector_type === "embedded"
  );
  return { address: (embedded ?? ethereumWallets[0]).address };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ telegramUserId: string }> }
) {
  let telegramUserId: string | undefined;
  try {
    const p = await params;
    telegramUserId = p.telegramUserId;
    if (!telegramUserId) {
      return NextResponse.json({ error: "telegramUserId required" }, { status: 400 });
    }

    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
      return NextResponse.json({ error: "Privy not configured" }, { status: 500 });
    }

    const privy = new PrivyClient({
      appId: PRIVY_APP_ID,
      appSecret: PRIVY_APP_SECRET,
    });

    const user = await privy.users().getByTelegramUserID({ telegram_user_id: telegramUserId });
    const wallet = pickEthereumWallet(user.linked_accounts as unknown as LinkedAccount[]);
    if (!wallet) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[api/wallet] No ethereum wallet for user", user.id, "linked_accounts:", (user.linked_accounts as unknown as LinkedAccount[]).map((a) => ({ type: a.type, chain_type: a.chain_type })));
      }
      return NextResponse.json({ address: null, isDelegated: false }, { status: 200 });
    }

    return NextResponse.json({
      address: wallet.address,
      isDelegated: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lookup failed";
    console.error("[api/wallet]", telegramUserId ?? "?", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
