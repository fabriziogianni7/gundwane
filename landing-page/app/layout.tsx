import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gundwane - Your Non-Custodial DeFi Agent",
  description:
    "A conversational DeFi agent for Telegram. Swap, bridge, manage your portfolio, set alerts, and automate DCA - all without giving up custody.",
  keywords: ["DeFi", "Telegram", "Non-custodial", "Crypto", "Web3", "EIP-7702", "LI.FI"],
  openGraph: {
    title: "Gundwane - Your Non-Custodial DeFi Agent",
    description:
      "A conversational DeFi agent for Telegram. Swap, bridge, manage your portfolio, set alerts, and automate DCA.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
