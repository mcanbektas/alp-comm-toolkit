/**
 * Şemadan kod üretimi — spec §9.5. Üretilen şey METİNdir, uygulama onu
 * çalıştırmaz.
 *
 * Bu barrel bilerek `protocol-core/index.ts`e BAĞLANMAZ: üreticiler yalnız
 * Custom Protocol Studio ekranında gerekiyor, tümünü çekirdek dışa aktarımına
 * koymak 172 protokolün ortak yolundaki paketi büyütürdü.
 */
export * from './cParser';
export * from './cStruct';
export * from './codegenSupport';
export * from './jsonSchemaOutput';
export * from './markdownDoc';
export * from './pythonParser';
export * from './typeScriptParser';
export * from './types';
