import { describe, expect, it } from 'vitest';

import { products } from '@/data/products';
import { createEmptySnapshot } from '@/domain/persistence';
import {
  addPrivateProductToSnapshot,
  addVerifiedProductToSnapshot,
  setProductSubmissionProcessingErrorInSnapshot,
  setProductSubmissionStatusInSnapshot,
  submitPrivateProductInSnapshot,
  updatePrivateProductInSnapshot,
} from '@/domain/productInventory';

const now = '2026-11-06T00:00:00.000Z';

describe('product inventory mutations', () => {
  it('adds a verified product idempotently and can replace a generic overlap', () => {
    const snapshot = createEmptySnapshot();
    snapshot.inventory = [{
      id: 'generic-vodka', ingredientId: 'vodka', status: 'onHand', source: 'generic', addedAt: now, revision: 1,
    }];
    const first = addVerifiedProductToSnapshot(
      snapshot,
      products[0],
      'scan-1',
      'replaceGeneric',
      now,
      { originalBarcode: '9300 0000 0001 9', symbology: 'ean13' },
    );
    expect(first.status).toBe('added');
    expect(first.snapshot.inventory).toEqual([
      expect.objectContaining({
        productId: products[0].id,
        ingredientId: 'vodka',
        source: 'product',
        scannedBarcodeOriginal: '9300 0000 0001 9',
        scannedBarcodeSymbology: 'ean13',
      }),
    ]);
    const retry = addVerifiedProductToSnapshot(first.snapshot, products[0], 'scan-1', 'replaceGeneric', now);
    expect(retry.status).toBe('alreadyProcessed');
    expect(retry.snapshot).toBe(first.snapshot);
  });

  it('reports a duplicate product and restores an out-of-stock bottle', () => {
    const added = addVerifiedProductToSnapshot(createEmptySnapshot(), products[0], 'scan-1', 'keepBoth', now);
    const duplicate = addVerifiedProductToSnapshot(added.snapshot, products[0], 'scan-2', 'keepBoth', now);
    expect(duplicate.status).toBe('duplicate');
    const empty = {
      ...duplicate.snapshot,
      inventory: duplicate.snapshot.inventory.map((item) => ({ ...item, status: 'outOfStock' as const })),
    };
    const restored = addVerifiedProductToSnapshot(empty, products[0], 'scan-3', 'keepBoth', now);
    expect(restored.status).toBe('restocked');
    expect(restored.snapshot.inventory[0].status).toBe('onHand');
  });

  it('keeps a generic ingredient when the user chooses to retain both entries', () => {
    const snapshot = createEmptySnapshot();
    snapshot.inventory = [{
      id: 'generic-vodka', ingredientId: 'vodka', status: 'onHand', source: 'generic', addedAt: now, revision: 1,
    }];

    const added = addVerifiedProductToSnapshot(snapshot, products[0], 'scan-keep-both', 'keepBoth', now);

    expect(added.snapshot.inventory).toHaveLength(2);
    expect(added.snapshot.inventory).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'generic', ingredientId: 'vodka' }),
      expect.objectContaining({ source: 'product', productId: products[0].id }),
    ]));
  });

  it('rejects verified scan diagnostics that do not match the resolved product', () => {
    expect(() => addVerifiedProductToSnapshot(
      createEmptySnapshot(),
      products[0],
      'scan-mismatched-diagnostics',
      'keepBoth',
      now,
      { originalBarcode: '9300000000026', symbology: 'ean13' },
    )).toThrow('does not match');
  });

  it('saves a private bottle before independently simulating catalogue processing', () => {
    const added = addPrivateProductToSnapshot(
      createEmptySnapshot(),
      {
        barcode: '9300000000026',
        originalBarcode: '9300000000026',
        symbology: 'ean13',
        name: 'Neighbourhood Vodka',
        brand: 'Local Fixture',
        ingredientId: 'vodka',
        bottleSizeMl: 700,
        labelPhotoUri: 'local-preview://label/9300000000026',
      },
      'scan-private-1',
      now,
    );
    expect(added.status).toBe('added');
    expect(added.snapshot.privateProducts).toHaveLength(1);
    expect(added.snapshot.inventory).toHaveLength(1);
    expect(added.snapshot.productSubmissions[0]).toEqual(
      expect.objectContaining({ status: 'draft', shareConsent: false }),
    );

    const submitted = submitPrivateProductInSnapshot(
      added.snapshot,
      added.privateProductId!,
      'submission-1',
      now,
    );
    expect(submitted.productSubmissions[0]).toEqual(
      expect.objectContaining({ status: 'submitted', shareConsent: true }),
    );
    const submissionId = submitted.productSubmissions[0].id;
    const processing = setProductSubmissionStatusInSnapshot(submitted, submissionId, 'processing', now);
    expect(processing.productSubmissions[0]).toEqual(
      expect.objectContaining({
        status: 'processing',
        modelId: 'local-simulated-label-extractor-v1',
        extractedFields: expect.objectContaining({ ingredientId: 'vodka' }),
      }),
    );
    expect(processing.privateProducts).toHaveLength(1);
    expect(processing.inventory).toHaveLength(1);
  });

  it('re-adds a removed private bottle without duplicating its private product record', () => {
    const input = {
      barcode: '9300000000026',
      originalBarcode: '9300000000026',
      symbology: 'ean13' as const,
      name: 'Neighbourhood Vodka',
      ingredientId: 'vodka' as const,
    };
    const first = addPrivateProductToSnapshot(createEmptySnapshot(), input, 'scan-private-1', now);
    const removed = {
      ...first.snapshot,
      inventory: [],
    };

    const rescanned = addPrivateProductToSnapshot(removed, input, 'scan-private-2', now);

    expect(rescanned.status).toBe('added');
    expect(rescanned.privateProductId).toBe(first.privateProductId);
    expect(rescanned.snapshot.privateProducts).toHaveLength(1);
    expect(rescanned.snapshot.inventory).toEqual([
      expect.objectContaining({ privateProductId: first.privateProductId, ingredientId: 'vodka' }),
    ]);
  });

  it('reports a duplicate private bottle and restores its existing mapping', () => {
    const input = {
      barcode: '9300000000026',
      originalBarcode: '9300000000026',
      symbology: 'ean13' as const,
      name: 'Neighbourhood Vodka',
      ingredientId: 'vodka' as const,
    };
    const added = addPrivateProductToSnapshot(createEmptySnapshot(), input, 'scan-private-a', now);
    const duplicate = addPrivateProductToSnapshot(added.snapshot, input, 'scan-private-b', now);
    expect(duplicate.status).toBe('duplicate');

    const outOfStock = {
      ...duplicate.snapshot,
      inventory: duplicate.snapshot.inventory.map((item) => ({ ...item, status: 'outOfStock' as const })),
    };
    const restored = addPrivateProductToSnapshot(outOfStock, input, 'scan-private-c', now);
    expect(restored.status).toBe('restocked');
    expect(restored.snapshot.privateProducts).toHaveLength(1);
    expect(restored.snapshot.inventory[0]).toEqual(
      expect.objectContaining({ status: 'onHand', ingredientId: 'vodka' }),
    );
  });

  it('edits private details and matching while preserving submitted review evidence', () => {
    const added = addPrivateProductToSnapshot(
      createEmptySnapshot(),
      {
        barcode: '9300000000026',
        originalBarcode: '9300000000026',
        symbology: 'ean13',
        name: 'Neighbourhood Vodka',
        ingredientId: 'vodka',
      },
      'scan-private-edit',
      now,
    );
    const submitted = submitPrivateProductInSnapshot(
      added.snapshot,
      added.privateProductId!,
      'ignored-when-draft-exists',
      now,
    );
    const updated = updatePrivateProductInSnapshot(
      submitted,
      added.privateProductId!,
      {
        name: 'Neighbourhood Bourbon',
        brand: 'Local Fixture',
        ingredientId: 'bourbon',
        bottleSizeMl: 750,
      },
      '2026-11-06T01:00:00.000Z',
    );
    const processing = setProductSubmissionStatusInSnapshot(
      updated,
      updated.productSubmissions[0].id,
      'processing',
      '2026-11-06T02:00:00.000Z',
    );

    expect(processing.privateProducts[0]).toEqual(expect.objectContaining({
      name: 'Neighbourhood Bourbon',
      ingredientId: 'bourbon',
      bottleSizeMl: 750,
    }));
    expect(processing.inventory[0]).toEqual(expect.objectContaining({
      ingredientId: 'bourbon',
      revision: 2,
    }));
    expect(processing.productSubmissions[0].submittedFields).toEqual(
      expect.objectContaining({ ingredientId: 'vodka', name: 'Neighbourhood Vodka' }),
    );
    expect(processing.productSubmissions[0].extractedFields).toEqual(
      expect.objectContaining({ ingredientId: 'vodka' }),
    );
  });

  it('enforces submission transitions and retries without deleting private inventory', () => {
    const added = addPrivateProductToSnapshot(
      createEmptySnapshot(),
      {
        barcode: '9300000000026',
        originalBarcode: '9300000000026',
        symbology: 'ean13',
        name: 'Neighbourhood Vodka',
        ingredientId: 'vodka',
      },
      'scan-private-state-machine',
      now,
    );
    const submitted = submitPrivateProductInSnapshot(
      added.snapshot,
      added.privateProductId!,
      'submission-state-machine',
      now,
    );
    const submissionId = submitted.productSubmissions[0].id;

    const invalidApproval = setProductSubmissionStatusInSnapshot(
      submitted,
      submissionId,
      'approved',
      now,
    );
    expect(invalidApproval).toBe(submitted);

    const processing = setProductSubmissionStatusInSnapshot(
      submitted,
      submissionId,
      'processing',
      now,
    );
    const failed = setProductSubmissionProcessingErrorInSnapshot(
      processing,
      submissionId,
      'Fixture timeout',
      now,
    );
    expect(failed.productSubmissions[0].processingError).toBe('Fixture timeout');
    expect(failed.privateProducts).toHaveLength(1);
    expect(failed.inventory).toHaveLength(1);

    const retrying = setProductSubmissionStatusInSnapshot(
      failed,
      submissionId,
      'processing',
      now,
    );
    expect(retrying.productSubmissions[0].processingError).toBeUndefined();
    const pending = setProductSubmissionStatusInSnapshot(
      retrying,
      submissionId,
      'pending_review',
      now,
    );
    const approved = setProductSubmissionStatusInSnapshot(
      pending,
      submissionId,
      'approved',
      now,
    );
    expect(approved.productSubmissions[0].status).toBe('approved');
    expect(setProductSubmissionStatusInSnapshot(
      approved,
      submissionId,
      'processing',
      now,
    )).toBe(approved);
  });

  it('rejects malformed private product service inputs', () => {
    expect(() => addPrivateProductToSnapshot(
      createEmptySnapshot(),
      {
        barcode: '9300000000025',
        originalBarcode: '9300000000025',
        symbology: 'ean13',
        name: 'Invalid barcode bottle',
        ingredientId: 'vodka',
      },
      'scan-invalid-private',
      now,
    )).toThrow('validated canonical');
  });
});
