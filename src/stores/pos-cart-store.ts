import { create } from "zustand";

export interface PosCartLine {
  productId: string;
  name: string;
  barcode: string | null;
  unitPrice: number;
  tvaRate: number;
  quantity: number;
  discountAmount: number;
}

export interface PosCartCustomer {
  id: string;
  name: string;
}

interface PosCartState {
  lines: PosCartLine[];
  customer: PosCartCustomer | null;
  // Phase 4 Chunk B: active CustomerPrice overrides for the selected
  // customer, keyed by productId — populated by CustomerPicker whenever the
  // customer changes. Without this, the cart/payment UI kept showing
  // Product.sellingPrice throughout checkout even though completeSale()
  // silently applied the customer's real price server-side, so the cashier
  // collected (and the customer saw) the wrong total on screen.
  customerPrices: Record<string, number>;
  discountAmount: number;
  addProduct: (product: {
    id: string;
    name: string;
    barcode: string | null;
    sellingPrice: number;
    tvaRate: number;
  }) => void;
  setQuantity: (productId: string, quantity: number) => void;
  setLineDiscount: (productId: string, discountAmount: number) => void;
  removeLine: (productId: string) => void;
  setCustomer: (customer: PosCartCustomer | null) => void;
  setCustomerPrices: (prices: Record<string, number>) => void;
  setDiscountAmount: (amount: number) => void;
  loadLines: (lines: PosCartLine[], discountAmount: number) => void;
  clear: () => void;
}

// Ephemeral client-only state for the in-progress sale — not persisted
// (IndexedDB persistence is Chunk D's offline work, out of scope here).
export const usePosCartStore = create<PosCartState>((set) => ({
  lines: [],
  customer: null,
  customerPrices: {},
  discountAmount: 0,

  addProduct: (product) =>
    set((state) => {
      const unitPrice = state.customerPrices[product.id] ?? product.sellingPrice;
      const existing = state.lines.find((line) => line.productId === product.id);
      if (existing) {
        return {
          lines: state.lines.map((line) =>
            line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line,
          ),
        };
      }
      return {
        lines: [
          ...state.lines,
          {
            productId: product.id,
            name: product.name,
            barcode: product.barcode,
            unitPrice,
            tvaRate: product.tvaRate,
            quantity: 1,
            discountAmount: 0,
          },
        ],
      };
    }),

  setQuantity: (productId, quantity) =>
    set((state) => ({
      lines:
        quantity <= 0
          ? state.lines.filter((line) => line.productId !== productId)
          : state.lines.map((line) => (line.productId === productId ? { ...line, quantity } : line)),
    })),

  setLineDiscount: (productId, discountAmount) =>
    set((state) => ({
      lines: state.lines.map((line) =>
        line.productId === productId ? { ...line, discountAmount } : line,
      ),
    })),

  removeLine: (productId) =>
    set((state) => ({ lines: state.lines.filter((line) => line.productId !== productId) })),

  setCustomer: (customer) => set({ customer, customerPrices: {} }),

  // Repricing already-in-cart lines here (not just new addProduct calls)
  // covers picking a customer after items are already scanned — falls back
  // to each line's existing unitPrice for any product with no override in
  // the new map, since the client doesn't retain the original
  // Product.sellingPrice separately once a line exists.
  setCustomerPrices: (customerPrices) =>
    set((state) => ({
      customerPrices,
      lines: state.lines.map((line) => {
        const override = customerPrices[line.productId];
        return override !== undefined ? { ...line, unitPrice: override } : line;
      }),
    })),

  setDiscountAmount: (discountAmount) => set({ discountAmount }),

  // Used to reload a recalled held ticket's items back into the working
  // cart — recall discards the held Sale row server-side, so this is the
  // only place that data survives afterward.
  loadLines: (lines, discountAmount) => set({ lines, discountAmount, customer: null, customerPrices: {} }),

  clear: () => set({ lines: [], customer: null, customerPrices: {}, discountAmount: 0 }),
}));

export function cartTotals(lines: PosCartLine[], ticketDiscount: number) {
  let subtotal = 0;
  let tvaAmount = 0;
  let lineDiscountTotal = 0;

  for (const line of lines) {
    const lineSubtotal = line.unitPrice * line.quantity - line.discountAmount;
    subtotal += line.unitPrice * line.quantity;
    lineDiscountTotal += line.discountAmount;
    tvaAmount += Math.round((lineSubtotal * line.tvaRate) / 100);
  }

  const discountAmount = lineDiscountTotal + ticketDiscount;
  const total = subtotal - discountAmount + tvaAmount;

  return { subtotal, discountAmount, tvaAmount, total };
}
