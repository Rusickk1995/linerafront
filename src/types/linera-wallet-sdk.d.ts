// src/types/linera-wallet-sdk.d.ts
//
// Минимальные типы для @linera/wallet-sdk под твой фронт.
// Без any, строго под getLineraClient().

declare module "@linera/wallet-sdk" {
  import type { Client } from "@linera/client";

  export function getLineraClient(): Promise<Client>;
}
