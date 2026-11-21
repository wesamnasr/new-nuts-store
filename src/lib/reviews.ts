export interface RatingRecalculationResult {
  newRating: number;
  newCount: number;
}

/**
 * Weighted average rating recalculation matching scripts/verify.mjs oracle.
 * Formula:
 * If oldCount === 0 -> { newRating: incomingRating, newCount: 1 }
 * Else rawAverage = (oldRating * oldCount + incomingRating) / (oldCount + 1)
 * newRating = Math.round(rawAverage * 10) / 10
 */
export function recalculateProductRating(
  currentRating?: number,
  currentCount?: number,
  incomingRating?: number
): RatingRecalculationResult {
  if (
    typeof incomingRating !== 'number' ||
    !Number.isFinite(incomingRating) ||
    incomingRating < 1 ||
    incomingRating > 5
  ) {
    throw new Error('التقييم يجب أن يكون رقماً بين 1 و 5 نجوم');
  }

  const oldCount =
    typeof currentCount === 'number' && Number.isFinite(currentCount)
      ? Math.max(0, currentCount)
      : 0;
  const oldRating =
    typeof currentRating === 'number' && Number.isFinite(currentRating)
      ? Math.max(1, currentRating)
      : 5;

  if (oldCount === 0) {
    return { newRating: incomingRating, newCount: 1 };
  }

  const newCount = oldCount + 1;
  const rawAverage = (oldRating * oldCount + incomingRating) / newCount;
  const newRating = Math.round(rawAverage * 10) / 10;

  return { newRating, newCount };
}

export interface ReviewValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: {
    productId: string;
    customerName: string;
    rating: number;
    comment: string;
  };
}

/**
 * Validates incoming review submission body against all business rules:
 * - productId: non-empty trimmed string
 * - customerName: length >= 2 trimmed string
 * - rating: number between 1 and 5
 * - comment: length >= 3 trimmed string
 */
export function validateReviewInput(body: any): ReviewValidationResult {
  if (!body || typeof body !== 'object') {
    return { isValid: false, error: 'بيانات التقييم غير صالحة' };
  }

  const productId =
    typeof body.productId === 'string' ? body.productId.trim() : '';
  if (!productId) {
    return { isValid: false, error: 'معرف المنتج غير صالح ومطلوب' };
  }

  const customerName =
    typeof body.customerName === 'string' ? body.customerName.trim() : '';
  if (!customerName || customerName.length < 2) {
    return {
      isValid: false,
      error: 'اسم العميل مطلوب ويجب أن يكون حرفين على الأقل',
    };
  }

  const rating = Number(body.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return {
      isValid: false,
      error: 'التقييم يجب أن يكون رقماً بين 1 و 5 نجوم',
    };
  }

  const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
  if (!comment || comment.length < 3) {
    return {
      isValid: false,
      error: 'التعليق مطلوب ويجب أن يحتوي على 3 أحرف على الأقل',
    };
  }

  return {
    isValid: true,
    sanitized: {
      productId,
      customerName,
      rating,
      comment,
    },
  };
}
