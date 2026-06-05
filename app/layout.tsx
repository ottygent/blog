import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RK Tutorials Blog",
  description: "Interactive tutorials on AI systems, automation, architecture, and technical workflows.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
