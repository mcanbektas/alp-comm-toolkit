/**
 * Bir bayt dizisini altı dilin dizi/array literal söz dizimine çeviren üreteçler.
 * Hepsi aynı imza `(bytes, varName) => string` — bir üst katman (kod üretici
 * paneli) tek bir fonksiyon listesi üzerinden hepsini aynı şekilde çağırabilsin.
 */

const HEX_DIGITS_PER_BYTE = 2;
const HEX_RADIX = 16;

/** Ortak hex-literal biçimi: "0x1A" gibi, tüm diller aynı gösterimi paylaşıyor. */
function toHexLiteral(byte: number): string {
  return `0x${byte.toString(HEX_RADIX).padStart(HEX_DIGITS_PER_BYTE, '0')}`;
}

export function generateCArray(bytes: Uint8Array, varName: string): string {
  const items = Array.from(bytes, toHexLiteral).join(', ');
  return `uint8_t ${varName}[] = {${items}};`;
}

export function generateCppArray(bytes: Uint8Array, varName: string): string {
  const items = Array.from(bytes, toHexLiteral).join(', ');
  return `std::array<uint8_t, ${bytes.length}> ${varName} = {${items}};`;
}

export function generatePythonArray(bytes: Uint8Array, varName: string): string {
  const items = Array.from(bytes, toHexLiteral).join(', ');
  return `${varName} = bytes([${items}])`;
}

export function generateRustArray(bytes: Uint8Array, varName: string): string {
  const items = Array.from(bytes, toHexLiteral).join(', ');
  return `let ${varName}: [u8; ${bytes.length}] = [${items}];`;
}

export function generateJavaArray(bytes: Uint8Array, varName: string): string {
  // Java'da `byte` işaretlidir (-128..127 aralığı); 0x80 ve üstü hex değerler
  // cast olmadan derleme hatası verir, bu yüzden her öge `(byte)` ile kapatılır.
  const items = Array.from(bytes, (byte) => `(byte)${toHexLiteral(byte)}`).join(', ');
  return `byte[] ${varName} = {${items}};`;
}

export function generateJavaScriptArray(bytes: Uint8Array, varName: string): string {
  const items = Array.from(bytes, toHexLiteral).join(', ');
  return `const ${varName} = new Uint8Array([${items}]);`;
}
