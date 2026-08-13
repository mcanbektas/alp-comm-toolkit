import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { NumberField, ResultField, SelectField, TextField } from '@/components/forms';
import {
  applyBitMask,
  bytesToHex,
  bytesToNumber,
  convertRadix,
  createBitMask,
  decodeBcd,
  decodeFloat16,
  decodeFloat32,
  decodeFloat64,
  encodeBcd,
  encodeFloat16,
  encodeFloat32,
  encodeFloat64,
  epochToBytes32,
  epochToIso,
  extractField,
  hexToBytes,
  isoToEpoch,
  numberToBytes,
  reverseByteBits,
  swapByteOrder,
  swapNibbles,
  toSignedInt,
  toUnsignedRaw,
} from '@/protocol-core';
import type { ByteOrder, Endianness, RadixBase } from '@/protocol-core';
import type { TranslationKey } from '@/translations';

const RADIX_OPTIONS = (t: (key: TranslationKey) => string) => [
  { value: '2', label: t('calc.field.radixBinary') },
  { value: '8', label: t('calc.field.radixOctal') },
  { value: '10', label: t('calc.field.radixDecimal') },
  { value: '16', label: t('calc.field.radixHex') },
];

/** Spec §12 "Decimal converter": tek girdi, dört tabanda eşzamanlı gösterim. */
export function RadixConverterTool(): ReactElement {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [fromRadix, setFromRadix] = useState('10');

  const results = useMemo(() => {
    if (value.trim().length === 0) return undefined;
    try {
      const from = Number(fromRadix) as RadixBase;
      return {
        bin: convertRadix(value, from, 2),
        oct: convertRadix(value, from, 8),
        dec: convertRadix(value, from, 10),
        hex: convertRadix(value, from, 16),
      };
    } catch {
      return null;
    }
  }, [value, fromRadix]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField id="calc-value" label={t('calc.field.value')} value={value} onChange={setValue} monospace placeholder="255" />
        </div>
        <div className="sm:w-40">
          <SelectField id="calc-radix" label={t('calc.field.inputRadix')} value={fromRadix} onChange={setFromRadix} options={RADIX_OPTIONS(t)} />
        </div>
      </div>
      {results === null && <p className="text-xs text-danger">{t('calc.error.invalidInput')}</p>}
      <ResultField id="calc-bin" label={t('calc.field.radixBinary')} value={results?.bin ?? ''} />
      <ResultField id="calc-oct" label={t('calc.field.radixOctal')} value={results?.oct ?? ''} />
      <ResultField id="calc-dec" label={t('calc.field.radixDecimal')} value={results?.dec ?? ''} />
      <ResultField id="calc-hex" label={t('calc.field.radixHex')} value={results?.hex ?? ''} />
    </div>
  );
}

const BIT_WIDTH_OPTIONS = [8, 16, 24, 32];

export function SignedUnsignedTool(): ReactElement {
  const { t } = useTranslation();
  const [rawValue, setRawValue] = useState('');
  const [signedValue, setSignedValue] = useState('');
  const [bitWidth, setBitWidth] = useState('16');

  const signed = useMemo(() => {
    if (rawValue.trim().length === 0) return undefined;
    try {
      return String(toSignedInt(Number(rawValue), Number(bitWidth)));
    } catch {
      return null;
    }
  }, [rawValue, bitWidth]);

  const unsigned = useMemo(() => {
    if (signedValue.trim().length === 0) return undefined;
    try {
      return String(toUnsignedRaw(Number(signedValue), Number(bitWidth)));
    } catch {
      return null;
    }
  }, [signedValue, bitWidth]);

  const widthOptions = BIT_WIDTH_OPTIONS.map((width) => ({ value: String(width), label: `${width} bit` }));

  return (
    <div className="flex flex-col gap-5">
      <div className="sm:w-40">
        <SelectField id="calc-width" label={t('calc.field.bitWidth')} value={bitWidth} onChange={setBitWidth} options={widthOptions} />
      </div>
      <div className="flex flex-col gap-3">
        <NumberField id="calc-raw" label={t('calc.field.rawUnsigned')} value={rawValue} onChange={setRawValue} />
        <ResultField id="calc-signed-out" label={t('calc.field.signedResult')} value={signed ?? ''} error={signed === null ? t('calc.error.invalidInput') : undefined} />
      </div>
      <div className="flex flex-col gap-3">
        <NumberField id="calc-signed" label={t('calc.field.signedInput')} value={signedValue} onChange={setSignedValue} />
        <ResultField id="calc-unsigned-out" label={t('calc.field.rawResult')} value={unsigned ?? ''} error={unsigned === null ? t('calc.error.invalidInput') : undefined} />
      </div>
    </div>
  );
}

