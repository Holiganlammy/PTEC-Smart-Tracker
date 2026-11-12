import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Thai, Kanit } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner"

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
});

const kanit = Kanit({
  variable: "--font-kanit",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "PTEC Contractor Portal",
  description: "ระบบแจ้งซ่อมสำหรับผู้รับเหมา PTEC",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${plexThai.variable} ${kanit.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-muted/40">
        {/* ออกแบบสำหรับมือถือเท่านั้น: จำกัดความกว้างเท่าจอโทรศัพท์ */}
        <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background shadow-sm">
          {children}
          <Toaster position="top-center" />
        </div>
      </body>
    </html>
  );
}
