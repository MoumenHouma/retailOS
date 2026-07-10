import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

/**
 * Shared read/update layer over ai_recommendations — the same table backs
 * Chunk B/C's recommendation-generating functions and Chunk D's
 * recommendations feed UI (see PHASE5_INTELLIGENCE_PLAN.md's divergence
 * table: this table doubles as the in-app notification store, no separate
 * Notification model).
 */
export async function listRecommendations(
  tx: TransactionClient,
  {
    storeId,
    recommendationType,
    isRead,
    isActioned,
    page,
    pageSize,
  }: {
    storeId?: string;
    recommendationType?: Prisma.AiRecommendationWhereInput["recommendationType"];
    isRead?: boolean;
    isActioned?: boolean;
    page: number;
    pageSize: number;
  },
) {
  const where: Prisma.AiRecommendationWhereInput = { storeId, recommendationType, isRead, isActioned };

  const [items, total] = await Promise.all([
    tx.aiRecommendation.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    tx.aiRecommendation.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function updateRecommendation(
  tx: TransactionClient,
  id: string,
  data: { isRead?: boolean; isActioned?: boolean },
) {
  return tx.aiRecommendation.update({ where: { id }, data });
}
