import type { Category } from "@/lib/products/types";

export type CategoryNode = Category & { depth: number; childCount: number };

/** Depth-first ordering (parents before children, siblings by name). Orphans whose parent is missing become roots. */
export function flattenCategoryTree(categories: Category[]): CategoryNode[] {
  const ids = new Set(categories.map((c) => String(c._id)));
  const children = new Map<string, Category[]>();
  for (const c of categories) {
    const parent = c.parentId && ids.has(String(c.parentId)) ? String(c.parentId) : "";
    children.set(parent, [...(children.get(parent) ?? []), c]);
  }
  const out: CategoryNode[] = [];
  const seen = new Set<string>();
  const walk = (parent: string, depth: number) => {
    const list = [...(children.get(parent) ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    for (const c of list) {
      const id = String(c._id);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ ...c, depth, childCount: children.get(id)?.length ?? 0 });
      walk(id, depth + 1);
    }
  };
  walk("", 0);
  return out;
}

/** The category plus all of its descendants (they can't become its parent). */
export function descendantIds(categories: Category[], id: string): Set<string> {
  const result = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of categories) {
      if (c.parentId && result.has(String(c.parentId)) && !result.has(String(c._id))) {
        result.add(String(c._id));
        grew = true;
      }
    }
  }
  return result;
}
