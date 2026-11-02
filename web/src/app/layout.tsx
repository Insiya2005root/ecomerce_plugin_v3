import './globals.css';
import '@/storefront/styles.css';
import { Geist, Geist_Mono, Lora } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/admin/ThemeToggle";

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontSerif = Lora({
  subsets: ["latin"],
  variable: "--font-serif",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

// Admin pages render inside the OpenExt iframe; navigation comes from the OpenExt sidebar (manifest adminNav).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(fontSans.variable, fontSerif.variable, fontMono.variable)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            try { if (localStorage.getItem('ecommerce-theme') === 'dark') document.documentElement.classList.add('dark'); } catch (e) {}
          `
        }} />
      </head>
      <body className="min-h-screen bg-zinc-50 text-foreground font-sans antialiased dark:bg-background">
        <div className="w-full px-4 py-5 sm:px-6 lg:px-8">
          <main>{children}</main>
        </div>
        <ThemeToggle />
      </body>
    </html>
  );
}
