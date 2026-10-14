import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli", "Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

const US_STATES = [
  "California", "Texas", "Florida", "New York", "Pennsylvania", "Illinois", "Ohio", "Georgia", "North Carolina", "Michigan"
]; // Just a subset for example

export function TaxRuleForm({ initialData, onSave, isSaving }: { initialData?: any, onSave: any, isSaving: any }) {
  const [classes, setClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  // Map initial name to taxType if possible
  const initName = initialData?.name || "";
  const isStandardType = ["GST", "VAT", "Sales Tax"].includes(initName);
  const [taxType, setTaxType] = useState(isStandardType ? initName : (initName ? "Custom" : "GST"));
  const [customTaxName, setCustomTaxName] = useState(isStandardType ? "" : initName);

  const [taxClassId, setTaxClassId] = useState(initialData?.taxClassId?._id || initialData?.taxClassId || "");
  const [country, setCountry] = useState(initialData?.country === '*' ? 'All Countries' : (initialData?.country || "India"));
  const [state, setState] = useState(initialData?.state === '*' ? 'All States' : (initialData?.state || "All States"));
  const [postalScope, setPostalScope] = useState(initialData?.postalScope === '*' ? '' : (initialData?.postalScope || ""));
  
  // Single rate vs Components
  const initComps = initialData?.components || [];
  const [useAdvancedComps, setUseAdvancedComps] = useState(initComps.length > 1);
  const [singleRate, setSingleRate] = useState<string>(initComps.length > 0 ? initComps.reduce((s: number, c: any) => s + c.rate, 0).toString() : "");
  const [components, setComponents] = useState<any[]>(initComps.length > 0 ? initComps : [{ label: "Tax", rate: 0 }]);
  
  const [shippingTaxPolicy, setShippingTaxPolicy] = useState(initialData?.shippingTaxPolicy || "UseGlobal");
  const [priority, setPriority] = useState(initialData?.priority || 0);
  const [isActive, setIsActive] = useState(initialData ? initialData.status === 'Active' : true);

  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    fetch("/api/plugins/ecommerce-plugin/taxes/classes", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { 
          if(d.success) setClasses(d.classes); 
          setLoadingClasses(false);
      })
      .catch(() => setLoadingClasses(false));
  }, []);

  // Reset state if country changes and current state is not "All States"
  useEffect(() => {
     if (country === 'India' && !INDIAN_STATES.includes(state) && state !== 'All States') setState('All States');
     if (country === 'United States' && !US_STATES.includes(state) && state !== 'All States') setState('All States');
  }, [country]);

  const addComponent = () => {
      setComponents([...components, { label: "", rate: 0 }]);
  };

  const removeComponent = (idx: number) => {
      setComponents(components.filter((_, i) => i !== idx));
  };

  const updateComponent = (idx: number, field: string, value: any) => {
      const newComps = [...components];
      newComps[idx][field] = value;
      setComponents(newComps);
      // Auto-update single rate
      if (field === 'rate') {
         setSingleRate(newComps.reduce((s, c) => s + Number(c.rate || 0), 0).toString());
      }
  };

  const handleSave = () => {
    const finalName = taxType === "Custom" ? customTaxName : taxType;
    const finalCountry = (country === 'All Countries' || !country) ? '*' : country;
    const finalState = (state === 'All States' || !state) ? '*' : state;
    const finalPostal = (!postalScope) ? '*' : postalScope;
    
    let finalComps = components;
    if (!useAdvancedComps) {
        finalComps = [{ label: finalName || "Tax", rate: Number(singleRate) || 0 }];
    }

    onSave({ 
        name: finalName || "Unnamed Tax", 
        taxClassId, 
        country: finalCountry, 
        state: finalState, 
        postalScope: finalPostal, 
        components: finalComps, 
        shippingTaxPolicy, 
        priority, 
        status: isActive ? 'Active' : 'Inactive' 
    });
  };

  return (
    <div className="space-y-6">
      <Card>
         <CardContent className="space-y-8 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b pb-6">
               <div>
                   <label className="font-bold text-lg mb-2 block">Tax Type</label>
                   <Select value={taxType} onValueChange={(val: any) => setTaxType(val || '')}>
                       <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                       <SelectContent>
                           <SelectItem value="GST">GST</SelectItem>
                           <SelectItem value="VAT">VAT</SelectItem>
                           <SelectItem value="Sales Tax">Sales Tax</SelectItem>
                           <SelectItem value="Custom">Custom</SelectItem>
                       </SelectContent>
                   </Select>
               </div>
               {taxType === "Custom" && (
                 <div>
                     <label className="font-bold text-lg mb-2 block">Custom Tax Name</label>
                     <Input value={customTaxName} onChange={e => setCustomTaxName(e.target.value)} placeholder="e.g. State Tax" className="bg-background" />
                 </div>
               )}
            </div>

            <div className="border-b pb-6">
               <label className="font-bold text-lg mb-2 block">Tax Category</label>
               {loadingClasses ? (
                   <div className="text-sm text-muted-foreground py-2">Loading categories...</div>
               ) : classes.filter(c => c.status === 'Active' || c._id === taxClassId).length > 0 ? (
                   <Select value={taxClassId} onValueChange={(val: any) => setTaxClassId(val || '')}>
                       <SelectTrigger className="max-w-md bg-background"><SelectValue placeholder="Select Category..." /></SelectTrigger>
                       <SelectContent>
                           {classes.filter(c => c.status === 'Active' || c._id === taxClassId).map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                       </SelectContent>
                   </Select>
               ) : (
                   <div className="bg-muted/30 p-4 rounded-md border text-center">
                       <p className="text-muted-foreground mb-3">No tax categories found.</p>
                       <Button variant="outline" onClick={() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/settings/tax/classes/add/index.html"}>
                           + Create Tax Category
                       </Button>
                   </div>
               )}
            </div>
            
            <div className="pt-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Applies To</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b pb-6">
                    <div>
                        <label className="font-bold text-lg mb-2 block">Country</label>
                        <Select value={country} onValueChange={(val: any) => setCountry(val || '')}>
                            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All Countries">All Countries</SelectItem>
                                <SelectItem value="India">India</SelectItem>
                                <SelectItem value="United States">United States</SelectItem>
                                <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                                <SelectItem value="Australia">Australia</SelectItem>
                                <SelectItem value="Canada">Canada</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="font-bold text-lg mb-2 block">State / Region</label>
                        {country === 'India' ? (
                            <Select value={state} onValueChange={(val: any) => setState(val || '')}>
                                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="All States">All States</SelectItem>
                                    {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        ) : country === 'United States' ? (
                            <Select value={state} onValueChange={(val: any) => setState(val || '')}>
                                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="All States">All States</SelectItem>
                                    {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input value={state} onChange={e => setState(e.target.value)} placeholder="e.g. All States" className="bg-background" />
                        )}
                    </div>
                </div>
            </div>

            <div className="pt-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Rate</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b pb-6">
                    <div>
                       <label className="font-bold text-lg mb-2 block">Tax Rate (%)</label>
                       <Input 
                           type="number" 
                           step="0.01"
                           min="0"
                           max="100"
                           placeholder="0.00"
                           value={singleRate} 
                           onChange={e => {
                               setSingleRate(e.target.value);
                               if(useAdvancedComps && components.length === 1) {
                                   updateComponent(0, 'rate', Number(e.target.value));
                               }
                           }} 
                           disabled={useAdvancedComps && components.length > 1} 
                           className="bg-background text-lg font-bold" 
                       />
                       {useAdvancedComps && components.length > 1 && <p className="text-sm text-muted-foreground mt-2">Rate is auto-calculated from components below.</p>}
                    </div>
                    <div>
                       <label className="font-bold text-lg mb-2 block">Tax Shipping</label>
                       <Select value={shippingTaxPolicy} onValueChange={(val: any) => setShippingTaxPolicy(val || '')}>
                           <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                           <SelectContent>
                               <SelectItem value="UseGlobal">Use Store Setting</SelectItem>
                               <SelectItem value="Taxable">Yes</SelectItem>
                               <SelectItem value="NonTaxable">No</SelectItem>
                           </SelectContent>
                       </Select>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between pb-2 pt-2">
                <div className="pr-8">
                   <h3 className="font-bold text-lg">Active</h3>
                </div>
                <Checkbox checked={isActive} onCheckedChange={(c: any) => setIsActive(c as boolean)} className="w-6 h-6" />
            </div>
         </CardContent>
      </Card>

      <div className="border rounded-lg bg-card overflow-hidden">
          <Button variant="ghost" className="w-full flex justify-between items-center p-6 h-auto hover:bg-muted/50 rounded-none" onClick={() => setShowAdvanced(!showAdvanced)}>
              <span className="font-bold text-lg">Advanced Options</span>
              {showAdvanced ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </Button>
          
          {showAdvanced && (
              <div className="p-6 pt-0 border-t space-y-6 bg-muted/20">
                  <div className="pt-4">
                      <div className="flex items-center space-x-2 mb-4">
                          <Checkbox id="useComps" checked={useAdvancedComps} onCheckedChange={(c: any) => setUseAdvancedComps(c as boolean)} />
                          <label htmlFor="useComps" className="font-bold cursor-pointer">Use Multi-Component Taxes (e.g. CGST + SGST)</label>
                      </div>
                      
                      {useAdvancedComps && (
                          <div className="space-y-4 pl-6 border-l-2 ml-2 mt-4">
                             {components.map((c, idx) => (
                                 <div key={idx} className="flex gap-4 items-end">
                                     <div className="flex-1">
                                         <label className="text-sm font-bold mb-2 block">Component Name</label>
                                         <Input value={c.label} onChange={e => updateComponent(idx, 'label', e.target.value)} placeholder="e.g. CGST" className="bg-background" />
                                     </div>
                                     <div className="w-32">
                                         <label className="text-sm font-bold mb-2 block">Rate (%)</label>
                                         <Input type="number" step="0.01" value={c.rate} onChange={e => updateComponent(idx, 'rate', Number(e.target.value))} className="bg-background" />
                                     </div>
                                     <Button variant="ghost" size="icon" onClick={() => removeComponent(idx)} disabled={components.length === 1}>
                                         <Trash2 className="w-4 h-4 text-red-500" />
                                     </Button>
                                 </div>
                             ))}
                             <Button variant="outline" size="sm" onClick={addComponent}>
                                 <Plus className="w-4 h-4 mr-2" /> Add Component
                             </Button>
                          </div>
                      )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                      <div>
                          <label className="font-bold mb-2 block">PIN / Postal Code Restriction</label>
                          <Input value={postalScope} onChange={e => setPostalScope(e.target.value)} placeholder="Leave blank for all" className="bg-background" />
                      </div>
                      <div>
                          <label className="font-bold mb-2 block">Priority Calculation Weight</label>
                          <Input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))} className="bg-background" />
                          <p className="text-xs text-muted-foreground mt-1">Leave at 0 to use automatic geographic priority.</p>
                      </div>
                  </div>
              </div>
          )}
      </div>

      <div className="flex justify-end pt-4">
         <Button size="lg" onClick={handleSave} disabled={isSaving || !taxClassId || singleRate === "" || Number(singleRate) < 0 || Number(singleRate) > 100}>
            {isSaving ? "Saving..." : (initialData ? "Save Changes" : "Create Tax Rate")}
         </Button>
      </div>
    </div>
  );
}
