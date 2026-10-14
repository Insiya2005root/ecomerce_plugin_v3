// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductPicker } from "@/components/ProductPicker";


export default function AddDiscountPage() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [existingRules, setExistingRules] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    isAutomatic: true,
    code: "",
    type: "percentage",
    value: 0,
    status: "Active",
    usageLimit: "",
    targetProductIds: [] as string[],
    buyXGetY: { 
      buyTargetType: 'SpecificProduct', 
      buyTargetIds: [] as string[], 
      buyQuantity: 1, 
      rewardTargetType: 'SpecificProduct', 
      rewardTargetIds: [] as string[], 
      rewardQuantity: 1, 
      rewardType: 'Free', 
      rewardValue: 100, 
      repeat: false },
      campaign: { childRuleIds: [] as string[], storefrontDisplay: true, marketingHeading: '', description: '' },
      spendXGetY: {
        minSpend: 5000,
        rewardType: 'FixedAmount',
        rewardValue: 500,
        rewardTargetIds: [] as string[],
        maxDiscount: undefined as number | undefined,
        repeat: false
      }
  });

  useEffect(() => {
    // Fetch products for the targeting dropdown
    fetch("/api/plugins/ecommerce-plugin/products").then(res => res.json()).then(data => {
        if (data.success) setProducts(data.products);
      fetch("/api/plugins/ecommerce-plugin/categories").then(res => res.json()).then(data => { if (data.success) setCategories(data.categories); });
      fetch("/api/plugins/ecommerce-plugin/discounts").then(res => res.json()).then(data => {
        if (data.success) setExistingRules(data.rules.filter((r:any) => r.type !== 'campaign'));
      });
      });
  }, []);

  const handleProductToggle = (productId: string) => {
    setFormData(prev => {
      const isSelected = prev.targetProductIds.includes(productId);
      return {
        ...prev,
        targetProductIds: isSelected 
          ? prev.targetProductIds.filter(id => id !== productId)
          : [...prev.targetProductIds, productId]
      };
    });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (formData.endDate && new Date(formData.endDate) <= new Date(formData.startDate)) {
      alert("End date must be later than start date.");
      return;
    }
    const payload = {
      ...formData,
      usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : undefined
    };
    if (payload.type === 'campaign' && (!payload.campaign.childRuleIds || payload.campaign.childRuleIds.length === 0)) {
        alert("Campaigns require at least 1 child discount.");
        return;
      }
      if (payload.isAutomatic) {
      delete payload.code;
    } else if (!payload.code || payload.code.trim() === "") {
      alert("Please enter a coupon code");
      return;
    }
    
    try {
      const res = await fetch("/api/plugins/ecommerce-plugin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = "/plugins/ecommerce-plugin/ui/admin/discounts/all/index.html";
      } else {
        alert("Failed to save discount: " + (data.message || "Unknown error"));
      }
    } catch (err: any) {
      alert("Network error: " + err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 mb-20">
      <h1 className="text-3xl font-bold">Create Automatic Discount</h1>
      
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Core Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Start Date & Time *</Label>
                <Input type="datetime-local" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>End Date & Time (Optional)</Label>
                <Input type="datetime-local" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Discount Name (Internal)</Label>
              <Input required placeholder="e.g. Summer Sale" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>

            <div className="flex items-center space-x-2">
              <input type="checkbox" style={{display:'none'}} checked={formData.isAutomatic} onChange={e => setFormData({...formData, isAutomatic: e.target.checked})} className="w-5 h-5" />
              <Label style={{display:'none'}}>Apply Automatically</Label>
            </div>

            {false && (
              <div className="space-y-2">
                <Label>Coupon Code</Label>
                <Input required={!formData.isAutomatic} placeholder="e.g. SUMMER20" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
              </div>
            )}

            <div className="space-y-2">
              <Label>Discount Type</Label>
              <Select value={formData.type} onValueChange={val => setFormData({...formData, type: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed_amount">Fixed Amount (₹)</SelectItem>
                  <SelectItem value="buy_x_get_y">Buy X Get Y (BOGO)</SelectItem>
                  <SelectItem value="spend_x_get_y">Spend X Get Y</SelectItem>
                  
                </SelectContent>
              </Select>
            </div>

            {(formData.type === 'percentage' || formData.type === 'fixed_amount') && (
              <div className="space-y-2">
                <Label>Discount Value</Label>
                <Input type="number" required value={formData.value} onChange={e => setFormData({...formData, value: parseFloat(e.target.value)})} />
              </div>
            )}

            {formData.type === 'buy_x_get_y' && (
              <div className="space-y-6 border p-6 rounded bg-muted/50 mt-4">
                <div className="space-y-4 border-b pb-4">
                  <h3 className="font-bold text-lg">BUY X (Condition)</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Target Type</Label>
                      <Select value={formData.buyXGetY.buyTargetType} onValueChange={v => setFormData({...formData, buyXGetY: {...formData.buyXGetY, buyTargetType: v, buyTargetIds: []}})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SpecificProduct">Specific Product</SelectItem>
                          <SelectItem value="MultipleProducts">Multiple Products</SelectItem>
                          <SelectItem value="Category">Category</SelectItem>
                          <SelectItem value="EntireStore">Entire Store</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantity Required</Label>
                      <Input type="number" min="1" value={formData.buyXGetY.buyQuantity} onChange={e => setFormData({...formData, buyXGetY: {...formData.buyXGetY, buyQuantity: parseInt(e.target.value) || 1}})} />
                    </div>
                  </div>
                  
                  {(formData.buyXGetY.buyTargetType === 'SpecificProduct' || formData.buyXGetY.buyTargetType === 'MultipleProducts') && (
                    <div className="space-y-2 mt-2">
                      <Label>Select Product(s)</Label>
                      <ProductPicker 
                        selectedIds={formData.buyXGetY.buyTargetIds} 
                        onChange={vals => setFormData({...formData, buyXGetY: {...formData.buyXGetY, buyTargetIds: vals}})} 
                        categories={categories}
                      />
                    </div>
                  )}

                  {formData.buyXGetY.buyTargetType === 'Category' && (
                    <div className="space-y-2 mt-2">
                      <Label>Select Category</Label>
                      <select multiple className="w-full border rounded p-2 min-h-[100px]" value={formData.buyXGetY.buyTargetIds} onChange={e => {
                        const vals = Array.from(e.target.selectedOptions, o => o.value);
                        setFormData({...formData, buyXGetY: {...formData.buyXGetY, buyTargetIds: vals}});
                      }}>
                        {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-lg">GET Y (Reward)</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Reward Target Type</Label>
                      <Select value={formData.buyXGetY.rewardTargetType} onValueChange={v => setFormData({...formData, buyXGetY: {...formData.buyXGetY, rewardTargetType: v, rewardTargetIds: []}})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SpecificProduct">Specific Product</SelectItem>
                          <SelectItem value="MultipleProducts">Multiple Products</SelectItem>
                          <SelectItem value="Category">Category</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Reward Quantity</Label>
                      <Input type="number" min="1" value={formData.buyXGetY.rewardQuantity} onChange={e => setFormData({...formData, buyXGetY: {...formData.buyXGetY, rewardQuantity: parseInt(e.target.value) || 1}})} />
                    </div>
                  </div>

                  {(formData.buyXGetY.rewardTargetType === 'SpecificProduct' || formData.buyXGetY.rewardTargetType === 'MultipleProducts') && (
                    <div className="space-y-2 mt-2">
                      <Label>Select Reward Product(s)</Label>
                      <ProductPicker 
                        selectedIds={formData.buyXGetY.rewardTargetIds} 
                        onChange={vals => setFormData({...formData, buyXGetY: {...formData.buyXGetY, rewardTargetIds: vals}})} 
                        categories={categories}
                      />
                    </div>
                  )}

                  {formData.buyXGetY.rewardTargetType === 'Category' && (
                    <div className="space-y-2 mt-2">
                      <Label>Select Reward Category</Label>
                      <select multiple className="w-full border rounded p-2 min-h-[100px]" value={formData.buyXGetY.rewardTargetIds} onChange={e => {
                        const vals = Array.from(e.target.selectedOptions, o => o.value);
                        setFormData({...formData, buyXGetY: {...formData.buyXGetY, rewardTargetIds: vals}});
                      }}>
                        {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="space-y-2">
                      <Label>Reward Type</Label>
                      <Select value={formData.buyXGetY.rewardType} onValueChange={v => setFormData({...formData, buyXGetY: {...formData.buyXGetY, rewardType: v}})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Free">Free (100% Off)</SelectItem>
                          <SelectItem value="PercentageOff">Percentage Off</SelectItem>
                          <SelectItem value="FixedAmountOff">Fixed Amount Off</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.buyXGetY.rewardType !== 'Free' && (
                      <div className="space-y-2">
                        <Label>Reward Value</Label>
                        <Input type="number" min="0" value={formData.buyXGetY.rewardValue} onChange={e => setFormData({...formData, buyXGetY: {...formData.buyXGetY, rewardValue: parseFloat(e.target.value) || 0}})} />
                      </div>
                    )}
                  </div>

                  <div className="col-span-2 flex items-center space-x-2 mt-4 pt-4 border-t">
                    <input type="checkbox" checked={formData.buyXGetY.repeat} onChange={e => setFormData({...formData, buyXGetY: {...formData.buyXGetY, repeat: e.target.checked}})} className="w-5 h-5" />
                    <Label>Repeat rule? (If ON: Buy 4 get 2. If OFF: Buy 4 get 1)</Label>
                  </div>
                </div>
              </div>
            )}

            {formData.type === 'campaign' && (
              <div className="space-y-4 border p-4 rounded bg-black text-white mt-4">
                <h3 className="font-semibold text-lg text-white">Campaign Configuration</h3>
                
                <div className="space-y-2">
                  <Label>Storefront Marketing Heading</Label>
                  <Input placeholder="e.g. MEGA FASHION SALE" value={formData.campaign.marketingHeading} onChange={e => setFormData({...formData, campaign: {...formData.campaign, marketingHeading: e.target.value}})} />
                  <p className="text-xs text-neutral-400">The "Up to X% Off" label will be calculated automatically from the child rules you select below.</p>
                </div>

                <div className="space-y-2">
                  <Label>Internal Description</Label>
                  <Input placeholder="Optional description for your team" value={formData.campaign.description} onChange={e => setFormData({...formData, campaign: {...formData.campaign, description: e.target.value}})} />
                </div>

                <div className="space-y-2 flex items-center space-x-2 pt-2">
                  <input type="checkbox" checked={formData.campaign.storefrontDisplay} onChange={e => setFormData({...formData, campaign: {...formData.campaign, storefrontDisplay: e.target.checked}})} className="w-5 h-5" />
                  <Label>Display Campaign on Storefront</Label>
                </div>

                <div className="space-y-2 pt-4">
                  <Label>Select Discounts to include in this Campaign</Label>
                  <div className="flex gap-2 mb-2">
                    <Input placeholder="Search discounts by name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="flex-1" />
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                        <SelectItem value="spend_x_get_y">Spend X Get Y</SelectItem>
                        <SelectItem value="buy_x_get_y">Buy X Get Y</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Scheduled">Scheduled</SelectItem>
                        <SelectItem value="Paused">Paused</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="border p-4 rounded bg-neutral-900 border-neutral-700 h-64 overflow-y-auto space-y-2">
                    {existingRules.filter(r => {
                      if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                      if (filterType !== 'all' && r.type !== filterType) return false;
                      if (filterStatus !== 'all') {
                          let computedStatus = r.status;
                          const now = new Date();
                          if (r.status === 'Active' && r.startDate && new Date(r.startDate) > now) computedStatus = 'Scheduled';
                          if (computedStatus !== filterStatus) return false;
                      }
                      return true;
                    }).map(rule => (
                      <label key={rule._id} className="flex items-center space-x-3 p-2 hover:bg-neutral-800 border-neutral-700 rounded transition-colors">
                        <input type="checkbox" className="w-5 h-5" checked={formData.campaign.childRuleIds.includes(rule._id)} onChange={e => {
                          const checked = e.target.checked;
                          setFormData(prev => ({
                            ...prev, 
                            campaign: {
                              ...prev.campaign,
                              childRuleIds: checked ? [...prev.campaign.childRuleIds, rule._id] : prev.campaign.childRuleIds.filter(id => id !== rule._id)
                            }
                          }));
                        }} />
                        <div className="flex flex-col">
                          <span className="font-medium">{rule.name}</span>
                          <span className="text-xs text-gray-500">{rule.type.replace('_', ' ')} � {rule.status}</span>
                        </div>
                      </label>
                    ))}
                    {existingRules.length === 0 && <p className="text-sm text-gray-500">No existing discounts found.</p>}
                  </div>
                </div>
              </div>
            )}
            
            {formData.type === 'spend_x_get_y' && (
              <div className="space-y-4 border p-4 rounded bg-black text-white mt-4">
                <h3 className="font-semibold text-lg">Spend X Get Y Configuration</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Minimum Spend (₹)</Label>
                    <Input type="number" value={formData.spendXGetY.minSpend} onChange={e => setFormData({...formData, spendXGetY: {...formData.spendXGetY, minSpend: Number(e.target.value)}})} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Reward Type</Label>
                    <Select value={formData.spendXGetY.rewardType} onValueChange={v => setFormData({...formData, spendXGetY: {...formData.spendXGetY, rewardType: v}})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FixedAmount">Fixed Amount Off</SelectItem>
                        <SelectItem value="Percentage">Percentage Off</SelectItem>
                        <SelectItem value="FreeProduct">Free Product</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.spendXGetY.rewardType !== 'FreeProduct' ? (
                  <div className="space-y-2">
                    <Label>Reward Value</Label>
                    <Input type="number" placeholder={formData.spendXGetY.rewardType === 'Percentage' ? 'e.g. 10' : 'e.g. 500'} value={formData.spendXGetY.rewardValue} onChange={e => setFormData({...formData, spendXGetY: {...formData.spendXGetY, rewardValue: Number(e.target.value)}})} />
                  </div>
                ) : (
                  <div className="space-y-2 mt-2">
                    <Label>Select Free Product(s)</Label>
                    <ProductPicker 
                      selectedIds={formData.spendXGetY.rewardTargetIds} 
                      onChange={vals => setFormData({...formData, spendXGetY: {...formData.spendXGetY, rewardTargetIds: vals}})} 
                      categories={categories}
                    />
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label>Maximum Discount Amount (Optional)</Label>
                    <Input type="number" placeholder="Leave empty for unlimited" value={formData.spendXGetY.maxDiscount || ''} onChange={e => setFormData({...formData, spendXGetY: {...formData.spendXGetY, maxDiscount: e.target.value ? Number(e.target.value) : undefined}})} />
                  </div>
                  
                  {formData.spendXGetY.rewardType !== 'Percentage' && (
                    <div className="space-y-2 flex flex-col justify-end pb-2">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" checked={formData.spendXGetY.repeat} onChange={e => setFormData({...formData, spendXGetY: {...formData.spendXGetY, repeat: e.target.checked}})} className="w-5 h-5 rounded border-gray-300" />
                        <span className="text-sm font-medium">Repeat rule (e.g. Spend 10k get 2x reward)</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Targeting & Limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Target Specific Products (Leave empty for entire store)</Label>
              <ProductPicker 
                selectedIds={formData.targetProductIds} 
                onChange={vals => setFormData({...formData, targetProductIds: vals})} 
                categories={categories}
              />
            </div>

            <div className="space-y-2">
              <Label>Total Usage Limit (Optional)</Label>
              <Input type="number" placeholder="e.g. 100 uses only" value={formData.usageLimit} onChange={e => setFormData({...formData, usageLimit: e.target.value})} />
            </div>

            <div className="flex justify-end space-x-4 pt-4"><Button type="button" variant="outline" onClick={() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/discounts/all/index.html"}>Cancel</Button><Button type="submit">Activate Discount</Button></div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}








