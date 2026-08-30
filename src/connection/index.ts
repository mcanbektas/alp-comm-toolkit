/**
 * Bağlantı katmanı toplu dışa aktarımı — spec §6'nın `connection/` klasörü.
 * Yedi kaynağın hepsi (§8.1) aynı `ByteSource` sözleşmesini gerçekliyor:
 * `web-serial`, `web-usb`, `web-bluetooth`, `websocket`, `file`, `simulated`.
 * "Local bridge" spec'te ayrı sayılır ama WebSocket köprüsüyle aynı sözleşmeyi
 * paylaşır, ayrı bir modül gerektirmedi.
 */
export * from './types';
export * from './serial';
export * from './usb';
export * from './bluetooth';
export * from './mock';
export * from './file';
export * from './websocket';
