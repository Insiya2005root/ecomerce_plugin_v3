// @ts-nocheck
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function CustomDiscountBuilder({ initialData, onSave }) {
  const [name, setName] = useState(initialData?.name || "");
  const [priority, setPriority] = useState(initialData?.priority || 0);
  const [stackingPolicy, setStackingPolicy] = useState(initialData?.stackingPolicy || "allow");
  const [status, setStatus] = useState(initialData?.status || "Active");
  
  const [conditionTree, setConditionTree] = useState(initialData?.customConfig?.conditionTree || { operator: "AND", conditions: [] });
  const [actions, setActions] = useState(initialData?.customConfig?.actions || []);
  
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetch("/api/plugins/ecommerce-plugin/products").then(r => r.json()).then(d => setProducts(d.products || []));
    fetch("/api/plugins/ecommerce-plugin/categories").then(r => r.json()).then(d => setCategories(d.categories || []));
  }, []);

  const handleSave = () => {
    onSave({
      name,
      type: 'custom',
      status,
      priority,
      stackingPolicy,
      customConfig: {
        conditionTree,
        actions
      }
    });
  };
  
  // Basic recursive condition builder UI component
  const ConditionNode = ({ node, onChange, onRemove }) => {
     if (node.operator === "AND" || node.operator === "OR") {
         return (
             <div className="border border-border rounded-md p-4 space-y-4 bg-neutral-50/50 dark:bg-black">
                <div className="flex items-center justify-between">
                    <Select value={node.operator} onValueChange={(val) => onChange({...node, operator: val})}>
                        <SelectTrigger className="w-32 font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="AND">ALL (AND)</SelectItem>
                            <SelectItem value="OR">ANY (OR)</SelectItem>
                        </SelectContent>
                    </Select>
                    {onRemove && (
                        <Button variant="ghost" size="icon" onClick={onRemove}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    )}
                </div>
                
                <div className="pl-6 border-l-2 border-border space-y-4">
                    {node.conditions.map((child, idx) => (
                        <ConditionNode 
                            key={idx} 
                            node={child} 
                            onChange={(updatedChild) => {
                                const newConds = [...node.conditions];
                                newConds[idx] = updatedChild;
                                onChange({...node, conditions: newConds});
                            }}
                            onRemove={() => {
                                const newConds = [...node.conditions];
                                newConds.splice(idx, 1);
                                onChange({...node, conditions: newConds});
                            }}
                        />
                    ))}
                    
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                            onChange({...node, conditions: [...node.conditions, { type: "CartTotal", operator: ">=", value: "" }]});
                        }}>+ Add Condition</Button>
                        <Button variant="outline" size="sm" onClick={() => {
                            onChange({...node, conditions: [...node.conditions, { operator: "AND", conditions: [] }]});
                        }}>+ Add Group</Button>
                    </div>
                </div>
             </div>
         );
     }
     
     // Leaf condition
     return (
         <div className="flex flex-wrap items-center gap-2 bg-card text-card-foreground p-3 rounded-md border border-border shadow-sm">
            <Select value={node.type} onValueChange={(val) => onChange({...node, type: val, operator: '=', value: ''})}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="CartTotal">Cart Total</SelectItem>
                    <SelectItem value="CartItemCount">Cart Item Count</SelectItem>
                    <SelectItem value="TotalCartQuantity">Total Cart Quantity</SelectItem>
                    <SelectItem value="ProductInCart">Product In Cart</SelectItem>
                    <SelectItem value="CategoryInCart">Category In Cart</SelectItem>
                    <SelectItem value="ProductQuantity">Product Quantity</SelectItem>
                    <SelectItem value="DayOfWeek">Day Of Week</SelectItem>
                    <SelectItem value="Date">Date</SelectItem>
                    <SelectItem value="Time">Time</SelectItem>
                    <SelectItem value="Location">Location (City)</SelectItem>
                </SelectContent>
            </Select>
            
            <Select value={node.operator} onValueChange={(val) => onChange({...node, operator: val})}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {["CartTotal", "CartItemCount", "TotalCartQuantity", "ProductQuantity"].includes(node.type) && (
                        <>
                            <SelectItem value="=">Equals</SelectItem>
                            <SelectItem value=">">Greater than</SelectItem>
                            <SelectItem value=">=">Greater or eq</SelectItem>
                            <SelectItem value="<">Less than</SelectItem>
                            <SelectItem value="<=">Less or eq</SelectItem>
                        </>
                    )}
                    {["ProductInCart", "CategoryInCart"].includes(node.type) && (
                        <>
                            <SelectItem value="Contains">Contains</SelectItem>
                            <SelectItem value="Does Not Contain">Does Not Contain</SelectItem>
                            <SelectItem value="Any Of">Any Of</SelectItem>
                            <SelectItem value="All Of">All Of</SelectItem>
                        </>
                    )}
                    {["DayOfWeek", "Location"].includes(node.type) && (
                        <>
                            <SelectItem value="Is">Is</SelectItem>
                            <SelectItem value="Is Not">Is Not</SelectItem>
                            <SelectItem value="Any Of">Any Of</SelectItem>
                        </>
                    )}
                    {["Date"].includes(node.type) && (
                        <>
                            <SelectItem value="On">On</SelectItem>
                            <SelectItem value="Before">Before</SelectItem>
                            <SelectItem value="After">After</SelectItem>
                        </>
                    )}
                    {["Time"].includes(node.type) && (
                        <>
                            <SelectItem value="Before">Before</SelectItem>
                            <SelectItem value="After">After</SelectItem>
                        </>
                    )}
                </SelectContent>
            </Select>

            {["ProductInCart"].includes(node.type) ? (
                 <Select value={node.value ? node.value[0] : ""} onValueChange={(val) => onChange({...node, value: [val]})}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Select Product" /></SelectTrigger>
                    <SelectContent>
                        {products.map(p => <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            ) : ["CategoryInCart"].includes(node.type) ? (
                 <Select value={node.value ? node.value[0] : ""} onValueChange={(val) => onChange({...node, value: [val]})}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Select Category" /></SelectTrigger>
                    <SelectContent>
                        {categories.map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            ) : ["DayOfWeek"].includes(node.type) ? (
                <Select value={node.value} onValueChange={(val) => onChange({...node, value: val})}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                </Select>
            ) : ["Date"].includes(node.type) ? (
                <Input type="date" value={node.value || ''} onChange={e => onChange({...node, value: e.target.value})} className="w-40" />
            ) : ["Time"].includes(node.type) ? (
                <Input type="time" value={node.value || ''} onChange={e => onChange({...node, value: e.target.value})} className="w-32" />
            ) : ["Location"].includes(node.type) ? (
                <Input type="text" placeholder="City name" value={node.value || ''} onChange={e => onChange({...node, locationField: 'City', value: e.target.value})} className="w-48" />
            ) : (
                <Input type="number" value={node.value} onChange={(e) => onChange({...node, value: e.target.value})} className="w-32" placeholder="Value" />
            )}

            {node.type === "ProductQuantity" && (
                <Select value={node.product} onValueChange={(val) => onChange({...node, product: val})}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Select Product" /></SelectTrigger>
                    <SelectContent>
                        {products.map(p => <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            )}
            
            <Button variant="ghost" size="icon" className="ml-auto" onClick={onRemove}><Trash2 className="w-4 h-4 text-red-500" /></Button>
         </div>
     );
  };

  const ActionNode = ({ action, idx, onChange, onRemove }) => {
      return (
          <div className="flex flex-col gap-4 bg-card text-card-foreground p-4 rounded-md border border-border shadow-sm relative">
             <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={onRemove}><Trash2 className="w-4 h-4 text-red-500" /></Button>
             
             <div className="flex items-center gap-4">
                 <span className="font-bold w-24">Action</span>
                 <Select value={action.type} onValueChange={(val) => onChange({...action, type: val})}>
                    <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="PercentageOff">Percentage Off</SelectItem>
                        <SelectItem value="FixedAmountOff">Fixed Amount Off</SelectItem>
                        <SelectItem value="SetProductPrice">Set Product Price</SelectItem>
                        <SelectItem value="FreeProduct">Free Product (Auto-Add)</SelectItem>
                        <SelectItem value="FreeShipping">Free Shipping</SelectItem>
                    </SelectContent>
                </Select>
             </div>
             
             {/* Fields based on action type */}
             {["PercentageOff", "FixedAmountOff", "SetProductPrice"].includes(action.type) && (
                 <div className="flex items-center gap-4 pl-28">
                    {action.type === "PercentageOff" && <Input type="number" placeholder="Percentage (e.g. 20)" value={action.percentage || ''} onChange={e => onChange({...action, percentage: e.target.value})} className="w-48" />}
                    {action.type === "FixedAmountOff" && <Input type="number" placeholder="Amount (e.g. 500)" value={action.amount || ''} onChange={e => onChange({...action, amount: e.target.value})} className="w-48" />}
                    {action.type === "SetProductPrice" && <Input type="number" placeholder="New Price (e.g. 99)" value={action.newPrice || ''} onChange={e => onChange({...action, newPrice: e.target.value})} className="w-48" />}
                    
                    {action.type !== "SetProductPrice" && (
                        <Select value={action.applyTo || "EntireCart"} onValueChange={(val) => onChange({...action, applyTo: val})}>
                            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="EntireCart">Entire Cart</SelectItem>
                                <SelectItem value="SpecificProduct">Specific Product</SelectItem>
                                <SelectItem value="Category">Specific Category</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                    
                    {(action.applyTo === "SpecificProduct" || action.type === "SetProductPrice") && (
                        <Select value={action.productIds ? action.productIds[0] : ""} onValueChange={(val) => onChange({...action, productIds: [val]})}>
                            <SelectTrigger className="w-64"><SelectValue placeholder="Select Product" /></SelectTrigger>
                            <SelectContent>
                                {products.map(p => <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                    
                    {action.applyTo === "Category" && (
                        <Select value={action.categoryIds ? action.categoryIds[0] : ""} onValueChange={(val) => onChange({...action, categoryIds: [val]})}>
                            <SelectTrigger className="w-64"><SelectValue placeholder="Select Category" /></SelectTrigger>
                            <SelectContent>
                                {categories.map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                 </div>
             )}
             
             {action.type === "FreeProduct" && (
                 <div className="flex items-center gap-4 pl-28">
                    <Select value={action.rewardProductId || ""} onValueChange={(val) => onChange({...action, rewardProductId: val})}>
                        <SelectTrigger className="w-64"><SelectValue placeholder="Select Free Product" /></SelectTrigger>
                        <SelectContent>
                            {products.map(p => <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Input type="number" placeholder="Qty" value={action.quantity || 1} onChange={e => onChange({...action, quantity: e.target.value})} className="w-24" />
                    
                    <Select value={action.autoAdd !== false ? "ON" : "OFF"} onValueChange={(val) => onChange({...action, autoAdd: val === "ON"})}>
                        <SelectTrigger className="w-32"><SelectValue placeholder="Auto Add" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ON">Auto Add: ON</SelectItem>
                            <SelectItem value="OFF">Auto Add: OFF</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>
             )}
          </div>
      )
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
       <div className="flex justify-between items-center bg-card text-card-foreground p-6 rounded-md shadow-sm border">
          <div className="w-1/2">
             <label className="text-sm font-bold mb-2 block">Discount Name</label>
             <Input placeholder="e.g. Tuesday Book Sale" value={name} onChange={e => setName(e.target.value)} className="text-lg font-bold" />
          </div>
          <Button size="lg" className="w-48" onClick={handleSave}>Save Custom Rule</Button>
       </div>
       
       <div className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">WHEN <span className="text-muted-foreground font-normal text-lg ml-2">(Conditions)</span></h2>
          <ConditionNode node={conditionTree} onChange={setConditionTree} onRemove={null} />
       </div>
       
       <div className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">THEN <span className="text-muted-foreground font-normal text-lg ml-2">(Actions)</span></h2>
          <div className="space-y-4 bg-neutral-50/50 dark:bg-black p-6 rounded-md border border-border">
             {actions.map((act, idx) => (
                 <ActionNode 
                    key={idx} 
                    action={act} 
                    idx={idx}
                    onChange={(newAct) => {
                        const newActions = [...actions];
                        newActions[idx] = newAct;
                        setActions(newActions);
                    }} 
                    onRemove={() => {
                        const newActions = [...actions];
                        newActions.splice(idx, 1);
                        setActions(newActions);
                    }} 
                 />
             ))}
             <Button variant="outline" onClick={() => setActions([...actions, { type: 'PercentageOff', applyTo: 'EntireCart' }])}>
                 + Add Action
             </Button>
          </div>
       </div>

       <div className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">WITH <span className="text-muted-foreground font-normal text-lg ml-2">(Controls)</span></h2>
          <div className="grid grid-cols-2 gap-6 bg-card text-card-foreground p-6 rounded-md border shadow-sm">
             <div>
                <label className="text-sm font-bold mb-2 block">Status</label>
                <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Paused">Paused</SelectItem>
                        <SelectItem value="Draft">Draft</SelectItem>
                    </SelectContent>
                </Select>
             </div>
             <div>
                <label className="text-sm font-bold mb-2 block">Priority (Higher runs first)</label>
                <Input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))} />
             </div>
             <div>
                <label className="text-sm font-bold mb-2 block">Stacking Policy</label>
                <Select value={stackingPolicy} onValueChange={setStackingPolicy}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="allow">Allow with other discounts</SelectItem>
                        <SelectItem value="exclusive">Do not combine (Exclusive)</SelectItem>
                    </SelectContent>
                </Select>
             </div>
          </div>
       </div>
    </div>
  );
}

