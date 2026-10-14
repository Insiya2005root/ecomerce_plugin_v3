"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";

export default function ShippingSettingsPage() {
  const [loading, setLoading] = useState(true);
  
  const [shippingMethod, setShippingMethod] = useState("Flat");
  const [shippingRate, setShippingRate] = useState<number>(0);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number>(0);
  
  const [shippingRatePerKm, setShippingRatePerKm] = useState<number>(0);
  const [locationSelection, setLocationSelection] = useState("Nearest");
  const [distanceRounding, setDistanceRounding] = useState("Up");
  const [fallbackShippingCost, setFallbackShippingCost] = useState<number>(0);

  useEffect(() => {
    fetch("/api/plugins/ecommerce-plugin/settings")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.settings) {
          setShippingMethod(data.settings.shippingMethod || "Flat");
          setShippingRate(data.settings.shippingRate || 0);
          setFreeShippingThreshold(data.settings.freeShippingThreshold || 0);
          
          setShippingRatePerKm(data.settings.shippingRatePerKm || 0);
          setLocationSelection(data.settings.locationSelection || "Nearest");
          setDistanceRounding(data.settings.distanceRounding || "Up");
          setFallbackShippingCost(data.settings.fallbackShippingCost || 0);
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    try {
      const payload = {
          shippingMethod,
          shippingRate,
          freeShippingThreshold,
          shippingRatePerKm,
          locationSelection,
          distanceRounding,
          fallbackShippingCost
      };
      const res = await fetch("/api/plugins/ecommerce-plugin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert("Shipping settings saved successfully!");
      } else {
        alert("Failed to save settings: " + data.message);
      }
    } catch (e) {
      alert("An error occurred while saving.");
    }
  };

  if (loading) return <div className="p-10 text-center">Loading settings...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <Button variant="ghost" className="mb-4" onClick={() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/settings/index.html"}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Store Settings
      </Button>
      
      <h1 className="text-3xl font-bold">Shipping Settings</h1>
      <p className="text-muted-foreground mb-8">Configure delivery pricing and distance calculation.</p>

      <Card>
        <CardHeader>
          <CardTitle>Shipping Method</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
             <div 
                className={`flex-1 border rounded-md p-4 cursor-pointer text-center ${shippingMethod === 'Flat' ? 'border-primary ring-2 ring-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
                onClick={() => setShippingMethod('Flat')}
             >
                <h3 className="font-bold">Flat Shipping</h3>
                <p className="text-sm text-muted-foreground">Fixed price for all orders</p>
             </div>
             <div 
                className={`flex-1 border rounded-md p-4 cursor-pointer text-center ${shippingMethod === 'Distance' ? 'border-primary ring-2 ring-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
                onClick={() => setShippingMethod('Distance')}
             >
                <h3 className="font-bold">Distance Based</h3>
                <p className="text-sm text-muted-foreground">Price by routing distance</p>
             </div>
          </div>
        </CardContent>
      </Card>
      
      {shippingMethod === 'Flat' && (
          <Card>
            <CardHeader>
              <CardTitle>Flat Shipping Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm font-bold mb-2 block">Flat Shipping Rate (₹)</label>
                <Input type="number" value={shippingRate} onChange={e => setShippingRate(Number(e.target.value))} className="max-w-[200px]" />
              </div>
              <div>
                <label className="text-sm font-bold mb-2 block">Free Shipping Threshold (₹)</label>
                <Input type="number" value={freeShippingThreshold} onChange={e => setFreeShippingThreshold(Number(e.target.value))} className="max-w-[200px]" />
                <p className="text-sm text-muted-foreground mt-2">Orders above this subtotal will have shipping set to ₹0. Enter 0 to disable.</p>
              </div>
            </CardContent>
          </Card>
      )}
      
      {shippingMethod === 'Distance' && (
          <Card>
            <CardHeader>
              <CardTitle>Distance Shipping Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm font-bold mb-2 block">Shipping Rate Per KM (₹)</label>
                <Input type="number" value={shippingRatePerKm} onChange={e => setShippingRatePerKm(Number(e.target.value))} className="max-w-[200px]" />
              </div>
              
              <div>
                <label className="text-sm font-bold mb-2 block">Fulfilment Location Selection</label>
                <Select value={locationSelection} onValueChange={(val: any) => setLocationSelection(val || '')}>
                    <SelectTrigger className="w-full max-w-[300px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Nearest">Automatically select nearest store</SelectItem>
                        <SelectItem value="CustomerSelect">Customer selects store</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-bold mb-2 block">Distance Rounding</label>
                <Select value={distanceRounding} onValueChange={(val: any) => setDistanceRounding(val || '')}>
                    <SelectTrigger className="w-full max-w-[300px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Exact">Exact / Keep decimals</SelectItem>
                        <SelectItem value="Nearest">Round to nearest KM</SelectItem>
                        <SelectItem value="Up">Round up to next KM</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-bold mb-2 block">Free Shipping Threshold (₹)</label>
                <Input type="number" value={freeShippingThreshold} onChange={e => setFreeShippingThreshold(Number(e.target.value))} className="max-w-[200px]" />
                <p className="text-sm text-muted-foreground mt-2">Orders above this subtotal will have shipping set to ₹0. Enter 0 to disable.</p>
              </div>
              
              <div className="border-t pt-6">
                  <h3 className="text-lg font-bold mb-4">Route Failure Behaviour</h3>
                  <div>
                    <label className="text-sm font-bold mb-2 block">Fallback Shipping Cost (₹)</label>
                    <Input type="number" value={fallbackShippingCost} onChange={e => setFallbackShippingCost(Number(e.target.value))} className="max-w-[200px]" />
                    <p className="text-sm text-muted-foreground mt-2">If routing distance cannot be calculated, this safe fallback amount is applied.</p>
                  </div>
              </div>
            </CardContent>
          </Card>
      )}
      
      <div className="flex justify-end">
        <Button size="lg" onClick={handleSave}>Save Shipping Settings</Button>
      </div>
    </div>
  );
}


