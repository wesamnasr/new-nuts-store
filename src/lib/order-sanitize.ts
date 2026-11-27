import { Order } from '@/types/store';

/**
 * Removes sensitive internal wholesale cost & net profit fields before returning
 * an order to public storefront callers or non-admin POS/cashier roles.
 */
export function stripOrderCosts(order: Order): Order {
  const copy: Order = { ...order };
  delete copy.rawCostTotal;
  delete copy.netProfitEgp;
  if (Array.isArray(copy.items)) {
    copy.items = copy.items.map((item) => {
      const itemCopy = { ...item };
      delete itemCopy.rawCostEgp;
      return itemCopy;
    });
  }
  return copy;
}
