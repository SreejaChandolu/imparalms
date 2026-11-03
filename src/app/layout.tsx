import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Impara — Live & Protected LMS Platform",
  description:
    "Next-generation LMS with in-app WebRTC live video classrooms, protected watermarked lecture archives, and precision progress tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="min-h-screen bg-[#04060a] text-slate-100 antialiased selection:bg-[#29d9ff]/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
