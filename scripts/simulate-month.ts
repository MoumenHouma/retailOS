// Simulates one month of realistic superette activity for a tenant:
// suppliers, catalog, purchase orders + received deliveries (stock in),
// customers, daily POS sales (stock out), and operating expenses — all
// backdated over the last 30 days so dashboards and reports show real
// trends. Idempotent-ish: refuses to run if the tenant already has
// products, to avoid double-stocking a live database.
//
// Usage (superuser URL — the script spans RLS-protected tables):
//   DATABASE_URL=postgresql://postgres:...@127.0.0.1:55432/retailos \
//     pnpm exec tsx scripts/simulate-month.ts [tenant-slug]
//
// Defaults to the first tenant if no slug is given.
//
// Invariants respected (see DATABASE.md / Dev Log):
// - stock_levels is trigger-maintained: only StockMovement rows are
//   inserted, and a running in-script tally guarantees no sale ever
//   drives on-hand negative (the trigger would reject it).
// - All monetary values are Int centimes.
// - tenantId is passed explicitly everywhere (superuser connection has no
//   app.current_tenant_id GUC to default from).
// - Sale/PO numbers come from the same per-store counters the app uses,
//   applied to Store at the end so the app continues the sequence.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

// Deterministic PRNG so reruns on a fresh DB produce the same month.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260712);
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(arr: readonly T[]): T => arr[randInt(0, arr.length - 1)]!;

const DAY = 24 * 60 * 60 * 1000;
// "Day 0" = 30 days ago at midnight local.
const now = new Date();
const dayStart = (daysAgo: number) => {
  const d = new Date(now.getTime() - daysAgo * DAY);
  d.setHours(0, 0, 0, 0);
  return d;
};
const at = (daysAgo: number, hour: number, minute: number) =>
  new Date(dayStart(daysAgo).getTime() + hour * 3600_000 + minute * 60_000);

// Catalog: name, category, brand, cost/sell in DA (converted to centimes
// below), TVA (9% reduced rate on staples, 19% standard), supplier index.
const CATEGORIES = ["Épicerie", "Boissons", "Produits laitiers", "Hygiène & Beauté", "Snacks & Confiserie", "Entretien ménager"] as const;
const BRANDS = ["Cevital", "Candia", "Ifri", "Bimo", "Henkel", "La Vache Qui Rit"] as const;
const SUPPLIERS = [
  { name: "SARL Distribution Numidia", city: "Alger", wilaya: "Alger", phone: "0550 12 34 56", contactPerson: "Karim Benali", paymentTerms: 30, leadTimeDays: 2 },
  { name: "EURL Agro Soummam", city: "Béjaïa", wilaya: "Béjaïa", phone: "0661 98 76 54", contactPerson: "Lyes Haddad", paymentTerms: 15, leadTimeDays: 3 },
  { name: "SPA Boissons de l'Atlas", city: "Blida", wilaya: "Blida", phone: "0770 45 67 89", contactPerson: "Amine Cherif", paymentTerms: 0, leadTimeDays: 1 },
] as const;

