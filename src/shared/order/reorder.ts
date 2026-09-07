import { keyBetween, rebalance } from './keys'

export interface SiblingEntry {
  id: string
  key: number
}

export interface KeyAssignment {
  id: string
  key: number
}

/**
 * Plan the key updates needed to move one sibling to a target index.
 * `siblings` is the current scope ordered by key ascending, INCLUDING the
 * item being moved. `targetIndex` is the desired index in the final order
 * (0..siblings.length-1). Returns the minimal list of {id, key} updates:
 * one entry in the common case, or every sibling when a rebalance is needed.
 */
export function planReorder(
  siblings: SiblingEntry[],
  moveId: string,
  targetIndex: number
): KeyAssignment[] {
  // Find the index of moveId in siblings; if absent, throw error
  const moveIndex = siblings.findIndex(entry => entry.id === moveId);
  if (moveIndex === -1) {
    throw new Error(`unknown sibling: ${moveId}`);
  }

  // Check bounds
  if (targetIndex < 0 || targetIndex > siblings.length - 1) {
    throw new Error('targetIndex out of bounds');
  }

  // If the item is already at targetIndex, return empty array
  if (moveIndex === targetIndex) {
    return [];
  }

  // Build remaining array without the moved entry (preserve order)
  const remaining = [...siblings];
  remaining.splice(moveIndex, 1);

  // Compute neighbors in the FINAL order
  const before = targetIndex === 0 ? null : remaining[targetIndex - 1].key;
  const after = targetIndex === remaining.length ? null : remaining[targetIndex].key;

  // Try to find a key between neighbors
  const k = keyBetween(before, after);
  if (k !== null) {
    return [{ id: moveId, key: k }];
  }

  // Otherwise rebalance
  // Build finalIds with moveId spliced in at targetIndex
  const finalIds = [...remaining.map(e => e.id)];
  finalIds.splice(targetIndex, 0, moveId);
  
  // Rebalance and return assignments
  const newKeys = rebalance(finalIds.map(() => 0));
  return finalIds.map((id, i) => ({ id, key: newKeys[i] }));
}