import { describe, expect, it } from 'vitest';

import { readTextFile } from './readTextFile';

describe('readTextFile', () => {
  it('returns the file contents as text', async () => {
    const file = new File(['{"formatVersion":1}'], 'project.json', { type: 'application/json' });

    expect(await readTextFile(file)).toBe('{"formatVersion":1}');
  });

  it('decodes non-ascii content as utf-8', async () => {
    const file = new File(['ölçüm şeması'], 'schema.json', { type: 'application/json' });

    expect(await readTextFile(file)).toBe('ölçüm şeması');
  });

  it('returns an empty string for an empty file', async () => {
    const file = new File([], 'empty.json', { type: 'application/json' });

    expect(await readTextFile(file)).toBe('');
  });
});
