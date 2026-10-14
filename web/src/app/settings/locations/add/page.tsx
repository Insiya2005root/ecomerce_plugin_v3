"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { LocationForm } from "@/components/LocationForm";
import { ArrowLeft } from "lucide-react";

export default function AddLocationPage() {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (data: any) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/plugins/ecommerce-plugin/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.success) {
        window.location.href = "/plugins/ecommerce-plugin/ui/admin/settings/locations/index.html";
      } else {
        alert("Failed to create location: " + result.message);
        setIsSaving(false);
      }
    } catch (e) {
      alert("Error occurred");
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <Button variant="ghost" className="mb-4" onClick={() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/settings/locations/index.html"}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Locations
      </Button>
      <h1 className="text-3xl font-bold">Add Location</h1>
      <LocationForm onSave={handleSave} isSaving={isSaving} />
    </div>
  );
}
