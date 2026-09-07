import { describe, it, expect } from 'vitest';
import {
  ORDER_GAP,
  keyAfter,
  keyBetween,
  needsRebalance,
  rebalance,
  insertionKeys
} from './keys';

describe('ORDER_GAP', () => {
  it('should be 1024', () => {
    expect(ORDER_GAP).toBe(1024);
  });
});

describe('keyAfter', () => {
  it('should return ORDER_GAP for null input', () => {
    expect(keyAfter(null)).toBe(ORDER_GAP);
  });

  it('should return maxKey + ORDER_GAP for existing maxKey', () => {
    expect(keyAfter(1024)).toBe(2048);
    expect(keyAfter(2048)).toBe(3072);
  });
});

describe('keyBetween', () => {
  it('should return null when both before and after are null', () => {
    expect(keyBetween(null, null)).toBeNull();
  });

  it('should handle head insertion with room', () => {
    expect(keyBetween(null, 2048)).toBe(1024);
  });

  it('should handle head insertion with no room', () => {
    expect(keyBetween(null, 1024)).toBeNull();
    expect(keyBetween(null, 512)).toBeNull();
  });

  it('should handle tail insertion', () => {
    expect(keyBetween(1024, null)).toBe(2048);
    expect(keyBetween(2048, null)).toBe(3072);
  });

  it('should handle midpoint insertion', () => {
    expect(keyBetween(1024, 3072)).toBe(2048);
    expect(keyBetween(0, 2048)).toBe(1024);
  });

  it('should return null for adjacent keys', () => {
    expect(keyBetween(1024, 1025)).toBeNull();
    expect(keyBetween(2048, 2049)).toBeNull();
  });

  it('should return null for equal keys', () => {
    expect(keyBetween(1024, 1024)).toBeNull();
  });

  it('should return null for inverted range', () => {
    expect(keyBetween(2048, 1024)).toBeNull();
  });
});

describe('needsRebalance', () => {
  it('should return false when keyBetween would return a valid key', () => {
    expect(needsRebalance(null, 2048)).toBe(false);
    expect(needsRebalance(1024, 3072)).toBe(false);
  });

  it('should return true when keyBetween would return null', () => {
    expect(needsRebalance(null, 1024)).toBe(true);
    expect(needsRebalance(1024, 1025)).toBe(true);
    expect(needsRebalance(2048, 2049)).toBe(true);
  });
});

describe('rebalance', () => {
  it('should produce evenly spaced keys', () => {
    const keys = [1024, 2048, 3072];
    const result = rebalance(keys);
    expect(result).toEqual([1024, 2048, 3072]);
  });

  it('should preserve length', () => {
    const keys = [1024, 2048, 3072, 4096];
    const result = rebalance(keys);
    expect(result.length).toBe(keys.length);
  });

  it('should not mutate input array', () => {
    const keys = [1024, 2048, 3072];
    const originalKeys = [...keys];
    rebalance(keys);
    expect(keys).toEqual(originalKeys);
  });

  it('should work with empty array', () => {
    const result = rebalance([]);
    expect(result).toEqual([]);
  });
});

describe('insertionKeys', () => {
  it('should handle head insertion with room', () => {
    const result = insertionKeys([2048, 3072], 0);
    expect(result).toEqual({ key: 1024 });
  });

  it('should handle tail insertion with room', () => {
    const result = insertionKeys([1024, 2048], 2);
    expect(result).toEqual({ key: 3072 });
  });

  it('should handle middle insertion with room', () => {
    const result = insertionKeys([1024, 3072], 1);
    expect(result).toEqual({ key: 2048 });
  });

  it('should rebalance on head insertion without room', () => {
    const result = insertionKeys([1024], 0);
    expect(result).toEqual({ rebalanced: [1024, 2048], key: 1024 });
  });

  it('should rebalance on middle insertion without room', () => {
    const result = insertionKeys([1024, 1025], 1);
    expect(result).toEqual({ rebalanced: [1024, 2048, 3072], key: 2048 });
  });

  it('should never rebalance on tail insertion', () => {
    expect(insertionKeys([1024, 1025], 2)).toEqual({ key: 2049 });
  });

  it('should keep rebalanced keys strictly increasing', () => {
    const result = insertionKeys([1024, 1025], 1);
    if (!('rebalanced' in result)) throw new Error('expected rebalance');
    for (let i = 1; i < result.rebalanced.length; i++) {
      expect(result.rebalanced[i]).toBeGreaterThan(result.rebalanced[i - 1]);
    }
  });

  it('should keep keys positive integers', () => {
    const result = insertionKeys([1024, 2048, 3072], 1);
    if ('rebalanced' in result) {
      for (const key of result.rebalanced) {
        expect(key).toBeGreaterThan(0);
        expect(Number.isInteger(key)).toBe(true);
      }
    } else {
      expect(result.key).toBeGreaterThan(0);
      expect(Number.isInteger(result.key)).toBe(true);
    }
  });

  it('should survive repeated worst-case head insertions', () => {
    let keys = [1024];
    for (let i = 0; i < 50; i++) {
      const result = insertionKeys(keys, 0);
      keys = 'rebalanced' in result ? result.rebalanced : [result.key, ...keys];
      for (let j = 1; j < keys.length; j++) {
        expect(keys[j]).toBeGreaterThan(keys[j - 1]);
      }
      for (const key of keys) {
        expect(key).toBeGreaterThan(0);
        expect(Number.isInteger(key)).toBe(true);
      }
    }
    expect(keys.length).toBe(51);
  });

  it('should throw for out of bounds index', () => {
    expect(() => insertionKeys([1024], -1)).toThrow('Index out of bounds');
    expect(() => insertionKeys([1024], 2)).toThrow('Index out of bounds');
  });
});