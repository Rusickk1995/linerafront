declare module "@linera/client" {
  export function initialize(): Promise<void>;
  export function initSync(): void;
  const _defaultInit: undefined | (() => Promise<void>);
  export default _defaultInit;

  export class Faucet {
    constructor(url: string);
    createWallet(): Promise<Wallet>;
    // поддержим обе сигнатуры, чтобы TS не мешал
    claimChain(client: Client): Promise<string>;
    claimChain(wallet: Wallet, owner: string): Promise<string>;
  }

  export class Wallet {}

  export class Client {
    constructor(wallet: Wallet, signer?: unknown);
    frontend(): { application(appId: string): Promise<Application> };
    // иногда полезно для fallback
    address?(): Promise<string>;
  }

  export class Application {
    query(request: string): Promise<string>;
  }
}
