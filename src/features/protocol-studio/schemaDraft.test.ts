import { beforeEach, describe, expect, it } from 'vitest';

import { SPEC_SENSOR_PROTOCOL } from '@/protocol-core/schemas/specFixture';
import type { FieldDraft, SchemaDraft } from './schemaDraft';
import {
  addField,
  createEmptyDraft,
  createEnumEntryDraft,
  createFieldDraft,
  draftToSchema,
  duplicateField,
  findFieldDraft,
  moveField,
  removeField,
  resetDraftIdCounter,
  schemaToDraft,
  updateField,
} from './schemaDraft';

/** Şemaya çevrilebilen en küçük taslak — testler bunun üstüne tek şey bozar. */
function minimalDraft(): SchemaDraft {
  const draft = createEmptyDraft();
  draft.name = 'Test Protocol';
  const field = createFieldDraft('uint8');
  field.id = 'address';
  field.name = 'Device Address';
  draft.fields = [field];
  return draft;
}

function namedField(id: string, type: FieldDraft['type'] = 'uint8'): FieldDraft {
  const field = createFieldDraft(type);
  field.id = id;
  field.name = id;
  return field;
}

function issueKeys(issues: readonly { readonly messageKey: string }[]): string[] {
  return issues.map((issue) => issue.messageKey);
}

beforeEach(() => {
  resetDraftIdCounter();
});

describe('createEmptyDraft', () => {
  it('starts with no fields and an unset name', () => {
    const draft = createEmptyDraft();
    expect(draft.name).toBe('');
    expect(draft.fields).toEqual([]);
    expect(draft.framing).toEqual({
      type: 'startEnd',
      startBytes: [],
      endBytes: [],
      maximumFrameLength: '256',
    });
  });
});

describe('createFieldDraft', () => {
  it('numbers draft identities deterministically from the module counter', () => {
    expect(createFieldDraft().draftId).toBe('fd-1');
    expect(createFieldDraft().draftId).toBe('fd-2');
    resetDraftIdCounter();
    expect(createFieldDraft().draftId).toBe('fd-1');
  });

  it('defaults to uint8 with the length the type implies', () => {
    const field = createFieldDraft();
    expect(field.type).toBe('uint8');
    expect(field.length).toBe('1');
  });

  it('takes the length from wider types', () => {
    expect(createFieldDraft('float64').length).toBe('8');
    expect(createFieldDraft('uint24').length).toBe('3');
  });

  it('leaves length empty for types whose width comes from the schema', () => {
    expect(createFieldDraft('ascii').length).toBe('');
    expect(createFieldDraft('rawBytes').length).toBe('');
  });
});

describe('schemaToDraft', () => {
  it('renders every numeric value as text', () => {
    const draft = schemaToDraft(SPEC_SENSOR_PROTOCOL);
    expect(draft.framing.startBytes).toEqual(['170']);
    expect(draft.framing.endBytes).toEqual(['85']);
    expect(draft.framing.maximumFrameLength).toBe('256');
    expect(draft.fields.map((field) => field.offset)).toEqual(['1', '2', '3', '4', '']);
  });

  it('turns absent optional values into empty text, not undefined', () => {
    const draft = schemaToDraft(SPEC_SENSOR_PROTOCOL);
    const checksum = draft.fields.find((field) => field.id === 'checksum');
    expect(checksum?.offset).toBe('');
    expect(checksum?.signed).toBeNull();
    expect(checksum?.endianness).toBe('');
    expect(checksum?.coverage).toEqual({ startField: 'address', endField: 'payload' });
  });

  it('keeps enum entries as an ordered list with their own identities', () => {
    const draft = schemaToDraft(SPEC_SENSOR_PROTOCOL);
    const command = draft.fields.find((field) => field.id === 'command');
    expect(command?.enumValues.map((entry) => entry.key)).toEqual(['16', '32', '48']);
    expect(command?.enumValues.map((entry) => entry.label)).toEqual([
      'Sensor Data',
      'Set Output',
      'Status Request',
    ]);
    expect(new Set(command?.enumValues.map((entry) => entry.entryId)).size).toBe(3);
  });
});

