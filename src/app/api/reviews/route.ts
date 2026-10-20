import { NextRequest, NextResponse } from 'next/server';
import { getDbAsync, saveDbAsync } from '@/lib/db';
import { ProductReview, ReviewSubmissionResponse } from '@/types/store';
import { validateReviewInput, recalculateProductRating } from '@/lib/reviews';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    const db = await getDbAsync();
    if (productId) {
      const product = db.products.find((p) => p.id === productId);
      if (!product) {
        return NextResponse.json(
          { error: 'المنتج غير موجود' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        reviews: product.reviews || [],
        rating: product.rating,
        reviewsCount: product.reviewsCount,
      });
    }

    const sanitizedProducts = db.products.map((p) => {
      const copy = { ...p };
      delete copy.costPerKg;
      delete copy.packagingCost;
      return copy;
    });

    return NextResponse.json({ products: sanitizedProducts });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب التقييمات' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json<ReviewSubmissionResponse>(
        { success: false, error: 'طلب غير صالح (JSON غير صحيح)' },
        { status: 400 }
      );
    }

    // 1. Strict Server-Side Validation
    const validation = validateReviewInput(body);
    if (!validation.isValid || !validation.sanitized) {
      return NextResponse.json<ReviewSubmissionResponse>(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { productId, customerName, rating, comment } = validation.sanitized;

    // 2. Database Lookup
    const db = await getDbAsync();
    const product = db.products.find((p) => p.id === productId);
    if (!product) {
      return NextResponse.json<ReviewSubmissionResponse>(
        { success: false, error: 'معرف المنتج غير صالح' },
        { status: 400 }
      );
    }

    // 3. Weighted Average Rating Recalculation
    const { newRating, newCount } = recalculateProductRating(
      product.rating,
      product.reviewsCount,
      rating
    );

    // 4. Create Product Review Object
    const dateFormatted = new Intl.DateTimeFormat('ar-EG', {
      dateStyle: 'medium',
    }).format(new Date());

    const newReview: ProductReview = {
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      customerName,
      rating: Math.round(rating),
      comment,
      date: dateFormatted,
      verified: true,
    };

    // 5. Update Product in Database
    if (!Array.isArray(product.reviews)) {
      product.reviews = [];
    }
    product.reviews.unshift(newReview);
    product.rating = newRating;
    product.reviewsCount = newCount;

    // Save to Neon Postgres & local cache
    await saveDbAsync(db);

    // 6. Return HTTP 201 Created
    return NextResponse.json<ReviewSubmissionResponse>(
      {
        success: true,
        review: newReview,
        rating: newRating,
        reviewsCount: newCount,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error processing review submission:', error);
    return NextResponse.json<ReviewSubmissionResponse>(
      {
        success: false,
        error: error?.message || 'حدث خطأ غير متوقع أثناء معالجة التقييم',
      },
      { status: 500 }
    );
  }
}
