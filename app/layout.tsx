import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cermin — Interview Practice",
  description: "Practice speaking through a job interview and review your delivery.",
};

export const viewport: Viewport = {
  themeColor: "#171713",
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
