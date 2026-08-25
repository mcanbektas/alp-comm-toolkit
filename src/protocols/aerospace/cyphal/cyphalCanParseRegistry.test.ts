import { describe, expect, it } from 'vitest';

import { createProtocolRegistry } from '@/protocol-core/registry';
import { registerBuiltInProtocols } from '../../index';
import { cyphalParser, cyphalPlugin } from './cyphal';
import { droneCanParser, droneCanPlugin } from '../dronecan/dronecan';
import { uavcanCompatibilityPlugin } from '../uavcanCompatibility/uavcanCompatibility';
import type { ExampleFrame, ProtocolParser, ProtocolPlugin } from '@/protocol-core/types';

/**
 * Faz 10 dalga 15b — `dronecanCanParseRegistry.test.ts` (15a) deseninin
 * BEŞİNCİ uygulaması, ama bu kez **kritik komşu aynı aileden**: `cyphal` aynı
 * 16 baytlık SocketCAN konteynerini `dronecan` DAHİL sekiz komşuyla paylaşıyor
 * ve ikisi UAVCAN soyundan geliyor — deponun ÖLÇÜLMÜŞ en yüksek çakışma riski.
 *
 * ═══ ÖLÇÜM (2026-08-25, aşağıdaki testler bu sayıları BEKÇİLER) ════════════
 *
 * ── 1) Registry taraması (ileri yön) ────────────────────────────────────────
 * `cyphal.canParse` registry'nin TÜM örnek çerçevelerine karşı koştu. Yabancı
 * kabul sayısı **1**: `dronecan/multi-frame-last`. Bu, aşağıdaki (3)'te
 * açıklanan YAPISAL örtüşmenin tek somut örneğidir ve BİLEREK bırakıldı —
 * kapatmanın tek yolu imzayı UYDURMAK olurdu.
 * (`uavcan-compatibility` taramanın DIŞINDA: örnekleri bilerek bu iki hattın
 * KENDİ çerçeveleridir, orada "çarpışma" ölçmek anlamsızdır.)
 *
 * ── 2) Rastgele girdi (imzanın gerçek gücü) ─────────────────────────────────
 * Aynı deterministik üreteçle, 20000 çerçeve:
 *
 *   | | kabul | oran |
 *   |---|---|---|
 *   | `cyphal`, yapısal olarak geçerli rastgele CAN çerçevesi | 2377 | **%11.9** |
 *   | `dronecan` (15a), AYNI üreteç | 7763 | %38.8 |
 *   | `cyphal`, tamamen rastgele arabellek (1..72 bayt) | 2 | %0.01 |
 *
 * Yani Cyphal'ın imzası DroneCAN'inkinden **3.3 kat DAR**. (Parent'ın 15a için
 * aktardığı %4.3 BAŞKA bir üreteçle ölçülmüştü; iki sayı doğrudan
 * karşılaştırılamaz — anlamlı olan bu tablodaki yan yana ölçümdür.) %11.9
 * protokolün İZİN VERDİĞİ sınırdır: CAN üstü bir kayıtta kilitlenecek senkron
 * sözcüğü yoktur ve spec'in verdiği HER yapısal kısıt (bit 23, mesajda bit 7,
 * toggle disiplini, MTU doluluğu, anonim tek-çerçeve kuralı, servis
 * kendine-adresleme yasağı) zaten kullanılıyor.
 *
 * ── 3) BULGU — `cyphal` ↔ `dronecan` örtüşmesi TAM OLARAK bir rolde ─────────
 * Aynı 20000 çerçevede İKİSİNİN BİRDEN kabul ettiği 1323 çerçevenin
 * **1323'ü de (%100) `multi-frame-last` rolündedir**; `single-frame` ve
 * `multi-frame-first` rollerinde örtüşme **SIFIRDIR**.
 *
 * Sebep matematikseldir: transferin İLK çerçevesinde (SOT=1) Cyphal
 * `Toggle=1`, DroneCAN `Toggle=0` ister — biri geçerse diğeri geçemez. Devam
 * çerçevesinde ise toggle sürüm bilgisi TAŞIMAZ; referans uygulamanın kendi
 * yorumu bunu birebir söylüyor — `OpenCyphal/libcanard`, `libcanard/canard.c`
 * **satır 1118** (kaynakta tek satır):
 * https://github.com/OpenCyphal/libcanard/blob/master/libcanard/canard.c#L1117-L1120
 *   *"If this is not the first frame of a transfer, the version is not detectable, so we attempt to parse both."*
 * Tam alıntı ve bağımsız çapraz kaynaklar `uavcanCompatibility.ts` dosya
 * başındadır (`pycyphal` `_wire.py:197,236` + `dronecan/libcanard` `:494,:667`).
 *
 * **Bu bir kusur değil, protokolün sınırıdır** ve depo bunu sessizce yamamak
 * yerine BİR KAYITLA çözüyor: `uavcan-compatibility` tam olarak bu belirsizliği
 * kullanıcıya raporlamak için var (`decision === 'ambiguous'`). Aşağıdaki
 * testler örtüşmeyi ÖLÇER ve **rol dağılımını bekçiler** — `single`/`first`
 * rollerinde bir örtüşme belirirse toggle kuralı bozulmuş demektir.
 */

