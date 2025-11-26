import type { Metadata } from "next";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";

export const metadata: Metadata = {
  title: "Message Board - Solana dApp",
  description: "A simple message board built on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
