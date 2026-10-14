"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Play, Pause, Trash2, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function LocationsPage() {
  const [locations, setLocations] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const fetchLocations = async () => {
    try {
      const res = await fetch("/api/plugins/ecommerce-plugin/locations");
      const data = await res.json();
      if (data.success) {
        setLocations(data.locations);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "Active" ? "Inactive" : "Active";
    await fetch(`/api/plugins/ecommerce-plugin/locations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchLocations();
  };

  const deleteLocation = async (id: string) => {
    if (!confirm("Delete this location?")) return;
    await fetch(`/api/plugins/ecommerce-plugin/locations/${id}`, {
      method: "DELETE",
    });
    fetchLocations();
  };
  
  const filteredLocations = locations.filter((l: any) => 
      l.name.toLowerCase().includes(search.toLowerCase()) || 
      l.city.toLowerCase().includes(search.toLowerCase())
  );
  
  const activeCount = locations.filter(l => l.status === 'Active').length;
  const inactiveCount = locations.length - activeCount;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <Button variant="ghost" className="mb-4" onClick={() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/settings/index.html"}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Store Settings
      </Button>
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locations / Warehouses</h1>
          <p className="text-muted-foreground mt-1">
             Active Locations: <span className="font-bold">{activeCount}</span> | 
             Inactive Locations: <span className="font-bold">{inactiveCount}</span>
          </p>
        </div>
        <Button onClick={() => window.location.href = "/plugins/ecommerce-plugin/ui/admin/settings/locations/add/index.html"}>
          <Plus className="w-4 h-4 mr-2" /> Add Location
        </Button>
      </div>
      
      <div className="flex gap-4 items-center">
         <Input 
            placeholder="Search Locations..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="max-w-sm"
         />
      </div>

      <div className="border rounded-md bg-card text-card-foreground">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>City / State</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLocations.map((loc) => (
              <TableRow key={loc._id}>
                <TableCell className="font-bold">{loc.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm truncate max-w-[200px]">{loc.addressLine1}</TableCell>
                <TableCell>{loc.city}, {loc.state}</TableCell>
                <TableCell>
                  <Badge variant={loc.status === 'Active' ? 'default' : 'secondary'}>{loc.status}</Badge>
                </TableCell>
                <TableCell>{loc.priority}</TableCell>
                <TableCell className="text-right flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => window.location.href = `/plugins/ecommerce-plugin/ui/admin/settings/locations/edit/index.html?id=${loc._id}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleStatus(loc._id, loc.status)}>
                      {loc.status === 'Active' ? <Pause className="w-4 h-4 text-orange-500" /> : <Play className="w-4 h-4 text-green-500" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteLocation(loc._id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                </TableCell>
              </TableRow>
            ))}
            {filteredLocations.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No locations found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

