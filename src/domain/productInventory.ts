import {
  BarcodeSymbology,
  BarSnapshot,
  NewPrivateProductInput,
  PrivateProduct,
  PrivateProductUpdateInput,
  ProductSubmission,
  ProductSubmissionStatus,
  VerifiedProduct,
} from '@/domain/types';
import { normalizeBarcode } from '@/domain/barcode';

export type ProductOverlapMode = 'replaceGeneric' | 'keepBoth';
export type ProductAddStatus = 'added' | 'restocked' | 'duplicate' | 'alreadyProcessed';
export interface VerifiedProductScanMetadata {
  originalBarcode: string;
  symbology: BarcodeSymbology;
}

export interface ProductAddResult {
  snapshot: BarSnapshot;
  status: ProductAddStatus;
  itemId?: string;
  privateProductId?: string;
}

function withCompletedOperation(snapshot: BarSnapshot, operationId: string): BarSnapshot {
  return {
    ...snapshot,
    completedScanOperationIds: [
      ...new Set([...snapshot.completedScanOperationIds, operationId]),
    ].slice(-100),
  };
}

function markShoppingOwned(snapshot: BarSnapshot, ingredientId: VerifiedProduct['ingredientId'], ownedAt: string) {
  return snapshot.shoppingItems.map((item) =>
    item.ingredientId === ingredientId ? { ...item, ownedAt } : item,
  );
}

export function addVerifiedProductToSnapshot(
  snapshot: BarSnapshot,
  product: VerifiedProduct,
  operationId: string,
  overlapMode: ProductOverlapMode,
  timestamp: string,
  scanMetadata?: VerifiedProductScanMetadata,
): ProductAddResult {
  if (scanMetadata) {
    const normalizedScan = normalizeBarcode(scanMetadata.originalBarcode);
    if (
      !normalizedScan.ok ||
      normalizedScan.canonicalBarcode !== product.barcode ||
      normalizedScan.symbology !== scanMetadata.symbology
    ) {
      throw new Error('Verified-product scan metadata does not match the resolved barcode.');
    }
  }
  const existing = snapshot.inventory.find((item) => item.productId === product.id);
  if (snapshot.completedScanOperationIds.includes(operationId)) {
    return { snapshot, status: 'alreadyProcessed', itemId: existing?.id };
  }

  if (existing) {
    const withOperation = withCompletedOperation(snapshot, operationId);
    if (existing.status === 'onHand') {
      return { snapshot: withOperation, status: 'duplicate', itemId: existing.id };
    }
    return {
      snapshot: {
        ...withOperation,
        inventory: snapshot.inventory.map((item) =>
          item.id === existing.id
            ? { ...item, status: 'onHand', revision: item.revision + 1 }
            : item,
        ),
        shoppingItems: markShoppingOwned(snapshot, product.ingredientId, timestamp),
      },
      status: 'restocked',
      itemId: existing.id,
    };
  }

  const itemId = `product-${product.id}`;
  const inventory =
    overlapMode === 'replaceGeneric'
      ? snapshot.inventory.filter(
          (item) => !(item.source === 'generic' && item.ingredientId === product.ingredientId),
        )
      : snapshot.inventory;
  const withOperation = withCompletedOperation(snapshot, operationId);
  return {
    snapshot: {
      ...withOperation,
      inventory: [
        ...inventory,
        {
          id: itemId,
          ingredientId: product.ingredientId,
          status: 'onHand',
          source: 'product',
          productId: product.id,
          ...(scanMetadata
            ? {
                scannedBarcodeOriginal: scanMetadata.originalBarcode,
                scannedBarcodeSymbology: scanMetadata.symbology,
              }
            : {}),
          addedAt: timestamp,
          revision: 1,
        },
      ],
      shoppingItems: markShoppingOwned(snapshot, product.ingredientId, timestamp),
    },
    status: 'added',
    itemId,
  };
}

function privateIdForOperation(operationId: string): string {
  const safeId = operationId.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `private-${safeId}`;
}

function draftSubmissionFor(
  privateProduct: PrivateProduct,
  timestamp: string,
): ProductSubmission {
  return {
    id: `submission-draft-${privateProduct.id}`,
    privateProductId: privateProduct.id,
    status: 'draft',
    shareConsent: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(privateProduct.labelPhotoUri ? { sourcePhotoUri: privateProduct.labelPhotoUri } : {}),
  };
}

function submittedFieldsFor(privateProduct: PrivateProduct): NonNullable<ProductSubmission['submittedFields']> {
  return {
    name: privateProduct.name,
    ...(privateProduct.brand ? { brand: privateProduct.brand } : {}),
    ingredientId: privateProduct.ingredientId,
    ...(privateProduct.bottleSizeMl ? { bottleSizeMl: privateProduct.bottleSizeMl } : {}),
  };
}

