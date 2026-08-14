import { describe, expect, it } from 'vitest';

import { parseProjectFile, serializeProject } from './projectFile';
import type { ProjectPayload } from './projectFile';

const SAVED_AT = '2026-08-13T09:15:00.000Z';

function makePayload(overrides: Partial<ProjectPayload> = {}): ProjectPayload {
  return {
    name: 'ALP Marine Communication Test',
    description: 'NMEA and Modbus analysis',
    savedAt: SAVED_AT,
    protocols: ['{"name":"ALP Sensor Protocol","version":"1.0"}'],
    packetTemplates: [
      {
        id: 'template-1',
        name: 'Sensor read',
        schemaName: 'ALP Sensor Protocol',
        values: { address: '5', command: '0x10' },
      },
    ],
    ...overrides,
  };
}

/** Geçerli bir dosya metni üretmenin kısa yolu; senaryolar bunun üstüne bozar. */
function fileText(project: Record<string, unknown>, formatVersion: unknown = 1): string {
  return JSON.stringify({ formatVersion, project });
}

describe('serializeProject', () => {
  it('wraps the payload in a formatVersion 1 envelope', () => {
    const text = serializeProject(makePayload());
    const decoded: unknown = JSON.parse(text);

    expect(decoded).toMatchObject({
      formatVersion: 1,
      project: { name: 'ALP Marine Communication Test' },
    });
  });

  it('indents with two spaces so the file stays diffable', () => {
    const text = serializeProject(makePayload());

    expect(text.split('\n')[1]).toBe('  "formatVersion": 1,');
  });

  it('omits description when the payload has none', () => {
    const { description: _ignored, ...withoutDescription } = makePayload();
    const text = serializeProject(withoutDescription);

    expect(text).not.toContain('description');
  });

  it('never stamps its own timestamp — savedAt is echoed verbatim', () => {
    // Modül `new Date()` çağırsaydı bu ölçüm çalışan saate bağlı olurdu.
    const text = serializeProject(makePayload({ savedAt: '1999-12-31T23:59:59.000Z' }));

    expect(text).toContain('"savedAt": "1999-12-31T23:59:59.000Z"');
  });
});