describe('draftToSchema round trip', () => {
  it('rebuilds SPEC_SENSOR_PROTOCOL exactly', () => {
    const result = draftToSchema(schemaToDraft(SPEC_SENSOR_PROTOCOL));
    expect(result.issues).toEqual([]);
    expect(result.schema).toEqual(SPEC_SENSOR_PROTOCOL);
  });

  it('survives a second pass unchanged', () => {
    const once = draftToSchema(schemaToDraft(SPEC_SENSOR_PROTOCOL)).schema;
    expect(once).not.toBeNull();
    const twice = once === null ? null : draftToSchema(schemaToDraft(once)).schema;
    expect(twice).toEqual(SPEC_SENSOR_PROTOCOL);
  });
});

describe('draftToSchema conversion', () => {
  it('reports the empty draft instead of producing half a schema', () => {
    const result = draftToSchema(createEmptyDraft());
    expect(result.schema).toBeNull();
    expect(issueKeys(result.issues)).toEqual([
      'studio.draft.nameRequired',
      'studio.draft.fieldsRequired',
    ]);
    expect(result.issues.every((issue) => issue.draftId === null)).toBe(true);
  });

  it('omits fields the user has not filled in', () => {
    const draft = minimalDraft();
    const field = draft.fields[0];
    expect(field).toBeDefined();
    if (field !== undefined) {
      field.length = '';
    }
    const result = draftToSchema(draft);
    expect(result.schema?.fields[0]).toEqual({
      id: 'address',
      name: 'Device Address',
      type: 'uint8',
    });
  });

  it('rejects an intermediate numeric value and blames the right field draft', () => {
    const draft = minimalDraft();
    const field = draft.fields[0];
    if (field !== undefined) {
      field.offset = '-';
    }
    const result = draftToSchema(draft);
    expect(result.schema).toBeNull();
    expect(result.issues).toEqual([
      {
        draftId: field?.draftId,
        field: 'fields.0.offset',
        messageKey: 'studio.draft.integerInvalid',
        params: { value: '-' },
      },
    ]);
  });

  it('rejects a half typed hexadecimal prefix', () => {
    const draft = minimalDraft();
    const field = draft.fields[0];
    if (field !== undefined) {
      field.offset = '0x';
    }
    expect(issueKeys(draftToSchema(draft).issues)).toEqual(['studio.draft.integerInvalid']);
  });

  it('accepts hexadecimal integers and writes them back as decimal', () => {
    const draft = minimalDraft();
    const field = draft.fields[0];
    if (field !== undefined) {
      field.offset = '0x10';
    }
    expect(draftToSchema(draft).schema?.fields[0]?.offset).toBe(16);
  });

  it('accepts a trailing decimal point but not a lone sign on real numbers', () => {
    const draft = minimalDraft();
    const field = draft.fields[0];
    if (field !== undefined) {
      field.scale = '1.';
      field.calibrationOffset = '-2.5e2';
    }
    expect(draftToSchema(draft).schema?.fields[0]?.scale).toBe(1);
    expect(draftToSchema(draft).schema?.fields[0]?.calibrationOffset).toBe(-250);
    if (field !== undefined) {
      field.minimum = '-';
    }
    expect(issueKeys(draftToSchema(draft).issues)).toEqual(['studio.draft.numberInvalid']);
  });

  it('refuses non finite numeric text', () => {
    const draft = minimalDraft();
    const field = draft.fields[0];
    if (field !== undefined) {
      field.scale = 'Infinity';
    }
    expect(issueKeys(draftToSchema(draft).issues)).toEqual(['studio.draft.numberInvalid']);
  });

  it('requires an id and a name on every field', () => {
    const draft = minimalDraft();
    const field = draft.fields[0];
    if (field !== undefined) {
      field.id = '  ';
      field.name = '';
    }
    expect(issueKeys(draftToSchema(draft).issues)).toEqual([
      'studio.draft.fieldIdRequired',
      'studio.draft.fieldNameRequired',
    ]);
  });

  it('normalises enum keys written in hexadecimal', () => {
    const draft = minimalDraft();
    const field = draft.fields[0];
    if (field !== undefined) {
      field.type = 'enum';
      field.enumValues = [createEnumEntryDraft('0x10', 'Sensor Data')];
    }
    expect(draftToSchema(draft).schema?.fields[0]?.enumValues).toEqual({ '16': 'Sensor Data' });
  });

  it('rejects an enum key that is not an integer', () => {
    const draft = minimalDraft();
    const field = draft.fields[0];
    if (field !== undefined) {
      field.enumValues = [createEnumEntryDraft('abc', 'Nope')];
    }
    expect(issueKeys(draftToSchema(draft).issues)).toEqual(['studio.draft.enumKeyInvalid']);
  });

  it('rejects two enum rows that normalise to the same key', () => {
    const draft = minimalDraft();
    const field = draft.fields[0];
    if (field !== undefined) {
      field.enumValues = [createEnumEntryDraft('16', 'First'), createEnumEntryDraft('0x10', 'Second')];
    }
    const result = draftToSchema(draft);
    expect(issueKeys(result.issues)).toEqual(['studio.draft.enumKeyDuplicate']);
  });

  it('rejects an enum row with a key but no label, and skips the untouched row', () => {
    const draft = minimalDraft();
    const field = draft.fields[0];
    if (field !== undefined) {
      field.enumValues = [createEnumEntryDraft('16', ' '), createEnumEntryDraft('', '')];
    }
    expect(issueKeys(draftToSchema(draft).issues)).toEqual(['studio.draft.enumLabelRequired']);
  });

  it('rejects a half filled checksum coverage', () => {
    const draft = minimalDraft();
    const field = draft.fields[0];
    if (field !== undefined) {
      field.coverage.startField = 'address';
    }
    expect(issueKeys(draftToSchema(draft).issues)).toEqual(['studio.draft.coverageIncomplete']);
  });

  it('converts a complete condition and rejects a half filled one', () => {
    const draft = minimalDraft();
    const field = draft.fields[0];
    if (field !== undefined) {
      field.condition = { field: 'command', equals: '0x10' };
    }
    expect(draftToSchema(draft).schema?.fields[0]?.condition).toEqual({
      field: 'command',
      equals: 16,
    });
    if (field !== undefined) {
      field.condition = { field: 'command', equals: '' };
    }
    expect(issueKeys(draftToSchema(draft).issues)).toEqual(['studio.draft.conditionIncomplete']);
  });

  it('converts both repeat count modes and demands a source field', () => {
    const draft = minimalDraft();
    const field = draft.fields[0];
    if (field !== undefined) {
      field.repeatCount = { mode: 'fixed', count: '4', fromField: '' };
    }
    expect(draftToSchema(draft).schema?.fields[0]?.repeatCount).toBe(4);
    if (field !== undefined) {
      field.repeatCount = { mode: 'fromField', count: '', fromField: 'count' };
    }
    expect(draftToSchema(draft).schema?.fields[0]?.repeatCount).toEqual({ fromField: 'count' });
    if (field !== undefined) {
      field.repeatCount = { mode: 'fromField', count: '', fromField: '  ' };
    }
    expect(issueKeys(draftToSchema(draft).issues)).toEqual(['studio.draft.repeatFieldRequired']);
  });

  it('keeps a numeric default value apart from the text that spells it', () => {
    const draft = minimalDraft();
    const field = draft.fields[0];
    if (field !== undefined) {
      field.defaultValue = '12';
      field.defaultValueKind = 'number';
    }
    expect(draftToSchema(draft).schema?.fields[0]?.defaultValue).toBe(12);
    if (field !== undefined) {
      field.defaultValueKind = 'text';
    }
    expect(draftToSchema(draft).schema?.fields[0]?.defaultValue).toBe('12');
  });

  it('skips blank framing byte rows but rejects a byte outside a byte', () => {
    const draft = minimalDraft();
    draft.framing.startBytes = ['0xAA', '  '];
    expect(draftToSchema(draft).schema?.framing.startBytes).toEqual([170]);
    draft.framing.startBytes = ['300'];
    const result = draftToSchema(draft);
    expect(result.schema).toBeNull();
    expect(result.issues).toEqual([
      {
        draftId: null,
        field: 'framing.startBytes.0',
        messageKey: 'studio.draft.byteRange',
        params: { value: '300' },
      },
    ]);
  });

  it('requires a maximum frame length', () => {
    const draft = minimalDraft();
    draft.framing.maximumFrameLength = '';
    expect(issueKeys(draftToSchema(draft).issues)).toEqual([
      'studio.draft.maximumFrameLengthRequired',
    ]);
  });

  it('converts a zod rejection into an issue pointing at the field draft', () => {
    const draft = minimalDraft();
    const field = draft.fields[0];
    if (field !== undefined) {
      // Renk kuşağı 0..3; aralık kuralının tek sahibi zod doğrulayıcısıdır.
      field.color = '9';
    }
    const result = draftToSchema(draft);
    expect(result.schema).toBeNull();
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.messageKey).toBe('studio.draft.schemaRejected');
    expect(result.issues[0]?.field).toBe('fields.0.color');
    expect(result.issues[0]?.draftId).toBe(field?.draftId);
    expect(result.issues[0]?.params?.path).toBe('fields.0.color');
  });

  it('converts nested structure fields', () => {
    const draft = minimalDraft();
    const parent = namedField('body', 'structure');
    parent.length = '';
    parent.fields = [namedField('inner')];
    draft.fields = [...draft.fields, parent];
    const schema = draftToSchema(draft).schema;
    expect(schema?.fields[1]?.fields?.map((child) => child.id)).toEqual(['inner']);
  });

  it('blames the nested draft when a nested field is invalid', () => {
    const draft = minimalDraft();
    const parent = namedField('body', 'structure');
    parent.length = '';
    const inner = namedField('inner');
    inner.length = 'abc';
    parent.fields = [inner];
    draft.fields = [...draft.fields, parent];
    const result = draftToSchema(draft);
    expect(result.issues).toEqual([
      {
        draftId: inner.draftId,
        field: 'fields.1.fields.0.length',
        messageKey: 'studio.draft.integerInvalid',
        params: { value: 'abc' },
      },
    ]);
  });
});

