import { describe, expect, it } from 'vitest';

import { recipeById } from '@/data/catalog';
import { products } from '@/data/products';
import {
  barcodeCheckDigit,
  hasValidBarcodeCheckDigit,
  normalizeBarcode,
  resolveBarcode,
} from '@/domain/barcode';
import { matchRecipe } from '@/domain/matching';
import { createEmptySnapshot } from '@/domain/persistence';
import { InventoryItem } from '@/domain/types';

const addedAt = '2026-01-01T00:00:00.000Z';

function item(
  ingredientId: InventoryItem['ingredientId'],
  overrides: Partial<InventoryItem> = {},
): InventoryItem {
  return {
    id: `item-${ingredientId}`,
    ingredientId,
    status: 'onHand',
    source: 'generic',
    addedAt,
    revision: 1,
    ...overrides,
  };
}

describe('barcode normalization and resolution', () => {
  it('validates EAN-13 check digits and rejects a changed digit', () => {
    expect(barcodeCheckDigit('930000000001')).toBe(9);
    expect(hasValidBarcodeCheckDigit('9300000000019')).toBe(true);
    expect(hasValidBarcodeCheckDigit('9300000000018')).toBe(false);
    expect(normalizeBarcode('9300000000018')).toEqual(
      expect.objectContaining({ ok: false, reason: 'The barcode check digit is not valid.' }),
    );
  });

  it('canonicalizes formatted UPC-A into the equivalent EAN-13', () => {
    expect(normalizeBarcode('036000-291452')).toEqual({
      ok: true,
      originalBarcode: '036000-291452',
      canonicalBarcode: '0036000291452',
      symbology: 'upca',
    });
  });

  it('resolves the local fictional vodka fixture and preserves scan metadata', () => {
    const resolution = resolveBarcode('9300000000019');
    expect(resolution).toEqual(
      expect.objectContaining({
        status: 'verified',
        canonicalBarcode: '9300000000019',
        originalBarcode: '9300000000019',
        symbology: 'ean13',
        product: products[0],
      }),
    );
  });

  it('distinguishes valid unknown, invalid, and unavailable results', () => {
    expect(resolveBarcode('9300000000026')).toEqual(
      expect.objectContaining({ status: 'unknown', canonicalBarcode: '9300000000026' }),
    );
    expect(resolveBarcode('not-a-barcode')).toEqual(
      expect.objectContaining({ status: 'invalid' }),
    );
    expect(resolveBarcode('9300000000026', { catalogAvailable: false })).toEqual(
      expect.objectContaining({ status: 'unavailable' }),
    );
  });
});

describe('verified-product matching', () => {
  it('refreshes the mapped vodka recommendation after a recognised bottle is added', () => {
    const snapshot = createEmptySnapshot();
    snapshot.basics['standard-ice'] = 'available';
    snapshot.inventory = [item('lemon-juice'), item('simple-syrup'), item('egg-white')];

    const before = matchRecipe(recipeById['vodka-sour'], snapshot.inventory, snapshot.basics);
    expect(before.category).toBe('oneAway');
    expect(before.missingRequired).toEqual(['vodka']);

    snapshot.inventory.push(
      item('vodka', {
        id: 'product-harbour-light',
        source: 'product',
        productId: products[0].id,
      }),
    );
    const after = matchRecipe(recipeById['vodka-sour'], snapshot.inventory, snapshot.basics);
    expect(after.category).toBe('ready');
    expect(after.missingRequired).toEqual([]);
  });
});
