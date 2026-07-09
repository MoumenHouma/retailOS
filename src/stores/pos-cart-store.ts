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
  setDiscountAmount: (amount: number) => void;
  clear: () => void;
}

// Ephemeral client-only state for the in-progress sale — not persisted
// (IndexedDB persistence is Chunk D's offline work, out of scope here).
export const usePosCartStore = create<PosCartState>((set) => ({
  lines: [],
  customer: null,
  discountAmount: 0,

  addProduct: (product) =>
    set((state) => {
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
            unitPrice: product.sellingPrice,
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

  setCustomer: (customer) => set({ customer }),
  setDiscountAmount: (discountAmount) => set({ discountAmount }),

  clear: () => set({ lines: [], customer: null, discountAmount: 0 }),
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
