"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function GeneralTaxSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const [taxesEnabled, setTaxesEnabled] = useState(true);
  const [defaultTaxClassId, setDefaultTaxClassId] = useState("NonTaxable");
  const [pricesIncludeTax, setPricesIncludeTax] = useState(false);
  const [taxShippingByDefault, setTaxShippingByDefault] = useState(false);
  const [displayTaxBreakdown, setDisplayTaxBreakdown] = useState(true);
  const [classes, setClasses] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/plugins/ecommerce-plugin/taxes/migrate", { method: 'POST' }).then(() => {
        Promise.all([
          fetch("/api/plugins/ecommerce-plugin/settings").then(r => r.json()),
          fetch("/api/plugins/ecommerce-plugin/taxes/classes", { cache: "no-store" }).then(r => r.json())
        ]).then(([settingsData, classesData]) => {
          if (settingsData.success && settingsData.settings) {
            setTaxesEnabled(settingsData.settings.taxesEnabled !== false);
            setDefaultTaxClassId(settingsData.settings.defaultTaxClassId || "NonTaxable");
            setPricesIncludeTax(settingsData.settings.pricesIncludeTax === true);
            setTaxShippingByDefault(settingsData.settings.taxShippingByDefault === true);
            setDisplayTaxBreakdown(settingsData.settings.displayTaxBreakdown !== false);
          }
          if (classesData.success) {
            setClasses(classesData.classes);
          }
          setLoading(false);
        });
    });
  }, []);

  const showToast = (message: string, type: "success" | "error") => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        taxesEnabled, defaultTaxClassId, pricesIncludeTax, taxShippingByDefault, displayTaxBreakdown
      };
      const res = await fetch("/api/plugins/ecommerce-plugin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast("Tax settings saved successfully.", "success");
      } else {
        showToast("Unable to save tax settings. Please try again.", "error");
      }
    } catch (e) {
      showToast("Unable to save tax settings. Please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Loading settings...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 relative">
      <Button variant="ghost" className="mb-4 -ml-4" onClick={() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/settings/tax/index.html"}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Tax Configuration
      </Button>
      
      <h1 className="text-3xl font-bold tracking-tight">General Tax Settings</h1>
      
      <Card>
        <CardContent className="space-y-8 pt-6">
          <div className="flex items-center justify-between border-b pb-6">
             <div className="pr-8">
                <h3 className="font-bold text-lg">Enable Taxes</h3>
                <p className="text-sm text-muted-foreground mt-1">Turn tax calculation on or off for the entire store.</p>
             </div>
             <Checkbox checked={taxesEnabled} onCheckedChange={(c: any) => setTaxesEnabled(c as boolean)} className="w-6 h-6" />
          </div>

          <div className="border-b pb-6">
             <label className="font-bold text-lg mb-1 block">Default Tax Category</label>
             <p className="text-sm text-muted-foreground mb-3">Used for products that do not have a specific tax class assigned.</p>
             <Select value={defaultTaxClassId} onValueChange={(val: any) => setDefaultTaxClassId(val || '')}>
                 <SelectTrigger className="max-w-md bg-background"><SelectValue /></SelectTrigger>
                 <SelectContent>
                     <SelectItem value="NonTaxable">Non-Taxable</SelectItem>
                     {classes.filter(c => c.status === 'Active').map(c => (
                         <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                     ))}
                 </SelectContent>
             </Select>
          </div>

          <div className="border-b pb-6">
             <label className="font-bold text-lg mb-1 block">Product Prices</label>
             <p className="text-sm text-muted-foreground mb-3">Choose whether the prices you enter for products already include tax.</p>
             <Select value={pricesIncludeTax ? "true" : "false"} onValueChange={(v: any) => setPricesIncludeTax(v === "true")}>
                 <SelectTrigger className="max-w-md bg-background"><SelectValue /></SelectTrigger>
                 <SelectContent>
                     <SelectItem value="false">Prices Exclude Tax</SelectItem>
                     <SelectItem value="true">Prices Include Tax</SelectItem>
                 </SelectContent>
             </Select>
          </div>

          <div className="flex items-center justify-between border-b pb-6 pt-2">
             <div className="pr-8">
                <h3 className="font-bold text-lg">Tax Shipping</h3>
                <p className="text-sm text-muted-foreground mt-1">Apply tax to shipping charges by default.</p>
             </div>
             <Checkbox checked={taxShippingByDefault} onCheckedChange={(c: any) => setTaxShippingByDefault(c as boolean)} className="w-6 h-6" />
          </div>

          <div className="flex items-center justify-between pt-2">
             <div className="pr-8">
                <h3 className="font-bold text-lg">Show Detailed Tax Breakdown</h3>
                <p className="text-sm text-muted-foreground mt-1">Show individual tax components in cart and order summaries.</p>
             </div>
             <Checkbox checked={displayTaxBreakdown} onCheckedChange={(c: any) => setDisplayTaxBreakdown(c as boolean)} className="w-6 h-6" />
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-end pt-4">
        <Button size="lg" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Tax Settings"}
        </Button>
      </div>

      {toastMessage && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded shadow-lg text-white font-medium z-50 transition-all ${toastType === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toastMessage}
        </div>
      )}
    </div>
  );
}
