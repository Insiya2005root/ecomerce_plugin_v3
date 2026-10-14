// @ts-nocheck
"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CustomDiscountBuilder } from "@/components/CustomDiscountBuilder";

function EditCustomDiscountInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    if (id) {
      fetch(`/api/plugins/ecommerce-plugin/discounts/${id}`)
        .then(r => r.json())
        .then(d => {
          if (d.success) setInitialData(d.rule);
        });
    }
  }, [id]);

  const handleSave = async (ruleData) => {
    try {
      const res = await fetch(`/api/plugins/ecommerce-plugin/discounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ruleData),
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = "/plugins/ecommerce-plugin/ui/admin/discounts/custom/index.html";
      } else {
        alert("Error updating rule: " + data.message);
      }
    } catch (e) {
      console.error(e);
      alert("Error updating rule");
    }
  };

  if (!initialData) return <div className="p-10 text-center">Loading rule...</div>;

  return <CustomDiscountBuilder initialData={initialData} onSave={handleSave} />;
}

export default function EditCustomDiscountPage() {
  return (
    <div className="py-6">
      <Suspense fallback={<div>Loading...</div>}>
        <EditCustomDiscountInner />
      </Suspense>
    </div>
  );
}
