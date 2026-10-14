"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { TaxRuleForm } from "@/components/TaxRuleForm";
import { ArrowLeft } from "lucide-react";

export default function AddTaxRulePage() {
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const showToast = (message: string, type: "success" | "error") => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSave = async (data: any) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/plugins/ecommerce-plugin/taxes/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.success) {
        showToast("Tax rate created successfully.", "success");
        setTimeout(() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/settings/tax/rules/index.html", 1000);
      } else {
        showToast("Unable to save tax rate. Please try again.", "error");
        setIsSaving(false);
      }
    } catch (e) {
      showToast("Unable to save tax rate. Please try again.", "error");
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 relative">
      <Button variant="ghost" className="mb-4 -ml-4" onClick={() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/settings/tax/rules/index.html"}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Tax Rates
      </Button>
      <h1 className="text-3xl font-bold tracking-tight">Add Tax Rate</h1>
      <TaxRuleForm onSave={handleSave} isSaving={isSaving} />

      {toastMessage && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded shadow-lg text-white font-medium z-50 transition-all ${toastType === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toastMessage}
        </div>
      )}
    </div>
  );
}