describe('addField', () => {
  it('appends to the root without touching the previous draft', () => {
    const draft = minimalDraft();
    const next = addField(draft, null, namedField('command'));
    expect(next).not.toBe(draft);
    expect(draft.fields.map((field) => field.id)).toEqual(['address']);
    expect(next.fields.map((field) => field.id)).toEqual(['address', 'command']);
  });

  it('appends into a nested parent and keeps untouched siblings identical', () => {
    const draft = minimalDraft();
    const parent = namedField('body', 'structure');
    const withParent = addField(draft, null, parent);
    const next = addField(withParent, parent.draftId, namedField('inner'));
    expect(next.fields[1]?.fields.map((field) => field.id)).toEqual(['inner']);
    expect(next.fields[0]).toBe(withParent.fields[0]);
  });

  it('returns the same draft when the parent does not exist', () => {
    const draft = minimalDraft();
    expect(addField(draft, 'fd-nope', namedField('inner'))).toBe(draft);
  });
});

describe('removeField', () => {
  it('removes a nested field and leaves the rest alone', () => {
    const draft = minimalDraft();
    const parent = namedField('body', 'structure');
    const inner = namedField('inner');
    parent.fields = [inner, namedField('other')];
    const withParent = addField(draft, null, parent);
    const next = removeField(withParent, inner.draftId);
    expect(next.fields[1]?.fields.map((field) => field.id)).toEqual(['other']);
    expect(withParent.fields[1]?.fields).toHaveLength(2);
  });

  it('returns the same draft for an unknown identity', () => {
    const draft = minimalDraft();
    expect(removeField(draft, 'fd-nope')).toBe(draft);
  });
});

