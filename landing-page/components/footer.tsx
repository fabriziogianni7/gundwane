import Link from "next/link";
import { BOT_URL } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="text-2xl font-bold gradient-text">
              Gundwane
            </Link>
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              Your non-custodial DeFi agent for Telegram. Built with EIP-7702,
              powered by LI.FI.
            </p>
          </div>

          <div>
            <h3 className="font-bold mb-4 text-slate-900 dark:text-white">
              Product
            </h3>
            <ul className="space-y-2 text-slate-600 dark:text-slate-400">
              <li>
                <Link
                  href="/#features"
                  className="hover:text-purple-600 dark:hover:text-purple-400 transition"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="hover:text-purple-600 dark:hover:text-purple-400 transition"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/#pricing"
                  className="hover:text-purple-600 dark:hover:text-purple-400 transition"
                >
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold mb-4 text-slate-900 dark:text-white">
              Connect
            </h3>
            <ul className="space-y-2 text-slate-600 dark:text-slate-400">
              <li>
                <a
                  href={BOT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-purple-600 dark:hover:text-purple-400 transition"
                >
                  Telegram Bot
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-8 text-center text-sm text-slate-500">
          &copy; {new Date().getFullYear()} Gundwane. Built for HackMoney 2026.
        </div>
      </div>
    </footer>
  );
}