/**
 * `canFrame.ts`in SocketCAN konteynerini paylaşan komşulardan GERÇEK yapısal
 * ayrım yapan dördü (15a'nın ölçtüğü liste — 11-bit'e kilitli ya da farklı
 * çerçeve biçimi). Kalanı (`can-2-0b`/`can-fd`/`iso-tp`/`j1939`/`ccp`/
 * `xcp-on-can`/`nmea-2000`) `canParse` düzeyinde ID bazlı eleme YAPMIYOR —
 * kendi tasarım kararları, 15a'da belgelendi, bu dalganın kapsamı dışında.
 */
const STRICT_STRUCTURAL_DISCRIMINATOR_IDS = ['canopen', 'devicenet', 'can-2-0a', 'can-xl'];

/**
 * BİLEREK kabul edilen tek yabancı çerçeve — dosya başı bulgu 3. Liste
 * uzarsa test kırılır: yeni bir örtüşme sessizce girmesin.
 */
const DOCUMENTED_CROSS_LINE_COLLISIONS = ['dronecan/multi-frame-last'];

function ownCandidates(plugin: ProtocolPlugin, parser: ProtocolParser): readonly ExampleFrame[] {
  return plugin.exampleFrames.filter((example) => parser.canParse(example.bytes));
}

function frameRoleOf(bytes: Uint8Array): 'single' | 'first' | 'middle' | 'last' {
  const declaredLength = bytes[4] ?? 0;
  const tail = bytes[8 + declaredLength - 1] ?? 0;
  const startOfTransfer = ((tail >>> 7) & 0x1) === 1;
  const endOfTransfer = ((tail >>> 6) & 0x1) === 1;
  if (startOfTransfer && endOfTransfer) return 'single';
  if (startOfTransfer) return 'first';
  if (endOfTransfer) return 'last';
  return 'middle';
}

/** Deterministik xorshift32 — ölçüm tekrar edilebilir olmalı. */
function makeRandomByteSource(seedInit: number): () => number {
  let seed = seedInit >>> 0;
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) & 0xff;
  };
}

/** Yapısal olarak GEÇERLİ rastgele CAN çerçevesi: 29-bit + EFF bayrağı, DLC 1..8. */
function buildRandomValidCanFrames(count: number, seed: number): Uint8Array[] {
  const nextByte = makeRandomByteSource(seed);
  const frames: Uint8Array[] = [];
  for (let index = 0; index < count; index += 1) {
    const frame = new Uint8Array(16);
    const id = ((nextByte() << 24) | (nextByte() << 16) | (nextByte() << 8) | nextByte()) >>> 0;
    const raw = ((id & 0x1fffffff) | 0x80000000) >>> 0;
    frame[0] = raw & 0xff;
    frame[1] = (raw >>> 8) & 0xff;
    frame[2] = (raw >>> 16) & 0xff;
    frame[3] = (raw >>> 24) & 0xff;
    const declaredLength = (nextByte() % 8) + 1;
    frame[4] = declaredLength;
    for (let byteIndex = 0; byteIndex < declaredLength; byteIndex += 1) {
      frame[8 + byteIndex] = nextByte();
    }
    frames.push(frame);
  }
  return frames;
}