const BYTE_LENGTH_OPTIONS = [1, 2, 3, 4, 6].map((length) => ({ value: String(length), label: `${length}` }));

/** Little/big/mixed-endian — üç kayıt aynı bileşeni `order` sabitiyle çağırır. */
export function EndiannessTool({ order }: { order: ByteOrder }): ReactElement {
  const { t } = useTranslation();
  const [hexInput, setHexInput] = useState('');
  const [decimalInput, setDecimalInput] = useState('');
  const [byteLength, setByteLength] = useState('4');

  const decoded = useMemo(() => {
    if (hexInput.trim().length === 0) return undefined;
    try {
      return String(bytesToNumber(hexToBytes(hexInput.replace(/\s+/g, '')), order));
    } catch {
      return null;
    }
  }, [hexInput, order]);

  const encoded = useMemo(() => {
    if (decimalInput.trim().length === 0) return undefined;
    try {
      return bytesToHex(numberToBytes(Number(decimalInput), Number(byteLength), order));
    } catch {
      return null;
    }
  }, [decimalInput, byteLength, order]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <TextField id="calc-hex" label={t('calc.field.hexInput')} value={hexInput} onChange={setHexInput} monospace placeholder="12 34 56 78" />
        <ResultField id="calc-decoded" label={t('calc.field.decimalOutput')} value={decoded ?? ''} error={decoded === null ? t('calc.error.invalidInput') : undefined} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <NumberField id="calc-decimal" label={t('calc.field.value')} value={decimalInput} onChange={setDecimalInput} />
        </div>
        <div className="sm:w-32">
          <SelectField id="calc-length" label={t('calc.field.byteLength')} value={byteLength} onChange={setByteLength} options={BYTE_LENGTH_OPTIONS} />
        </div>
      </div>
      <ResultField id="calc-encoded" label={t('calc.field.hexOutput')} value={encoded ?? ''} error={encoded === null ? t('calc.error.invalidInput') : undefined} />
    </div>
  );
}

/** IEEE-754 float16/32/64 — üç kayıt aynı bileşeni `bits` sabitiyle çağırır. */
export function Ieee754Tool({ bits }: { bits: 16 | 32 | 64 }): ReactElement {
  const { t } = useTranslation();
  const [floatInput, setFloatInput] = useState('');
  const [hexInput, setHexInput] = useState('');
  const [endianness, setEndianness] = useState<string>('big');

  const encodeFn = bits === 16 ? encodeFloat16 : bits === 32 ? encodeFloat32 : encodeFloat64;
  const decodeFn = bits === 16 ? decodeFloat16 : bits === 32 ? decodeFloat32 : decodeFloat64;

  const encoded = useMemo(() => {
    if (floatInput.trim().length === 0) return undefined;
    try {
      return bytesToHex(encodeFn(Number(floatInput), endianness as Endianness));
    } catch {
      return null;
    }
  }, [floatInput, endianness, encodeFn]);

  const decoded = useMemo(() => {
    if (hexInput.trim().length === 0) return undefined;
    try {
      return String(decodeFn(hexToBytes(hexInput.replace(/\s+/g, '')), endianness as Endianness));
    } catch {
      return null;
    }
  }, [hexInput, endianness, decodeFn]);

  const endiannessOptions = [
    { value: 'big', label: t('calc.field.bigEndianOption') },
    { value: 'little', label: t('calc.field.littleEndianOption') },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="sm:w-48">
        <SelectField id="calc-endianness" label={t('calc.field.byteOrder')} value={endianness} onChange={setEndianness} options={endiannessOptions} />
      </div>
      <div className="flex flex-col gap-3">
        <NumberField id="calc-float" label={t('calc.field.floatValue')} value={floatInput} onChange={setFloatInput} step={0.0001} />
        <ResultField id="calc-encoded" label={t('calc.field.hexOutput')} value={encoded ?? ''} error={encoded === null ? t('calc.error.invalidInput') : undefined} />
      </div>
      <div className="flex flex-col gap-3">
        <TextField id="calc-hex" label={t('calc.field.hexInput')} value={hexInput} onChange={setHexInput} monospace />
        <ResultField id="calc-decoded" label={t('calc.field.floatOutput')} value={decoded ?? ''} error={decoded === null ? t('calc.error.invalidInput') : undefined} />
      </div>
    </div>
  );
}