describe('updateField', () => {
  it('merges the patch into a new object', () => {
    const draft = minimalDraft();
    const target = draft.fields[0];
    const next = updateField(draft, target?.draftId ?? '', { name: 'Renamed', offset: '3' });
    expect(next.fields[0]?.name).toBe('Renamed');
    expect(next.fields[0]?.offset).toBe('3');
    expect(target?.name).toBe('Device Address');
  });

  it('never lets the patch change the draft identity', () => {
    const draft = minimalDraft();
    const target = draft.fields[0];
    const next = updateField(draft, target?.draftId ?? '', { draftId: 'hijacked', id: 'renamed' });
    expect(next.fields[0]?.draftId).toBe(target?.draftId);
    expect(next.fields[0]?.id).toBe('renamed');
  });

  it('reaches nested fields', () => {
    const draft = minimalDraft();
    const parent = namedField('body', 'structure');
    const inner = namedField('inner');
    parent.fields = [inner];
    const withParent = addField(draft, null, parent);
    const next = updateField(withParent, inner.draftId, { unit: 'mV' });
    expect(next.fields[1]?.fields[0]?.unit).toBe('mV');
  });
});

describe('moveField', () => {
  it('reorders the root list', () => {
    let draft = minimalDraft();
    draft = addField(draft, null, namedField('command'));
    draft = addField(draft, null, namedField('payload'));
    const next = moveField(draft, null, 2, 0);
    expect(next.fields.map((field) => field.id)).toEqual(['payload', 'address', 'command']);
  });

  it('clamps a target index past the end of the list', () => {
    let draft = minimalDraft();
    draft = addField(draft, null, namedField('command'));
    const next = moveField(draft, null, 0, 99);
    expect(next.fields.map((field) => field.id)).toEqual(['command', 'address']);
  });

  it('does nothing when the source index is outside the list', () => {
    const draft = minimalDraft();
    expect(moveField(draft, null, 5, 0)).toBe(draft);
    expect(moveField(draft, null, -1, 0)).toBe(draft);
  });

  it('does nothing when source and target are the same slot', () => {
    const draft = minimalDraft();
    expect(moveField(draft, null, 0, 0)).toBe(draft);
  });

  it('reorders a nested list', () => {
    const draft = minimalDraft();
    const parent = namedField('body', 'structure');
    parent.fields = [namedField('a'), namedField('b'), namedField('c')];
    const withParent = addField(draft, null, parent);
    const next = moveField(withParent, parent.draftId, 0, 2);
    expect(next.fields[1]?.fields.map((field) => field.id)).toEqual(['b', 'c', 'a']);
  });

  it('does nothing when the parent is unknown', () => {
    const draft = minimalDraft();
    expect(moveField(draft, 'fd-nope', 0, 1)).toBe(draft);
  });
});

