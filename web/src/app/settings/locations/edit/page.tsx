"use client";

import React, { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { LocationForm } from "@/components/LocationForm";
import { ArrowLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";

function EditLocationInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [initialData, setInitialData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (id) {
      fetch(`/api/plugins/ecommerce-plugin/locations/${id}`)
        .then(r => r.json())
        .then(d => {
          if (d.success) setInitialData(d.location);
        });
    }
  }, [id]);

  const handleSave = async (data: any) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/plugins/ecommerce-plugin/locations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.success) {
        window.location.href = "/plugins/ecommerce-plugin/ui/admin/settings/locations/index.html";
      } else {
        alert("Failed to update location: " + result.message);
        setIsSaving(false);
      }
    } catch (e) {
      alert("Error occurred");
      setIsSaving(false);
    }
  };

  if (!initialData) return <div className="p-10 text-center">Loading location...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <Button variant="ghost" className="mb-4" onClick={() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/settings/locations/index.html"}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Locations
      </Button>
      <h1 className="text-3xl font-bold">Edit Location</h1>
      <LocationForm initialData={initialData} onSave={handleSave} isSaving={isSaving} />
    </div>
  );
}

export default function EditLocationPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
       <EditLocationInner />
    </Suspense>
  );
}
