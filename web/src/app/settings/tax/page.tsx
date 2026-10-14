"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowRight, Settings, FileText, Percent } from "lucide-react";

export default function TaxSettingsPage() {
  const router = useRouter();

  const navigateTo = (path: string) => {
    window.location.href = `/plugins/ecommerce-plugin/ui/admin/settings/tax/${path}/index.html`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex gap-4 mb-4">
        <a href="/plugins/ecommerce-plugin/ui/admin/settings/index.html" className="text-sm font-bold hover:underline">← Store Settings</a>
      </div>
      
      <h1 className="text-3xl font-bold">Tax Configuration</h1>
      <p className="text-muted-foreground mb-8">Manage how your store charges and calculates taxes.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card 
          className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all group"
          onClick={() => navigateTo('general')}
        >
          <CardHeader>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Settings className="w-6 h-6 text-blue-600 dark:text-blue-300" />
            </div>
            <CardTitle>General Tax Settings</CardTitle>
            <CardDescription>Configure global tax behaviour and inclusive pricing.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-between items-center text-sm font-medium text-blue-600 dark:text-blue-400">
            Manage Settings <ArrowRight className="w-4 h-4" />
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-purple-500 hover:shadow-md transition-all group"
          onClick={() => navigateTo('classes')}
        >
          <CardHeader>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6 text-purple-600 dark:text-purple-300" />
            </div>
            <CardTitle>Tax Categories</CardTitle>
            <CardDescription>Create categories of taxation applied to your products.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-between items-center text-sm font-medium text-purple-600 dark:text-purple-400">
            Manage Categories <ArrowRight className="w-4 h-4" />
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-green-500 hover:shadow-md transition-all group"
          onClick={() => navigateTo('rules')}
        >
          <CardHeader>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Percent className="w-6 h-6 text-green-600 dark:text-green-300" />
            </div>
            <CardTitle>Tax Rates</CardTitle>
            <CardDescription>Assign actual percentage rates by location and class.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-between items-center text-sm font-medium text-green-600 dark:text-green-400">
            Manage Rates <ArrowRight className="w-4 h-4" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