describe('duplicateField', () => {
  it('inserts the copy right after the original with fresh identities', () => {
    const draft = minimalDraft();
    const original = draft.fields[0];
    const next = duplicateField(draft, original?.draftId ?? '');
    expect(next.fields.map((field) => field.id)).toEqual(['address', 'addressCopy']);
    expect(next.fields[1]?.draftId).not.toBe(original?.draftId);
  });

  it('avoids colliding with an id that is already taken', () => {
    let draft = minimalDraft();
    draft = addField(draft, null, namedField('addressCopy'));
    const original = draft.fields[0];
    const next = duplicateField(draft, original?.draftId ?? '');
    expect(next.fields.map((field) => field.id)).toEqual([
      'address',
      'addressCopy2',
      'addressCopy',
    ]);
  });

  it('deep copies nested fields so editing the copy leaves the original alone', () => {
    const draft = minimalDraft();
    const parent = namedField('body', 'structure');
    parent.fields = [namedField('inner')];
    const withParent = addField(draft, null, parent);
    const next = duplicateField(withParent, parent.draftId);
    const copy = next.fields[2];
    const copiedChild = copy?.fields[0];
    expect(copiedChild).toBeDefined();
    expect(copiedChild?.draftId).not.toBe(parent.fields[0]?.draftId);
    if (copiedChild !== undefined) {
      copiedChild.unit = 'mV';
    }
    expect(parent.fields[0]?.unit).toBe('');
  });

  it('returns the same draft for an unknown identity', () => {
    const draft = minimalDraft();
    expect(duplicateField(draft, 'fd-nope')).toBe(draft);
  });
});

describe('findFieldDraft', () => {
  it('finds a nested field by identity', () => {
    const draft = minimalDraft();
    const parent = namedField('body', 'structure');
    const inner = namedField('inner');
    parent.fields = [inner];
    const withParent = addField(draft, null, parent);
    expect(findFieldDraft(withParent, inner.draftId)).toBe(inner);
  });

  it('returns null when nothing matches', () => {
    expect(findFieldDraft(minimalDraft(), 'fd-nope')).toBeNull();
  });
});
