import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { orders } from "@/components/data/order-history-1-data"

export function OrderHistory1() {
  const totalOrders = orders.length
  const totalAmount = orders.reduce((sum, order) => sum + order.price, 0)
  const lastOrder = orders.reduce((latest, order) => {
    const currentDate = new Date(order.orderDate)
    const latestDate = new Date(latest)
    return currentDate > latestDate ? order.orderDate : latest
  }, orders[0].orderDate)

  return (
    <div className='mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8'>
      <Card>
        <CardHeader className='flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-x-6'>
          <div>
            <CardTitle className='text-2xl'>Order History</CardTitle>
            <CardDescription className='text-balance'>View your past orders and their status</CardDescription>
          </div>
          <div className='text-muted-foreground text-end text-sm max-sm:text-start'>
            <p>Total Orders: {totalOrders}</p>
            <p>Last Order: {lastOrder}</p>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className='hover:bg-transparent'>
                <TableHead className='font-semibold'>Item</TableHead>
                <TableHead className='hidden sm:table-cell text-end font-semibold'>Order Date</TableHead>
                <TableHead className='hidden md:table-cell text-end font-semibold'>Quantity</TableHead>
                <TableHead className='text-end font-semibold'>Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(order => (
                <TableRow key={order.name}>
                  <TableCell className='flex flex-col sm:flex-row sm:items-center gap-3 py-3'>
                    <img src={order.image} alt={order.name} className='w-16 h-16 rounded-md object-cover shrink-0' />
                    <div className='flex-1 min-w-0'>
                      <p className='font-medium truncate'>{order.name}</p>
                      <p className='text-muted-foreground text-sm truncate'>{`Color: ${order.color} • Size: ${order.size}`}</p>
                      <p className='text-muted-foreground text-xs sm:hidden mt-1'>{order.orderDate}</p>
                    </div>
                  </TableCell>
                  <TableCell className='hidden sm:table-cell text-end'>{order.orderDate}</TableCell>
                  <TableCell className='hidden md:table-cell text-end'>{order.quantity}</TableCell>
                  <TableCell className='text-end'>${order.price.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className='bg-transparent'>
              {/* Mobile and Tablet Footer - colSpan={1} */}
              <TableRow className='font-semibold hover:bg-transparent md:hidden'>
                <TableCell colSpan={1}></TableCell>
                <TableCell className='text-end'>{`$${totalAmount.toFixed(2)}`}</TableCell>
              </TableRow>
              {/* Desktop Footer - colSpan={2} */}
              <TableRow className='font-semibold hover:bg-transparent hidden md:table-row'>
                <TableCell colSpan={2}></TableCell>
                <TableCell className='text-end'>{`$${totalAmount.toFixed(2)}`}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
        <CardFooter className='flex flex-wrap gap-4 border-t-0 bg-transparent pt-0'>
          <Button variant='default' className='h-9 px-4 py-2 cursor-pointer'>
            View Order Details
          </Button>
          <Button variant='secondary' className='h-9 px-4 py-2 cursor-pointer'>
            Download Invoice
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default OrderHistory1
