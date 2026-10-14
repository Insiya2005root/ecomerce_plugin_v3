"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function CoreSettingsPage() {
  const [taxRate, setTaxRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/plugins/ecommerce-plugin/settings")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.settings) {
          setTaxRate(data.settings.taxRate || 0);
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    try {
      const res = await fetch("/api/plugins/ecommerce-plugin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxRate })
      });
      const data = await res.json();
      if (data.success) {
        alert("Core settings saved successfully!");
      } else {
        alert("Failed to save settings: " + data.message);
      }
    } catch (e) {
      alert("An error occurred while saving.");
    }
  };

  if (loading) return <div className="p-10 text-center">Loading settings...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <Button variant="ghost" className="mb-4" onClick={() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/settings/index.html"}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Store Settings
      </Button>
      
      <h1 className="text-3xl font-bold">Core Settings</h1>
      <p className="text-muted-foreground mb-8">Tax and general store configuration.</p>

      <Card>
        <CardHeader>
          <CardTitle>Tax Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-bold mb-2 block">Tax Rate (%)</label>
            <Input 
              type="number" 
              value={taxRate} 
              onChange={e => setTaxRate(Number(e.target.value))} 
              className="max-w-[200px]"
            />
            <p className="text-sm text-muted-foreground mt-2">
              The default tax rate applied to taxable products in the cart.
            </p>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-end">
        <Button size="lg" onClick={handleSave}>Save Core Settings</Button>
      </div>
    </div>
  );
}
