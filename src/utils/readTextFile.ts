/**
 * Kullanıcının seçtiği dosyayı metin olarak okur — şema ve proje içe
 * aktarımının tek giriş kapısı. Dosya yerelde okunur, yüklenmez (spec §41).
 */

/**
 * `FileReader` yerine `file.text()`: olay tabanlı API'yi Promise'e sarmak
 * `onerror`/`onabort` dallarını elle yönetmeyi gerektiriyor ve iptal edilen
 * okumada sessizce asılı kalan promise üretmesi kolay. `Blob.text()` aynı işi
 * tek satırda ve reddi standart yapar.
 *
 * İçerik UTF-8 varsayılır — `Blob.text()` her zaman UTF-8 çözer, dolayısıyla
 * başka kodlamada kaydedilmiş bir dosya bozuk karakterle döner, hata vermez.
 */
export async function readTextFile(file: File): Promise<string> {
  return await file.text();
}
