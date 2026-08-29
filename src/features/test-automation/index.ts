/**
 * Test Automation Studio (spec §38) — senaryo motoru.
 *
 * TA-a katmanı: saf model, koşul değerlendirici, adım makinesi ve bir
 * `ByteSource` köprüsü. Ekran ve rota TA-b'de gelir; bu barrel React'e hiç
 * dokunmaz, bu yüzden birim testinden de Worker'dan da aynı şekilde çağrılır.
 */

export * from './scenario';
export * from './conditions';
export * from './report';
export * from './runner';
export * from './byteSourceIo';
