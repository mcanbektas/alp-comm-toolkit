import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { ResultField, TextField } from '@/components/forms';
import {
  asciiToHex,
  base32Decode,
  base32Encode,
  base64Decode,
  base64Encode,
  binaryToHex,
  bytesToPercentEncoded,
  hexToAscii,
  hexToBinary,
  hexToBytes,
  urlDecode,
  urlEncode,
  viewUtf8Bytes,
} from '@/protocol-core';

/** Girdi boşken hesap denenmez — boş bir hata mesajı basmak yerine sessiz "sonuç yok" durumu. */
function useSafeCompute<T>(input: string, compute: (input: string) => T): { value?: T; error?: string } {
  const { t } = useTranslation();
  return useMemo(() => {
    if (input.trim().length === 0) return {};
    try {
      return { value: compute(input) };
    } catch {
      return { error: t('calc.error.invalidInput') };
    }
  }, [input, compute, t]);
}

export type HexTextDirection = 'hexToText' | 'textToHex';

/** HEX↔ASCII çift yönlü — `direction` sabit verilir, kayıt kimliği başına bir yön. */
export function HexAsciiTool({ direction }: { direction: HexTextDirection }): ReactElement {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const { value, error } = useSafeCompute(input, (raw) =>
    direction === 'hexToText' ? hexToAscii(raw.replace(/\s+/g, '')) : asciiToHex(raw),
  );

  return (
    <div className="flex flex-col gap-3">
      <TextField
        id="calc-input"
        label={direction === 'hexToText' ? t('calc.field.hexInput') : t('calc.field.textInput')}
        value={input}
        onChange={setInput}
        monospace={direction === 'hexToText'}
        multiline
        placeholder={direction === 'hexToText' ? '48 65 6C 6C 6F' : 'Hello'}
      />
      <ResultField id="calc-output" label={t('calc.field.output')} value={value ?? ''} error={error} />
    </div>
  );
}

/** HEX↔Binary çift yönlü — desen `HexAsciiTool` ile birebir aynı. */
export function HexBinaryTool({ direction }: { direction: 'hexToBinary' | 'binaryToHex' }): ReactElement {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const { value, error } = useSafeCompute(input, (raw) => {
    const cleaned = raw.replace(/\s+/g, '');
    return direction === 'hexToBinary' ? hexToBinary(cleaned) : binaryToHex(cleaned);
  });

  return (
    <div className="flex flex-col gap-3">
      <TextField
        id="calc-input"
        label={direction === 'hexToBinary' ? t('calc.field.hexInput') : t('calc.field.binaryInput')}
        value={input}
        onChange={setInput}
        monospace
        multiline
        placeholder={direction === 'hexToBinary' ? 'FF 0A' : '11111111 00001010'}
      />
      <ResultField id="calc-output" label={t('calc.field.output')} value={value ?? ''} error={error} />
    </div>
  );
}