describe('Cyphal canParse — registry çapında yanlış pozitif taraması', () => {
  it(
    'cyphal DIŞINDA yalnız BELGELENMİŞ tek çarpışma kalır, yenisi eklenemez',
    async () => {
      const registry = createProtocolRegistry();
      registerBuiltInProtocols(registry);

      const ids = registry.registeredProtocolIds();
      const collisions: string[] = [];
      let totalExamples = 0;

      for (const id of ids) {
        // `uavcan-compatibility` bir sınıflandırıcıdır: örnekleri BİLEREK bu
        // iki hattın kendi çerçeveleridir, orada çarpışma ölçmek anlamsız.
        if (id === cyphalPlugin.id || id === uavcanCompatibilityPlugin.id) continue;
        const plugin = await registry.loadProtocolPlugin(id);
        for (const example of plugin.exampleFrames) {
          totalExamples += 1;
          if (cyphalParser.canParse(example.bytes)) collisions.push(`${id}/${example.id}`);
        }
      }

      // Taramanın gerçekten TAM registry üzerinde koştuğunun kanıtı
      // (14f 761 örnek ölçmüştü; kayıt sayısı arttı, azalamaz).
      expect(
        totalExamples,
        'registry örnek sayısı beklenenden düşük — tarama gerçekten koştu mu?',
      ).toBeGreaterThan(700);
      expect(collisions.sort(), `çarpışmalar (${collisions.length}): ${collisions.join(', ')}`).toEqual(
        [...DOCUMENTED_CROSS_LINE_COLLISIONS].sort(),
      );
    },
    20000,
  );

  it('belgelenen tek çarpışma GERÇEKTEN devam çerçevesidir (rol bekçisi)', () => {
    const example = droneCanPlugin.exampleFrames.find((item) => item.id === 'multi-frame-last');
    if (example === undefined) throw new Error('dronecan/multi-frame-last örneği yok');
    // Örtüşme yalnız SOT=0 rolünde meşrudur; SOT=1'e kayarsa toggle kuralı bozulmuştur.
    expect(frameRoleOf(example.bytes)).toBe('last');
  });

  it(
    'GERÇEK yapısal ayrım yapan komşular Cyphal adaylarının HİÇBİRİNİ kabul etmez',
    async () => {
      const registry = createProtocolRegistry();
      registerBuiltInProtocols(registry);

      const candidates = ownCandidates(cyphalPlugin, cyphalParser);
      expect(candidates.length, 'cyphal kendi hiçbir örneğini aday saymıyor — canParse bozuk mu?').toBe(
        5,
      );

      const collisions: string[] = [];
      for (const id of STRICT_STRUCTURAL_DISCRIMINATOR_IDS) {
        const plugin = await registry.loadProtocolPlugin(id);
        for (const example of candidates) {
          if (plugin.parser?.canParse(example.bytes) === true) {
            collisions.push(`cyphal/${example.id} → ${id} canParse=true`);
          }
        }
      }

      expect(collisions, `beklenmeyen kabul (${collisions.length}): ${collisions.join(', ')}`).toEqual(
        [],
      );
    },
    20000,
  );
});

