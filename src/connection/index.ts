/**
 * Bağlantı katmanı toplu dışa aktarımı — spec §6'nın `connection/` klasörü.
 * `usb`, `bluetooth`, `websocket`, `file` alt klasörleri sonraki fazlarda
 * aynı `ByteSource` sözleşmesini gerçekleyecek; bu barrel o zaman büyür.
 */
export * from './types';
export * from './serial';
export * from './mock';
