import { NextResponse } from 'next/server';
import { getDbAsync } from '@/lib/db';
import { verifyAdminRequest } from '@/lib/auth';
import { generateScalePluCsv } from '@/lib/scale-plu';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = verifyAdminRequest(request, ['super_admin', 'admin', 'accountant', 'cashier']);
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'غير مصرح بالوصول: يتطلب صلاحية إدارة أو محاسب أو كاشير' },
        { status: auth.statusCode || 401 }
      );
    }

    const db = await getDbAsync();
    const products = db.products || [];
    const csvContent = generateScalePluCsv(products);

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="hafsa-roastery-scale-plu.csv"',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('GET /api/admin/scale-plu error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تصدير ملف الميزان الإلكتروني' },
      { status: 500 }
    );
  }
}
