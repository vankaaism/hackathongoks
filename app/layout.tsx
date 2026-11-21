import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ngblu — Latihan Wawancara",
  icons: { icon: "/ngblu-icon.png" },
  description: "Practice speaking through a job interview and review your delivery.",
};

export const viewport: Viewport = {
  themeColor: "#f5f7ff",
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
