/**
 * Protocol Converter ekranının durumu (spec §33).
 *
 * Ekran BOŞ AÇILMAZ: spec §33'ün kendi örneği hazır durur — Modbus RTU'nun
 * kayıt yanıtı, `Register 0 × 0.1`, hedef `sensors/temperature` MQTT topic'i.
 * Kullanıcı hiçbir şey yazmadan çalışan bir dönüşüm görür; boş bir eşleme
 * tablosu "nereden başlayacağım" sorusundan başka bir şey bırakmazdı
 * (Test Automation ekranının varsayılan senaryosuyla aynı gerekçe).
 *
 * Kayıt defteri LAZY: kaynak motoru ancak seçildiğinde iner. Bu yüzden yükleme
 * GERÇEK bir durumdur ve ekranda gösterilir; hata da yutulmaz.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { allEntries } from '@/app/catalog';
import { hexToBytes } from '@/protocol-core/buffers/representation';
import { loadProtocolPlugin } from '@/protocol-core/registry';
import type { ParsedFrame, ProtocolPlugin } from '@/protocol-core/types';

import { convertFrame } from './converterEngine';
import type { ConversionOutput, DestinationKind, FieldMapping, TransformKind } from './converterTypes';

/** Spec §33'ün örneğinin kaynağı. */
const DEFAULT_SOURCE_PLUGIN_ID = 'modbus-rtu';
/**
 * Açılış çerçevesi: Modbus RTU'nun kayıt YANITI (01 03 04 00 64 00 C8 BA 7A —
 * `modbusRtu.ts`in örnek çerçevesi, register 0 = 100, register 1 = 200).
 *
 * Motorun İLK örneği değil, ÇÜNKÜ o bir İSTEKTİR ve isteğin alanları arasında
 * register YOKTUR — spec §33'ün "Modbus Register 40001" örneği ancak yanıtta
 * karşılık bulur. Öteki protokollere geçildiğinde motorun kendi ilk geçerli
 * örneği tohumlanır.
 */
const DEFAULT_HEX_INPUT = '01 03 04 00 64 00 C8 BA 7A';
/** Aynı örneğin ölçeği: `value × 0.1`. */
const DEFAULT_FACTOR = 0.1;

const DEFAULT_MAPPINGS: readonly FieldMapping[] = [
  {
    id: 'mapping-1',
    // Modbus RTU'nun kayıt yanıtında ilk register alanının kimliği.
    sourceFieldId: 'register-0',
    transform: 'scale',
    factor: DEFAULT_FACTOR,
    addend: 0,
    // Spec §33'ün örnek topic'i. Kullanıcı verisi, çeviriye girmez.
    destinationName: 'sensors/temperature',
  },
];

export type PluginState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly plugin: ProtocolPlugin }
  | { readonly status: 'failed'; readonly detail: string };

export interface SourceOption {
  readonly pluginId: string;
  readonly name: string;
}

export type ParseState =
  | { readonly status: 'ok'; readonly frame: ParsedFrame }
  | { readonly status: 'invalid-hex'; readonly detail: string }
  | { readonly status: 'no-parser' }
  | { readonly status: 'failed'; readonly detail: string };

export interface ProtocolConverterState {
  readonly sourcePluginId: string;
  readonly hexInput: string;
  readonly mappings: readonly FieldMapping[];
  readonly destination: DestinationKind;
}

/**
 * Kaynak listesi katalogdan gelir, registry'den DEĞİL: adlar katalogda duruyor
 * ve listeyi çizmek için 190 motoru indirmek gerekmiyor (defterin `pluginId` ile
 * durma gerekçesiyle aynı). Aynı motor birden çok katalog kaydında görünebilir
 * (alias sayfaları), bu yüzden kimliğe göre tekilleştiriliyor.
 */
