'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function DashboardPage() {
  const [productCount, setProductCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/plugins/ecommerce-plugin/products?t=' + Date.now()).then(res => res.json()),
      fetch('/api/plugins/ecommerce-plugin/categories?t=' + Date.now()).then(res => res.json())
    ]).then(([prodData, catData]) => {
      const products = prodData.products || [];
      const categories = catData.categories || [];
      
      setProductCount(products.length);
      setCategoryCount(categories.length);

      // Map product counts per category
      const counts: any = {};
      products.forEach((p: any) => {
        if (p.categoryId) {
          counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
        }
      });

      const data = categories.map((c: any) => ({
        name: c.name,
        Products: counts[c._id] || 0
      })).sort((a: any, b: any) => b.Products - a.Products); // Sort by most products

      setChartData(data.slice(0, 7)); // Show top 7
    });
  }, []);

  return (
    <div className="space-y-8 p-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="hover:-translate-y-1 transition-transform">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold tracking-widest uppercase text-center text-muted-foreground">Total Products</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center pt-4">
            <p className="text-6xl font-bold">{productCount}</p>
            <a href="/plugins/ecommerce-plugin/ui/admin/products/index.html" className="text-sm mt-6 hover:underline font-bold text-muted-foreground border-b border-border">Manage Products</a>
          </CardContent>
        </Card>
        
        <Card className="hover:-translate-y-1 transition-transform">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold tracking-widest uppercase text-center text-muted-foreground">Total Categories</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center pt-4">
            <p className="text-6xl font-bold">{categoryCount}</p>
            <a href="/plugins/ecommerce-plugin/ui/admin/categories/index.html" className="text-sm mt-6 hover:underline font-bold text-muted-foreground border-b border-border">Manage Categories</a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold tracking-widest uppercase text-center text-muted-foreground">Store Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center pt-8">
            <Badge variant="outline" className="text-base px-6 py-2 bg-green-500/10 text-green-600 border-green-500">ONLINE</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="uppercase tracking-tight text-lg">Products by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="h-[350px] w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888888" strokeOpacity={0.2} />
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip 
                      cursor={{fill: '#888888', opacity: 0.1}}
                      contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '8px', border: '1px solid #88888840', color: 'currentColor' }} 
                    />
                    <Bar dataKey="Products" fill="currentColor" radius={[4, 4, 0, 0]} maxBarSize={50} className="fill-primary" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[350px] w-full flex items-center justify-center text-muted-foreground font-semibold">
                No data available yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}




