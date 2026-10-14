// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Play, Pause, Trash2 } from "lucide-react";

export default function CustomDiscountsList() {
  const [rules, setRules] = useState([]);

  const fetchRules = async () => {
    try {
      const res = await fetch("/api/plugins/ecommerce-plugin/discounts");
      const data = await res.json();
      if (data.success) {
        setRules(data.rules.filter(r => r.type === 'custom'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "Active" ? "Paused" : "Active";
    await fetch(`/api/plugins/ecommerce-plugin/discounts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchRules();
  };

  const deleteRule = async (id) => {
    if (!confirm("Delete this custom rule?")) return;
    await fetch(`/api/plugins/ecommerce-plugin/discounts/${id}`, {
      method: "DELETE",
    });
    fetchRules();
  };
  
  const renderConditionSummary = (rule) => {
     if (!rule.customConfig?.conditionTree?.conditions?.length) return "Always (No Conditions)";
     return `${rule.customConfig.conditionTree.conditions.length} conditions`;
  };
  
  const renderActionSummary = (rule) => {
     if (!rule.customConfig?.actions?.length) return "No Actions";
     return `${rule.customConfig.actions.length} actions`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Custom Discounts</h1>
          <p className="text-muted-foreground">Build advanced discounts using your own conditions and actions.</p>
        </div>
        <Button onClick={() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/discounts/custom/add/index.html"}>
          <Plus className="w-4 h-4 mr-2" /> Create Custom Discount
        </Button>
      </div>

      <div className="border rounded-md bg-card text-card-foreground">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Conditions</TableHead>
              <TableHead>Actions</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Start / End</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((r) => (
              <TableRow key={r._id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{renderConditionSummary(r)}</TableCell>
                <TableCell>{renderActionSummary(r)}</TableCell>
                <TableCell>{r.priority || 0}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    {r.startDate ? new Date(r.startDate).toLocaleDateString() : 'Immediately'}<br/>
                    {r.endDate ? new Date(r.endDate).toLocaleDateString() : 'No expiry'}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={r.status === 'Active' ? 'default' : 'secondary'}>{r.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => window.location.href = `/plugins/ecommerce-plugin/ui/admin/discounts/custom/edit/index.html?id=${r._id}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleStatus(r._id, r.status)}>
                      {r.status === 'Active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteRule(r._id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rules.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No custom rules found. Create one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

