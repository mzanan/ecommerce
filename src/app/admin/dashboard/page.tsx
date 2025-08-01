import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, ShoppingBag, Package } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ShippingActionButtons } from '@/components/admin/buttons/ShippingActionButtons/ShippingActionButtons';
import { SyncOrdersButton } from '@/components/admin/buttons/SyncOrdersButton/SyncOrdersButton';
import { SortableTableHead } from '@/components/admin/data-table/SortableTableHead/SortableTableHead';
import { createServerActionClient } from '@/lib/supabase/server';
import { syncStuckOrdersAction, updateOrderStatusAction } from './actions';
import { generateMetadata } from '@/lib/utils/seo';
import { SOCIAL_LINKS } from '@/lib/constants/social';

export const metadata = generateMetadata({
  title: 'Dashboard',
  description: 'Admin dashboard overview with key metrics and recent orders',
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;



interface SearchParams {
  page?: string;
  limit?: string;
  sortby?: string;
  sortdir?: 'asc' | 'desc';
}

interface DashboardPageProps {
  searchParams: Promise<SearchParams>;
}

async function getDashboardStats(supabase: any) {
  try {
    const [ordersResult, revenueResult, productsResult] = await Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('total_amount').eq('status', 'paid'),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true)
    ]);

    const totalRevenue = revenueResult.data?.reduce((sum: number, order: any) => sum + parseFloat(order.total_amount || 0), 0) || 0;

    return {
      totalOrders: ordersResult.count || 0,
      totalRevenue: totalRevenue,
      totalProducts: productsResult.count || 0,
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      totalOrders: 0,
      totalRevenue: 0,
      totalProducts: 0,
    };
  }
}

async function DashboardContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const supabase = createServerActionClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    redirect('/admin/login');
  }

  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page || '1');
  const limit = parseInt(resolvedSearchParams.limit || '10');
  const sortby = resolvedSearchParams.sortby || 'created_at';
  const sortdir = resolvedSearchParams.sortdir || 'desc';
  const offset = (page - 1) * limit;

  const stats = await getDashboardStats(supabase);

  const { data: orders, count, error } = await supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .order(sortby, { ascending: sortdir === 'asc' })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching orders:', error);
    return <div className="p-6 text-red-500">Error loading orders: {error.message}</div>;
  }

  const totalPages = Math.ceil((count || 0) / limit);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to your Infideli admin dashboard</p>
        </div>
        <form action={syncStuckOrdersAction}>
          <SyncOrdersButton />
        </form>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(stats.totalRevenue || 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">All time revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders || 0}</div>
            <p className="text-xs text-muted-foreground">All time orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts || 0}</div>
            <p className="text-xs text-muted-foreground">Products in catalog</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Recent Orders</CardTitle>
              <p className="text-sm text-muted-foreground">
                Latest orders and their current status
              </p>
            </div>
            <Link href={SOCIAL_LINKS.STRIPE_DASHBOARD} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                View All Orders
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead 
                    title="Order ID" 
                    sortKey="id" 
                    currentSort={sortby} 
                    currentOrder={sortdir}
                    page={page}
                    basePath="/admin/dashboard"
                  />
                  <SortableTableHead 
                    title="Customer" 
                    sortKey="shipping_name" 
                    currentSort={sortby} 
                    currentOrder={sortdir}
                    page={page}
                    basePath="/admin/dashboard"
                  />
                  <SortableTableHead 
                    title="Amount" 
                    sortKey="total_amount" 
                    currentSort={sortby} 
                    currentOrder={sortdir}
                    page={page}
                    basePath="/admin/dashboard"
                  />
                  <SortableTableHead 
                    title="Status" 
                    sortKey="status" 
                    currentSort={sortby} 
                    currentOrder={sortdir}
                    page={page}
                    basePath="/admin/dashboard"
                  />
                  <SortableTableHead 
                    title="Created" 
                    sortKey="created_at" 
                    currentSort={sortby} 
                    currentOrder={sortdir}
                    page={page}
                    basePath="/admin/dashboard"
                  />
                  <SortableTableHead 
                    title="Shipping" 
                    sortKey="shipping_status" 
                    currentSort={sortby} 
                    currentOrder={sortdir}
                    page={page}
                    basePath="/admin/dashboard"
                  />
                  <TableHead className="font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders?.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link 
                        href={`/admin/orders/${order.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        #{order.id.slice(-8)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{order.shipping_name || 'N/A'}</div>
                        <div className="text-sm text-muted-foreground">{order.shipping_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>${(order.total_amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={
                        order.status === 'paid' ? 'default' :
                        order.status === 'processing' ? 'secondary' :
                        'outline'
                      }>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">{new Date(order.created_at).toLocaleDateString()}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        order.shipping_status === 'delivered' ? 'default' :
                        order.shipping_status === 'in_transit' ? 'secondary' :
                        'outline'
                      }>
                        {order.shipping_status || 'pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ShippingActionButtons 
                        orderId={order.id}
                        currentShippingStatus={order.shipping_status as 'pending' | 'in_transit' | 'delivered'}
                        currentPage={page}
                        action={updateOrderStatusAction}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            baseUrl="/admin/dashboard"
            searchParams={new URLSearchParams(
              Object.entries(resolvedSearchParams).reduce((acc, [key, value]) => {
                if (value) {
                  acc[key] = value;
                }
                return acc;
              }, {} as Record<string, string>),
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage({ searchParams }: DashboardPageProps) {
  return (
    <DashboardContent searchParams={searchParams} />
  );
} 