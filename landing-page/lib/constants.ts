/* ── Shared constants & data for the landing page ─────── */

export const BOT_URL = "https://t.me/gundwane_bot";
export const BOT_HANDLE = "@gundwane_bot";

/* ── Navigation ───────────────────────────────────────── */

export type NavItem = { label: string; href: string };

export const NAV_ITEMS: NavItem[] = [
  { label: "Features", href: "#features" },
  { label: "About", href: "/about" },
  { label: "Pricing", href: "#pricing" },
];

/* ── Stats shown below the hero ───────────────────────── */

export type Stat = { value: string; label: string };

export const STATS: Stat[] = [
  { value: "Non-Custodial", label: "You always control your wallet" },
  { value: "6+ Chains", label: "Ethereum, Base, Arbitrum & more" },
  { value: "30+ DEXs", label: "Best rates via LI.FI aggregation" },
];

/* ── Features ─────────────────────────────────────────── */

export type Feature = { icon: string; title: string; description: string };

export const FEATURES: Feature[] = [
  {
    icon: "ArrowRightLeft",
    title: "Swaps & Bridges",
    description:
      "Execute trades across 30+ DEXs and bridge seamlessly between chains. LI.FI finds the best routes automatically.",
  },
  {
    icon: "TrendingUp",
    title: "Portfolio Management",
    description:
      "Check balances across all chains, track your positions, and get insights on your holdings.",
  },
  {
    icon: "Bell",
    title: "Price Alerts",
    description:
      "Get notified when your tokens hit target prices. Never miss an opportunity.",
  },
  {
    icon: "Clock",
    title: "DCA Automation",
    description:
      "Set up dollar-cost averaging plans. The bot executes automatically on your schedule.",
  },
  {
    icon: "Shield",
    title: "Non-Custodial",
    description:
      "Powered by EIP-7702 delegation. Your funds never leave your wallet. Revoke access anytime.",
  },
  {
    icon: "Wallet",
    title: "Multi-Chain",
    description:
      "Works across Ethereum, Base, Arbitrum, Optimism, Polygon, and more. All from one chat.",
  },
];

/* ── How-it-works steps ───────────────────────────────── */

export type Step = { title: string; description: string };

export const STEPS: Step[] = [
  {
    title: "Open the Mini App",
    description:
      "Start a conversation with @gundwane_bot and tap the mini app button. Log in with your Telegram account and create your embedded wallet via Privy.",
  },
  {
    title: "Activate Delegation",
    description:
      "Sign a one-time EIP-7702 authorization. This lets Gundwane execute transactions on your behalf — without ever holding your funds. You can revoke it anytime.",
  },
  {
    title: "Start Trading",
    description:
      'Chat naturally: "Swap 0.1 ETH to USDC", "What\'s my balance?", "Set up weekly DCA for 50 USDC into ETH". Gundwane handles the rest.',
  },
];

/* ── Pricing tiers ────────────────────────────────────── */

export type PricingTier = {
  name: string;
  price: string;
  subtitle: string;
  fee: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
};

export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Starter",
    price: "Free",
    subtitle: "Perfect for casual users and trying out the platform",
    fee: "0.30%",
    features: [
      "All core features",
      "Swaps & bridges",
      "Portfolio tracking",
      "Price alerts",
    ],
    cta: "Get Started",
  },
  {
    name: "Pro",
    price: "$49/year",
    subtitle: "For active traders and DCA enthusiasts",
    fee: "0.10%",
    features: [
      "Everything in Starter",
      "70% lower fees",
      "DCA automation",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
    highlighted: true,
  },
  {
    name: "Whale",
    price: "$199/year",
    subtitle: "For high-volume power users",
    fee: "0.05%",
    features: [
      "Everything in Pro",
      "Best-in-class fees (0.05%)",
      "Custom strategies",
      "Dedicated support",
    ],
    cta: "Go Whale",
  },
];

/* ── About page — technology cards ────────────────────── */

export type TechCard = { icon: string; title: string; description: string };

export const TECH_CARDS: TechCard[] = [
  {
    icon: "Lock",
    title: "EIP-7702 Delegation",
    description:
      "You sign a one-time authorization that lets Gundwane execute transactions on your behalf through a delegate contract. Your private keys never leave your device, and you can revoke access at any time.",
  },
  {
    icon: "Zap",
    title: "LI.FI Integration",
    description:
      "Every swap and bridge goes through LI.FI, which aggregates routes across 30+ DEXs and bridges. You always get the best price, lowest slippage, and fastest execution.",
  },
  {
    icon: "Globe",
    title: "Multi-Chain Native",
    description:
      "Gundwane abstracts away the complexity of different chains. Whether you're on Ethereum, Base, Arbitrum, Optimism, or Polygon, the experience is seamless.",
  },
  {
    icon: "Code",
    title: "Privy Embedded Wallets",
    description:
      'Onboarding is as simple as logging in with Telegram. Privy creates an embedded wallet for you — no seed phrases to write down, no MetaMask to install. Just tap "Activate" and you\'re ready.',
  },
];

/* ── About page — values ──────────────────────────────── */

export type Value = { icon: string; title: string; description: string };

export const VALUES: Value[] = [
  {
    icon: "Shield",
    title: "Non-Custodial First",
    description:
      "We never hold your funds. Ever. Your wallet, your keys, your control. The agent only has permission to execute transactions you approve — and you can revoke at any time.",
  },
  {
    icon: "Users",
    title: "Built for Humans",
    description:
      'No jargon, no complicated UIs, no 20-step guides. Just talk to Gundwane like you\'d talk to a friend: "Swap some ETH for USDC", "What\'s my portfolio worth?"',
  },
  {
    icon: "Zap",
    title: "Transparent & Fair",
    description:
      "Our pricing is simple: a small fee on each swap, collected transparently on-chain via LI.FI. No hidden charges, no surprises.",
  },
];

/* ── About page — tech stack badges ───────────────────── */

export type TechBadge = { name: string; label: string };

export const TECH_STACK: TechBadge[] = [
  { name: "EIP-7702", label: "Delegation" },
  { name: "LI.FI", label: "Swaps & Bridges" },
  { name: "Privy", label: "Embedded Wallets" },
  { name: "OpenClaw", label: "AI Agent Framework" },
  { name: "Solidity", label: "Smart Contracts" },
  { name: "Next.js", label: "Frontend" },
];
