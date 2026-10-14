// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Power, PowerOff } from "lucide-react";

export default function CouponsPage() {
  const [discounts, setDiscounts] = useState<any[]>([]);

  const getComputedStatus = (d: any) => {
    if (d.status === 'Paused') return 'Paused';
    const now = new Date();
    if (d.startDate && new Date(d.startDate) > now) return 'Scheduled';
    if (d.endDate && new Date(d.endDate) < now) return 'Expired';
    return d.status;
  };

  const fetchDiscounts = () => {
    fetch("/api/plugins/ecommerce-plugin/discounts")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setDiscounts(data.rules.filter((r: any) => r.isAutomatic === false && r.type !== 'campaign'));
        }
      });
  };

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Active' ? 'Paused' : 'Active';
    try {
      const res = await fetch("/api/plugins/ecommerce-plugin/discounts/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        setDiscounts(discounts.map(d => d._id === id ? { ...d, status: newStatus } : d));
      }
    } catch (e) { console.error(e); alert("Network error: " + e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to completely delete this coupon?")) return;
    try {
      const res = await fetch("/api/plugins/ecommerce-plugin/discounts/" + id, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        if (data.archived) {
          alert('Coupon has order history and was safely archived instead of permanent deletion.');
        }
        setDiscounts(discounts.filter(d => d._id !== id));
      } else { alert("Delete failed: " + data.message); }
    } catch (e) { console.error(e); alert("Network error: " + e.message); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 mb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Coupons</h1>
          <p className="text-neutral-500">Customer-entered discount codes for checkout.</p>
        </div>
        <Button onClick={() => window.location.href = '/plugins/ecommerce-plugin/ui/admin/discounts/coupons/add/index.html'}>
          + Create Coupon
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Coupon Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discounts.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-neutral-500">No coupons found.</TableCell></TableRow>
              ) : (
                discounts.map((rule) => {
                  const status = getComputedStatus(rule);
                  return (
                    <TableRow key={rule._id}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell><Badge variant="outline">{rule.code}</Badge></TableCell>
                      <TableCell className="capitalize">{rule.type.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-neutral-500">
                        {rule.type === 'percentage' ? `${rule.value}% Off` : `₹${rule.value} Off`}
                      </TableCell>
                      <TableCell>{rule.usedCount || 0} {rule.usageLimit ? `/ ${rule.usageLimit}` : ''}</TableCell>
                      <TableCell className="whitespace-nowrap">{rule.startDate ? new Date(rule.startDate).toLocaleString() : 'Immediate'}</TableCell>
                      <TableCell className="whitespace-nowrap">{rule.endDate ? new Date(rule.endDate).toLocaleString() : 'No Expiry'}</TableCell>
                      <TableCell>
                        <Badge variant={status === 'Active' ? 'default' : status === 'Paused' ? 'secondary' : status === 'Scheduled' ? 'outline' : 'destructive'}>
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(rule._id, rule.status)} title={rule.status === 'Active' ? 'Pause' : 'Activate'}>
                          {rule.status === 'Active' ? <PowerOff size={16} className="text-neutral-500" /> : <Power size={16} className="text-green-500" />}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => window.location.href = `/plugins/ecommerce-plugin/ui/admin/discounts/coupons/edit/index.html?id=${rule._id}`}>
                          <Edit size={14} className="mr-1" /> Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(rule._id)}>
                          <Trash2 size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
