import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadTextFile } from './downloadTextFile';

interface ClickedAnchor {
  readonly href: string;
  readonly download: string;
}

/**
 * jsdom Blob URL'ini uygulamıyor; koşucunun `URL`i ise Node'un sürümünü
 * miras alıyor ve o jsdom Blob'unu reddediyor. Bu yüzden her senaryo `URL`
 * üstüne kendi tanımını koyar. `vi.spyOn` yetmez: gözetlenen özellik yine
 * Node'un gerçek uygulamasını çağırırdı.
 */
function installBlobUrlSupport(): {
  readonly createObjectURL: ReturnType<typeof vi.fn<(blob: Blob) => string>>;
  readonly revokeObjectURL: ReturnType<typeof vi.fn<(url: string) => void>>;
} {
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:alp-comm/1');
  const revokeObjectURL = vi.fn<(url: string) => void>();
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });
  return { createObjectURL, revokeObjectURL };
}

/**
 * Desteğin YOKLUĞUNU taklit eder. Silmek yetmiyor — miras alınan uygulama
 * ortaya çıkıyor — bu yüzden `undefined` ile gölgeleniyor.
 */
function simulateMissingBlobUrlSupport(): void {
  Object.defineProperty(URL, 'createObjectURL', { value: undefined, configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: undefined, configurable: true });
}

/** Testin koyduğu tanımları kaldırır; ortamın kendi (miras) hâli geri gelir. */
function restoreBlobUrlSupport(): void {
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
}

const clicked: ClickedAnchor[] = [];

beforeEach(() => {
  clicked.length = 0;
  // Gerçek `click()` jsdom'da gezinme uyarısı basar; bağlantının hangi
  // niteliklerle tıklandığını yakalamak zaten yeterli.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push({ href: this.href, download: this.download });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  restoreBlobUrlSupport();
});

describe('downloadTextFile', () => {
  it('throws instead of failing silently when Blob URLs are unavailable', () => {
    simulateMissingBlobUrlSupport();

    expect(() => {
      downloadTextFile('project.json', '{}');
    }).toThrow(/createObjectURL/);
  });

  it('clicks an anchor carrying the blob url and the requested file name', () => {
    installBlobUrlSupport();

    downloadTextFile('project.alpproj.json', '{"formatVersion":1}', 'application/json');

    expect(clicked).toEqual([{ href: 'blob:alp-comm/1', download: 'project.alpproj.json' }]);
  });

  it('builds a utf-8 blob with the given mime type and content', async () => {
    const { createObjectURL } = installBlobUrlSupport();

    downloadTextFile('schema.json', '{"name":"ölçüm"}', 'application/json');

    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.type).toBe('application/json;charset=utf-8');
    expect(await blob?.text()).toBe('{"name":"ölçüm"}');
  });

  it('defaults to text/plain when no mime type is given', () => {
    const { createObjectURL } = installBlobUrlSupport();

    downloadTextFile('notes.txt', 'hello');

    expect(createObjectURL.mock.calls[0]?.[0]?.type).toBe('text/plain;charset=utf-8');
  });

  it('revokes the blob url even when the click throws', () => {
    const { revokeObjectURL } = installBlobUrlSupport();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('navigation blocked');
    });

    expect(() => {
      downloadTextFile('notes.txt', 'hello');
    }).toThrow('navigation blocked');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:alp-comm/1');
  });
});
