import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FPS Arena - 3D First Person Shooter",
  description: "A 3D first-person shooter game built with Next.js and Three.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-black text-white overflow-hidden">
        {children}
      </body>
    </html>
  );
}
