"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowRight, Tag, Ticket, Megaphone, Settings2 } from "lucide-react";

export default function DiscountsLandingPage() {
  const router = useRouter();

  const navigateTo = (path: string) => {
    window.location.href = `/plugins/ecommerce-plugin/ui/admin/discounts/${path}/index.html`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Discounts & Promotions</h1>
      <p className="text-muted-foreground mb-8">Manage automatic rules, customer coupons, and marketing campaigns.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: All Discounts (Automatic) */}
        <Card 
          className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all group"
          onClick={() => navigateTo('all')}
        >
          <CardHeader>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Tag className="w-6 h-6 text-blue-600 dark:text-blue-300" />
            </div>
            <CardTitle>All Discounts</CardTitle>
            <CardDescription>Automatic pricing rules and offers</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-between items-center text-sm font-medium text-blue-600 dark:text-blue-400">
            Manage Rules <ArrowRight className="w-4 h-4" />
          </CardContent>
        </Card>

        {/* Card 2: Coupons */}
        <Card 
          className="cursor-pointer hover:border-green-500 hover:shadow-md transition-all group"
          onClick={() => navigateTo('coupons')}
        >
          <CardHeader>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Ticket className="w-6 h-6 text-green-600 dark:text-green-300" />
            </div>
            <CardTitle>Coupons</CardTitle>
            <CardDescription>Customer-entered discount codes</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-between items-center text-sm font-medium text-green-600 dark:text-green-400">
            Manage Coupons <ArrowRight className="w-4 h-4" />
          </CardContent>
        </Card>

        {/* Card 3: Campaigns */}
        <Card 
          className="cursor-pointer hover:border-purple-500 hover:shadow-md transition-all group"
          onClick={() => navigateTo('campaigns')}
        >
          <CardHeader>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Megaphone className="w-6 h-6 text-purple-600 dark:text-purple-300" />
            </div>
            <CardTitle>Campaigns</CardTitle>
            <CardDescription>Group discounts into promotional sales</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-between items-center text-sm font-medium text-purple-600 dark:text-purple-400">
            Manage Campaigns <ArrowRight className="w-4 h-4" />
          </CardContent>
        </Card>

        {/* Card 4: Custom Discounts */}
        <Card 
          className="cursor-pointer hover:border-orange-500 hover:shadow-md transition-all group"
          onClick={() => navigateTo('custom')}
        >
          <CardHeader>
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Settings2 className="w-6 h-6 text-orange-600 dark:text-orange-300" />
            </div>
            <CardTitle>Custom Discounts</CardTitle>
            <CardDescription>Build advanced discounts using your own conditions and actions</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-between items-center text-sm font-medium text-orange-600 dark:text-orange-400">
            Build Rules <ArrowRight className="w-4 h-4" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

