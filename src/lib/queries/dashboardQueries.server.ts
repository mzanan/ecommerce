import { createServerComponentClient } from '@/lib/supabase/server';
import type { SaleOrder, DashboardSearchParams, DashboardData } from '@/types/dashboard';

const sortMapping: Record<string, string> = {
  'customer': 'shipping_name',
  'date': 'created_at',
  'country': 'shipping_country',
  'total': 'total_amount',
  'payment_status': 'status',
  'shipping_status': 'shipping_status'
};

export async function getDashboardData(searchParams: DashboardSearchParams): Promise<DashboardData> {
  const supabase = createServerComponentClient();

  let currentPage = 1;
  if (searchParams.page) {
    if (typeof searchParams.page === 'string') {
      const pageNumber = parseInt(searchParams.page, 10);
      if (!isNaN(pageNumber) && pageNumber > 0) {
        currentPage = pageNumber;
      }
    } else if (Array.isArray(searchParams.page) && searchParams.page.length > 0) {
      const pageNumber = parseInt(searchParams.page[0], 10);
      if (!isNaN(pageNumber) && pageNumber > 0) {
        currentPage = pageNumber;
      }
    }
  }

  const sortBy = (Array.isArray(searchParams.sortBy) ? searchParams.sortBy[0] : searchParams.sortBy) || 'created_at';
  const sortOrder = (Array.isArray(searchParams.sortOrder) ? searchParams.sortOrder[0] : searchParams.sortOrder) || 'desc';
  const isAscending = sortOrder === 'asc';

  const itemsPerPage = 10;
  const offset = (currentPage - 1) * itemsPerPage;
  const dbSortColumn = sortMapping[sortBy] || 'created_at';

  const { data: salesData, error: salesError, count: totalCount } = await supabase
    .from('orders')
    .select(`
      id,
      created_at,
      shipping_status,
      status,
      order_details,
      shipping_name,
      shipping_email,
      shipping_country,
      total_amount,
      user_id
    `, { count: 'exact' })
    .order(dbSortColumn, { ascending: isAscending })
    .range(offset, offset + itemsPerPage - 1);

  if (salesError) {
    console.error('Error fetching sales data:', salesError);
    throw new Error('Failed to fetch dashboard data');
  }

  const totalPages = Math.ceil((totalCount || 0) / itemsPerPage);

  return {
    orders: (salesData || []) as SaleOrder[],
    totalCount: totalCount || 0,
    currentPage,
    totalPages,
    sortBy,
    sortOrder
  };
} 