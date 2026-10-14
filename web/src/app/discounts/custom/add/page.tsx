// @ts-nocheck
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { CustomDiscountBuilder } from "@/components/CustomDiscountBuilder";

export default function AddCustomDiscountPage() {
  const router = useRouter();

  const handleSave = async (ruleData) => {
    try {
      const res = await fetch("/api/plugins/ecommerce-plugin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ruleData),
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = "/plugins/ecommerce-plugin/ui/admin/discounts/custom/index.html";
      } else {
        alert("Error saving rule: " + data.message);
      }
    } catch (e) {
      console.error(e);
      alert("Error saving rule");
    }
  };

  return (
    <div className="py-6">
      <CustomDiscountBuilder onSave={handleSave} />
    </div>
  );
}
