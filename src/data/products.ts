import { VerifiedProduct } from '@/domain/types';

// A deliberately fictional, locally verified fixture for Milestone 3 usability
// testing. It must never be presented as an external-provider result.
export const products: VerifiedProduct[] = [
  {
    id: 'verified-harbour-light-vodka-700',
    barcode: '9300000000019',
    name: 'Harbour Light Vodka 700 ml',
    brand: 'Connoisseur Fixture Co.',
    ingredientId: 'vodka',
    bottleSizeMl: 700,
    status: 'verified',
  },
];

export const verifiedProductById = Object.fromEntries(
  products.map((product) => [product.id, product]),
) as Record<string, VerifiedProduct>;

export const verifiedProductByBarcode = Object.fromEntries(
  products.map((product) => [product.barcode, product]),
) as Record<string, VerifiedProduct>;
