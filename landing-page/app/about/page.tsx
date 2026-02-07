import {
  Shield,
  Zap,
  Users,
  Code,
  Lock,
  Globe,
  type LucideIcon,
} from "lucide-react";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { SectionHeader } from "@/components/section-header";
import {
  BOT_URL,
  BOT_HANDLE,
  TECH_CARDS,
  VALUES,
  TECH_STACK,
} from "@/lib/constants";

/* ── Icon lookup ──────────────────────────────────────── */

const ICON_MAP: Record<string, LucideIcon> = {
  Lock,
  Zap,
  Globe,
  Code,
  Shield,
  Users,
};

/* ── Page ─────────────────────────────────────────────── */

export default function About() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <Navbar activePage="/about" />

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 text-slate-900 dark:text-white">
            About <span className="gradient-text">Gundwane</span>
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
            A conversational DeFi agent that lives in Telegram. Built for
            humans, powered by cutting-edge blockchain technology.
          </p>
        </div>
      </section>

      {/* ── Mission ─────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 shadow-xl">
            <h2 className="text-3xl font-bold mb-6 text-slate-900 dark:text-white">
              Our Mission
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
              DeFi should be accessible to everyone — not just developers and
              crypto natives. We believe the best interface is no interface at
              all: just natural conversation.
            </p>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
              Gundwane removes the complexity of interacting with blockchain
              networks, DEXs, bridges, and smart contracts. Instead of juggling
              multiple apps, wallets, and interfaces, you simply chat with an AI
              agent that understands your intent and executes on your behalf —
              while you always maintain full custody of your funds.
            </p>
          </div>
        </div>
      </section>

      {/* ── Technology ──────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900">
        <div className="max-w-6xl mx-auto">
          <SectionHeader
            title="Built on Modern Standards"
            subtitle="Powered by the latest blockchain innovations"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {TECH_CARDS.map((card) => {
              const Icon = ICON_MAP[card.icon];
              return (
                <div
                  key={card.title}
                  className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-8 shadow-lg"
                >
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-4">
                    {Icon && (
                      <Icon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    )}
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">
                    {card.title}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Values ──────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <SectionHeader title="Our Values" />

          <div className="space-y-8">
            {VALUES.map((v) => {
              const Icon = ICON_MAP[v.icon];
              return (
                <div key={v.title} className="flex gap-6 items-start">
                  <div className="shrink-0">
                    {Icon && (
                      <Icon className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">
                      {v.title}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {v.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Tech Stack ──────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900">
        <div className="max-w-4xl mx-auto">
          <SectionHeader title="Built With" />

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {TECH_STACK.map((t) => (
              <div
                key={t.name}
                className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl p-6 text-center shadow-lg"
              >
                <div className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  {t.name}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {t.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-12 shadow-2xl">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
            Try Gundwane Today
          </h2>
          <p className="text-xl text-purple-100 mb-8">
            Experience the future of DeFi — right in Telegram
          </p>
          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-white text-purple-600 px-8 py-4 rounded-full hover:bg-purple-50 transition shadow-xl text-lg font-semibold"
          >
            Start Chatting with {BOT_HANDLE}
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