export function BcdConverterTool(): ReactElement {
  const { t } = useTranslation();
  const [decimalInput, setDecimalInput] = useState('');
  const [hexInput, setHexInput] = useState('');

  const encoded = useMemo(() => {
    if (decimalInput.trim().length === 0) return undefined;
    try {
      return bytesToHex(encodeBcd(Number(decimalInput)));
    } catch {
      return null;
    }
  }, [decimalInput]);

  const decoded = useMemo(() => {
    if (hexInput.trim().length === 0) return undefined;
    try {
      return String(decodeBcd(hexToBytes(hexInput.replace(/\s+/g, ''))));
    } catch {
      return null;
    }
  }, [hexInput]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <NumberField id="calc-decimal" label={t('calc.field.value')} value={decimalInput} onChange={setDecimalInput} />
        <ResultField id="calc-encoded" label={t('calc.field.hexOutput')} value={encoded ?? ''} error={encoded === null ? t('calc.error.invalidInput') : undefined} />
      </div>
      <div className="flex flex-col gap-3">
        <TextField id="calc-hex" label={t('calc.field.hexInput')} value={hexInput} onChange={setHexInput} monospace placeholder="12 34" />
        <ResultField id="calc-decoded" label={t('calc.field.decimalOutput')} value={decoded ?? ''} error={decoded === null ? t('calc.error.invalidInput') : undefined} />
      </div>
    </div>
  );
}

export function UnixTimestampTool(): ReactElement {
  const { t } = useTranslation();
  const [epochInput, setEpochInput] = useState('');
  const [isoInput, setIsoInput] = useState('');
  const [endianness, setEndianness] = useState<string>('big');

  const iso = useMemo(() => {
    if (epochInput.trim().length === 0) return undefined;
    try {
      return epochToIso(Number(epochInput), 'seconds');
    } catch {
      return null;
    }
  }, [epochInput]);

  const epoch = useMemo(() => {
    if (isoInput.trim().length === 0) return undefined;
    try {
      return String(isoToEpoch(isoInput, 'seconds'));
    } catch {
      return null;
    }
  }, [isoInput]);

  const bytesHex = useMemo(() => {
    if (epochInput.trim().length === 0) return undefined;
    try {
      return bytesToHex(epochToBytes32(Number(epochInput), endianness as Endianness));
    } catch {
      return null;
    }
  }, [epochInput, endianness]);

  const endiannessOptions = [
    { value: 'big', label: t('calc.field.bigEndianOption') },
    { value: 'little', label: t('calc.field.littleEndianOption') },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <NumberField id="calc-epoch" label={t('calc.field.epochSeconds')} value={epochInput} onChange={setEpochInput} />
        <ResultField id="calc-iso" label={t('calc.field.isoOutput')} value={iso ?? ''} error={iso === null ? t('calc.error.invalidInput') : undefined} monospace={false} />
      </div>
      <div className="flex flex-col gap-3">
        <TextField id="calc-iso-input" label={t('calc.field.isoInput')} value={isoInput} onChange={setIsoInput} placeholder="2026-08-13T12:00:00.000Z" />
        <ResultField id="calc-epoch-out" label={t('calc.field.epochOutput')} value={epoch ?? ''} error={epoch === null ? t('calc.error.invalidInput') : undefined} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-48">
          <SelectField id="calc-endianness" label={t('calc.field.byteOrder')} value={endianness} onChange={setEndianness} options={endiannessOptions} />
        </div>
      </div>
      <ResultField id="calc-bytes" label={t('calc.field.bytes32Output')} value={bytesHex ?? ''} error={bytesHex === null ? t('calc.error.invalidInput') : undefined} />
    </div>
  );
}