describe('parseProjectFile', () => {
  it('round-trips a serialized project', () => {
    const payload = makePayload();
    const result = parseProjectFile(serializeProject(payload));

    expect(result).toEqual({ ok: true, project: payload });
  });

  it('accepts a project without a description', () => {
    const { description: _ignored, ...withoutDescription } = makePayload();
    const result = parseProjectFile(serializeProject(withoutDescription));

    expect(result).toEqual({ ok: true, project: withoutDescription });
  });

  it('reports malformed JSON with the parser message as detail', () => {
    const result = parseProjectFile('{ "formatVersion": ');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorKey).toBe('projects.error.invalidJson');
    expect(result.detail).toBeTruthy();
  });

  it('rejects valid JSON that is not an object', () => {
    expect(parseProjectFile('[]')).toEqual({ ok: false, errorKey: 'projects.error.notAnObject' });
    expect(parseProjectFile('42')).toEqual({ ok: false, errorKey: 'projects.error.notAnObject' });
    expect(parseProjectFile('null')).toEqual({ ok: false, errorKey: 'projects.error.notAnObject' });
  });

  it('rejects a file without formatVersion', () => {
    const text = JSON.stringify({ project: makePayload() });

    expect(parseProjectFile(text)).toEqual({
      ok: false,
      errorKey: 'projects.error.missingVersion',
    });
  });

  it('rejects a non-numeric formatVersion', () => {
    const text = fileText({ ...makePayload() }, '1');

    expect(parseProjectFile(text)).toEqual({
      ok: false,
      errorKey: 'projects.error.versionNotNumber',
      detail: '1',
    });
  });

  it('separates a future version from an unsupported one', () => {
    // Ayrı anahtar şart: ileri sürümde kullanıcının yapacağı şey "uygulamayı
    // güncelle", eski/geçersiz sürümde değil.
    expect(parseProjectFile(fileText({ ...makePayload() }, 2))).toEqual({
      ok: false,
      errorKey: 'projects.error.futureVersion',
      detail: '2',
    });
    expect(parseProjectFile(fileText({ ...makePayload() }, 0))).toEqual({
      ok: false,
      errorKey: 'projects.error.unsupportedVersion',
      detail: '0',
    });
  });

  it('rejects a missing or non-object project', () => {
    expect(parseProjectFile(JSON.stringify({ formatVersion: 1 }))).toEqual({
      ok: false,
      errorKey: 'projects.error.missingProject',
    });
    expect(parseProjectFile(JSON.stringify({ formatVersion: 1, project: [] }))).toEqual({
      ok: false,
      errorKey: 'projects.error.missingProject',
    });
  });

  it('rejects a missing or empty project name', () => {
    const { name: _ignored, ...withoutName } = makePayload();

    expect(parseProjectFile(fileText({ ...withoutName }))).toEqual({
      ok: false,
      errorKey: 'projects.error.invalidName',
    });
    expect(parseProjectFile(fileText({ ...makePayload(), name: '' }))).toEqual({
      ok: false,
      errorKey: 'projects.error.invalidName',
    });
  });

  it('rejects a non-string description', () => {
    expect(parseProjectFile(fileText({ ...makePayload(), description: 7 }))).toEqual({
      ok: false,
      errorKey: 'projects.error.invalidDescription',
    });
  });

  it('rejects a missing or unparseable savedAt', () => {
    const { savedAt: _ignored, ...withoutSavedAt } = makePayload();

    expect(parseProjectFile(fileText({ ...withoutSavedAt }))).toEqual({
      ok: false,
      errorKey: 'projects.error.invalidSavedAt',
    });
    expect(parseProjectFile(fileText({ ...makePayload(), savedAt: 'dün' }))).toEqual({
      ok: false,
      errorKey: 'projects.error.invalidSavedAt',
    });
  });

  it('rejects protocols that is not an array of strings', () => {
    expect(parseProjectFile(fileText({ ...makePayload(), protocols: '{}' }))).toEqual({
      ok: false,
      errorKey: 'projects.error.invalidProtocols',
    });
    // Şemalar METİN olarak taşınır; çözümlenmiş nesne kabul edilmez.
    expect(parseProjectFile(fileText({ ...makePayload(), protocols: [{ name: 'x' }] }))).toEqual({
      ok: false,
      errorKey: 'projects.error.invalidProtocols',
    });
  });

  it('accepts empty protocol and template lists', () => {
    const payload = makePayload({ protocols: [], packetTemplates: [] });

    expect(parseProjectFile(serializeProject(payload))).toEqual({ ok: true, project: payload });
  });

  it('rejects packetTemplates that is not an array', () => {
    expect(parseProjectFile(fileText({ ...makePayload(), packetTemplates: {} }))).toEqual({
      ok: false,
      errorKey: 'projects.error.invalidPacketTemplates',
    });
  });

  it('points at the offending template field in detail', () => {
    const broken = fileText({
      ...makePayload(),
      packetTemplates: [
        { id: 'a', name: 'A', schemaName: 'S', values: {} },
        { id: 'b', name: 'B', schemaName: 'S', values: { address: 5 } },
      ],
    });

    expect(parseProjectFile(broken)).toEqual({
      ok: false,
      errorKey: 'projects.error.invalidPacketTemplate',
      detail: 'packetTemplates[1].values',
    });
  });

  it('rejects a template missing its schema name', () => {
    const broken = fileText({
      ...makePayload(),
      packetTemplates: [{ id: 'a', name: 'A', values: {} }],
    });

    expect(parseProjectFile(broken)).toEqual({
      ok: false,
      errorKey: 'projects.error.invalidPacketTemplate',
      detail: 'packetTemplates[0].schemaName',
    });
  });

  it('drops unknown fields instead of rejecting the file', () => {
    // §40 "Unknown field handling": ileri bir sürümün eklediği alan dosyayı
    // açılamaz yapmamalı, ama dönen yüke de sızmamalı.
    const text = fileText({
      ...makePayload(),
      charts: [{ id: 'chart-1' }],
      userNotes: 'ileriden gelen alan',
    });
    const result = parseProjectFile(text);

    expect(result).toEqual({ ok: true, project: makePayload() });
  });
});
