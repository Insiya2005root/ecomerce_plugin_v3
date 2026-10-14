// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductPicker } from "@/components/ProductPicker";

function EditCouponPageContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    type: "percentage",
    value: 0,
    status: "Active",
    startDate: "",
    endDate: "",
    usageLimit: "",
    targetProductIds: [] as string[],
    isAutomatic: false
  });

  useEffect(() => {
    fetch("/api/plugins/ecommerce-plugin/categories").then(res => res.json()).then(data => { if (data.success) setCategories(data.categories); });
    
    if (id) {
      fetch(`/api/plugins/ecommerce-plugin/discounts/${id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.rule) {
            const r = data.rule;
            setFormData({
              name: r.name || "",
              code: r.code || "",
              type: r.type || "percentage",
              value: r.value || 0,
              status: r.status || "Active",
              startDate: r.startDate ? new Date(r.startDate).toISOString().slice(0,16) : "",
              endDate: r.endDate ? new Date(r.endDate).toISOString().slice(0,16) : "",
              usageLimit: r.usageLimit || "",
              targetProductIds: r.targetProductIds || [],
              isAutomatic: false
            });
            setLoading(false);
          }
        });
    }
  }, [id]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (formData.endDate && new Date(formData.endDate) <= new Date(formData.startDate)) {
      alert("End date must be later than start date.");
      return;
    }
    if (!formData.code || formData.code.trim() === "") {
      alert("Please enter a coupon code");
      return;
    }
    
    const payload = {
      ...formData,
      usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : undefined
    };
    
    try {
      const res = await fetch(`/api/plugins/ecommerce-plugin/discounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = "/plugins/ecommerce-plugin/ui/admin/discounts/coupons/index.html";
      } else {
        alert("Failed to save coupon: " + (data.message || "Unknown error"));
      }
    } catch (err: any) {
      alert("Network error: " + err.message);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 mb-20">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Edit Coupon</h1>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Coupon Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Coupon Name (Internal)</Label>
                <Input required placeholder="e.g. Summer Special" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Coupon Code</Label>
                <Input required placeholder="e.g. SUMMER20" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select value={formData.type} onValueChange={val => setFormData({...formData, type: val})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>{formData.type === 'percentage' ? 'Percentage Off (%)' : 'Amount Off'}</Label>
                <Input type="number" required min="0" value={formData.value} onChange={e => setFormData({...formData, value: parseFloat(e.target.value)})} />
              </div>
            </div>
            
            <div className="space-y-2 pt-4">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={val => setFormData({...formData, status: val})}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Start Date & Time</Label>
                <Input type="datetime-local" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>End Date & Time (Optional)</Label>
                <Input type="datetime-local" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage Limits & Targeting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 w-1/2">
              <Label>Total Usage Limit (Optional)</Label>
              <Input type="number" min="1" placeholder="e.g. 100 uses" value={formData.usageLimit} onChange={e => setFormData({...formData, usageLimit: e.target.value})} />
            </div>
            
            <div className="space-y-2">
              <Label>Target Specific Products (Leave empty for entire store)</Label>
              <ProductPicker 
                selectedIds={formData.targetProductIds} 
                onChange={vals => setFormData({...formData, targetProductIds: vals})} 
                categories={categories}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/discounts/coupons/index.html"}>Cancel</Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </div>
  );
}


import { Suspense } from "react";
export default function EditCouponPage() { return <Suspense fallback={<div>Loading...</div>}><EditCouponPageContent /></Suspense>; }
