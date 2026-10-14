"use client";

import React, { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { TaxClassForm } from "@/components/TaxClassForm";
import { ArrowLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";

function EditTaxClassInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [initialData, setInitialData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const showToast = (message: string, type: "success" | "error") => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    if (id) {
      fetch(`/api/plugins/ecommerce-plugin/taxes/classes/${id}`)
        .then(r => r.json())
        .then(d => {
          if (d.success) setInitialData(d.class);
        });
    }
  }, [id]);

  const handleSave = async (data: any) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/plugins/ecommerce-plugin/taxes/classes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.success) {
        showToast("Tax category updated successfully.", "success");
        setTimeout(() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/settings/tax/classes/index.html", 1000);
      } else { showToast(result.message || "Unable to save tax category. Please try again.", "error");
        setIsSaving(false);
      }
    } catch (e: any) { showToast(e?.message || "Unable to save tax category. Please try again.", "error");
      setIsSaving(false);
    }
  };

  if (!initialData) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 relative">
      <Button variant="ghost" className="mb-4 -ml-4" onClick={() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/settings/tax/classes/index.html"}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Tax Categories
      </Button>
      <h1 className="text-3xl font-bold tracking-tight">Edit Tax Category</h1>
      <TaxClassForm initialData={initialData} onSave={handleSave} isSaving={isSaving} />

      {toastMessage && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded shadow-lg text-white font-medium z-50 transition-all ${toastType === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {toastMessage}
        </div>
      )}
    </div>
  );
}

export default function EditTaxClassPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
       <EditTaxClassInner />
    </Suspense>
  );
}

