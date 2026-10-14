'use client';
import './globals.css';
import '@/storefront/styles.css';
import { useState, useEffect } from 'react';
import { Geist, Geist_Mono, Lora } from "next/font/google";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('ecommerce-theme');
    if (savedTheme === 'dark') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme = !isDark;
    setIsDark(nextTheme);
    if (nextTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('ecommerce-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('ecommerce-theme', 'light');
    }
  };

  return (
    <html lang="en" className={cn(fontSans.variable, fontSerif.variable, fontMono.variable)}>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            if (localStorage.getItem('ecommerce-theme') === 'dark') {
              document.documentElement.classList.add('dark');
            }
          `
        }} />
      </head>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b">
            <h1 className="text-3xl font-bold tracking-tight uppercase">Ecommerce Plugin</h1>
            <div className="flex items-center gap-4">
              {mounted && (
                <Button variant="outline" size="icon" onClick={toggleTheme}>
                  {isDark ? <span>Sun</span> : <span>Moon</span>}
                </Button>
              )}
              <Badge variant="secondary" className="text-sm">v1.0.0</Badge>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex gap-3 mb-8 flex-wrap">
            {[
              { label: 'Dashboard', href: '/plugins/ecommerce-plugin/ui/admin/index.html' },
              { label: 'Products', href: '/plugins/ecommerce-plugin/ui/admin/products/index.html' },
              { label: 'Categories', href: '/plugins/ecommerce-plugin/ui/admin/categories/index.html' },
              { label: 'Orders', href: '/plugins/ecommerce-plugin/ui/admin/orders/index.html' },
              { label: 'Discounts', href: '/plugins/ecommerce-plugin/ui/admin/discounts/index.html' },
              { label: 'Cart Simulator', href: '/plugins/ecommerce-plugin/ui/admin/cart/index.html' },
              { label: 'Settings', href: '/plugins/ecommerce-plugin/ui/admin/settings/index.html' },
              { label: 'Storefront', href: '/plugins/ecommerce-plugin/ui/admin/storefront/index.html' },
            ].map(link => (
              <a key={link.label} href={link.href} className={buttonVariants({variant: "default"})}>{link.label}</a>
            ))}
          </nav>
          
          {/* Page Content */}
          <main>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

