import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Hind_Siliguri, IBM_Plex_Mono } from "next/font/google";
import { AutoLogout } from "@/components/AutoLogout";
import { BackToTop } from "@/components/BackToTop";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});
const bengali = Hind_Siliguri({
  subsets: ["bengali"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-bengali",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Imperial IT | Client Registry",
  description: "The complete IT solution - Institution client database and management console",
  icons: {
    icon: [
      { url: "/database/favicon.ico" },
      { url: "/database/pad.png", type: "image/png" },
    ],
    shortcut: "/database/pad.png",
    apple: "/database/pad.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/database/favicon.ico" sizes="any" />
        <link rel="icon" href="/database/pad.png" type="image/png" />
        <link rel="shortcut icon" href="/database/favicon.ico" />
        <link rel="apple-touch-icon" href="/database/pad.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('theme') === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body
        className={`${sans.variable} ${bengali.variable} ${mono.variable} font-sans min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors antialiased`}
      >
        <AutoLogout />
        {children}
        <BackToTop />
      </body>
    </html>
  );
}
