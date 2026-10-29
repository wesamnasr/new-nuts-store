import { Product } from '@/types/store';
import { escapeCsvField } from '@/lib/csv';
import { getProductBarcode } from '@/lib/pricing';

/**
 * Standard headers for retail electronic barcode scales
 * (e.g. Rongta, Cas, Aclas, Bizerba, DIGI)
 */
export const SCALE_PLU_HEADERS = [
  'PLU',
  'الكود',
  'اسم الصنف',
  'القسم',
  'سعر الكيلو',
  'نوع الصنف',
  'بادئة الباركود',
  'مدة الصلاحية',
  'الزر السريع',
] as const;

/**
 * Generates an Electronic Scale PLU CSV file with UTF-8 BOM (\uFEFF)
 * compatible with Cas, Rongta, Aclas, and Arabic Excel scale sync software.
 */
export function generateScalePluCsv(products: Product[]): string {
  const BOM = '\uFEFF';

  // Include products that can be sold by weight or in POS
  const weightedProducts = (products || []).filter((p) => p.showInPos !== false);

  const rows = weightedProducts.map((p, idx) => {
    const pluNumber = idx + 1;
    const barcode = getProductBarcode(p, idx);
    const itemCode = barcode.replace(/^20/, '') || String(pluNumber).padStart(4, '0');
    const pricePerKg = p.pricePerKg || (p.weights && p.weights[0] ? p.weights[0].price : 0);
    const department = p.subCategoryName || p.categoryId || 'محمصة';
    const itemType = 'وزن'; // Sold by weight
    const barcodePrefix = '20'; // Standard retail weight barcode prefix
    const shelfLifeDays = 90;
    const hotKey = pluNumber <= 112 ? pluNumber : '';

    return [
      escapeCsvField(pluNumber),
      escapeCsvField(barcode),
      escapeCsvField(p.name),
      escapeCsvField(department),
      escapeCsvField(pricePerKg),
      escapeCsvField(itemType),
      escapeCsvField(barcodePrefix),
      escapeCsvField(shelfLifeDays),
      escapeCsvField(hotKey),
    ].join(',');
  });

  return BOM + [SCALE_PLU_HEADERS.map(escapeCsvField).join(','), ...rows].join('\r\n');
}

/**
 * Triggers a browser download of the Scale PLU CSV.
 */
export function downloadScalePluCsv(
  products: Product[],
  filename = 'hafsa-roastery-scale-plu.csv'
): void {
  if (typeof window === 'undefined') return;
  const csv = generateScalePluCsv(products);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
