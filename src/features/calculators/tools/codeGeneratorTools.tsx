import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { useTranslation } from '@/app/providers/LanguageProvider';
import { ResultField, TextField } from '@/components/forms';
import {
  generateCArray,
  generateCppArray,
  generateJavaArray,
  generateJavaScriptArray,
  generatePythonArray,
  generateRustArray,
  hexToBytes,
} from '@/protocol-core';

export type CodeGeneratorLanguage = 'c' | 'cpp' | 'python' | 'rust' | 'java' | 'javascript';

const GENERATORS: Record<CodeGeneratorLanguage, (bytes: Uint8Array, varName: string) => string> = {
  c: generateCArray,
  cpp: generateCppArray,
  python: generatePythonArray,
  rust: generateRustArray,
  java: generateJavaArray,
  javascript: generateJavaScriptArray,
};

const DEFAULT_VAR_NAME: Record<CodeGeneratorLanguage, string> = {
  c: 'frame',
  cpp: 'frame',
  python: 'frame',
  rust: 'FRAME',
  java: 'frame',
  javascript: 'frame',
};

/** Altı kayıt (C/C++/Python/Rust/Java/JavaScript) aynı bileşeni `language` sabitiyle çağırır. */
export function CodeArrayGeneratorTool({ language }: { language: CodeGeneratorLanguage }): ReactElement {
  const { t } = useTranslation();
  const [hexInput, setHexInput] = useState('');
  const [varName, setVarName] = useState(DEFAULT_VAR_NAME[language]);

  const output = useMemo(() => {
    if (hexInput.trim().length === 0) return undefined;
    try {
      const bytes = hexToBytes(hexInput.replace(/\s+/g, ''));
      return GENERATORS[language](bytes, varName.trim().length === 0 ? DEFAULT_VAR_NAME[language] : varName);
    } catch {
      return null;
    }
  }, [hexInput, varName, language]);

  return (
    <div className="flex flex-col gap-3">
      <TextField id="calc-hex" label={t('calc.field.hexInput')} value={hexInput} onChange={setHexInput} monospace multiline placeholder="AA 05 10 03 34 12 7F 4F 55" />
      <TextField id="calc-varname" label={t('calc.field.variableName')} value={varName} onChange={setVarName} monospace />
      <ResultField
        id="calc-output"
        label={t('calc.field.codeOutput')}
        value={output ?? ''}
        error={output === null ? t('calc.error.invalidInput') : undefined}
      />
    </div>
  );
}
