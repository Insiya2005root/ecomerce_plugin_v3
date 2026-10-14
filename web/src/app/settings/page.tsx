"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowRight, Settings, Truck, MapPin } from "lucide-react";

export default function SettingsLandingPage() {
  const router = useRouter();

  const navigateTo = (path: string) => {
    window.location.href = `/plugins/ecommerce-plugin/ui/admin/settings/${path}/index.html`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <h1 className="text-3xl font-bold">Store Settings</h1>
      <p className="text-muted-foreground mb-8">Manage your store configuration, shipping and fulfilment locations.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card 
          className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all group"
          onClick={() => navigateTo('tax')}
        >
          <CardHeader>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Settings className="w-6 h-6 text-blue-600 dark:text-blue-300" />
            </div>
            <CardTitle>Tax Configuration</CardTitle>
            <CardDescription>Configure tax classes, rates, location rules and shipping taxation.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-between items-center text-sm font-medium text-blue-600 dark:text-blue-400">
            Manage Settings <ArrowRight className="w-4 h-4" />
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-green-500 hover:shadow-md transition-all group"
          onClick={() => navigateTo('shipping')}
        >
          <CardHeader>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Truck className="w-6 h-6 text-green-600 dark:text-green-300" />
            </div>
            <CardTitle>Shipping Settings</CardTitle>
            <CardDescription>Configure delivery pricing and distance calculation</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-between items-center text-sm font-medium text-green-600 dark:text-green-400">
            Configure Shipping <ArrowRight className="w-4 h-4" />
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-purple-500 hover:shadow-md transition-all group"
          onClick={() => navigateTo('locations')}
        >
          <CardHeader>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <MapPin className="w-6 h-6 text-purple-600 dark:text-purple-300" />
            </div>
            <CardTitle>Locations</CardTitle>
            <CardDescription>Manage stores, warehouses and fulfilment points</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-between items-center text-sm font-medium text-purple-600 dark:text-purple-400">
            Manage Locations <ArrowRight className="w-4 h-4" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

