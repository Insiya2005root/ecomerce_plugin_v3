'use client';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
// No lucide-react

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewCategory, setViewCategory] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/plugins/ecommerce-plugin/categories?t=' + Date.now())
      .then(res => res.json())
      .then(data => {
        if (data.success) setCategories(data.categories);
      });
  }, []);

    const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/plugins/ecommerce-plugin/categories/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setCategories(categories.filter(c => c._id !== id));
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert("Failed to delete category");
    }
    setDeleteConfirm(null);
  };

  const buildTree = (parentId: string | null = null, level: number = 0): any[] => {
    return categories
      .filter(c => (c.parentId || null) === parentId)
      .flatMap(c => [{ ...c, level }, ...buildTree(c._id, level + 1)]);
  };

  const treeCategories = buildTree(null, 0);

  return (
    <div className="p-2 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold uppercase tracking-tight">Categories</h2>
          <p className="text-muted-foreground font-semibold mt-1">Manage product categories.</p>
        </div>
        
          <a href="/plugins/ecommerce-plugin/ui/admin/categories/add/index.html">
            <span>+</span>
            Add Category
          </a>
      </div>
      
      <div className="border rounded-md bg-card">
                  <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-bold uppercase text-xs">Name</TableHead>
                <TableHead className="font-bold uppercase text-xs">Products</TableHead>
                <TableHead className="font-bold uppercase text-xs">Slug</TableHead>
                <TableHead className="text-right font-bold uppercase text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {treeCategories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground font-semibold">No categories found.</TableCell>
                </TableRow>
              )}
              {treeCategories.map(cat => (
                <TableRow key={cat._id}>
                  <TableCell className="font-bold text-base">
                    <div className="flex items-center" style={{ paddingLeft: `${cat.level * 2}rem` }}>
                      {cat.level > 0 && <span className="text-muted-foreground mr-2 font-light">└─ </span>}
                      {cat.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {cat.productCount > 0 ? (
                      <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-bold">{cat.productCount} item(s)</span>
                    ) : (
                      <span className="text-muted-foreground text-xs font-semibold">0 items</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">{cat.slug}</TableCell>
                  <TableCell className="text-right">
                    {deleteConfirm === cat._id ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(cat._id)}>Confirm</Button>
                        <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setViewCategory(cat)}>View</Button>
                        <a href={`/plugins/ecommerce-plugin/ui/admin/categories/edit/index.html?id=${cat._id}`} className={buttonVariants({variant: "outline", size: "sm"})}>Edit</a>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirm(cat._id)}>Delete</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
              </div>
        <Dialog open={!!viewCategory} onOpenChange={(open) => !open && setViewCategory(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-tight text-xl">{viewCategory?.name} - Hierarchy</DialogTitle>
              <DialogDescription>Full subcategory tree</DialogDescription>
            </DialogHeader>
            <div className="pt-4 space-y-2 max-h-96 overflow-y-auto">
              {viewCategory && buildTree(viewCategory._id, 1).map((sub: any) => (
                <div key={sub._id} style={{ paddingLeft: `${sub.level}rem` }} className="flex items-center gap-2 py-1 border-b last:border-0 border-border/50">
                  <span className="text-muted-foreground">?</span>
                  <span className="font-semibold">{sub.name}</span>
                </div>
              ))}
              {viewCategory && buildTree(viewCategory._id, 1).length === 0 && (
                <div className="text-muted-foreground text-sm italic">No subcategories.</div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );






}






