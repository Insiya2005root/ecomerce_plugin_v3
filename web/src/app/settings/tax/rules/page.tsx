"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, ArrowLeft } from "lucide-react";

export default function TaxRulesPage() {
  const [rules, setRules] = useState([]);

  const fetchRules = async () => {
    try {
      const res = await fetch("/api/plugins/ecommerce-plugin/taxes/rules", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setRules(data.rules);
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const deleteRule = async (id: string) => {
    if (!confirm("Are you sure you want to archive this tax rate?")) return;
    await fetch(`/api/plugins/ecommerce-plugin/taxes/rules/${id}`, { method: "DELETE" });
    fetchRules();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 relative">
      <Button variant="ghost" className="mb-4 -ml-4" onClick={() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/settings/tax/index.html"}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Tax Configuration
      </Button>
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tax Rates</h1>
          <p className="text-muted-foreground mt-1">Assign actual percentage rates by location and tax category.</p>
        </div>
        <Button onClick={() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/settings/tax/rules/add/index.html"}>
          <Plus className="w-4 h-4 mr-2" /> Add Tax Rate
        </Button>
      </div>
      
      <div className="border rounded-md bg-card text-card-foreground">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tax Name</TableHead>
              <TableHead>Tax Category</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((r: any) => {
              const countryStr = r.country === '*' ? 'All Countries' : r.country;
              const stateStr = r.state === '*' ? 'All States' : r.state;
              const postalStr = r.postalScope === '*' ? '' : ` (${r.postalScope})`;
              const locationStr = `${countryStr}${stateStr !== 'All States' ? ' > ' + stateStr : ''}${postalStr}`;
              
              const rateTotal = r.components ? r.components.reduce((sum: number, c: any) => sum + c.rate, 0) : 0;
              return (
              <TableRow key={r._id}>
                <TableCell className="font-bold">{r.name}</TableCell>
                <TableCell>{r.taxClassId?.name || 'Unknown'}</TableCell>
                <TableCell className="text-sm">{locationStr}</TableCell>
                <TableCell>
                  <div className="font-bold">{rateTotal}%</div>
                  {r.components && r.components.length > 1 && (
                     <div className="text-xs text-muted-foreground">
                        {r.components.map((c: any) => `${c.label}: ${c.rate}%`).join(', ')}
                     </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={r.status === 'Active' ? 'default' : 'secondary'}>{r.status}</Badge>
                </TableCell>
                <TableCell className="text-right flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => window.location.href = `/plugins/ecommerce-plugin/ui/admin/settings/tax/rules/edit/index.html?id=${r._id}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteRule(r._id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                </TableCell>
              </TableRow>
            )})}
            {rules.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No tax rates found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
