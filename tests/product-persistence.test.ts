import { describe, expect, it } from 'vitest';

import {
  createEmptySnapshot,
  mergeGuestIntoAccount,
  normalizeBarSnapshot,
} from '@/domain/persistence';

const createdAt = '2026-11-06T00:00:00.000Z';

describe('product persistence', () => {
  it('normalizes private product, submission, scan operation and product inventory metadata', () => {
    const snapshot = normalizeBarSnapshot({
      inventory: [
        {
          id: 'private-item-1',
          ingredientId: 'vodka',
          status: 'onHand',
          source: 'product',
          privateProductId: 'private-1',
          scannedBarcodeOriginal: '9300 0000 0002 6',
          scannedBarcodeSymbology: 'ean13',
          addedAt: createdAt,
          revision: 2,
        },
      ],
      privateProducts: [
        {
          id: 'private-1',
          barcode: '9300000000026',
          originalBarcode: '9300000000026',
          symbology: 'ean13',
          name: 'Neighbourhood Vodka',
          brand: 'Local Fixture',
          ingredientId: 'vodka',
          bottleSizeMl: 700,
          labelPhotoUri: 'local-preview://label/9300000000026',
          createdAt,
          updatedAt: createdAt,
        },
      ],
      productSubmissions: [
        {
          id: 'submission-1',
          privateProductId: 'private-1',
          status: 'pending_review',
          shareConsent: true,
          createdAt,
          updatedAt: createdAt,
          modelId: 'local-simulated-label-extractor-v1',
          extractedFields: {
            name: 'Neighbourhood Vodka',
            ingredientId: 'vodka',
            bottleSizeMl: 700,
          },
        },
      ],
      completedScanOperationIds: ['scan-1', 'scan-1'],
    });

    expect(snapshot.inventory[0]).toEqual(
      expect.objectContaining({
        source: 'product',
        privateProductId: 'private-1',
        scannedBarcodeOriginal: '9300 0000 0002 6',
        scannedBarcodeSymbology: 'ean13',
      }),
    );
    expect(snapshot.privateProducts).toHaveLength(1);
    expect(snapshot.productSubmissions[0]).toEqual(
      expect.objectContaining({ status: 'pending_review', privateProductId: 'private-1' }),
    );
    expect(snapshot.completedScanOperationIds).toEqual(['scan-1']);
  });

  it('drops malformed product records and submissions without a matching private product', () => {
    const snapshot = normalizeBarSnapshot({
      inventory: [
        {
          id: 'unreferenced-product-item',
          ingredientId: 'vodka',
          status: 'onHand',
          source: 'product',
          addedAt: createdAt,
          revision: 1,
        },
      ],
      privateProducts: [
        {
          id: 'bad',
          barcode: '9300000000025',
          originalBarcode: '9300000000025',
          symbology: 'ean13',
          name: 'Bad record',
          ingredientId: 'vodka',
          createdAt,
          updatedAt: createdAt,
        },
      ],
      productSubmissions: [
        {
          id: 'orphan',
          privateProductId: 'missing',
          status: 'pending_review',
          createdAt,
          updatedAt: createdAt,
        },
      ],
    });
    expect(snapshot.inventory).toEqual([]);
    expect(snapshot.privateProducts).toEqual([]);
    expect(snapshot.productSubmissions).toEqual([]);
  });

  it('merges separate product bottles and their review state without collapsing by ingredient', () => {
    const account = createEmptySnapshot();
    account.inventory = [
      {
        id: 'verified-vodka',
        ingredientId: 'vodka',
        status: 'onHand',
        source: 'product',
        productId: 'verified-harbour-light-vodka-700',
        addedAt: createdAt,
        revision: 1,
      },
    ];
    account.completedScanOperationIds = ['known-scan'];

    const guest = normalizeBarSnapshot({
      inventory: [
        {
          id: 'private-vodka',
          ingredientId: 'vodka',
          status: 'onHand',
          source: 'product',
          privateProductId: 'private-1',
          addedAt: createdAt,
          revision: 1,
        },
      ],
      privateProducts: [
        {
          id: 'private-1',
          barcode: '9300000000026',
          originalBarcode: '9300000000026',
          symbology: 'ean13',
          name: 'Neighbourhood Vodka',
          ingredientId: 'vodka',
          createdAt,
          updatedAt: createdAt,
        },
      ],
      productSubmissions: [
        {
          id: 'submission-1',
          privateProductId: 'private-1',
          status: 'submitted',
          shareConsent: true,
          createdAt,
          updatedAt: createdAt,
        },
      ],
      completedScanOperationIds: ['private-scan'],
    });

    const result = mergeGuestIntoAccount(account, guest, 'import-products');
    expect(result.snapshot.inventory).toHaveLength(2);
    expect(result.snapshot.privateProducts).toHaveLength(1);
    expect(result.snapshot.productSubmissions).toHaveLength(1);
    expect(result.snapshot.completedScanOperationIds).toEqual(['known-scan', 'private-scan']);
  });

  it('deduplicates the same private barcode across guest import and remaps its records', () => {
    const account = normalizeBarSnapshot({
      privateProducts: [
        {
          id: 'account-private',
          barcode: '9300000000026',
          originalBarcode: '9300000000026',
          symbology: 'ean13',
          name: 'Account bottle',
          ingredientId: 'bourbon',
          createdAt,
          updatedAt: createdAt,
        },
      ],
      productSubmissions: [
        {
          id: 'account-draft',
          privateProductId: 'account-private',
          status: 'draft',
          shareConsent: false,
          createdAt,
          updatedAt: createdAt,
        },
      ],
    });
    const guest = normalizeBarSnapshot({
      inventory: [
        {
          id: 'guest-private-item',
          ingredientId: 'vodka',
          status: 'onHand',
          source: 'product',
          privateProductId: 'guest-private',
          addedAt: createdAt,
          revision: 1,
        },
      ],
      privateProducts: [
        {
          id: 'guest-private',
          barcode: '9300000000026',
          originalBarcode: '9300000000026',
          symbology: 'ean13',
          name: 'Guest bottle',
          ingredientId: 'vodka',
          createdAt,
          updatedAt: createdAt,
        },
      ],
      productSubmissions: [
        {
          id: 'guest-draft',
          privateProductId: 'guest-private',
          status: 'pending_review',
          shareConsent: true,
          createdAt,
          updatedAt: createdAt,
          submittedFields: {
            name: 'Guest bottle',
            ingredientId: 'vodka',
          },
          modelId: 'local-simulated-label-extractor-v1',
          extractedFields: {
            name: 'Guest bottle',
            ingredientId: 'vodka',
          },
        },
      ],
    });

    const result = mergeGuestIntoAccount(account, guest, 'dedupe-private-barcode');

    expect(result.snapshot.privateProducts).toHaveLength(1);
    expect(result.snapshot.inventory).toEqual([
      expect.objectContaining({ privateProductId: 'account-private', ingredientId: 'bourbon' }),
    ]);
    expect(result.snapshot.productSubmissions).toEqual([
      expect.objectContaining({
        privateProductId: 'account-private',
        status: 'pending_review',
        shareConsent: true,
        submittedFields: expect.objectContaining({ ingredientId: 'vodka' }),
      }),
    ]);
  });

  it('normalizes duplicate private barcodes to one canonical mapping', () => {
    const snapshot = normalizeBarSnapshot({
      inventory: [
        {
          id: 'duplicate-private-item',
          ingredientId: 'vodka',
          status: 'onHand',
          source: 'product',
          privateProductId: 'duplicate-private',
          addedAt: createdAt,
          revision: 1,
        },
      ],
      privateProducts: [
        {
          id: 'canonical-private',
          barcode: '9300000000026',
          originalBarcode: '9300000000026',
          symbology: 'ean13',
          name: 'Canonical bottle',
          ingredientId: 'bourbon',
          createdAt,
          updatedAt: createdAt,
        },
        {
          id: 'duplicate-private',
          barcode: '9300000000026',
          originalBarcode: '9300000000026',
          symbology: 'ean13',
          name: 'Duplicate bottle',
          ingredientId: 'vodka',
          createdAt,
          updatedAt: createdAt,
        },
      ],
    });

    expect(snapshot.privateProducts).toEqual([
      expect.objectContaining({ id: 'canonical-private', ingredientId: 'bourbon' }),
    ]);
    expect(snapshot.inventory).toEqual([
      expect.objectContaining({ privateProductId: 'canonical-private', ingredientId: 'bourbon' }),
    ]);
  });
});