describe('Cyphal ↔ DroneCAN — İKİ YÖNLÜ ayrım (dalganın en yüksek riski)', () => {
  it('İLERİ YÖN: dronecan’ın SOT adaylarının HİÇBİRİNİ cyphal kabul etmez', () => {
    const droneCanSotCandidates = ownCandidates(droneCanPlugin, droneCanParser).filter(
      (example) => frameRoleOf(example.bytes) !== 'last',
    );
    expect(
      droneCanSotCandidates.length,
      'dronecan SOT adayı bulunamadı — örnek kümesi değişmiş olabilir',
    ).toBeGreaterThanOrEqual(5);

    for (const example of droneCanSotCandidates) {
      expect(cyphalParser.canParse(example.bytes), `dronecan/${example.id} → cyphal`).toBe(false);
    }
  });

  it('TERS YÖN: cyphal’in SOT adaylarının HİÇBİRİNİ dronecan kabul etmez', () => {
    const cyphalSotCandidates = ownCandidates(cyphalPlugin, cyphalParser).filter(
      (example) => frameRoleOf(example.bytes) !== 'last',
    );
    expect(
      cyphalSotCandidates.length,
      'cyphal SOT adayı bulunamadı — örnek kümesi değişmiş olabilir',
    ).toBeGreaterThanOrEqual(4);

    for (const example of cyphalSotCandidates) {
      expect(droneCanParser.canParse(example.bytes), `cyphal/${example.id} → dronecan`).toBe(false);
    }
  });

  it('BULGU: devam çerçevesinde örtüşme VARDIR — gizlenmez, ölçülür', () => {
    const lastFrame = cyphalPlugin.exampleFrames.find(
      (example) => example.id === 'service-response-last',
    );
    if (lastFrame === undefined) throw new Error('örnek çerçeve yok');
    expect(frameRoleOf(lastFrame.bytes)).toBe('last');

    // İkisi de kabul ediyor: toggle biti bu rolde sürüm bilgisi TAŞIMAZ
    // (libcanard: "the version is not detectable … attempt to parse both").
    expect(cyphalParser.canParse(lastFrame.bytes)).toBe(true);
    expect(droneCanParser.canParse(lastFrame.bytes)).toBe(true);
  });

  it('ÖLÇÜM: 20000 rastgele geçerli CAN çerçevesinde örtüşmenin TAMAMI `last` rolünde', () => {
    const frames = buildRandomValidCanFrames(20000, 0x1379_2ab5);
    let cyphalAccepted = 0;
    let droneCanAccepted = 0;
    const overlapByRole: Record<string, number> = { single: 0, first: 0, middle: 0, last: 0 };

    for (const frame of frames) {
      const cyphalOk = cyphalParser.canParse(frame);
      const droneCanOk = droneCanParser.canParse(frame);
      if (cyphalOk) cyphalAccepted += 1;
      if (droneCanOk) droneCanAccepted += 1;
      if (cyphalOk && droneCanOk) {
        const role = frameRoleOf(frame);
        overlapByRole[role] = (overlapByRole[role] ?? 0) + 1;
      }
    }

    // Dosya başı ölçüm tablosu. Sayılar deterministik üreteçten gelir; sınırlar
    // ölçülen değerin biraz üstünde/altında tutuldu ki imza gevşerse kırılsın.
    expect(cyphalAccepted, `cyphal kabul ${cyphalAccepted}/20000`).toBeGreaterThan(0);
    expect(cyphalAccepted / frames.length).toBeLessThan(0.13);
    // Cyphal'ın imzası DroneCAN'inkinden BELİRGİN olarak dar — bu bir bekçidir.
    expect(cyphalAccepted).toBeLessThan(droneCanAccepted / 2);

    // ASIL BEKÇİ: SOT çerçevelerinde örtüşme MATEMATİKSEL olarak imkânsızdır.
    expect(overlapByRole.single, 'single-frame rolünde örtüşme çıktı — toggle kuralı bozuldu').toBe(0);
    expect(overlapByRole.first, 'multi-frame-first rolünde örtüşme çıktı — toggle kuralı bozuldu').toBe(
      0,
    );
    expect(overlapByRole.middle, 'middle rolü iki tarafta da reddedilmeliydi').toBe(0);
    expect(overlapByRole.last, 'last rolünde örtüşme beklenir (protokolün sınırı)').toBeGreaterThan(0);
  });

  it('ÖLÇÜM: tamamen rastgele arabelleklerde kabul neredeyse SIFIR', () => {
    const nextByte = makeRandomByteSource(0xabcd_ef01);
    let accepted = 0;
    const total = 20000;
    for (let index = 0; index < total; index += 1) {
      const length = 1 + (nextByte() % 72);
      const buffer = new Uint8Array(length);
      for (let byteIndex = 0; byteIndex < length; byteIndex += 1) buffer[byteIndex] = nextByte();
      if (cyphalParser.canParse(buffer)) accepted += 1;
    }
    // ÖLÇÜLDÜ: 2/20000. Neredeyse tamamı 16 bayt olmadığı için elenir.
    expect(accepted / total, `kabul ${accepted}/${total}`).toBeLessThan(0.001);
  });
});
