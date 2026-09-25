export interface PriceCategory {
  id: string;
  parent_id: string | null;
}

export interface PriceCategoryMultiplier {
  category_id: string;
  multiplier: number;
}

export interface EffectiveMultiplierInput {
  productMultiplier: number | null | undefined;
  categoryId: string | null | undefined;
  categories: PriceCategory[];
  categoryMultipliers: PriceCategoryMultiplier[];
  defaultMultiplier: number;
}

export function getEffectiveMultiplier(input: EffectiveMultiplierInput): number {
  if (input.productMultiplier != null) return input.productMultiplier;

  const categoryById = new Map(input.categories.map(category => [category.id, category]));
  const multiplierByCategory = new Map(input.categoryMultipliers.map(row => [row.category_id, row.multiplier]));
  const visited = new Set<string>();
  let categoryId = input.categoryId ?? null;

  while (categoryId && !visited.has(categoryId)) {
    visited.add(categoryId);
    const multiplier = multiplierByCategory.get(categoryId);
    if (multiplier != null) return multiplier;
    categoryId = categoryById.get(categoryId)?.parent_id ?? null;
  }

  return input.defaultMultiplier;
}

export function suggestPresentationPrice(input: {
  packageCost: number;
  packageQuantity: number;
  presentationQuantity: number;
  multiplier: number;
  soldByWeight?: boolean;
}): { salePrice: number; displayPrice: number } | null {
  const values = [input.packageCost, input.packageQuantity, input.presentationQuantity, input.multiplier];
  if (values.some(value => !Number.isFinite(value)) || input.packageCost < 0 || input.packageQuantity <= 0 ||
      input.presentationQuantity <= 0 || input.multiplier <= 0) return null;

  const quantityToPrice = input.soldByWeight ? 1000 : input.presentationQuantity;
  const unrounded = (input.packageCost / input.packageQuantity) * quantityToPrice * input.multiplier;
  // Round upward to preserve at least the configured markup after rounding.
  const displayPrice = Math.ceil((unrounded - Number.EPSILON) / 100) * 100;
  return {
    displayPrice,
    salePrice: input.soldByWeight ? displayPrice / 1000 : displayPrice
  };
}
