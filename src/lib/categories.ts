export interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  children: CategoryNode[];
}

export interface FlatCategory {
  id: string;
  name: string;
  depth: number;
}

export function flattenCategories(nodes: CategoryNode[], depth = 0): FlatCategory[] {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, depth },
    ...flattenCategories(node.children, depth + 1),
  ]);
}
