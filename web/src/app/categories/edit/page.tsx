'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function EditCategoryForm() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [formData, setFormData] = useState({ name: '', slug: '', description: '', parentId: '' });
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/plugins/ecommerce-plugin/categories')
      .then(res => res.json())
      .then(data => { if (data.success) setCategories(data.categories); });

    if (id) {
      fetch(`/api/plugins/ecommerce-plugin/categories/${id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setFormData({
              name: data.category.name || '',
              slug: data.category.slug || '',
              description: data.category.description || '',
              parentId: data.category.parentId || ''
            });
          }
        });
    }
  }, [id]);

  const parentCategories = categories.filter(c => c._id !== id);

  const getCategoryPath = (cat: any): string => {
    let path = cat.name;
    let current = cat;
    while (current.parentId) {
      current = categories.find(c => c._id === current.parentId);
      if (current) path = current.name + ' > ' + path;
      else break;
    }
    return path;
  };

  const handleChange = (e: any) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleSelectChange = (val: any) => setFormData({ ...formData, parentId: val === 'none' ? '' : val });

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/plugins/ecommerce-plugin/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({...formData, parentId: formData.parentId || null})
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      window.location.href = '/plugins/ecommerce-plugin/ui/admin/categories/index.html';
    } else {
      alert('Error: ' + data.message);
    }
  };

  return (
    <div className="p-2 max-w-2xl mx-auto">
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold uppercase tracking-tight">Edit Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="uppercase font-semibold text-xs text-muted-foreground">Name *</Label>
              <Input type="text" name="name" list="commonCategories" value={formData.name} onChange={handleChange} required placeholder="Category name" />
              <datalist id="commonCategories">
                <option value="Clothing" />
                <option value="Men" />
                <option value="Women" />
                <option value="Kids" />
                <option value="Electronics" />
                <option value="Computers" />
                <option value="Smartphones" />
                <option value="Accessories" />
                <option value="Home & Garden" />
                <option value="Furniture" />
                <option value="Sports & Outdoors" />
                <option value="Beauty & Personal Care" />
                <option value="Health & Wellness" />
                <option value="Toys & Games" />
                <option value="Automotive" />
                <option value="Books & Media" />
                <option value="Pet Supplies" />
                <option value="Groceries" />
                <option value="Shoes" />
                <option value="Jewelry" />
              </datalist>
            </div>
            
            <div className="space-y-2">
              <Label className="uppercase font-semibold text-xs text-muted-foreground">Slug *</Label>
              <Input type="text" name="slug" value={formData.slug} onChange={handleChange} required placeholder="category-slug" />
            </div>

            <div className="space-y-2">
              <Label className="uppercase font-semibold text-xs text-muted-foreground">Description</Label>
              <Textarea name="description" value={formData.description} onChange={handleChange} rows={4} placeholder="Category description..." />
            </div>

            {parentCategories.length > 0 && (
              <div className="space-y-2">
                <Label className="uppercase font-semibold text-xs text-muted-foreground">Parent Category</Label>
                <Select key={parentCategories ? parentCategories.length : categories.length} value={formData.parentId || 'none'} onValueChange={handleSelectChange}>
                  <SelectTrigger>
                    <SelectValue>{formData.parentId && formData.parentId !== 'none' ? getCategoryPath(parentCategories.find(c => c._id === formData.parentId) || { name: 'Unknown Category' }) : '-- None (Root Category) --'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- None (Root Category) --</SelectItem>
                    {parentCategories.map(c => (
                      <SelectItem key={c._id} value={c._id}>{getCategoryPath(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-4 border-t pt-6">
            <Button type="button" variant="outline" onClick={() => window.location.href = '/plugins/ecommerce-plugin/ui/admin/categories/index.html'}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Update Category'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

export default function EditCategory() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-bold">Loading editor...</div>}>
      <EditCategoryForm />
    </Suspense>
  );
}