interface ProductSpec {
  name: string; cat: number; brand: number | null; cost: number; sell: number; tva: number; sup: number; barcode: string;
}
const PRODUCTS: ProductSpec[] = [
  { name: "Huile de table Elio 5L", cat: 0, brand: 0, cost: 1180, sell: 1350, tva: 19, sup: 0, barcode: "6130001000011" },
  { name: "Semoule extra 5kg", cat: 0, brand: null, cost: 380, sell: 450, tva: 9, sup: 1, barcode: "6130001000028" },
  { name: "Farine 1kg", cat: 0, brand: null, cost: 75, sell: 95, tva: 9, sup: 1, barcode: "6130001000035" },
  { name: "Sucre cristallisé 1kg", cat: 0, brand: 0, cost: 95, sell: 115, tva: 9, sup: 0, barcode: "6130001000042" },
  { name: "Pâtes spaghetti 500g", cat: 0, brand: null, cost: 68, sell: 90, tva: 9, sup: 1, barcode: "6130001000059" },
  { name: "Riz long grain 1kg", cat: 0, brand: null, cost: 165, sell: 210, tva: 9, sup: 1, barcode: "6130001000066" },
  { name: "Concentré de tomate 400g", cat: 0, brand: null, cost: 105, sell: 140, tva: 19, sup: 1, barcode: "6130001000073" },
  { name: "Café moulu 250g", cat: 0, brand: null, cost: 340, sell: 420, tva: 19, sup: 0, barcode: "6130001000080" },
  { name: "Thé vert 200g", cat: 0, brand: null, cost: 195, sell: 260, tva: 19, sup: 0, barcode: "6130001000097" },
  { name: "Eau minérale Ifri 1.5L", cat: 1, brand: 2, cost: 28, sell: 40, tva: 9, sup: 2, barcode: "6130002000010" },
  { name: "Eau minérale Ifri 0.5L (pack 6)", cat: 1, brand: 2, cost: 120, sell: 160, tva: 9, sup: 2, barcode: "6130002000027" },
  { name: "Soda cola 2L", cat: 1, brand: null, cost: 105, sell: 150, tva: 19, sup: 2, barcode: "6130002000034" },
  { name: "Jus d'orange 1L", cat: 1, brand: 2, cost: 115, sell: 160, tva: 19, sup: 2, barcode: "6130002000041" },
  { name: "Limonade 1L", cat: 1, brand: 2, cost: 75, sell: 110, tva: 19, sup: 2, barcode: "6130002000058" },
  { name: "Lait UHT Candia 1L", cat: 2, brand: 1, cost: 118, sell: 140, tva: 9, sup: 0, barcode: "6130003000019" },
  { name: "Yaourt nature (pack 4)", cat: 2, brand: 1, cost: 130, sell: 175, tva: 9, sup: 0, barcode: "6130003000026" },
  { name: "Fromage fondu 8 portions", cat: 2, brand: 5, cost: 210, sell: 270, tva: 19, sup: 0, barcode: "6130003000033" },
  { name: "Beurre 250g", cat: 2, brand: 1, cost: 320, sell: 395, tva: 19, sup: 0, barcode: "6130003000040" },
  { name: "Savon de toilette 125g", cat: 3, brand: 4, cost: 85, sell: 120, tva: 19, sup: 0, barcode: "6130004000018" },
  { name: "Shampooing 400ml", cat: 3, brand: 4, cost: 310, sell: 420, tva: 19, sup: 0, barcode: "6130004000025" },
  { name: "Dentifrice 100ml", cat: 3, brand: null, cost: 145, sell: 200, tva: 19, sup: 0, barcode: "6130004000032" },
  { name: "Biscuits Bimo (pack 12)", cat: 4, brand: 3, cost: 240, sell: 310, tva: 19, sup: 1, barcode: "6130005000017" },
  { name: "Chocolat tablette 100g", cat: 4, brand: 3, cost: 155, sell: 210, tva: 19, sup: 1, barcode: "6130005000024" },
  { name: "Chips 90g", cat: 4, brand: null, cost: 62, sell: 90, tva: 19, sup: 1, barcode: "6130005000031" },
  { name: "Lessive poudre 3kg", cat: 5, brand: 4, cost: 720, sell: 890, tva: 19, sup: 0, barcode: "6130006000016" },
  { name: "Javel 1L", cat: 5, brand: null, cost: 55, sell: 85, tva: 19, sup: 0, barcode: "6130006000023" },
  { name: "Liquide vaisselle 750ml", cat: 5, brand: 4, cost: 130, sell: 180, tva: 19, sup: 0, barcode: "6130006000030" },
];

