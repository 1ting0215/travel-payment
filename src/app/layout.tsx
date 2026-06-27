import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Travel Payment",
  description: "旅遊費用分攤記帳工具",
  authors: [{ name: "1ting0215", url: "https://github.com/1ting0215" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">
        {children}
        <footer className="mt-auto py-3 text-center text-xs text-zinc-400">
          &copy; {new Date().getFullYear()}{" "}
          <a
            href="https://github.com/1ting0215"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-600 underline-offset-2 hover:underline"
          >
            1ting0215
          </a>
        </footer>
      </body>
    </html>
  );
}