export function addPrivateProductToSnapshot(
  snapshot: BarSnapshot,
  input: NewPrivateProductInput,
  operationId: string,
  timestamp: string,
): ProductAddResult {
  const normalizedOriginal = normalizeBarcode(input.originalBarcode);
  if (
    !normalizedOriginal.ok ||
    normalizedOriginal.canonicalBarcode !== input.barcode ||
    normalizedOriginal.symbology !== input.symbology
  ) {
    throw new Error('Private products require a validated canonical UPC-A or EAN-13 barcode.');
  }
  if (!input.name.trim()) throw new Error('Private products require a name.');
  if (
    input.bottleSizeMl !== undefined &&
    (!Number.isFinite(input.bottleSizeMl) || input.bottleSizeMl <= 0 || input.bottleSizeMl > 10_000)
  ) {
    throw new Error('Bottle size must be between 1 and 10,000 ml.');
  }

  const existingProduct = snapshot.privateProducts.find((product) => product.barcode === input.barcode);
  const existingItem = existingProduct
    ? snapshot.inventory.find((item) => item.privateProductId === existingProduct.id)
    : undefined;
  if (snapshot.completedScanOperationIds.includes(operationId)) {
    return {
      snapshot,
      status: 'alreadyProcessed',
      itemId: existingItem?.id,
      privateProductId: existingProduct?.id,
    };
  }

  if (existingProduct && existingItem) {
    const withOperation = withCompletedOperation(snapshot, operationId);
    if (existingItem.status === 'onHand') {
      return {
        snapshot: withOperation,
        status: 'duplicate',
        itemId: existingItem.id,
        privateProductId: existingProduct.id,
      };
    }
    return {
      snapshot: {
        ...withOperation,
        inventory: snapshot.inventory.map((item) =>
          item.id === existingItem.id
            ? { ...item, status: 'onHand', revision: item.revision + 1 }
            : item,
        ),
        shoppingItems: markShoppingOwned(snapshot, existingProduct.ingredientId, timestamp),
      },
      status: 'restocked',
      itemId: existingItem.id,
      privateProductId: existingProduct.id,
    };
  }

  if (existingProduct) {
    const itemId = `private-item-${existingProduct.id}`;
    const withOperation = withCompletedOperation(snapshot, operationId);
    return {
      snapshot: {
        ...withOperation,
        inventory: [
          ...snapshot.inventory,
          {
            id: itemId,
            ingredientId: existingProduct.ingredientId,
            status: 'onHand',
            source: 'product',
            privateProductId: existingProduct.id,
            addedAt: timestamp,
            revision: 1,
          },
        ],
        shoppingItems: markShoppingOwned(snapshot, existingProduct.ingredientId, timestamp),
      },
      status: 'added',
      itemId,
      privateProductId: existingProduct.id,
    };
  }

  const privateProductId = privateIdForOperation(operationId);
  const itemId = `private-item-${privateProductId}`;
  const product: PrivateProduct = {
    id: privateProductId,
    barcode: input.barcode,
    originalBarcode: input.originalBarcode,
    symbology: input.symbology,
    name: input.name.trim(),
    ...(input.brand?.trim() ? { brand: input.brand.trim() } : {}),
    ingredientId: input.ingredientId,
    ...(input.bottleSizeMl ? { bottleSizeMl: input.bottleSizeMl } : {}),
    ...(input.labelPhotoUri ? { labelPhotoUri: input.labelPhotoUri } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const withOperation = withCompletedOperation(snapshot, operationId);
  return {
    snapshot: {
      ...withOperation,
      privateProducts: [...snapshot.privateProducts, product],
      productSubmissions: [
        ...snapshot.productSubmissions,
        draftSubmissionFor(product, timestamp),
      ],
      inventory: [
        ...snapshot.inventory,
        {
          id: itemId,
          ingredientId: input.ingredientId,
          status: 'onHand',
          source: 'product',
          privateProductId,
          addedAt: timestamp,
          revision: 1,
        },
      ],
      shoppingItems: markShoppingOwned(snapshot, input.ingredientId, timestamp),
    },
    status: 'added',
    itemId,
    privateProductId,
  };
}

export function submitPrivateProductInSnapshot(
  snapshot: BarSnapshot,
  privateProductId: string,
  submissionId: string,
  timestamp: string,
): BarSnapshot {
  const product = snapshot.privateProducts.find((item) => item.id === privateProductId);
  if (!product) return snapshot;
  const existing = snapshot.productSubmissions.find(
    (submission) => submission.privateProductId === privateProductId,
  );
  if (existing) {
    if (existing.status !== 'draft') return snapshot;
    return {
      ...snapshot,
      productSubmissions: snapshot.productSubmissions.map((submission) =>
        submission.id === existing.id
          ? {
              ...submission,
              status: 'submitted',
              shareConsent: true,
              submittedFields: submittedFieldsFor(product),
              updatedAt: timestamp,
            }
          : submission,
      ),
    };
  }
  const submission: ProductSubmission = {
    id: submissionId,
    privateProductId,
    status: 'submitted',
    shareConsent: true,
    submittedFields: submittedFieldsFor(product),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(product.labelPhotoUri ? { sourcePhotoUri: product.labelPhotoUri } : {}),
  };
  return { ...snapshot, productSubmissions: [...snapshot.productSubmissions, submission] };
}

export function updatePrivateProductInSnapshot(
  snapshot: BarSnapshot,
  privateProductId: string,
  input: PrivateProductUpdateInput,
  timestamp: string,
): BarSnapshot {
  const product = snapshot.privateProducts.find((item) => item.id === privateProductId);
  if (!product) return snapshot;
  if (!input.name.trim()) throw new Error('Private products require a name.');
  if (
    input.bottleSizeMl !== undefined &&
    (!Number.isFinite(input.bottleSizeMl) || input.bottleSizeMl <= 0 || input.bottleSizeMl > 10_000)
  ) {
    throw new Error('Bottle size must be between 1 and 10,000 ml.');
  }

  const updatedProduct: PrivateProduct = {
    ...product,
    name: input.name.trim(),
    ...(input.brand?.trim() ? { brand: input.brand.trim() } : { brand: undefined }),
    ingredientId: input.ingredientId,
    ...(input.bottleSizeMl !== undefined
      ? { bottleSizeMl: Math.round(input.bottleSizeMl) }
      : { bottleSizeMl: undefined }),
    ...(input.labelPhotoUri ? { labelPhotoUri: input.labelPhotoUri } : { labelPhotoUri: undefined }),
    updatedAt: timestamp,
  };
  const inventory = snapshot.inventory.map((item) =>
    item.privateProductId === privateProductId
      ? {
          ...item,
          ingredientId: input.ingredientId,
          revision: item.revision + 1,
        }
      : item,
  );
  const oldIngredientStillOnHand = inventory.some(
    (item) => item.ingredientId === product.ingredientId && item.status === 'onHand',
  );
  const newIngredientOnHand = inventory.some(
    (item) => item.ingredientId === input.ingredientId && item.status === 'onHand',
  );

  return {
    ...snapshot,
    privateProducts: snapshot.privateProducts.map((item) =>
      item.id === privateProductId ? updatedProduct : item,
    ),
    inventory,
    shoppingItems: snapshot.shoppingItems.map((item) => {
      if (item.ingredientId === product.ingredientId && !oldIngredientStillOnHand) {
        return { ...item, ownedAt: undefined };
      }
      if (item.ingredientId === input.ingredientId && newIngredientOnHand) {
        return { ...item, ownedAt: item.ownedAt ?? timestamp };
      }
      return item;
    }),
    productSubmissions: snapshot.productSubmissions.map((submission) =>
      submission.privateProductId === privateProductId && submission.status === 'draft'
        ? {
            ...submission,
            ...(updatedProduct.labelPhotoUri
              ? { sourcePhotoUri: updatedProduct.labelPhotoUri }
              : { sourcePhotoUri: undefined }),
            updatedAt: timestamp,
          }
        : submission,
    ),
  };
}

export function setProductSubmissionStatusInSnapshot(
  snapshot: BarSnapshot,
  submissionId: string,
  status: ProductSubmissionStatus,
  timestamp: string,
): BarSnapshot {
  const current = snapshot.productSubmissions.find((submission) => submission.id === submissionId);
  if (!current) return snapshot;
  const allowedNext: Record<ProductSubmissionStatus, ProductSubmissionStatus[]> = {
    draft: ['submitted'],
    submitted: ['processing'],
    processing: ['processing', 'pending_review'],
    pending_review: ['approved', 'merged', 'rejected'],
    approved: [],
    merged: [],
    rejected: [],
  };
  if (!allowedNext[current.status].includes(status)) return snapshot;

  const productById = new Map(snapshot.privateProducts.map((product) => [product.id, product]));
  return {
    ...snapshot,
    productSubmissions: snapshot.productSubmissions.map((submission) => {
      if (submission.id !== submissionId) return submission;
      const product = productById.get(submission.privateProductId);
      const evidence = submission.submittedFields ?? product;
      return {
        ...submission,
        status,
        updatedAt: timestamp,
        ...(status === 'processing' && evidence
          ? {
              modelId: 'local-simulated-label-extractor-v1',
              extractedFields: {
                name: evidence.name,
                brand: evidence.brand,
                ingredientId: evidence.ingredientId,
                bottleSizeMl: evidence.bottleSizeMl,
              },
              processingError: undefined,
            }
          : {}),
        ...(status === 'pending_review' ? { processingError: undefined } : {}),
      };
    }),
  };
}

export function setProductSubmissionProcessingErrorInSnapshot(
  snapshot: BarSnapshot,
  submissionId: string,
  error: string,
  timestamp: string,
): BarSnapshot {
  const current = snapshot.productSubmissions.find((submission) => submission.id === submissionId);
  if (!current || current.status !== 'processing') return snapshot;
  return {
    ...snapshot,
    productSubmissions: snapshot.productSubmissions.map((submission) =>
      submission.id === submissionId
        ? {
            ...submission,
            processingError: error,
            updatedAt: timestamp,
          }
        : submission,
    ),
  };
}
