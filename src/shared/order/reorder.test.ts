import { describe, it, expect } from 'vitest';
import { planReorder } from './reorder';
import { ORDER_GAP } from './keys';

describe('planReorder', () => {
  it('should move middle item to head among keys [1024, 2048, 3072]: moving id at key 3072 to index 0 → single assignment; keyBetween(null, 1024) returns null per keys.ts (after <= ORDER_GAP), so this actually rebalances → expect 3 assignments with keys [1024, 2048, 3072] in the new id order', () => {
    const siblings = [
      { id: 'a', key: 1024 },
      { id: 'b', key: 2048 },
      { id: 'c', key: 3072 }
    ];
    const result = planReorder(siblings, 'c', 0);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('c');
    expect(result[1].id).toBe('a');
    expect(result[2].id).toBe('b');
    expect(result[0].key).toBe(1024);
    expect(result[1].key).toBe(2048);
    expect(result[2].key).toBe(3072);
  });

  it('should move head to tail among [1024, 2048, 3072] → single assignment { key: 3072 + 1024 = 4096 }', () => {
    const siblings = [
      { id: 'a', key: 1024 },
      { id: 'b', key: 2048 },
      { id: 'c', key: 3072 }
    ];
    const result = planReorder(siblings, 'a', 2);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
    expect(result[0].key).toBe(4096);
  });

  it('should move tail to middle (index 1) among [1024, 2048, 3072] → single assignment with key strictly between 1024 and 2048 (assert key > 1024 && key < 2048, and exact value Math.floor((1024+2048)/2) = 1536)', () => {
    const siblings = [
      { id: 'a', key: 1024 },
      { id: 'b', key: 2048 },
      { id: 'c', key: 3072 }
    ];
    const result = planReorder(siblings, 'c', 1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c');
    expect(result[0].key).toBe(1536);
    expect(result[0].key).toBeGreaterThan(1024);
    expect(result[0].key).toBeLessThan(2048);
  });

  it('should be no-op: moving an item to its current index returns []', () => {
    const siblings = [
      { id: 'a', key: 1024 },
      { id: 'b', key: 2048 },
      { id: 'c', key: 3072 }
    ];
    const result = planReorder(siblings, 'b', 1);
    expect(result).toHaveLength(0);
  });

  it('should rebalance path: siblings with adjacent keys [1000, 1001, 1002], move last to index 1 → expect 3 assignments, keys [1024, 2048, 3072], ids in the correct final order (original order with last item moved between first and second)', () => {
    const siblings = [
      { id: 'a', key: 1000 },
      { id: 'b', key: 1001 },
      { id: 'c', key: 1002 }
    ];
    const result = planReorder(siblings, 'c', 1);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('a');
    expect(result[1].id).toBe('c');
    expect(result[2].id).toBe('b');
    expect(result[0].key).toBe(1024);
    expect(result[1].key).toBe(2048);
    expect(result[2].key).toBe(3072);
  });

  it('should handle single-item scope: moving the only item to index 0 returns []', () => {
    const siblings = [
      { id: 'a', key: 1024 }
    ];
    const result = planReorder(siblings, 'a', 0);
    expect(result).toHaveLength(0);
  });

  it('should throw for unknown moveId', () => {
    const siblings = [
      { id: 'a', key: 1024 },
      { id: 'b', key: 2048 }
    ];
    expect(() => planReorder(siblings, 'c', 0)).toThrow('unknown sibling: c');
  });

  it('should throw for targetIndex -1', () => {
    const siblings = [
      { id: 'a', key: 1024 },
      { id: 'b', key: 2048 }
    ];
    expect(() => planReorder(siblings, 'a', -1)).toThrow('targetIndex out of bounds');
  });

  it('should throw for targetIndex === siblings.length', () => {
    const siblings = [
      { id: 'a', key: 1024 },
      { id: 'b', key: 2048 }
    ];
    expect(() => planReorder(siblings, 'a', 2)).toThrow('targetIndex out of bounds');
  });

  it('should maintain result invariant: applying assignments to sibling list and re-sorting by key yields expected final id order', () => {
    const applyAssignments = (siblings: {id: string, key: number}[], assignments: {id: string, key: number}[]) => {
      const updated = [...siblings];
      for (const assignment of assignments) {
        const index = updated.findIndex(s => s.id === assignment.id);
        if (index !== -1) {
          updated[index] = { ...updated[index], key: assignment.key };
        }
      }
      return updated.sort((a, b) => a.key - b.key);
    };

    // Test case 1: move middle to head
    const siblings1 = [
      { id: 'a', key: 1024 },
      { id: 'b', key: 2048 },
      { id: 'c', key: 3072 }
    ];
    const result1 = planReorder(siblings1, 'c', 0);
    const final1 = applyAssignments(siblings1, result1);
    expect(final1.map(s => s.id)).toEqual(['c', 'a', 'b']);

    // Test case 2: move head to tail
    const siblings2 = [
      { id: 'a', key: 1024 },
      { id: 'b', key: 2048 },
      { id: 'c', key: 3072 }
    ];
    const result2 = planReorder(siblings2, 'a', 2);
    const final2 = applyAssignments(siblings2, result2);
    expect(final2.map(s => s.id)).toEqual(['b', 'c', 'a']);
  });
});