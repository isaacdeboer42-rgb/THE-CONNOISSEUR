import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

describe('Milestone 4 release configuration', () => {
  it('has stable store identifiers and developer-facing build versions', () => {
    const config = readJson('app.json').expo;
    expect(config.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(config.ios.bundleIdentifier).toBe('com.connoisseur.app');
    expect(config.ios.buildNumber).toBe('1');
    expect(config.android.package).toBe('com.connoisseur.app');
    expect(config.android.versionCode).toBe(1);
    expect(config.runtimeVersion.policy).toBe('appVersion');
    expect(config.newArchEnabled).toBeUndefined();
  });

  it('defines internal and production build profiles with remote auto-increment', () => {
    const eas = readJson('eas.json');
    expect(eas.cli.appVersionSource).toBe('remote');
    expect(eas.build.preview.distribution).toBe('internal');
    expect(eas.build.production.autoIncrement).toBe(true);
    expect(eas.submit.production).toEqual({});
  });

  it('configures opt-in barcode camera scanning without microphone access', () => {
    const config = readJson('app.json').expo;
    const packageJson = readJson('package.json');
    const cameraPlugin = config.plugins.find(
      (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-camera',
    );
    const scanSource = fs.readFileSync(path.join(root, 'app/scan.tsx'), 'utf8');

    expect(packageJson.dependencies['expo-camera']).toMatch(/^~58\./);
    expect(cameraPlugin).toEqual([
      'expo-camera',
      expect.objectContaining({
        barcodeScannerEnabled: true,
        microphonePermission: false,
        recordAudioAndroid: false,
      }),
    ]);
    expect(scanSource).toContain('useCameraPermissions');
    expect(scanSource).toContain("barcodeTypes: ['ean13', 'upc_a']");
    expect(scanSource).toContain('onBarcodeScanned={handleCameraBarcode}');
  });

  it('ships the launch handover set', () => {
    [
      'docs/RELEASE_READINESS.md',
      'docs/OPERATIONS.md',
      'docs/PRIVACY_SECURITY.md',
      'docs/CONTENT_GUIDE.md',
      'docs/TEST_EVIDENCE.md',
      'docs/UX_AUDIT.md',
      'docs/UX_INFORMATION_ARCHITECTURE.md',
      'docs/UX_SCREEN_SPEC.md',
      'docs/UX_STATE_CONTENT_SPEC.md',
      'docs/UX_BACKLOG.md',
      'docs/UX_USABILITY_TEST_PACK.md',
      'docs/UX_HANDOVER.md',
    ].forEach((file) => expect(fs.existsSync(path.join(root, file)), file).toBe(true));
  });
});
