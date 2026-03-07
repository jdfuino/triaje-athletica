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

export const metadata = {
  title: "Silvers Games — Evaluación Física",
  description: "Sistema de triaje de condición física para atletas",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
