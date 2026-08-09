/**
 * `inert` HTML attribute'u React 18'in tiplerinde yok, React 19'da eklendi.
 * Tarayıcı desteği tam; eksik olan yalnız tip tanımı. `any` ya da cast yerine
 * modül genişletmesi: attribute doğru yerde ve doğru değer kümesiyle tanımlı kalır.
 *
 * React 19'a çıkıldığında bu dosya silinmeli — o sürümde tip çakışması üretir.
 */
import 'react';

declare module 'react' {
  interface HTMLAttributes<T> {
    inert?: '' | undefined;
  }
}
