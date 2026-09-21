import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://chatstory-studio.vercel.app"),
  title: "ChatStory Studio — Viral Short Video Generator",
  description: "Generate 5 viral TikTok, Instagram Reels & YouTube Shorts videos at once from title ideas. AI-powered with Mistral, Puter, Buffer integration.",
  openGraph: {
    title: "ChatStory Studio",
    description: "Batch-generate viral chat story videos for TikTok, Instagram & YouTube",
    images: ["/og-image.jpg"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <head>
        <script src="https://js.puter.com/v2/" defer></script>
      </head>
      <body className="bg-gray-950 text-white antialiased">{children}</body>
    </html>
  );
}
