"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CartSimulatorPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("Surat");
  const [state, setState] = useState("Gujarat");
  const [postalCode, setPostalCode] = useState("395007");
  const [country, setCountry] = useState("India");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [calculation, setCalculation] = useState<any>(null);

  useEffect(() => {
    fetch("/api/plugins/ecommerce-plugin/products")
      .then(r => r.json())
      .then(d => {
        if (d.success) setProducts(d.products);
      });
  }, []);

  useEffect(() => {
    if (cartItems.length > 0) {
      calculateCart();
    } else {
      setCalculation(null);
    }
  }, [cartItems]);

  const handleAddProduct = (p: any) => {
    const existing = cartItems.find(i => i.productId === p._id);
    if (existing) {
      setCartItems(cartItems.map(i => i.productId === p._id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCartItems([...cartItems, { productId: p._id, quantity: 1, name: p.name, price: p.price }]);
    }
    setSearch("");
  };

  const updateQuantity = (pid: string, delta: number) => {
    setCartItems(items => {
      const existing = items.find(i => i.productId === pid);
      if (!existing) return items;
      const nq = existing.quantity + delta;
      if (nq <= 0) return items.filter(i => i.productId !== pid);
      return items.map(i => i.productId === pid ? { ...i, quantity: nq } : i);
    });
  };

  const calculateCart = async () => {
    if (cartItems.length === 0) {
      setCalculation(null);
      return;
    }
    try {
      const res = await fetch("/api/plugins/ecommerce-plugin/cart/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cartItems, couponCode, customerAddress: { addressLine1, city, state, postalCode, country }, selectedLocationId })
      });
      const data = await res.json();
      if (data.success) {
        setCalculation(data);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const filteredProducts = search.trim() === "" ? [] : products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 mb-20 font-sans">
      
      {/* LEFT COLUMN: Add Products & Context */}
      <div className="space-y-12">
        <div className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight">Add Products</h2>
          <hr className="border-gray-200 dark:border-gray-800" />
          
          <div className="flex items-center gap-4">
            <span className="whitespace-nowrap font-medium">Search Product:</span>
            <div className="relative w-full">
              <Input 
                placeholder="Search..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
              {filteredProducts.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredProducts.map(p => (
                    <div 
                      key={p._id} 
                      className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer flex justify-between"
                      onClick={() => handleAddProduct(p)}
                    >
                      <span>{p.name}</span>
                      <span>₹{p.price?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6 mt-8">
            {(calculation?.items || cartItems).map((item: any, idx: number) => (
              <div key={item.productId + '_' + idx} className="flex flex-col gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex justify-between font-semibold text-lg">
                  <div className="flex items-center gap-2">
                    <span>{item.name}</span>
                    {item.isAutoAddedGift && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-bold tracking-wide uppercase">FREE GIFT</span>
                    )}
                  </div>
                  {item.isAutoAddedGift ? (
                    <div className="flex flex-col items-end">
                       <span className="line-through text-gray-400 text-sm">₹{(item.originalPrice || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                       <span className="text-green-600">FREE</span>
                    </div>
                  ) : (
                    <span>₹{(item.price || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    {!item.isAutoAddedGift ? (
                      <>
                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-none" onClick={() => updateQuantity(item.productId, -1)}>-</Button>
                        <span className="font-bold w-4 text-center">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-none" onClick={() => updateQuantity(item.productId, 1)}>+</Button>
                      </>
                    ) : (
                      <>
                        <span className="font-bold w-4 text-center ml-2">×{item.quantity}</span>
                      </>
                    )}
                  </div>
                  <span className="font-bold text-gray-600 dark:text-gray-400">
                    ₹{((item.price || 0) * item.quantity).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                  </span>
                </div>
              </div>
            ))}
            {(calculation?.items || cartItems).length === 0 && <p className="text-gray-400 italic">No products added.</p>}
          </div>
        </div>

        {/* Customer Context for Taxes & Shipping */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold tracking-tight">Customer Location</h2>
          <hr className="border-gray-200 dark:border-gray-800" />
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="text-sm font-bold">Country</label>
                <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. India" />
             </div>
             <div>
                <label className="text-sm font-bold">State / Region</label>
                <Input value={state} onChange={e => setState(e.target.value)} placeholder="e.g. Gujarat" />
             </div>
             <div>
                <label className="text-sm font-bold">City</label>
                <Input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Surat" />
             </div>
             <div>
                <label className="text-sm font-bold">PIN / Postal Code</label>
                <Input value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="e.g. 395007" />
             </div>
             <div className="col-span-2">
                <Button variant="outline" className="w-full" onClick={calculateCart}>Apply Location Rules</Button>
             </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Order Summary */}
      <div className="space-y-6 bg-gray-50 dark:bg-gray-900/30 p-6 rounded-lg border border-gray-100 dark:border-gray-800">
        <h2 className="text-2xl font-bold tracking-tight">Order Summary</h2>
        <hr className="border-gray-200 dark:border-gray-800" />
        
        <div className="space-y-4 text-lg">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
            <span className="font-semibold">₹{(calculation?.pricing?.subtotal || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
          </div>

          <div className="pt-2">
            <span className="text-gray-600 dark:text-gray-400">Discount:</span>
            {calculation?.pricing?.appliedDiscounts?.length > 0 ? (
              <div className="mt-2 space-y-2">
                {calculation.pricing.appliedDiscounts.map((ad: any, i: number) => {
                  const amt = ad.amount !== undefined ? ad.amount : (ad.discountAmount || 0);
                  return (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex justify-between font-medium">
                      <span>{ad.name}</span>
                      <span>-₹{amt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                    </div>
                    {ad.isFreeGift && ad.rewardProductName && (
                      <span className="text-sm text-green-600">Free {ad.rewardProductName} (Qty: {ad.rewardQuantity})</span>
                    )}
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex justify-between font-medium mt-2">
                <span>None</span>
                <span>-₹0.00</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-gray-600 dark:text-gray-400">Coupon Code</span>
            <div className="flex gap-2 w-1/2">
              <Input className="h-8 text-sm" placeholder="Code..." value={couponCode} onChange={e => setCouponCode(e.target.value)} />
              <Button size="sm" className="h-8" onClick={calculateCart}>Apply</Button>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <span className="text-gray-600 dark:text-gray-400">Shipping</span>
            <span className="font-semibold">₹{(calculation?.pricing?.shipping || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
          </div>

          
          {/* Tax Section */}
          <div className="flex flex-col gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
            {calculation?.pricing?.taxSnapshot?.configurationErrors?.length > 0 && (
                <div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded-md text-sm font-semibold mb-2 space-y-1">
                    {calculation.pricing.taxSnapshot.configurationErrors.map((err: string, i: number) => (
                        <p key={i}>?? {err}</p>
                    ))}
                </div>
            )}
            <div className="flex justify-between">

              <span className="text-gray-600 dark:text-gray-400">Tax</span>
              <span className="font-semibold">₹{(calculation?.pricing?.tax || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
            </div>
            {calculation?.pricing?.taxSnapshot?.taxLines?.length > 0 && (
                <div className="pl-4 space-y-1 mt-1 border-l-2 border-gray-200 dark:border-gray-700">
                   {calculation.pricing.taxSnapshot.taxLines.map((line: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                          <span>{line.label} {line.rate}%</span>
                          <span>₹{(line.taxAmount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                      </div>
                   ))}
                </div>
            )}
          </div>
        </div>

        <hr className="border-gray-200 dark:border-gray-800 my-6" />

        <div className="space-y-2">
          <div className="flex justify-between font-bold text-2xl tracking-tight">
            <span>TOTAL</span>
            <span>₹{(calculation?.pricing?.totalAmount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
          </div>
          
          <div className="flex justify-between font-bold text-xl text-green-600 dark:text-green-500">
            <span>YOU SAVED</span>
            <span>₹{(calculation?.pricing?.discount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
          </div>
        </div>

        <div className="flex gap-4 pt-6">
          <Button variant="outline" className="flex-1 font-bold h-12" onClick={calculateCart}>Recalculate</Button>
          <Button className="flex-1 font-bold h-12" onClick={() => alert("Checkout clicked! In a real app, this redirects to payment.")}>Checkout</Button>
        </div>
      </div>
      
    </div>
  );
}
