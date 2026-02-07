import Link from "next/link";
import { BOT_URL, NAV_ITEMS } from "@/lib/constants";

type NavbarProps = {
  /** Highlight the active page in the nav. */
  activePage?: string;
};

export function Navbar({ activePage }: NavbarProps) {
  return (
    <nav className="fixed top-0 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-50 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="text-2xl font-bold gradient-text">
            Gundwane
          </Link>

          <div className="hidden md:flex space-x-8">
            {NAV_ITEMS.map((item) => {
              const isActive = activePage === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    isActive
                      ? "text-purple-600 dark:text-purple-400 font-semibold"
                      : "text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <a
            href={BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-2 rounded-full hover:from-purple-700 hover:to-indigo-700 transition shadow-lg text-sm font-medium"
          >
            Get Started
          </a>
        </div>
      </div>
    </nav>
  );
}
