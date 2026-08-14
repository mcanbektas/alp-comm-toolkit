/**
 * Kod üreticilerinin ortak sözleşmesi — spec §9.5 "Code Generation"
 * (JSON Schema · C struct · C parser · Python parser · TypeScript parser ·
 * Markdown doküman).
 *
 * Üretilen şey METİNdir. Uygulama bu çıktıyı ÇALIŞTIRMAZ; kullanıcı kopyalar
 * ya da indirir (spec §41 `eval` ve dinamik kod çalıştırma yasağı). Bu yüzden
 * artefakt tipi bir modül/işlev değil, yalnız `code` alanı taşıyan saf veridir.
 *
 * Çıktı DETERMİNİSTİK olmak zorundadır: aynı şema her zaman bayt bayt aynı
 * metni üretir. Üretim tarihi, rastgele kimlik, `Map` gezinme sırasına bağlı
 * çıktı yasak — yoksa hem testler kırılır hem kullanıcının sürüm kontrolü her
 * üretimde gürültü görür.
 */

export type GeneratedArtifactId =
  | 'json-schema'
  | 'c-struct'
  | 'c-parser'
  | 'python-parser'
  | 'typescript-parser'
  | 'markdown-doc';

export interface GeneratedArtifact {
  readonly id: GeneratedArtifactId;
  /** Söz dizimi vurgulayıcıya verilecek dil etiketi (`c`, `python`, `typescript`, `json`, `markdown`). */
  readonly language: string;
  /** İndirme adı; uzantısıyla birlikte, dizin yolu içermez. */
  readonly fileName: string;
  readonly code: string;
}

export interface CodegenOptions {
  /** Bir kademe girinti. Verilmezse {@link DEFAULT_INDENT}. */
  readonly indent?: string;
  /**
   * Üretilen dosyanın başına "elle düzenlemeyin" başlığı konsun mu (varsayılan
   * `true`). JSON çıktısında yorum söz dizimi olmadığından `false` verilmeli.
   */
  readonly banner?: boolean;
  /**
   * Dokümana basılacak örnek çerçeve (yalnız Markdown üreticisi kullanır).
   *
   * Üreticiler ŞEMADAN örnek çerçeve türetmez: bunun için kodlayıcıyı çağırmak
   * gerekirdi ve üretici katmanı saf/bağımsız kalmalı (çağıran ne göstereceğine
   * kendisi karar verir). Verilmezse "Example frame" bölümü hiç yazılmaz.
   */
  readonly exampleFrame?: Uint8Array;
}

/** Altı üretici de aynı girintiyi kullansın diye tek yerde. */
export const DEFAULT_INDENT = '  ';
