"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, ArrowLeft } from "lucide-react";

export default function TaxClassesPage() {
  const [classes, setClasses] = useState([]);

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/plugins/ecommerce-plugin/taxes/classes", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setClasses(data.classes);
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const deleteClass = async (id: string) => {
    if (!confirm("Are you sure you want to archive this tax category?")) return;
    await fetch(`/api/plugins/ecommerce-plugin/taxes/classes/${id}`, { method: "DELETE" });
    fetchClasses();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <Button variant="ghost" className="mb-4 -ml-4" onClick={() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/settings/tax/index.html"}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Tax Configuration
      </Button>
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tax Categories</h1>
          <p className="text-muted-foreground mt-1">Create a product tax category such as Standard, Reduced or Zero Rated.</p>
        </div>
        <Button onClick={() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/settings/tax/classes/add/index.html"}>
          <Plus className="w-4 h-4 mr-2" /> Add Tax Category
        </Button>
      </div>
      
      <div className="border rounded-md bg-card text-card-foreground">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map((c: any) => (
              <TableRow key={c._id}>
                <TableCell className="font-bold">{c.name}</TableCell>
                <TableCell>
                  <Badge variant={c.status === 'Active' ? 'default' : 'secondary'}>{c.status}</Badge>
                </TableCell>
                <TableCell className="text-right flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => window.location.href = `/plugins/ecommerce-plugin/ui/admin/settings/tax/classes/edit/index.html?id=${c._id}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteClass(c._id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                </TableCell>
              </TableRow>
            ))}
            {classes.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  No tax categories found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