const CUSTOMERS = [
  { name: "Mohamed Larbi", phone: "0551 22 33 44", customerType: "regular" as const },
  { name: "Fatima Zohra Meziane", phone: "0662 33 44 55", customerType: "regular" as const },
  { name: "Rachid Bouzid", phone: "0773 44 55 66", customerType: "regular" as const },
  { name: "Amel Khelifi", phone: "0554 55 66 77", customerType: "regular" as const },
  { name: "Café des Frères Slimani", phone: "0665 66 77 88", customerType: "wholesale" as const },
  { name: "Restaurant El Bahdja", phone: "0776 77 88 99", customerType: "wholesale" as const },
  { name: "Nadia Benmoussa", phone: "0557 88 99 00", customerType: "regular" as const },
  { name: "Sofiane Guerroudj", phone: "0668 99 00 11", customerType: "regular" as const },
];

const EXPENSE_CATEGORIES = ["Loyer", "Énergie & Eau", "Salaires", "Transport & Carburant", "Fournitures & Divers"];

async function main() {
  const slug = process.argv[2];
  const tenant = slug
    ? await prisma.tenant.findUnique({ where: { slug } })
    : await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  if (!tenant) throw new Error(`Tenant not found${slug ? ` for slug "${slug}"` : ""}`);
  const tenantId = tenant.id;

  const existingProducts = await prisma.product.count({ where: { tenantId, deletedAt: null } });
  if (existingProducts > 0) {
    throw new Error(
      `Tenant "${tenant.name}" already has ${existingProducts} products — refusing to double-stock. ` +
        `This script is meant for a freshly-registered tenant.`,
    );
  }

  const store = await prisma.store.findFirst({ where: { tenantId, isMain: true } });
  if (!store) throw new Error("No main store");
  const owner = await prisma.user.findFirst({ where: { tenantId }, orderBy: { createdAt: "asc" } });
  if (!owner) throw new Error("No user to act as cashier");
  const unit = await prisma.unit.findFirst({ where: { tenantId, abbreviation: "pce", deletedAt: null } });
  if (!unit) throw new Error("No 'pce' unit — run the permission/unit backfill first");

  console.log(`Simulating 1 month for "${tenant.name}" (store: ${store.name})`);

  // --- Catalog -------------------------------------------------------------
  const categoryIds: string[] = [];
  for (const name of CATEGORIES) {
    const c = await prisma.productCategory.create({ data: { tenantId, name } });
    categoryIds.push(c.id);
  }
  const brandIds: string[] = [];
  for (const name of BRANDS) {
    const b = await prisma.brand.create({ data: { tenantId, name } });
    brandIds.push(b.id);
  }
  const supplierIds: string[] = [];
  for (const s of SUPPLIERS) {
    const created = await prisma.supplier.create({ data: { tenantId, ...s } });
    supplierIds.push(created.id);
  }

  const productIds: string[] = [];
  for (let i = 0; i < PRODUCTS.length; i++) {
    const p = PRODUCTS[i]!;
    const created = await prisma.product.create({
      data: {
        tenantId,
        sku: `SKU-${String(i + 1).padStart(4, "0")}`,
        name: p.name,
        categoryId: categoryIds[p.cat]!,
        brandId: p.brand === null ? null : brandIds[p.brand]!,
        unitId: unit.id,
        barcode: p.barcode,
        costPrice: p.cost * 100,
        sellingPrice: p.sell * 100,
        tvaRate: p.tva,
        minStockLevel: 12,
        createdBy: owner.id,
        createdAt: dayStart(31),
      },
    });
    productIds.push(created.id);
    await prisma.supplierProduct.create({
      data: {
        tenantId,
        supplierId: supplierIds[p.sup]!,
        productId: created.id,
        unitPrice: p.cost * 100,
        isPreferred: true,
      },
    });
  }
  console.log(`  catalog: ${CATEGORIES.length} categories, ${BRANDS.length} brands, ${SUPPLIERS.length} suppliers, ${PRODUCTS.length} products`);

  // --- Customers -----------------------------------------------------------
  const customerIds: string[] = [];
  for (const c of CUSTOMERS) {
    const created = await prisma.customer.create({
      data: { tenantId, ...c, createdAt: dayStart(randInt(20, 31)) },
    });
    customerIds.push(created.id);
  }

  // --- Expense categories ----------------------------------------------------
  const expenseCatIds = new Map<string, string>();
  for (const name of EXPENSE_CATEGORIES) {
    const c = await prisma.expenseCategory.create({ data: { tenantId, name } });
    expenseCatIds.set(name, c.id);
  }

  // --- Stock: POs + deliveries, then day-by-day sales -----------------------
  // In-script on-hand tally: the DB trigger rejects negative stock, so the
  // simulation buys before it sells, exactly like the real shop would.
  const stock = new Map<string, number>(productIds.map((id) => [id, 0]));
  let poCounter = store.poCounter;
  let saleCounter = store.saleCounter;
  let deliveryCounter = 0;

  async function receivePo(daysAgo: number, lines: Array<{ productId: string; qty: number }>) {
    // One PO per supplier per restock cycle, matching how the shop would
    // actually order.
    const bySupplier = new Map<string, Array<{ productId: string; qty: number }>>();
    for (const line of lines) {
      const spec = PRODUCTS[productIds.indexOf(line.productId)]!;
      const supId = supplierIds[spec.sup]!;
      if (!bySupplier.has(supId)) bySupplier.set(supId, []);
      bySupplier.get(supId)!.push(line);
    }
    for (const [supplierId, supLines] of bySupplier) {
      poCounter += 1;
      const thisPoNumber = `PO-${String(poCounter).padStart(6, "0")}`;
      const orderedAt = at(daysAgo + 1, 10, randInt(0, 50));
      const deliveredAt = at(daysAgo, randInt(8, 11), randInt(0, 59));
      let subtotal = 0;
      let tvaAmount = 0;
      const itemRows = supLines.map((line) => {
        const spec = PRODUCTS[productIds.indexOf(line.productId)]!;
        const unitPrice = spec.cost * 100;
        const lineSub = unitPrice * line.qty;
        const lineTva = Math.round((lineSub * spec.tva) / 100);
        subtotal += lineSub;
        tvaAmount += lineTva;
        return { productId: line.productId, qty: line.qty, unitPrice, tvaRate: spec.tva, lineSub, lineTva };
      });
      const po = await prisma.purchaseOrder.create({
        data: {
          tenantId,
          poNumber: thisPoNumber,
          supplierId,
          storeId: store.id,
          status: "received",
          orderedAt,
          expectedDeliveryDate: dayStart(daysAgo),
          subtotal,
          tvaAmount,
          total: subtotal + tvaAmount,
          createdBy: owner.id,
          approvedBy: owner.id,
          createdAt: orderedAt,
        },
      });
      const poItems = [] as Array<{ id: string; productId: string; qty: number; unitPrice: number }>;
      for (const row of itemRows) {
        const item = await prisma.purchaseOrderItem.create({
          data: {
            tenantId,
            poId: po.id,
            productId: row.productId,
            quantityOrdered: row.qty,
            quantityReceived: row.qty,
            unitPrice: row.unitPrice,
            tvaRate: row.tvaRate,
            subtotal: row.lineSub,
            tvaAmount: row.lineTva,
            total: row.lineSub + row.lineTva,
          },
        });
        poItems.push({ id: item.id, productId: row.productId, qty: row.qty, unitPrice: row.unitPrice });
      }
      deliveryCounter += 1;
      const delivery = await prisma.purchaseDelivery.create({
        data: {
          tenantId,
          poId: po.id,
          deliveryNumber: `BL-${String(deliveryCounter).padStart(6, "0")}`,
          deliveredAt,
          receivedBy: owner.id,
          createdAt: deliveredAt,
        },
      });
      for (const item of poItems) {
        await prisma.purchaseDeliveryItem.create({
          data: {
            tenantId,
            deliveryId: delivery.id,
            poItemId: item.id,
            productId: item.productId,
            quantityDelivered: item.qty,
            unitCost: item.unitPrice,
          },
        });
        await prisma.stockMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            storeId: store.id,
            movementType: "PURCHASE_IN",
            quantity: item.qty,
            referenceId: delivery.id,
            referenceType: "purchase_delivery",
            createdBy: owner.id,
            createdAt: deliveredAt,
          },
        });
        stock.set(item.productId, (stock.get(item.productId) ?? 0) + item.qty);
      }
    }
  }

  // Initial stocking 30 days ago: generous quantities on everything.
  await receivePo(30, productIds.map((id, i) => ({ productId: id, qty: PRODUCTS[i]!.sell < 200 ? randInt(80, 140) : randInt(30, 60) })));
  console.log("  initial stocking received (day -30)");

  // --- Daily sales, with restock cycles when things run low -----------------
  const customerStats = new Map<string, { spent: number; visits: number; last: Date }>();
  let salesCreated = 0;
  let revenue = 0;

  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const date = dayStart(daysAgo);
    const weekday = date.getDay(); // 5 = Friday
    // Friday = lighter traffic (Algerian weekend); Saturday busy.
    const salesToday = weekday === 5 ? randInt(6, 11) : weekday === 6 ? randInt(16, 26) : randInt(10, 20);

    // Weekly-ish restock: whenever >5 products are at/below min level.
    const lowIds = productIds.filter((id) => (stock.get(id) ?? 0) <= 15);
    if (lowIds.length > 5) {
      await receivePo(daysAgo, lowIds.map((id) => {
        const spec = PRODUCTS[productIds.indexOf(id)]!;
        return { productId: id, qty: spec.sell < 200 ? randInt(60, 110) : randInt(25, 50) };
      }));
      console.log(`  restock received (day -${daysAgo}, ${lowIds.length} products)`);
    }

    for (let s = 0; s < salesToday; s++) {
      const createdAt = at(daysAgo, randInt(8, 20), randInt(0, 59));
      const lineCount = randInt(1, 5);
      const chosen = new Set<string>();
      const lines: Array<{ productId: string; qty: number; spec: ProductSpec }> = [];
      for (let l = 0; l < lineCount; l++) {
        const idx = randInt(0, productIds.length - 1);
        const productId = productIds[idx]!;
        if (chosen.has(productId)) continue;
        chosen.add(productId);
        const available = stock.get(productId) ?? 0;
        if (available < 1) continue;
        const spec = PRODUCTS[idx]!;
        const wanted = spec.sell < 150 ? randInt(1, 6) : randInt(1, 2);
        lines.push({ productId, qty: Math.min(wanted, available), spec });
      }
      if (lines.length === 0) continue;

      let subtotal = 0;
      let tvaAmount = 0;
      const itemRows = lines.map((line) => {
        const unitPrice = line.spec.sell * 100;
        const lineSub = unitPrice * line.qty;
        const lineTva = Math.round((lineSub * line.spec.tva) / 100);
        subtotal += lineSub;
        tvaAmount += lineTva;
        return {
          productId: line.productId,
          productName: line.spec.name,
          productBarcode: line.spec.barcode,
          quantity: line.qty,
          unitPrice,
          costPrice: line.spec.cost * 100,
          tvaRate: line.spec.tva,
          subtotal: lineSub,
          tvaAmount: lineTva,
          total: lineSub + lineTva,
        };
      });
      const total = subtotal + tvaAmount;

      // ~18% of sales attached to a registered customer.
      const customerId = rand() < 0.18 ? pick(customerIds) : null;
      // 85% cash (often rounded up, giving change), 15% card (exact).
      const isCash = rand() < 0.85;
      const paid = isCash ? Math.ceil(total / 1000) * 1000 : total;

      saleCounter += 1;
      const sale = await prisma.sale.create({
        data: {
          tenantId,
          storeId: store.id,
          saleNumber: `${store.posPrefix}-${String(saleCounter).padStart(6, "0")}`,
          customerId,
          cashierId: owner.id,
          subtotal,
          tvaAmount,
          total,
          totalPaid: paid,
          changeDue: paid - total,
          status: "completed",
          createdAt,
          items: { create: itemRows.map((r) => ({ tenantId, ...r })) },
          payments: {
            create: [{ tenantId, paymentMethod: isCash ? "CASH" : "CARD", amount: paid, createdAt }],
          },
        },
      });
      await prisma.stockMovement.createMany({
        data: lines.map((line) => ({
          tenantId,
          productId: line.productId,
          storeId: store.id,
          movementType: "SALE_OUT" as const,
          quantity: line.qty,
          referenceId: sale.id,
          referenceType: "sale",
          createdBy: owner.id,
          createdAt,
        })),
      });
      for (const line of lines) stock.set(line.productId, (stock.get(line.productId) ?? 0) - line.qty);

      if (customerId) {
        const stats = customerStats.get(customerId) ?? { spent: 0, visits: 0, last: createdAt };
        stats.spent += total;
        stats.visits += 1;
        if (createdAt > stats.last) stats.last = createdAt;
        customerStats.set(customerId, stats);
      }
      salesCreated += 1;
      revenue += total;
    }
  }
  console.log(`  sales: ${salesCreated} over 30 days, revenue ${(revenue / 100).toFixed(0)} DA TTC`);

  for (const [customerId, stats] of customerStats) {
    await prisma.customer.update({
      where: { id: customerId },
      data: { totalSpent: stats.spent, totalPurchases: stats.visits, visitCount: stats.visits, lastVisitAt: stats.last },
    });
  }

  // --- Expenses --------------------------------------------------------------
  const expenses: Array<{ cat: string; desc: string; amount: number; daysAgo: number; method: "CASH" | "TRANSFER" }> = [
    { cat: "Loyer", desc: "Loyer du local — mois courant", amount: 45000, daysAgo: 29, method: "TRANSFER" },
    { cat: "Énergie & Eau", desc: "Facture Sonelgaz (électricité + gaz)", amount: 8420, daysAgo: 21, method: "CASH" },
    { cat: "Énergie & Eau", desc: "Facture ADE (eau)", amount: 1850, daysAgo: 20, method: "CASH" },
    { cat: "Salaires", desc: "Salaire vendeur — Yacine", amount: 38000, daysAgo: 2, method: "CASH" },
    { cat: "Salaires", desc: "Salaire caissière — Samira", amount: 35000, daysAgo: 2, method: "CASH" },
    { cat: "Transport & Carburant", desc: "Carburant fourgon livraisons", amount: 4600, daysAgo: 15, method: "CASH" },
    { cat: "Transport & Carburant", desc: "Réparation pneu fourgon", amount: 2800, daysAgo: 9, method: "CASH" },
    { cat: "Fournitures & Divers", desc: "Rouleaux caisse + sacs plastique", amount: 3250, daysAgo: 17, method: "CASH" },
    { cat: "Fournitures & Divers", desc: "Abonnement internet (Idoom)", amount: 2600, daysAgo: 25, method: "TRANSFER" },
  ];
  for (const e of expenses) {
    await prisma.expense.create({
      data: {
        tenantId,
        storeId: store.id,
        categoryId: expenseCatIds.get(e.cat)!,
        description: e.desc,
        amount: e.amount * 100,
        expenseDate: dayStart(e.daysAgo),
        paymentMethod: e.method,
        createdBy: owner.id,
        createdAt: at(e.daysAgo, 18, 30),
      },
    });
  }
  console.log(`  expenses: ${expenses.length} entries`);

  // Hand the counters back to the app so its next sale/PO continues the
  // sequence instead of colliding with simulated numbers.
  await prisma.store.update({
    where: { id: store.id },
    data: { saleCounter, poCounter },
  });

  const levels = await prisma.stockLevel.findMany({ where: { tenantId, storeId: store.id } });
  const negative = levels.filter((l) => l.quantityOnHand < 0);
  console.log(`  final stock levels: ${levels.length} products, ${negative.length} negative (must be 0)`);
  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
