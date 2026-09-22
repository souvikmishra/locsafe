import {
  decodeFunctionData,
  type Abi,
  type Hex,
} from "viem";
import defaultSelectors from "./4byte.json" with { type: "json" };

export type DecodeResult =
  | {
      verified: true;
      signature: string;
      args: readonly unknown[];
    }
  | {
      verified: false;
      raw: Hex;
      label: "UNVERIFIED";
    };

export type SelectorDatabase = Record<string, string>;

function selectorOf(data: Hex): string | null {
  if (!data || data === "0x" || data.length < 10) {
    return null;
  }
  return data.slice(0, 10).toLowerCase();
}

function abiFromSignature(signature: string): Abi {
  return [
    {
      type: "function",
      name: signature.slice(0, signature.indexOf("(")),
      inputs: parseInputs(signature),
      outputs: [],
      stateMutability: "nonpayable",
    },
  ];
}

function parseInputs(signature: string): { name: string; type: string }[] {
  const inner = signature.slice(signature.indexOf("(") + 1, signature.lastIndexOf(")"));
  if (!inner.trim()) {
    return [];
  }
  return inner.split(",").map((part, index) => ({
    name: `arg${index}`,
    type: part.trim(),
  }));
}

export function decodeCalldata(
  data: Hex,
  options?: { selectors?: SelectorDatabase; abi?: Abi },
): DecodeResult {
  const selectors = options?.selectors ?? (defaultSelectors as SelectorDatabase);
  if (!data || data === "0x") {
    return { verified: true, signature: "(empty)", args: [] };
  }
  const selector = selectorOf(data);
  if (!selector) {
    return { verified: false, raw: data, label: "UNVERIFIED" };
  }

  if (options?.abi) {
    try {
      const decoded = decodeFunctionData({ abi: options.abi, data });
      return {
        verified: true,
        signature: String(decoded.functionName),
        args: decoded.args ?? [],
      };
    } catch {
      // fall through to selector database
    }
  }

    const signature = selectors[selector];
  if (!signature) {
    return { verified: false, raw: data, label: "UNVERIFIED" };
  }
  try {
    const decoded = decodeFunctionData({
      abi: abiFromSignature(signature),
      data,
    });
    return { verified: true, signature, args: decoded.args ?? [] };
  } catch {
    return { verified: false, raw: data, label: "UNVERIFIED" };
  }
}

