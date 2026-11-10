import type { Metadata, Viewport } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import { shopSign } from "@/lib/config";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const title = shopSign();

export const metadata: Metadata = {
  title: {
    default: title,
    template: `%s · ${title}`,
  },
  description: "A little corner of good music. A personal Discogs collection.",
};

export const viewport: Viewport = {
  themeColor: "#f6f3ec",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-ink">
        <div aria-hidden className="grain pointer-events-none fixed inset-0 z-[70]" />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[90] focus:rounded-full focus:bg-amber focus:px-4 focus:py-2 focus:text-ink"
        >
          Skip to the records
        </a>
        {children}
      </body>
    </html>
  );
}
