import Link from "next/link";
import {
  Shield,
  TrendingUp,
  Bell,
  ArrowRightLeft,
  Clock,
  Wallet,
  MessageCircle,
  Check,
  type LucideIcon,
} from "lucide-react";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { SectionHeader } from "@/components/section-header";
import {
  BOT_URL,
  BOT_HANDLE,
  FEATURES,
  STATS,
  STEPS,
  PRICING_TIERS,
  type PricingTier,
} from "@/lib/constants";

/* ── Icon lookup (keeps data layer icon-agnostic) ─────── */

const ICON_MAP: Record<string, LucideIcon> = {
  ArrowRightLeft,
  TrendingUp,
  Bell,
  Clock,
  Shield,
  Wallet,
};

/* ── Page ─────────────────────────────────────────────── */

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 text-slate-900 dark:text-white">
              Agentic, Non Custodial, DeFi Assistant
              <br />
              <span className="gradient-text">Right in Telegram</span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 mb-12 max-w-3xl mx-auto">
              Swap, bridge, manage portfolios, set alerts, and automate DCA —
              all through simple conversations.{" "}
              <span className="font-semibold text-purple-600 dark:text-purple-400">
              Powered by OpenClaw & LI.FI
              </span>
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href={BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-4 rounded-full hover:from-purple-700 hover:to-indigo-700 transition shadow-xl text-lg font-semibold"
              >
                <MessageCircle className="w-5 h-5" />
                Chat with {BOT_HANDLE}
              </a>
              <Link
                href="/about"
                className="flex items-center gap-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-8 py-4 rounded-full hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-lg text-lg font-semibold border border-slate-200 dark:border-slate-700"
              >
                Learn More
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {STATS.map((s) => (
                <div
                  key={s.value}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg"
                >
                  <div className="text-4xl font-bold gradient-text mb-2">
                    {s.value}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────── */}
      <section
        id="features"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900"
      >
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            title="Everything You Need"
            subtitle="A full-featured DeFi assistant powered by AI"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((f) => {
              const Icon = ICON_MAP[f.icon];
              return (
                <div
                  key={f.title}
                  className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-8 shadow-lg hover:shadow-xl transition"
                >
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-4">
                    {Icon && (
                      <Icon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    )}
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">
                    {f.title}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    {f.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            title="How It Works"
            subtitle="Get started in 3 simple steps"
          />

          <div className="space-y-8">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex gap-6 items-start">
                <div className="shrink-0 w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                  {i + 1}
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">
                    {step.title}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 text-lg">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────── */}
      <section
        id="pricing"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900"
      >
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            title="Simple, Transparent Pricing"
            subtitle="Fees are collected automatically on-chain via LI.FI — no invoices, no payment hassles"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PRICING_TIERS.map((tier) => (
              <PricingCard key={tier.name} tier={tier} />
            ))}
          </div>

          <p className="mt-12 text-center text-sm text-slate-500">
            Fees are deducted automatically on-chain via LI.FI. No separate
            billing. Cancel anytime.
          </p>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-12 shadow-2xl">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-purple-100 mb-8">
            Join hundreds of users managing their DeFi portfolios through
            Telegram
          </p>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white text-purple-600 px-8 py-4 rounded-full hover:bg-purple-50 transition shadow-xl text-lg font-semibold"
          >
            <MessageCircle className="w-5 h-5" />
            Start Chatting with {BOT_HANDLE}
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ── Pricing card (page-local component) ──────────────── */

function PricingCard({ tier }: { tier: PricingTier }) {
  if (tier.highlighted) {
    return (
      <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl p-8 shadow-2xl scale-105 relative">
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-slate-900 px-4 py-1 rounded-full text-sm font-bold">
          POPULAR
        </span>
        <h3 className="text-2xl font-bold mb-2 text-white">{tier.name}</h3>
        <div className="text-4xl font-bold mb-6 text-white">{tier.price}</div>
        <p className="text-purple-100 mb-6">{tier.subtitle}</p>
        <div className="mb-6">
          <div className="text-3xl font-bold text-white">{tier.fee}</div>
          <div className="text-sm text-purple-100">transaction fee</div>
        </div>
        <ul className="space-y-3 mb-8">
          {tier.features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check className="w-5 h-5 text-white shrink-0 mt-0.5" />
              <span className="text-white">{f}</span>
            </li>
          ))}
        </ul>
        <a
          href={BOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center bg-white text-purple-600 px-6 py-3 rounded-full hover:bg-purple-50 transition font-semibold"
        >
          {tier.cta}
        </a>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-8 shadow-lg">
      <h3 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">
        {tier.name}
      </h3>
      <div className="text-4xl font-bold mb-6 gradient-text">{tier.price}</div>
      <p className="text-slate-600 dark:text-slate-400 mb-6">{tier.subtitle}</p>
      <div className="mb-6">
        <div className="text-3xl font-bold text-slate-900 dark:text-white">
          {tier.fee}
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-400">
          transaction fee
        </div>
      </div>
      <ul className="space-y-3 mb-8">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <span className="text-slate-600 dark:text-slate-400">{f}</span>
          </li>
        ))}
      </ul>
      <a
        href={BOT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white px-6 py-3 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 transition font-semibold"
      >
        {tier.cta}
      </a>
    </div>
  );
}
