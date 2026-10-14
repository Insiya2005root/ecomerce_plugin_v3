'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
// No lucide-react

export default function AddProduct() {
  const [formData, setFormData] = useState({
    name: '', description: '', price: '', discountPercentage: '0', costPrice: '', sku: '', barcode: '',
    stock: '', categoryId: '', status: 'Published', metaTitle: '', metaDescription: ''
  });
  const [taxClassId, setTaxClassId] = useState('Default');
  const [taxClasses, setTaxClasses] = useState<any[]>([]);
  const [isDigital, setIsDigital] = useState(false);

  const [categories, setCategories] = useState<any[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/plugins/ecommerce-plugin/taxes/classes').then(r => r.json()).then(d => { if(d.success) setTaxClasses(d.classes); });
    fetch('/api/plugins/ecommerce-plugin/categories?t=' + Date.now())
      .then(res => res.json())
      .then(data => { if (data.success) setCategories(data.categories); });
  }, []);

  const handleChange = (e: any) => setFormData({ ...formData, [e.target.name]: e.target.value });
  
  const handleVariantChange = (index: number, field: string, value: any) => {
    const newVariants = [...variants];
    newVariants[index][field] = value;
    setVariants(newVariants);
  };

  const addVariant = () => setVariants([...variants, { size: '', color: '', stock: 0, priceOverride: '' }]);
  const removeVariant = (index: number) => setVariants(variants.filter((_, i) => i !== index));

  const handleImageDrop = (e: any) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || e.target.files);
    files.forEach((file: any) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (file.type.startsWith('video/')) {
          setVideos(prev => [...prev, event.target?.result as string]);
        } else {
          setImages(prev => [...prev, event.target?.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!formData.categoryId) return alert("Please select a Category");
    
    setLoading(true);
    const payload = { ...formData, taxClassId, isDigital, images, videos, variants: variants.length > 0 ? variants : undefined };

    const res = await fetch('/api/plugins/ecommerce-plugin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      window.location.href = '/plugins/ecommerce-plugin/ui/admin/products/index.html';
    } else {
      alert('Error: ' + data.message);
    }
  };

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

  return (
    <div className="p-2 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight uppercase">Add Product</h2>
        <div className="w-48">
          <Select value={formData.status} onValueChange={(val: any) => setFormData({...formData, status: val})}>
            <SelectTrigger className="font-semibold bg-muted">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Published">Published</SelectItem>
              <SelectItem value="Archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label className="uppercase font-semibold text-xs text-muted-foreground">Title *</Label>
                <Input type="text" name="name" value={formData.name} onChange={handleChange} required className="text-lg font-bold" placeholder="Product name" />
              </div>
              <div className="space-y-2">
                <Label className="uppercase font-semibold text-xs text-muted-foreground">Description</Label>
                <Textarea name="description" value={formData.description} onChange={handleChange} rows={5} placeholder="Product description..." />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg uppercase">Media Gallery</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div 
                onDragOver={(e) => e.preventDefault()} 
                onDrop={handleImageDrop}
                className="border-2 border-dashed rounded-lg p-12 text-center bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
              >
                <span>Upload</span>
                <div className="text-muted-foreground font-bold mb-4">Drag and drop images and videos here</div>
                <input type="file" multiple className="hidden" id="media-upload" onChange={handleImageDrop} />
                <Button type="button" variant="outline" onClick={() => document.getElementById('media-upload')?.click()}>Browse Files</Button>
                
                <div className="flex gap-4 flex-wrap mt-8 justify-center">
                  {images.map((img, i) => (
                    <div key={`img-${i}`} className="relative group">
                      <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); setImages(images.filter((_, idx) => idx !== i)); }}>
                        <span>X</span>
                      </Button>
                      <img src={img} alt="Preview" className="h-24 w-24 object-cover border rounded-md shadow-sm" />
                    </div>
                  ))}
                  {videos.map((vid, i) => (
                    <div key={`vid-${i}`} className="relative group">
                      <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); setVideos(videos.filter((_, idx) => idx !== i)); }}>
                        <span>X</span>
                      </Button>
                      <video src={vid} className="h-24 w-24 object-cover border rounded-md shadow-sm" controls />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4 mb-4">
              <CardTitle className="text-lg uppercase">Variants</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                <span>+</span> Add Variant
              </Button>
            </CardHeader>
            <CardContent>
              {variants.length === 0 ? (
                <p className="text-sm font-semibold text-muted-foreground italic">No variants added. Product uses master stock.</p>
              ) : (
                <div className="space-y-4">
                  {variants.map((v, i) => (
                                          <div key={i} className="p-4 bg-muted border rounded-md flex flex-col gap-4">
                        <div className="flex justify-between items-center border-b pb-2 border-border/50">
                          <h4 className="font-bold text-sm uppercase text-muted-foreground">Variant {i + 1}</h4>
                          <Button type="button" variant="destructive" size="sm" onClick={() => removeVariant(i)}>Remove</Button>
                        </div>
                        <div className="flex flex-wrap gap-4 items-end">
                      <div className="flex-1 min-w-[120px] space-y-1">
                        <Label className="text-xs uppercase">Size</Label>
                        <Input type="text" value={v.size} onChange={e => handleVariantChange(i, 'size', e.target.value)} placeholder="e.g. XL" />
                      </div>
                      <div className="flex-1 min-w-[120px] space-y-1">
                        <Label className="text-xs uppercase">Color</Label>
                        <Input type="text" value={v.color} onChange={e => handleVariantChange(i, 'color', e.target.value)} placeholder="e.g. Red" />
                      </div>
                      <div className="w-24 space-y-1">
                        <Label className="text-xs uppercase">Stock</Label>
                                                  <Input type="number" value={v.stock} onChange={e => handleVariantChange(i, 'stock', Number(e.target.value))} />
                        </div>
                        </div>
                      </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg uppercase">Logistics & SEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="uppercase font-semibold text-xs text-muted-foreground">Cost Price</Label>
                  <Input type="number" name="costPrice" value={formData.costPrice} onChange={handleChange} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label className="uppercase font-semibold text-xs text-muted-foreground">Barcode (ISBN, UPC)</Label>
                  <Input type="text" name="barcode" value={formData.barcode} onChange={handleChange} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="uppercase font-semibold text-xs text-muted-foreground">Meta Title</Label>
                  <Input type="text" name="metaTitle" value={formData.metaTitle} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                                      <Label className="uppercase font-semibold text-xs text-muted-foreground">Meta Description</Label>
                    <Input type="text" name="metaDescription" value={formData.metaDescription} onChange={handleChange} />
                  </div>
                </div>

                <div className="pt-6 border-t mt-6">
                  <Label className="uppercase font-semibold text-xs text-muted-foreground mb-2 block">Google Search Preview</Label>
                  <div className="p-4 border rounded bg-white mt-2 max-w-2xl">
                    <div className="text-[14px] text-[#202124] font-normal font-sans mb-1">yoursite.com &gt; product &gt; {formData.name ? formData.name.toLowerCase().replace(/\s+/g, '-') : 'product-slug'}</div>
                    <div className="text-[20px] text-[#1a0dab] font-normal font-sans hover:underline cursor-pointer truncate">{formData.metaTitle || formData.name || 'Product Title'}</div>
                    <div className="text-[14px] text-[#4d5156] font-normal font-sans mt-1 line-clamp-2">{formData.metaDescription || formData.description?.substring(0, 160) || 'Product meta description will appear here in search engine results.'}</div>
                  </div>
                </div>
              </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg uppercase">Pricing & Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="uppercase font-semibold text-xs text-muted-foreground">Price *</Label>
                <Input type="number" name="price" value={formData.price} onChange={handleChange} required placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label className="uppercase font-semibold text-xs text-muted-foreground">Discount %</Label>
                  <Input type="number" min="0" max="100" placeholder="e.g. 5 for 5%" value={formData.discountPercentage} onChange={(e) => setFormData({ ...formData, discountPercentage: e.target.value })} />
              
              </div>
              <div className="space-y-2">
                <Label className="uppercase font-semibold text-xs text-muted-foreground">Tax Category</Label>
                <Select value={taxClassId} onValueChange={(val: any) => setTaxClassId(val || 'Default')}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Default">Default</SelectItem>
                    <SelectItem value="NonTaxable">Non-Taxable</SelectItem>
                    {taxClasses.filter(c => c.status === 'Active' || c._id === taxClassId).map(c => (
                        <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="uppercase font-semibold text-xs text-muted-foreground">Master Stock</Label>
                <Input type="number" name="stock" value={formData.stock} onChange={handleChange} placeholder="0" disabled={variants.length > 0} />
                {variants.length > 0 && <p className="text-xs text-muted-foreground">Stock managed via variants.</p>}
              </div>
              <div className="space-y-2">
                <Label className="uppercase font-semibold text-xs text-muted-foreground">SKU</Label>
                <Input type="text" name="sku" value={formData.sku} onChange={handleChange} placeholder="Stock Keeping Unit" />
              </div>

              <div className="pt-4 border-t space-y-4">
                <div className="flex items-center space-x-2">
                  
                  
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="digital" checked={isDigital} onCheckedChange={(c) => setIsDigital(c as boolean)} />
                  <Label htmlFor="digital" className="font-semibold">Digital Product (No Shipping)</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg uppercase">Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label className="uppercase font-semibold text-xs text-muted-foreground">Select Category *</Label>
                <Select key={categories.length} value={formData.categoryId || 'none'} onValueChange={(val: any) => setFormData({...formData, categoryId: val === 'none' ? '' : val})}>
                  <SelectTrigger>
                    <SelectValue>{formData.categoryId && formData.categoryId !== 'none' ? getCategoryPath(categories.find(c => c._id === formData.categoryId) || { name: 'Unknown Category' }) : '-- Choose Category --'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Choose Category --</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c._id} value={c._id}>{getCategoryPath(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4 mt-4">
            <Button type="button" variant="outline" onClick={() => window.location.href = '/plugins/ecommerce-plugin/ui/admin/products/index.html'}>Cancel</Button>
            <Button type="submit" disabled={loading} size="lg">
              {loading ? 'Saving...' : 'Save Product'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}














