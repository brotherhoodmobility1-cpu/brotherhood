export type StockItem = { id: number; name: string; barcode: string | null; unit_price: number; quantity: number; min_stock: number };
export const lowStock = (s: Pick<StockItem, "quantity" | "min_stock">) => s.quantity <= s.min_stock;
