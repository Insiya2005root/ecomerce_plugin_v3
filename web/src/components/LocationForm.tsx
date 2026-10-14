import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle } from "lucide-react";

export function LocationForm({ initialData, onSave, isSaving }: { initialData?: any, onSave: any, isSaving: any }) {
  const [name, setName] = useState(initialData?.name || "");
  const [addressLine1, setAddressLine1] = useState(initialData?.addressLine1 || "");
  const [addressLine2, setAddressLine2] = useState(initialData?.addressLine2 || "");
  const [city, setCity] = useState(initialData?.city || "");
  const [state, setState] = useState(initialData?.state || "");
  const [postalCode, setPostalCode] = useState(initialData?.postalCode || "");
  const [country, setCountry] = useState(initialData?.country || "India");
  const [status, setStatus] = useState(initialData?.status || "Active");
  const [priority, setPriority] = useState(initialData?.priority || 0);

  const hasCoords = initialData?.latitude && initialData?.longitude;

  const handleSave = () => {
    onSave({
      name, addressLine1, addressLine2, city, state, postalCode, country, status, priority
    });
  };

  return (
    <div className="space-y-6">
      <Card>
         <CardHeader>
             <CardTitle>Location Details</CardTitle>
         </CardHeader>
         <CardContent className="space-y-4">
            <div>
               <label className="text-sm font-bold mb-2 block">Location Name</label>
               <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Surat Main Warehouse" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                   <label className="text-sm font-bold mb-2 block">Address Line 1</label>
                   <Input value={addressLine1} onChange={e => setAddressLine1(e.target.value)} />
               </div>
               <div>
                   <label className="text-sm font-bold mb-2 block">Address Line 2</label>
                   <Input value={addressLine2} onChange={e => setAddressLine2(e.target.value)} />
               </div>
               <div>
                   <label className="text-sm font-bold mb-2 block">City</label>
                   <Input value={city} onChange={e => setCity(e.target.value)} />
               </div>
               <div>
                   <label className="text-sm font-bold mb-2 block">State</label>
                   <Input value={state} onChange={e => setState(e.target.value)} />
               </div>
               <div>
                   <label className="text-sm font-bold mb-2 block">PIN Code</label>
                   <Input value={postalCode} onChange={e => setPostalCode(e.target.value)} />
               </div>
               <div>
                   <label className="text-sm font-bold mb-2 block">Country</label>
                   <Input value={country} onChange={e => setCountry(e.target.value)} />
               </div>
            </div>
         </CardContent>
      </Card>
      
      <Card>
         <CardHeader>
             <CardTitle>Configuration</CardTitle>
         </CardHeader>
         <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <label className="text-sm font-bold mb-2 block">Status</label>
                <Select value={status} onValueChange={(val: any) => setStatus(val || '')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                </Select>
             </div>
             <div>
                <label className="text-sm font-bold mb-2 block">Priority (Higher runs first)</label>
                <Input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))} />
             </div>
         </CardContent>
      </Card>

      {initialData && (
          <div className="flex items-center gap-2 px-2 py-4">
             {hasCoords ? (
                 <span className="flex items-center text-green-600 dark:text-green-400 font-medium">
                    <CheckCircle2 className="w-5 h-5 mr-2" /> Address verified and geocoded
                 </span>
             ) : (
                 <span className="flex items-center text-orange-600 dark:text-orange-400 font-medium">
                    <AlertCircle className="w-5 h-5 mr-2" /> Unable to verify this address
                 </span>
             )}
          </div>
      )}

      <div className="flex justify-end">
         <Button size="lg" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Location"}
         </Button>
      </div>
    </div>
  );
}


