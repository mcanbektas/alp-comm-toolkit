/**
 * Metin içeriğini tarayıcıda dosya olarak indirtir.
 *
 * Dosya TAMAMEN istemcide üretilir; hiçbir bayt sunucuya gitmez (spec §41 —
 * log, protokol tanımı ve proje dosyası kullanıcı verisidir). Dışa aktarma
 * yapan her ekran aynı beş satırı kopyalamak yerine buraya bağlanır.
 */

/** İçerik metin olduğu için varsayılan MIME düz metin; JSON/CSV çağıran verir. */
const DEFAULT_MIME_TYPE = 'text/plain';

export function downloadTextFile(
  fileName: string,
  text: string,
  mimeType: string = DEFAULT_MIME_TYPE,
): void {
  // SESSİZCE ÇIKMIYORUZ: Blob URL'i olmayan bir ortamda (test koşucusu, eski
  // WebView) "indirdim" numarası yapmak, kullanıcının verisinin kaybolduğunu
  // gizler. Çağıran hatayı görüp kullanıcıya bildirebilmeli.
  if (typeof URL.createObjectURL !== 'function' || typeof URL.revokeObjectURL !== 'function') {
    throw new Error('downloadTextFile requires Blob URL support (URL.createObjectURL).');
  }

  // `charset=utf-8` şart: Türkçe karakterler ve protokol adlarındaki simgeler
  // aksi hâlde bazı editörlerde latin-1 varsayılıp bozuk açılıyor.
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
  } finally {
    // `finally`: tıklama atarsa bile Blob serbest bırakılmalı, yoksa içerik
    // sekme kapanana dek bellekte kalır. İndirme tıklamayla EŞZAMANLI başladığı
    // için hemen iptal etmek güvenli.
    URL.revokeObjectURL(url);
  }
}
