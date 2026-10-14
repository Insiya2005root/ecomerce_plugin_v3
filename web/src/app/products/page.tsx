'use client';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// No lucide-react

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewProduct, setViewProduct] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/plugins/ecommerce-plugin/products?t=' + Date.now()).then(res => res.json()).then(data => { if (data.success) setProducts(data.products); });
    fetch('/api/plugins/ecommerce-plugin/categories?t=' + Date.now()).then(res => res.json()).then(data => { if (data.success) setCategories(data.categories); });
  }, []);

  const handleDelete = async (id: string) => {
    await fetch(`/api/plugins/ecommerce-plugin/products/${id}`, { method: 'DELETE' });
    setProducts(products.filter(p => p._id !== id));
    setDeleteConfirm(null);
  };

  return (
    <div className="p-2 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold uppercase tracking-tight">Products</h2>
          <p className="text-muted-foreground font-semibold mt-1">Manage your inventory and variants.</p>
        </div>
        
          <a href="/plugins/ecommerce-plugin/ui/admin/products/add/index.html">
            <span>+</span>
            Add Product
          </a>
      </div>
      
      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16"></TableHead>
              <TableHead className="font-bold uppercase text-xs">Name</TableHead>
              <TableHead className="font-bold uppercase text-xs">Category</TableHead>
              <TableHead className="font-bold uppercase text-xs">Price</TableHead>
              <TableHead className="font-bold uppercase text-xs">Stock</TableHead>
              <TableHead className="font-bold uppercase text-xs">Status</TableHead>
              <TableHead className="text-right font-bold uppercase text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground font-semibold">No products found. Create one!</TableCell>
              </TableRow>
            )}
            {products.map(prod => (
              <TableRow key={prod._id}>
                <TableCell>
                  <div className="w-12 h-12 bg-muted border rounded-md overflow-hidden flex items-center justify-center">
                    {prod.images?.[0] ? (
                      <img src={prod.images[0]} className="w-full h-full object-cover" alt="Thumb" />
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">No Img</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-bold text-base">{prod.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{prod.sku}</div>
                </TableCell>
                <TableCell className="font-semibold text-muted-foreground">
                  {prod.categoryId ? categories.find(c => c._id === prod.categoryId)?.name || 'Unknown' : 'â€”'}
                </TableCell>
                <TableCell className="font-bold">${prod.price}</TableCell>
                <TableCell className="font-semibold">{prod.variants?.length ? `${prod.variants.reduce((acc:any, v:any)=>acc+v.stock,0)} (Variants)` : prod.stock}</TableCell>
                <TableCell>
                  <Badge variant={prod.status === 'Published' ? 'default' : 'secondary'}>
                    {prod.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {deleteConfirm === prod._id ? (
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(prod._id)}>Confirm</Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                    </div>
                  ) : (
                                          <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setViewProduct(prod)}>View</Button>
                        <a href={`/plugins/ecommerce-plugin/ui/admin/products/edit/index.html?id=${prod._id}`} className={buttonVariants({variant: "outline", size: "sm"})}>Edit</a>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirm(prod._id)}>Delete</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
              </div>
        <Dialog open={!!viewProduct} onOpenChange={(open) => !open && setViewProduct(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-tight text-xl">{viewProduct?.name}</DialogTitle>
              <DialogDescription>Product details and SEO preview</DialogDescription>
            </DialogHeader>
                          {viewProduct && (
                <div className="space-y-6 pt-4 max-h-[80vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="font-semibold uppercase text-muted-foreground">Price:</span> ${viewProduct.price}</div>
                    <div><span className="font-semibold uppercase text-muted-foreground">SKU:</span> {viewProduct.sku}</div>
                    <div><span className="font-semibold uppercase text-muted-foreground">Stock:</span> {viewProduct.stock}</div>
                    <div><span className="font-semibold uppercase text-muted-foreground">Category:</span> {categories.find(c => c._id === viewProduct.categoryId)?.name || 'Unknown Category'}</div>
                  </div>

                  {viewProduct.images && viewProduct.images.length > 0 && (
                    <div className="pt-4 border-t">
                      <h4 className="font-semibold uppercase text-sm mb-3 text-muted-foreground">Images</h4>
                      <div className="flex gap-4 overflow-x-auto pb-2">
                        {viewProduct.images.map((img: string, i: number) => (
                          <img key={i} src={img} alt={`Product ${i}`} className="w-24 h-24 object-cover rounded-md border shadow-sm shrink-0" />
                        ))}
                      </div>
                    </div>
                  )}

                  {viewProduct.variants && viewProduct.variants.length > 0 && (
                    <div className="pt-4 border-t">
                      <h4 className="font-semibold uppercase text-sm mb-3 text-muted-foreground">Variants</h4>
                      <div className="grid gap-2">
                        {viewProduct.variants.map((v: any, i: number) => (
                          <div key={i} className="flex justify-between items-center bg-muted/50 p-3 rounded-md border text-sm">
                            <div>
                              <span className="font-bold">{v.size || 'N/A'}</span> / <span className="font-bold">{v.color || 'N/A'}</span>
                            </div>
                            <div className="flex gap-4 text-muted-foreground">
                              <span>Stock: <strong className="text-foreground">{v.stock}</strong></span>
                              {v.priceOverride ? <span>Price: <strong className="text-foreground">${v.priceOverride}</strong></span> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <h4 className="font-semibold uppercase text-sm mb-2 text-muted-foreground">Description</h4>
                    <p className="text-sm bg-muted/30 p-3 rounded-md border">{viewProduct.description || 'No description provided.'}</p>
                  </div>
                  
                  <div className="pt-4 border-t pb-4">
                    <h4 className="font-semibold uppercase text-sm mb-2 text-muted-foreground">Google Search Preview (SEO)</h4>
                    <div className="p-4 border rounded bg-white mt-2 max-w-2xl shadow-sm">
                      <div className="text-[14px] text-[#202124] font-normal font-sans mb-1">yoursite.com &gt; product &gt; {viewProduct.slug || 'product-slug'}</div>
                      <div className="text-[20px] text-[#1a0dab] font-normal font-sans hover:underline cursor-pointer truncate">{viewProduct.metaTitle || viewProduct.name || 'Product Title'}</div>
                      <div className="text-[14px] text-[#4d5156] font-normal font-sans mt-1 line-clamp-2">{viewProduct.metaDescription || viewProduct.description?.substring(0, 160) || 'Product meta description will appear here in search engine results.'}</div>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
        </Dialog>
      </div>
    );






}






