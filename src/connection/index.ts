/**
 * Bağlantı katmanı toplu dışa aktarımı — spec §6'nın `connection/` klasörü.
 * `file` (dosya oynatma) yazıldı; `usb`, `bluetooth`, `websocket` alt
 * klasörleri sonraki fazlarda aynı `ByteSource` sözleşmesini gerçekleyecek ve
 * bu barrel o zaman yine büyür.
 */
export * from './types';
export * from './serial';
export * from './mock';
export * from './file';
