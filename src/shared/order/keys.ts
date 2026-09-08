/**
 * A sparse sort-key allocator for task ordering.
 * 
 * Sort keys are integers with gaps to allow efficient insertions
 * without renumbering existing items.
 */

export const ORDER_GAP = 1024;

/**
 * Compute the key for appending to a scope.
 * @param maxKey - The maximum key in the scope, or null if empty
 * @returns The key for appending
 */
export function keyAfter(maxKey: number | null): number {
  return maxKey === null ? ORDER_GAP : maxKey + ORDER_GAP;
}

/**
 * Compute a key strictly between two neighbors.
 * @param before - The key before the insertion point, or null if inserting at head
 * @param after - The key after the insertion point, or null if inserting at tail
 * @returns A key strictly between before and after, or null if none exists
 */
export function keyBetween(
  before: number | null,
  after: number | null
): number | null {
  if (before === null) {
    if (after === null) {
      return null;
    }
    // Inserting at head
    if (after <= ORDER_GAP) {
      return null; // No room before head
    }
    return after - ORDER_GAP;
  }
  
  if (after === null) {
    // Inserting at tail
    return before + ORDER_GAP;
  }
  
  // Both are non-null
  if (before >= after) {
    return null; // Invalid range
  }
  
  if (before + 1 >= after) {
    return null; // No integer between them
  }
  
  return Math.floor((before + after) / 2);
}

/**
 * Check if rebalancing is needed.
 * @param before - The key before the insertion point, or null if inserting at head
 * @param after - The key after the insertion point, or null if inserting at tail
 * @returns true if keyBetween would return null
 */
export function needsRebalance(
  before: number | null,
  after: number | null
): boolean {
  return keyBetween(before, after) === null;
}

/**
 * Rebalance keys to evenly distribute them.
 * @param keys - The current keys in the scope
 * @returns New keys with even spacing
 */
export function rebalance(keys: number[]): number[] {
  const result = new Array(keys.length);
  for (let i = 0; i < keys.length; i++) {
    result[i] = (i + 1) * ORDER_GAP;
  }
  return result;
}

/**
 * Compute insertion keys for a specific index.
 * @param orderedKeys - The current ordered keys in the scope
 * @param index - The index to insert at
 * @returns The key for insertion, or rebalanced keys if a rebalance is needed
 */
export function insertionKeys(
  orderedKeys: number[],
  index: number
): { key: number } | { rebalanced: number[]; key: number } {
  if (index < 0 || index > orderedKeys.length) {
    throw new Error('Index out of bounds');
  }
  
  const before = index === 0 ? null : orderedKeys[index - 1];
  const after = index === orderedKeys.length ? null : orderedKeys[index];
  
  const key = keyBetween(before, after);
  
  if (key !== null) {
    return { key };
  }
  
  // Need to rebalance
  const newKeys = [...orderedKeys];
  newKeys.splice(index, 0, 0); // Insert placeholder
  const rebalanced = rebalance(newKeys);
  return { rebalanced, key: rebalanced[index] };
}