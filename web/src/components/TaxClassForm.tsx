import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";

export function TaxClassForm({ initialData, onSave, isSaving }: { initialData?: any, onSave: any, isSaving: any }) {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [isActive, setIsActive] = useState(initialData ? initialData.status === 'Active' : true);

  const handleSave = () => {
    const code = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    onSave({ 
        name, 
        code, 
        description, 
        status: isActive ? 'Active' : 'Inactive', 
        shippingTaxPolicy: "UseGlobal" 
    });
  };

  return (
    <div className="space-y-6">
      <Card>
         <CardContent className="space-y-8 pt-6">
            <div className="border-b pb-6">
                <label className="font-bold text-lg mb-1 block">Category Name</label>
                <p className="text-sm text-muted-foreground mb-3">Examples: Standard, Reduced, Zero Rated.</p>
                <Input className="max-w-md bg-background" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard" />
            </div>
            <div className="border-b pb-6">
                <label className="font-bold text-lg mb-1 block">Description (Optional)</label>
                <p className="text-sm text-muted-foreground mb-3">Describe which products should use this category.</p>
                <Input className="max-w-xl bg-background" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. For general products" />
            </div>
            <div className="flex items-center justify-between pt-2">
                <div className="pr-8">
                   <h3 className="font-bold text-lg">Active</h3>
                   <p className="text-sm text-muted-foreground mt-1">Inactive categories cannot be assigned to new products.</p>
                </div>
                <Checkbox checked={isActive} onCheckedChange={(c: any) => setIsActive(c as boolean)} className="w-6 h-6" />
            </div>
         </CardContent>
      </Card>
      
      <div className="flex justify-end pt-4">
         <Button size="lg" onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? "Saving..." : (initialData ? "Save Changes" : "Create Tax Category")}
         </Button>
      </div>
    </div>
  );
}
