import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionGuard } from "@/components/SessionGuard";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Embar",
  description: "Personal productivity platform with AI execution layer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <SessionGuard />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