export function BitMaskTool(): ReactElement {
  const { t } = useTranslation();
  const [bitWidth, setBitWidth] = useState('4');
  const [shift, setShift] = useState('0');
  const [rawValue, setRawValue] = useState('');

  const mask = useMemo(() => {
    try {
      return createBitMask(Number(bitWidth), Number(shift));
    } catch {
      return null;
    }
  }, [bitWidth, shift]);

  const applied = useMemo(() => {
    if (rawValue.trim().length === 0 || mask === null) return undefined;
    try {
      return {
        masked: applyBitMask(Number(rawValue), mask),
        field: extractField(Number(rawValue), mask, Number(shift)),
      };
    } catch {
      return null;
    }
  }, [rawValue, mask, shift]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <NumberField id="calc-bitwidth" label={t('calc.field.maskBitWidth')} value={bitWidth} onChange={setBitWidth} />
        </div>
        <div className="flex-1">
          <NumberField id="calc-shift" label={t('calc.field.maskShift')} value={shift} onChange={setShift} />
        </div>
      </div>
      <ResultField id="calc-mask" label={t('calc.field.maskOutput')} value={mask === null ? '' : `0x${mask.toString(16).toUpperCase()}`} error={mask === null ? t('calc.error.invalidInput') : undefined} />
      <NumberField id="calc-raw" label={t('calc.field.rawUnsigned')} value={rawValue} onChange={setRawValue} />
      <ResultField
        id="calc-masked"
        label={t('calc.field.maskedValue')}
        value={applied === null || applied === undefined ? '' : `0x${applied.masked.toString(16).toUpperCase()}`}
        error={applied === null ? t('calc.error.invalidInput') : undefined}
      />
      <ResultField
        id="calc-field"
        label={t('calc.field.extractedField')}
        value={applied === null || applied === undefined ? '' : String(applied.field)}
      />
    </div>
  );
}

function hexToBytesLoose(input: string): Uint8Array {
  return hexToBytes(input.replace(/\s+/g, ''));
}

export function ByteSwapTool(): ReactElement {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const output = useMemo(() => {
    if (input.trim().length === 0) return undefined;
    try {
      return bytesToHex(swapByteOrder(hexToBytesLoose(input)));
    } catch {
      return null;
    }
  }, [input]);

  return (
    <div className="flex flex-col gap-3">
      <TextField id="calc-input" label={t('calc.field.hexInput')} value={input} onChange={setInput} monospace placeholder="12 34 56 78" />
      <ResultField id="calc-output" label={t('calc.field.hexOutput')} value={output ?? ''} error={output === null ? t('calc.error.invalidInput') : undefined} />
    </div>
  );
}

export function BitReverseTool(): ReactElement {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const output = useMemo(() => {
    if (input.trim().length === 0) return undefined;
    try {
      const bytes = hexToBytesLoose(input);
      return bytesToHex(Uint8Array.from(bytes, reverseByteBits));
    } catch {
      return null;
    }
  }, [input]);

  return (
    <div className="flex flex-col gap-3">
      <TextField id="calc-input" label={t('calc.field.hexInput')} value={input} onChange={setInput} monospace placeholder="01 80 0F" />
      <ResultField id="calc-output" label={t('calc.field.hexOutput')} value={output ?? ''} error={output === null ? t('calc.error.invalidInput') : undefined} />
    </div>
  );
}

export function NibbleSwapTool(): ReactElement {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const output = useMemo(() => {
    if (input.trim().length === 0) return undefined;
    try {
      const bytes = hexToBytesLoose(input);
      return bytesToHex(Uint8Array.from(bytes, swapNibbles));
    } catch {
      return null;
    }
  }, [input]);

  return (
    <div className="flex flex-col gap-3">
      <TextField id="calc-input" label={t('calc.field.hexInput')} value={input} onChange={setInput} monospace placeholder="1A 2B 3C" />
      <ResultField id="calc-output" label={t('calc.field.hexOutput')} value={output ?? ''} error={output === null ? t('calc.error.invalidInput') : undefined} />
    </div>
  );
}
