// @ts-nocheck
﻿"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function EditCampaignPageContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [existingRules, setExistingRules] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    name: "",
    type: "campaign",
    status: "Active",
    startDate: "",
    endDate: "",
    campaign: { 
      childRuleIds: [] as string[], 
      storefrontDisplay: true, 
      marketingHeading: '', 
      description: '' 
    }
  });

  useEffect(() => {
    fetch("/api/plugins/ecommerce-plugin/discounts").then(res => res.json()).then(data => {
      if (data.success) {
        setExistingRules(data.rules.filter((r:any) => r.type !== 'campaign' && r.status !== 'Archived'));
      }
    });

    if (id) {
      fetch(`/api/plugins/ecommerce-plugin/discounts/${id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.rule) {
            const r = data.rule;
            setFormData({
              name: r.name || "",
              type: "campaign",
              status: r.status || "Active",
              startDate: r.startDate ? new Date(r.startDate).toISOString().slice(0,16) : "",
              endDate: r.endDate ? new Date(r.endDate).toISOString().slice(0,16) : "",
              campaign: {
                childRuleIds: r.campaign?.childRuleIds || [],
                storefrontDisplay: r.campaign?.storefrontDisplay !== false,
                marketingHeading: r.campaign?.marketingHeading || '',
                description: r.campaign?.description || ''
              }
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
    if (!formData.campaign.childRuleIds || formData.campaign.childRuleIds.length === 0) {
      alert("Campaigns require at least 1 child discount.");
      return;
    }
    
    try {
      const res = await fetch(`/api/plugins/ecommerce-plugin/discounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = "/plugins/ecommerce-plugin/ui/admin/discounts/campaigns/index.html";
      } else {
        alert("Failed to save campaign: " + (data.message || "Unknown error"));
      }
    } catch (err: any) {
      alert("Network error: " + err.message);
    }
  };

  const filteredRules = existingRules.filter(r => {
    if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 mb-20">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Edit Campaign</h1>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Campaign Name (Internal)</Label>
              <Input required placeholder="e.g. Mega Summer Sale" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            
            <div className="space-y-2">
              <Label>Marketing Heading / Label</Label>
              <Input placeholder="e.g. Up to 70% Off" value={formData.campaign.marketingHeading} onChange={e => setFormData({...formData, campaign: {...formData.campaign, marketingHeading: e.target.value}})} />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" placeholder="e.g. Sitewide clearance event for summer items." value={formData.campaign.description} onChange={e => setFormData({...formData, campaign: {...formData.campaign, description: e.target.value}})} />
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
                <Label>Start Date & Time *</Label>
                <Input type="datetime-local" required value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>End Date & Time (Optional)</Label>
                <Input type="datetime-local" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
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
            <CardTitle>Storefront</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
              <div className="space-y-0.5">
                <Label className="text-base">Display on Storefront</Label>
                <p className="text-sm text-neutral-500">Show campaign banners and marketing labels on the live store.</p>
              </div>
              <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={formData.campaign.storefrontDisplay} onChange={e => setFormData({...formData, campaign: {...formData.campaign, storefrontDisplay: e.target.checked}})} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Included Discounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Search existing discounts</Label>
              <Input placeholder="Search by name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            
            <div className="mt-4 border rounded-md max-h-[300px] overflow-y-auto bg-neutral-900 border-neutral-700 p-2 space-y-1">
              {filteredRules.length === 0 ? (
                <div className="p-4 text-center text-sm text-neutral-500">No discounts found.</div>
              ) : (
                filteredRules.map(rule => (
                  <label key={rule._id} className="flex items-center space-x-3 p-3 rounded hover:bg-neutral-800 cursor-pointer transition-colors text-white">
                    <input type="checkbox" className="w-5 h-5 accent-blue-600" 
                      checked={formData.campaign.childRuleIds.includes(rule._id)} 
                      onChange={e => {
                        const checked = e.target.checked;
                        setFormData(prev => ({
                          ...prev, 
                          campaign: {
                            ...prev.campaign,
                            childRuleIds: checked ? [...prev.campaign.childRuleIds, rule._id] : prev.campaign.childRuleIds.filter(id => id !== rule._id)
                          }
                        }));
                      }} 
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{rule.name}</span>
                      <span className="text-xs text-neutral-400">{rule.type.replace('_', ' ')} - {rule.status}</span>
                    </div>
                  </label>
                ))
              )}
            </div>
            
            <div className="text-sm text-neutral-500 pt-2">
              {formData.campaign.childRuleIds.length} discount(s) selected
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/discounts/campaigns/index.html"}>Cancel</Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </div>
  );
}


import { Suspense } from "react";
export default function EditCampaignPage() { return <Suspense fallback={<div>Loading...</div>}><EditCampaignPageContent /></Suspense>; }
