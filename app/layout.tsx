import type { Metadata, Viewport } from "next";
import { Work_Sans } from "next/font/google";
import "./globals.css";

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Socio Management System",
  description: "Staffing, timelines y carga del equipo",
};

export const viewport: Viewport = {
  themeColor: "#0092C8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${workSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-canvas font-sans text-navy">{children}</body>
    </html>
  );
}
