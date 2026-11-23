import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Korean Macro Economic Perspective",
  description:
    "통계청·관세청·한국은행의 CPI, 수출입, 산업활동, 고용, GDP를 한눈에 요약합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans text-slate-900">
        {children}
      </body>
    </html>
  );
}