export function sourceOptions(): readonly SourceOption[] {
  const byPluginId = new Map<string, string>();
  for (const entry of allEntries()) {
    const pluginId = entry.protocol.pluginId;
    if (pluginId === undefined || byPluginId.has(pluginId)) continue;
    byPluginId.set(pluginId, entry.protocol.name);
  }
  return [...byPluginId.entries()]
    .map(([pluginId, name]) => ({ pluginId, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function toDetail(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** Motorun kendi örnek çerçevesi — ekranın açılış girdisi. */
function firstExampleHex(plugin: ProtocolPlugin): string {
  const example = plugin.exampleFrames?.find((frame) => frame.expectedValid) ?? plugin.exampleFrames?.[0];
  if (example === undefined) return '';
  return Array.from(example.bytes, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

export interface ProtocolConverterApi {
  readonly state: ProtocolConverterState;
  readonly pluginState: PluginState;
  readonly parseState: ParseState;
  readonly output: ConversionOutput | null;
  readonly setSourcePluginId: (pluginId: string) => void;
  readonly setHexInput: (hex: string) => void;
  readonly setDestination: (destination: DestinationKind) => void;
  readonly addMapping: () => void;
  readonly removeMapping: (mappingId: string) => void;
  readonly updateMapping: (mappingId: string, patch: Partial<Omit<FieldMapping, 'id'>>) => void;
}

export function useProtocolConverter(): ProtocolConverterApi {
  const [state, setState] = useState<ProtocolConverterState>({
    sourcePluginId: DEFAULT_SOURCE_PLUGIN_ID,
    hexInput: DEFAULT_HEX_INPUT,
    mappings: DEFAULT_MAPPINGS,
    destination: 'mqtt-publish',
  });
  const [pluginState, setPluginState] = useState<PluginState>({ status: 'loading' });
  /**
   * Kullanıcı hex kutusuna DOKUNDU mu. Dokunmadıysa protokol değişince örnek
   * çerçeve yeniden tohumlanır; dokunduysa yazdığı şey EZİLMEZ — kendi verisini
   * kaybetmek, seçim değiştirmenin bedeli olamaz.
   */
  const [hexTouched, setHexTouched] = useState(false);
  /**
   * Kutudaki çerçevenin HANGİ motordan tohumlandığı. Açılış değeri varsayılan
   * kaynaktır: yoksa ilk yükleme §33'ün yanıt çerçevesini motorun ilk örneğiyle
   * (bir İSTEKLE) ezer ve ekran boş açılmama sözünü tutmazdı.
   */
  const seededFrom = useRef(DEFAULT_SOURCE_PLUGIN_ID);

  useEffect(() => {
    let cancelled = false;
    setPluginState({ status: 'loading' });

    loadProtocolPlugin(state.sourcePluginId).then(
      (plugin) => {
        if (cancelled) return;
        setPluginState({ status: 'ready', plugin });
        if (!hexTouched && seededFrom.current !== plugin.id) {
          seededFrom.current = plugin.id;
          setState((current) => ({ ...current, hexInput: firstExampleHex(plugin) }));
        }
      },
      (cause: unknown) => {
        if (!cancelled) setPluginState({ status: 'failed', detail: toDetail(cause) });
      },
    );

    return () => {
      cancelled = true;
    };
    // `hexTouched` BİLEREK bağımlılık değil: kullanıcı yazınca motor yeniden
    // yüklenmemeli, yalnız bir sonraki protokol değişiminde tohum atlanmalı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sourcePluginId]);

  const parseState = useMemo<ParseState>(() => {
    if (pluginState.status !== 'ready') return { status: 'no-parser' };
    const parser = pluginState.plugin.parser;
    if (parser === undefined) return { status: 'no-parser' };

    let bytes: Uint8Array;
    try {
      bytes = hexToBytes(state.hexInput);
    } catch (cause) {
      return { status: 'invalid-hex', detail: toDetail(cause) };
    }
    if (bytes.length === 0) return { status: 'invalid-hex', detail: state.hexInput };

    const result = parser.parse(bytes);
    // Çözüm BAŞARISIZ olsa bile ekran çöker gibi davranmaz: hata metni
    // gösterilir, eşleme tablosu yerinde kalır (spec §47).
    return result.success ? { status: 'ok', frame: result.frame } : { status: 'failed', detail: result.error.message };
  }, [pluginState, state.hexInput]);

  const output = useMemo<ConversionOutput | null>(() => {
    if (parseState.status !== 'ok') return null;
    return convertFrame(parseState.frame, state.mappings, state.destination);
  }, [parseState, state.mappings, state.destination]);

  const setSourcePluginId = useCallback((pluginId: string) => {
    setState((current) => ({ ...current, sourcePluginId: pluginId }));
  }, []);

  const setHexInput = useCallback((hex: string) => {
    setHexTouched(true);
    setState((current) => ({ ...current, hexInput: hex }));
  }, []);

  const setDestination = useCallback((destination: DestinationKind) => {
    setState((current) => ({ ...current, destination }));
  }, []);

  const addMapping = useCallback(() => {
    setState((current) => {
      // Kimlik SAYAÇTAN değil, var olan en büyükten türer: satır silinip
      // yenisi eklendiğinde kimlik çakışması olmasın.
      const nextNumber =
        current.mappings.reduce((maximum, mapping) => {
          const parsed = Number.parseInt(mapping.id.replace('mapping-', ''), 10);
          return Number.isNaN(parsed) ? maximum : Math.max(maximum, parsed);
        }, 0) + 1;

      return {
        ...current,
        mappings: [
          ...current.mappings,
          {
            id: `mapping-${String(nextNumber)}`,
            sourceFieldId: '',
            transform: 'none' as TransformKind,
            factor: 1,
            addend: 0,
            destinationName: '',
          },
        ],
      };
    });
  }, []);

  const removeMapping = useCallback((mappingId: string) => {
    setState((current) => ({
      ...current,
      mappings: current.mappings.filter((mapping) => mapping.id !== mappingId),
    }));
  }, []);

  const updateMapping = useCallback((mappingId: string, patch: Partial<Omit<FieldMapping, 'id'>>) => {
    setState((current) => ({
      ...current,
      mappings: current.mappings.map((mapping) => (mapping.id === mappingId ? { ...mapping, ...patch } : mapping)),
    }));
  }, []);

  return {
    state,
    pluginState,
    parseState,
    output,
    setSourcePluginId,
    setHexInput,
    setDestination,
    addMapping,
    removeMapping,
    updateMapping,
  };
}
