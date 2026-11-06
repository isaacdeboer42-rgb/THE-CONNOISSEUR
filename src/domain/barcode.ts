import { verifiedProductByBarcode } from '@/data/products';
import { BarcodeSymbology, VerifiedProduct } from '@/domain/types';

export type BarcodeResolution =
  | {
      status: 'verified';
      canonicalBarcode: string;
      originalBarcode: string;
      symbology: BarcodeSymbology;
      product: VerifiedProduct;
    }
  | {
      status: 'unknown';
      canonicalBarcode: string;
      originalBarcode: string;
      symbology: BarcodeSymbology;
    }
  | { status: 'invalid'; originalBarcode: string; reason: string }
  | { status: 'unavailable'; originalBarcode: string; reason: string };

export type BarcodeNormalization =
  | {
      ok: true;
      canonicalBarcode: string;
      originalBarcode: string;
      symbology: BarcodeSymbology;
    }
  | { ok: false; originalBarcode: string; reason: string };

export function barcodeCheckDigit(body: string): number | undefined {
  if (!/^\d+$/.test(body)) return undefined;

  let sum = 0;
  let weight = 3;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10;
}

export function hasValidBarcodeCheckDigit(value: string): boolean {
  if (!/^\d{12,13}$/.test(value)) return false;
  const expected = barcodeCheckDigit(value.slice(0, -1));
  return expected !== undefined && expected === Number(value.at(-1));
}

export function normalizeBarcode(raw: string): BarcodeNormalization {
  const originalBarcode = raw;
  const compact = raw.replace(/[\s-]/g, '');

  if (!compact) {
    return { ok: false, originalBarcode, reason: 'Enter a UPC-A or EAN-13 barcode.' };
  }
  if (!/^\d+$/.test(compact)) {
    return { ok: false, originalBarcode, reason: 'Barcodes can contain digits, spaces and hyphens only.' };
  }
  if (compact.length !== 12 && compact.length !== 13) {
    return { ok: false, originalBarcode, reason: 'Use a 12-digit UPC-A or 13-digit EAN-13 barcode.' };
  }
  if (!hasValidBarcodeCheckDigit(compact)) {
    return { ok: false, originalBarcode, reason: 'The barcode check digit is not valid.' };
  }

  const symbology: BarcodeSymbology = compact.length === 12 ? 'upca' : 'ean13';
  return {
    ok: true,
    canonicalBarcode: symbology === 'upca' ? `0${compact}` : compact,
    originalBarcode,
    symbology,
  };
}

export function resolveBarcode(
  raw: string,
  options: { catalogAvailable?: boolean } = {},
): BarcodeResolution {
  const normalized = normalizeBarcode(raw);
  if (!normalized.ok) {
    return {
      status: 'invalid',
      originalBarcode: normalized.originalBarcode,
      reason: normalized.reason,
    };
  }
  if (options.catalogAvailable === false) {
    return {
      status: 'unavailable',
      originalBarcode: normalized.originalBarcode,
      reason: 'The local product catalogue is temporarily unavailable.',
    };
  }

  const product = verifiedProductByBarcode[normalized.canonicalBarcode];
  return product
    ? { status: 'verified', ...normalized, product }
    : { status: 'unknown', ...normalized };
}
