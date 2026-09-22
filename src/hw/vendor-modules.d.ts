declare module "@ledgerhq/hw-transport-webhid" {
  const TransportWebHID: {
    create: () => Promise<unknown>;
  };
  export default TransportWebHID;
}

declare module "@ledgerhq/hw-app-eth" {
  export default class Eth {
    constructor(transport: unknown, opts?: { scrambleKey?: string });
    getAddress: (path: string) => Promise<{ address: string }>;
    signEIP712HashedMessage: (
      path: string,
      domainSeparatorHex: string,
      hashStructHex: string,
    ) => Promise<{ v: number; r: string; s: string }>;
    signTransaction: (
      path: string,
      rawTxHex: string,
    ) => Promise<{ v: string; r: string; s: string }>;
  }
}

declare module "@trezor/connect" {
  const TrezorConnect: {
    init: (opts: Record<string, unknown>) => Promise<void>;
    ethereumGetAddress: (opts: unknown) => Promise<{ success: boolean; payload: { address: string } }>;
    ethereumSignTypedData: (opts: unknown) => Promise<{
      success: boolean;
      payload: { signature: `0x${string}` };
    }>;
    ethereumSignTransaction: (opts: unknown) => Promise<{
      success: boolean;
      payload: { v: string; r: string; s: string };
    }>;
  };
  export default TrezorConnect;
}
