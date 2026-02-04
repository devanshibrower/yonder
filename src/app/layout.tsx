import type { Metadata } from "next";
import localFont from "next/font/local";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const georgia = localFont({
  src: "../../public/fonts/Georgia.ttf",
  variable: "--font-georgia",
});

const space_grotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Yonder",
  description: "A meteor shower tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${georgia.variable} ${space_grotesk.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
