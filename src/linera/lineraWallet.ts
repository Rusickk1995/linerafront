// src/linera/lineraWallet.ts
//
// Conway / Testnet frontend:
//  - init WASM
//  - Faucet
//  - Wallet
//  - claimChain
//  - Client + frontend().application(APP_ID)

import * as linera from "@linera/client";
import { LINERA_APP_ID, LINERA_FAUCET_URL } from "./lineraEnv";

// Типы из @linera/client
export type Application = linera.Application;
export type Client = linera.Client;
export type Wallet = linera.Wallet;
export type Faucet = linera.Faucet;

let backendPromise: Promise<Application> | null = null;

/**
 * Один раз инициализируем WASM.
 */
async function initWasm(): Promise<void> {
  const initFn: () => Promise<unknown> = (linera as any).default;
  if (typeof initFn !== "function") {
    throw new Error("@linera/client: default init function not found");
  }
  await initFn();
}

/**
 * Создаём backend Application поверх faucet/wallet/client.
 */
async function createBackend(): Promise<Application> {
  await initWasm();

  console.log("[lineraWallet] creating backend...");

  // 1) Faucet Conway testnet — ВАЖНО: await new
  const faucet: Faucet = (await new (linera as any).Faucet(
    LINERA_FAUCET_URL
  )) as Faucet;
  console.log("[lineraWallet] faucet url =", LINERA_FAUCET_URL);

  // 2) Новый wallet
  const wallet: Wallet = (await (faucet as any).createWallet()) as Wallet;
  console.log("[lineraWallet] wallet =", wallet);

  // 3) Client поверх wallet — ВАЖНО: await new
  const client: Client = (await new (linera as any).Client(wallet)) as Client;
  console.log(
    "[lineraWallet] client created, is Promise? ",
    client instanceof Promise
  );

  // 4) Claim chain через client
  const chainId: string = await (faucet as any).claimChain(client);
  console.log("[lineraWallet] claimChain ok, chainId =", chainId);

  // 5) frontend().application(APP_ID)
  const frontend = (client as any).frontend();
  const application: Application = await frontend.application(LINERA_APP_ID);
  console.log("[lineraWallet] application ready, appId =", LINERA_APP_ID);

  return application;
}

/**
 * Публичная точка входа: получить backend Application.
 */
export async function getBackend(): Promise<Application> {
  if (!backendPromise) {
    backendPromise = createBackend();
  }
  return backendPromise;
}

/**
 * “Готовность Linera” – можно использовать при старте.
 */
export const lineraReady: Promise<void> = getBackend().then(() => {
  console.log("[lineraWallet] ready");
});
