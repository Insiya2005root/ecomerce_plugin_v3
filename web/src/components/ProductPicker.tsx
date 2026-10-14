import React, { useState, useEffect } from 'react';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { X } from 'lucide-react';

interface ProductPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  categories?: any[];
}

export function ProductPicker({ selectedIds = [], onChange, categories: externalCategories }: ProductPickerProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  const [categories, setCategories] = useState<any[]>(externalCategories || []);
  const [selectedDetails, setSelectedDetails] = useState<Record<string, any>>({});

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Load categories if not provided
  useEffect(() => {
    if (!externalCategories || externalCategories.length === 0) {
      fetch('/api/plugins/ecommerce-plugin/categories?t=' + Date.now())
        .then(res => res.json())
        .then(data => {
          if (data.success) setCategories(data.categories);
        })
        .catch(console.error);
    } else {
      setCategories(externalCategories);
    }
  }, [externalCategories]);

  // Load selected details initially (to resolve IDs to Names)
  useEffect(() => {
    if (selectedIds.length > 0) {
      const missingIds = selectedIds.filter(id => !selectedDetails[id]);
      if (missingIds.length > 0) {
        fetch('/api/plugins/ecommerce-plugin/products?ids=' + missingIds.join(','))
          .then(res => res.json())
          .then(data => {
            if (data.success && data.products) {
              const newDetails = { ...selectedDetails };
              data.products.forEach((p: any) => {
                newDetails[p._id] = p;
              });
              setSelectedDetails(newDetails);
            }
          })
          .catch(console.error);
      }
    }
  }, [selectedIds, selectedDetails]);

  // Load products when search/category/page changes
  useEffect(() => {
    setLoading(true);
    let url = `/api/plugins/ecommerce-plugin/products?page=${page}&limit=10`;
    if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
    if (categoryId && categoryId !== 'all') url += `&categoryId=${encodeURIComponent(categoryId)}`;
    
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (page === 1) {
            setProducts(data.products);
          } else {
            setProducts(prev => {
              const existingIds = new Set(prev.map(p => p._id));
              const newProducts = data.products.filter((p: any) => !existingIds.has(p._id));
              return [...prev, ...newProducts];
            });
          }
          setHasMore(data.products.length === 10);
          
          const newDetails = { ...selectedDetails };
          data.products.forEach((p: any) => {
            if (!newDetails[p._id]) newDetails[p._id] = p;
          });
          setSelectedDetails(newDetails);
        }
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, [debouncedSearch, categoryId, page]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
    setProducts([]);
  }, [debouncedSearch, categoryId]);

  const handleToggle = (id: string, product: any) => {
    let newSelection = [...selectedIds];
    if (newSelection.includes(id)) {
      newSelection = newSelection.filter(x => x !== id);
    } else {
      newSelection.push(id);
      setSelectedDetails(prev => ({ ...prev, [id]: product }));
    }
    onChange(newSelection);
  };

  const handleRemove = (id: string) => {
    onChange(selectedIds.filter(x => x !== id));
  };

  const getCategoryName = (catId: string) => {
    if (!catId) return 'No Category';
    const found = categories.find(c => String(c._id) === String(catId));
    return found ? found.name : 'Unknown Category';
  };

  return (
    <div className="space-y-6 border border-border bg-card text-card-foreground p-5 rounded-lg shadow-sm">
      
      {/* Search and Filters */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight">Target Products</h3>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1 w-full">
            <Input 
              placeholder="Search products by name / SKU..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border-input"
            />
          </div>
          <div className="w-full sm:w-64">
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v || "all")}>
              <SelectTrigger className="w-full bg-background border-input">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat: any) => (
                  <SelectItem key={cat._id} value={cat._id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <hr className="border-border" />

      {/* Selected Products Area */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-tight">Selected Products ({selectedIds.length})</h3>
          {selectedIds.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => onChange([])} className="h-8 text-xs text-muted-foreground hover:text-destructive">
              Clear All
            </Button>
          )}
        </div>
        
        {selectedIds.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedIds.map(id => {
              const d = selectedDetails[id];
              return (
                <div key={id} className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 text-sm px-3 py-1.5 rounded-full group transition-colors hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30">
                  <span className="font-medium">{d ? d.name : 'Loading...'}</span>
                  <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); handleRemove(id); }} 
                    className="opacity-70 group-hover:opacity-100 transition-opacity focus:outline-none"
                    aria-label="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No products selected yet.</p>
        )}
      </div>

      <hr className="border-border" />

      {/* Product List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight">Products</h3>
        <div className="border border-border rounded-md overflow-hidden flex flex-col bg-background">
          <div className="max-h-[350px] overflow-y-auto">
            {products.map(p => {
              const isSelected = selectedIds.includes(p._id);
              return (
                <div 
                  key={p._id} 
                  className={`flex items-start gap-4 p-4 border-b border-border last:border-0 cursor-pointer transition-colors ${
                    isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => handleToggle(p._id, p)}
                >
                  <div className="pt-1">
                    <Checkbox 
                      checked={isSelected} 
                      onCheckedChange={() => handleToggle(p._id, p)}
                      className="w-5 h-5"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="font-semibold text-foreground text-base leading-none">
                      {p.name}
                    </div>
                    <div className="text-sm text-muted-foreground grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pt-1">
                      <div><span className="opacity-75">SKU:</span> {p.sku || 'N/A'}</div>
                      <div><span className="opacity-75">Price:</span> ₹{p.price || 0}</div>
                      <div className="sm:col-span-2"><span className="opacity-75">Category:</span> {getCategoryName(p.categoryId)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {products.length === 0 && !loading && (
              <div className="p-8 text-center flex flex-col items-center justify-center space-y-2 text-muted-foreground">
                <p>No products found matching your criteria.</p>
              </div>
            )}
            
            {loading && (
              <div className="p-8 text-center text-muted-foreground flex items-center justify-center space-x-2">
                <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                <span>Loading products...</span>
              </div>
            )}
          </div>
          
          {hasMore && !loading && products.length > 0 && (
            <div className="p-3 border-t border-border bg-muted/20 text-center">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} className="w-full sm:w-auto">
                Load More
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