/** UTF-8 bayt görüntüleyici — spec §12 madde 14: karakter başına bayt uzunluğu ve öncü/devam bayt bilgisini gösterir. */
export function Utf8ByteViewerTool(): ReactElement {
  const { t } = useTranslation();
  const [input, setInput] = useState('');

  const bytesInfo = useMemo(() => {
    if (input.length === 0) return [];
    return viewUtf8Bytes(input);
  }, [input]);

  return (
    <div className="flex flex-col gap-3">
      <TextField id="calc-input" label={t('calc.field.textInput')} value={input} onChange={setInput} placeholder="ALP Şé" />
      {bytesInfo.length > 0 && (
        <div className="overflow-x-auto rounded-token border border-line">
          <table className="w-full text-left text-xs tabular">
            <thead className="bg-raised text-muted">
              <tr>
                <th className="px-2 py-1.5 font-medium">{t('calc.field.byteIndex')}</th>
                <th className="px-2 py-1.5 font-medium">{t('calc.field.hex')}</th>
                <th className="px-2 py-1.5 font-medium">{t('calc.field.decimal')}</th>
                <th className="px-2 py-1.5 font-medium">{t('calc.field.character')}</th>
                <th className="px-2 py-1.5 font-medium">{t('calc.field.leadByte')}</th>
              </tr>
            </thead>
            <tbody>
              {bytesInfo.map((info) => (
                <tr key={info.byteIndex} className="border-t border-line">
                  <td className="px-2 py-1 font-mono">{info.byteIndex}</td>
                  <td className="px-2 py-1 font-mono">{info.hex}</td>
                  <td className="px-2 py-1 font-mono">{info.decimal}</td>
                  <td className="px-2 py-1 font-mono">{info.isLeadByte ? info.character : ''}</td>
                  <td className="px-2 py-1">{info.isLeadByte ? t('common.yes') : t('common.no')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export type BytesTextEncoding = 'base64' | 'base32';

/** Base64/Base32 — hex bayt girdisinden kodla, kodlanmış metinden çöz; tek ekranda iki alan. */
export function BytesEncodingTool({ encoding }: { encoding: BytesTextEncoding }): ReactElement {
  const { t } = useTranslation();
  const [hexInput, setHexInput] = useState('');
  const [encodedInput, setEncodedInput] = useState('');

  const encode = encoding === 'base64' ? base64Encode : base32Encode;
  const decode = encoding === 'base64' ? base64Decode : base32Decode;

  const { value: encoded, error: encodeError } = useSafeCompute(hexInput, (raw) => encode(hexToBytes(raw.replace(/\s+/g, ''))));
  const { value: decodedBytes, error: decodeError } = useSafeCompute(encodedInput, (raw) => decode(raw.trim()));
  const decodedHex = decodedBytes === undefined ? undefined : Array.from(decodedBytes).map((byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">{t('calc.field.encode')}</h2>
        <TextField id="calc-hex-input" label={t('calc.field.hexInput')} value={hexInput} onChange={setHexInput} monospace placeholder="41 4C 50" />
        <ResultField id="calc-encoded-output" label={t('calc.field.output')} value={encoded ?? ''} error={encodeError} />
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">{t('calc.field.decode')}</h2>
        <TextField id="calc-encoded-input" label={t('calc.field.encodedInput')} value={encodedInput} onChange={setEncodedInput} monospace />
        <ResultField id="calc-decoded-output" label={t('calc.field.hexOutput')} value={decodedHex ?? ''} error={decodeError} />
      </div>
    </div>
  );
}

/** URL (percent) kodlama — metin↔yüzde-kodlu string, ayrıca ham baytların yüzde-kodlu gösterimi. */
export function UrlEncodingTool(): ReactElement {
  const { t } = useTranslation();
  const [textInput, setTextInput] = useState('');
  const [encodedInput, setEncodedInput] = useState('');
  const [hexInput, setHexInput] = useState('');

  const { value: encoded, error: encodeError } = useSafeCompute(textInput, urlEncode);
  const { value: decoded, error: decodeError } = useSafeCompute(encodedInput, urlDecode);
  const { value: percentBytes, error: percentError } = useSafeCompute(hexInput, (raw) => bytesToPercentEncoded(hexToBytes(raw.replace(/\s+/g, ''))));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">{t('calc.field.encode')}</h2>
        <TextField id="calc-text-input" label={t('calc.field.textInput')} value={textInput} onChange={setTextInput} placeholder="a b+c" />
        <ResultField id="calc-encoded-output" label={t('calc.field.output')} value={encoded ?? ''} error={encodeError} />
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">{t('calc.field.decode')}</h2>
        <TextField id="calc-encoded-input" label={t('calc.field.encodedInput')} value={encodedInput} onChange={setEncodedInput} placeholder="a%20b%2Bc" />
        <ResultField id="calc-decoded-output" label={t('calc.field.output')} value={decoded ?? ''} error={decodeError} />
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">{t('calc.field.bytesToPercent')}</h2>
        <TextField id="calc-hex-input" label={t('calc.field.hexInput')} value={hexInput} onChange={setHexInput} monospace placeholder="41 20 62" />
        <ResultField id="calc-percent-output" label={t('calc.field.output')} value={percentBytes ?? ''} error={percentError} />
      </div>
    </div>
  );
}
