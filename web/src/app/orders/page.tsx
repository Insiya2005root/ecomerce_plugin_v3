'use client';
import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewOrder, setViewOrder] = useState<any>(null);
  
  const [newOrder, setNewOrder] = useState<any>({ name: '', email: '', address: '', productId: '', quantity: 1, couponCode: '' });

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/plugins/ecommerce-plugin/orders?t=' + Date.now());
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      if (data.success) setOrders(data.orders);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/plugins/ecommerce-plugin/products?t=' + Date.now());
      const data = await res.json();
      if (data.success) setProducts(data.products);
    } catch (e) {}
  };

  const handleStatusChange = async (id: string, status: string) => {
    await fetch(`/api/plugins/ecommerce-plugin/orders/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    fetchOrders();
  };

  const createManualOrder = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      customerDetails: { name: newOrder.name, email: newOrder.email, address: newOrder.address },
      items: [{ productId: newOrder.productId, quantity: newOrder.quantity }], couponCode: newOrder.couponCode
    };
    await fetch('/api/plugins/ecommerce-plugin/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setShowCreateModal(false);
    setNewOrder({ name: '', email: '', address: '', productId: '', quantity: 1, couponCode: '' });
    fetchOrders();
  };

  return (
    <div className="p-2 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight uppercase">Orders</h2>
          <p className="text-muted-foreground font-semibold mt-1">Manage and fulfill customer purchases.</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <span>+</span>
          Create Real Order
        </Button>
      </div>
      
      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-bold uppercase text-xs">Order #</TableHead>
              <TableHead className="font-bold uppercase text-xs">Customer</TableHead>
              <TableHead className="font-bold uppercase text-xs">Product(s)</TableHead>
              <TableHead className="font-bold uppercase text-xs">Date</TableHead>
              <TableHead className="font-bold uppercase text-xs">Total</TableHead>
              <TableHead className="font-bold uppercase text-xs">Status</TableHead>
              <TableHead className="text-right font-bold uppercase text-xs">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center font-bold text-muted-foreground">Loading...</TableCell></TableRow>
            ) : orders.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center font-bold text-muted-foreground">No orders found.</TableCell></TableRow>
            ) : orders.map(ord => (
              <TableRow key={ord._id}>
                <TableCell className="font-bold text-lg">{ord.orderNumber}</TableCell>
                <TableCell>
                  <div className="font-bold">{ord.customerDetails?.name}</div>
                  <div className="text-sm font-semibold text-muted-foreground">{ord.customerDetails?.email}</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {ord.items?.map((item: any, i: number) => (
                      <a key={i} href={`/plugins/ecommerce-plugin/ui/admin/products/edit/index.html?id=${item.productId}`} className="text-sm text-primary hover:underline font-semibold">
                        {item.quantity}x {item.name}
                        {item.discountPercentage > 0 && <span className="ml-1 text-green-500 text-xs">(-{item.discountPercentage}%)</span>}
                      </a>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="font-semibold text-muted-foreground">
                  {new Date(ord.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="font-bold text-primary text-xl">${ord.pricing?.totalAmount?.toFixed(2)}</TableCell>
                <TableCell>
                  <Select value={ord.status} onValueChange={(val: any) => handleStatusChange(ord._id, val)}>
                    <SelectTrigger className="w-[130px] h-8 text-xs font-bold">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Processing">Processing</SelectItem>
                      <SelectItem value="Shipped">Shipped</SelectItem>
                      <SelectItem value="Delivered">Delivered</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => setViewOrder(ord)}>VIEW BILL</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Manual Order Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tight">Create Manual Order</DialogTitle>
            <DialogDescription>Select a product and enter customer details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createManualOrder} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="uppercase font-semibold text-xs text-muted-foreground">Select Product</Label>
              <Select key={products.length} required value={newOrder.productId || 'none'} onValueChange={(val: any) => {
                setNewOrder({...newOrder, productId: val === 'none' ? '' : val});
              }}>
                <SelectTrigger>
                  <SelectValue>{newOrder.productId && newOrder.productId !== 'none' ? (products.find((p: any) => p._id === newOrder.productId)?.name || 'Unknown Product') : '-- Choose Product --'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Choose Product --</SelectItem>
                  {products.map((p: any) => <SelectItem key={p._id} value={p._id}>{p.name} - ${p.price}{p.discountPercentage > 0 ? ` (${p.discountPercentage}% OFF)` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="uppercase font-semibold text-xs text-muted-foreground">Quantity</Label>
              <Input type="number" min="1" required value={newOrder.quantity} onChange={(e: any) => setNewOrder({...newOrder, quantity: Number(e.target.value)})} />
            </div>
            <div className="space-y-2 pt-4">
              <Label className="uppercase font-semibold text-xs text-muted-foreground">Customer Name</Label>
              <Input type="text" required value={newOrder.name} onChange={(e: any) => setNewOrder({...newOrder, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label className="uppercase font-semibold text-xs text-muted-foreground">Customer Email</Label>
              <Input type="email" required value={newOrder.email} onChange={(e: any) => setNewOrder({...newOrder, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label className="uppercase font-semibold text-xs text-muted-foreground">Shipping Address</Label>
              <Input type="text" required value={newOrder.address} onChange={(e: any) => setNewOrder({...newOrder, address: e.target.value})} />
            </div>
                        <div className="space-y-2 pt-4 border-t mt-4">
              <Label className="uppercase font-semibold text-xs text-muted-foreground">Apply Coupon Code (Optional)</Label>
              <Input type="text" placeholder="e.g. SUMMER20" value={newOrder.couponCode} onChange={(e: any) => setNewOrder({...newOrder, couponCode: e.target.value})} />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button type="submit">Submit Order</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tax Invoice Bill Modal */}
      <Dialog open={!!viewOrder} onOpenChange={(open) => !open && setViewOrder(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">Tax Invoice</DialogTitle>
            <DialogDescription className="font-bold text-muted-foreground">Order {viewOrder?.orderNumber}</DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            <div>
              <p className="font-bold text-xs text-muted-foreground uppercase mb-1">Billed To</p>
              <p className="font-bold text-lg">{viewOrder?.customerDetails?.name}</p>
              <p className="text-sm font-semibold">{viewOrder?.customerDetails?.email}</p>
              <p className="text-sm text-muted-foreground">{viewOrder?.customerDetails?.address}</p>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold uppercase text-xs">Item</TableHead>
                  <TableHead className="text-right font-bold uppercase text-xs">Qty</TableHead>
                  <TableHead className="text-right font-bold uppercase text-xs">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewOrder?.items?.map((item: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-semibold text-primary">
                      <a href={`/plugins/ecommerce-plugin/ui/admin/products/edit/index.html?id=${item.productId}`} className="hover:underline">{item.name}</a>
                      {item.discountPercentage > 0 && (
                        <span className="ml-2 text-xs font-bold text-green-500">-{item.discountPercentage}% OFF</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {item.discountPercentage > 0 && item.originalPrice && (
                        <span className="line-through text-muted-foreground text-xs mr-1">${item.originalPrice?.toFixed(2)}</span>
                      )}
                      ${item.price?.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="space-y-2 pt-4">
              <div className="flex justify-between font-semibold text-sm">
                <span>Subtotal</span>
                <span>${viewOrder?.pricing?.subtotal?.toFixed(2)}</span>
              </div>
              {viewOrder?.pricing?.discount > 0 && (
                <div className="flex justify-between font-semibold text-sm text-green-500">
                  <span>Discount</span>
                  <span>-${viewOrder?.pricing?.discount?.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-sm text-muted-foreground">
                <span>Tax</span>
                <span>${viewOrder?.pricing?.tax?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-sm text-muted-foreground">
                <span>Shipping</span>
                <span>${viewOrder?.pricing?.shipping?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-xl pt-2 mt-2 border-t">
                <span>Total</span>
                <span>${viewOrder?.pricing?.totalAmount?.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}





