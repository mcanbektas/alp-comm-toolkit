import type { ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { findCalculator } from '@/features/calculators';
import { ChecksumFinderTool } from '@/features/calculators/tools/ChecksumFinderTool';
import { CodeArrayGeneratorTool } from '@/features/calculators/tools/codeGeneratorTools';
import { CrcCalculatorTool } from '@/features/calculators/tools/CrcCalculatorTool';
import {
  BcdConverterTool,
  BitMaskTool,
  BitReverseTool,
  ByteSwapTool,
  EndiannessTool,
  Ieee754Tool,
  NibbleSwapTool,
  RadixConverterTool,
  SignedUnsignedTool,
  UnixTimestampTool,
} from '@/features/calculators/tools/numericTools';
import { CurrentLoopTool } from '@/features/calculators/tools/currentLoopTools';
import { VehiclePhyTool } from '@/features/calculators/tools/vehiclePhyTools';
import { LogicLevelCompatibilityTool } from '@/features/calculators/tools/logicLevelTools';
import { LoraAirtimeTool, LoraBatteryTool, LoraLinkBudgetTool } from '@/features/calculators/tools/loraTools';
import { BytesEncodingTool, HexAsciiTool, HexBinaryTool, UrlEncodingTool, Utf8ByteViewerTool } from '@/features/calculators/tools/textBytesTools';
import {
  I2cTimingTool,
  PmbusDirectTool,
  PmbusLinearTool,
  Rs485TimingTool,
  SpiTimingTool,
  UartTimingTool,
} from '@/features/calculators/tools/timingTools';
import { NotFoundPage } from './NotFoundPage';

/**
 * Araç kimliğinden bileşene eşleme. Birden çok kayıt aynı bileşeni farklı
 * parametrelerle çağırır (örn. altı kod üreteci, üç endianness, üç IEEE-754
 * genişliği) — `CALCULATOR_TOOLS`teki `id` yalnız gezinme/derin bağlantı
 * kimliğidir, bileşen seçimi burada yapılır.
 */
export const TOOL_RENDERERS: Record<string, () => ReactElement> = {
  'hex-to-ascii': () => <HexAsciiTool direction="hexToText" />,
  'ascii-to-hex': () => <HexAsciiTool direction="textToHex" />,
  'hex-to-binary': () => <HexBinaryTool direction="hexToBinary" />,
  'binary-to-hex': () => <HexBinaryTool direction="binaryToHex" />,
  'decimal-converter': () => <RadixConverterTool />,
  'utf8-byte-viewer': () => <Utf8ByteViewerTool />,
  base64: () => <BytesEncodingTool encoding="base64" />,
  base32: () => <BytesEncodingTool encoding="base32" />,
  'url-encoding': () => <UrlEncodingTool />,
  'signed-unsigned': () => <SignedUnsignedTool />,
  'little-endian': () => <EndiannessTool order="little" />,
  'big-endian': () => <EndiannessTool order="big" />,
  'mixed-endian': () => <EndiannessTool order="mixed" />,
  'ieee754-float16': () => <Ieee754Tool bits={16} />,
  'ieee754-float32': () => <Ieee754Tool bits={32} />,
  'ieee754-float64': () => <Ieee754Tool bits={64} />,
  'bcd-converter': () => <BcdConverterTool />,
  'unix-timestamp': () => <UnixTimestampTool />,
  'bit-mask': () => <BitMaskTool />,
  'byte-swap': () => <ByteSwapTool />,
  'bit-reverse': () => <BitReverseTool />,
  'nibble-swap': () => <NibbleSwapTool />,
  'c-array-generator': () => <CodeArrayGeneratorTool language="c" />,
  'cpp-array-generator': () => <CodeArrayGeneratorTool language="cpp" />,
  'python-bytes-generator': () => <CodeArrayGeneratorTool language="python" />,
  'rust-array-generator': () => <CodeArrayGeneratorTool language="rust" />,
  'java-byte-array-generator': () => <CodeArrayGeneratorTool language="java" />,
  'javascript-uint8array-generator': () => <CodeArrayGeneratorTool language="javascript" />,
  'uart-timing': () => <UartTimingTool />,
  'rs485-timing': () => <Rs485TimingTool />,
  'spi-timing': () => <SpiTimingTool />,
  'i2c-timing': () => <I2cTimingTool />,
  'pmbus-linear': () => <PmbusLinearTool />,
  'pmbus-direct': () => <PmbusDirectTool />,
  'lora-airtime': () => <LoraAirtimeTool />,
  'lora-link-budget': () => <LoraLinkBudgetTool />,
  'lora-battery': () => <LoraBatteryTool />,
  'logic-level-compat': () => <LogicLevelCompatibilityTool />,
  'current-loop': () => <CurrentLoopTool />,
  'can-phy-timing': () => <VehiclePhyTool variant="can" />,
  'lin-phy-timing': () => <VehiclePhyTool variant="lin" />,
  'flexray-phy-timing': () => <VehiclePhyTool variant="flexray" />,
  'crc-calculator': () => <CrcCalculatorTool />,
  'checksum-finder': () => <ChecksumFinderTool />,
};

export function CalculatorPage(): ReactElement {
  const { t } = useTranslation();
  const { toolId } = useParams();
  const tool = toolId === undefined ? undefined : findCalculator(toolId);

  if (tool === undefined) return <NotFoundPage />;

  const renderTool = TOOL_RENDERERS[tool.id];
  if (renderTool === undefined) return <NotFoundPage />;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <nav className="text-sm">
        <Link to="/calculators" className="rounded-token-sm px-1 text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-accent">
          {t('calculators.heading')}
        </Link>
      </nav>

      <header className="flex flex-col gap-2">
        <h1 className="font-display text-xl font-semibold text-text sm:text-2xl">{t(tool.nameKey)}</h1>
        <p className="max-w-2xl text-sm text-muted">{t(tool.summaryKey)}</p>
      </header>

      <section className="rounded-token border border-line bg-surface p-4">{renderTool()}</section>

      <Link
        to="/calculators"
        className="self-start rounded-token-sm px-1 text-sm text-muted hover:text-text focus-visible:ring-2 focus-visible:ring-accent"
      >
        {t('calculators.backToList')}
      </Link>
    </div>
  );
}
