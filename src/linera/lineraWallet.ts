// src/linera/lineraWallet.ts
//
// Linera Conway / Testnet frontend:
//
//  1) init WASM через linera.default()
//  2) Faucet        – Conway faucet
//  3) Wallet        – кошелёк пользователя
//  4) claimChain    – создаём microchain
//  5) Client        – клиент поверх wallet
//  6) frontend().application(APP_ID)

import * as linera from "@linera/client";
import { LINERA_APP_ID, LINERA_FAUCET_URL } from "./lineraEnv";

// Типы берём из namespace, чтобы TS был доволен
export type Application = linera.Application;
export type Client = linera.Client;
export type Wallet = linera.Wallet;
export type Faucet = linera.Faucet;

let wasmInitPromise: Promise<void> | null = null;
let backendPromise: Promise<Application> | null = null;

/**
 * Один раз инициализируем WASM, чтобы не ловить __wbindgen_malloc undefined.
 */
async function ensureWasmInitialized(): Promise<void> {
  if (!wasmInitPromise) {
    const initFn = (linera as any).default;
    if (typeof initFn !== "function") {
      throw new Error("@linera/client: init function (default) not found");
    }
    wasmInitPromise = initFn();
  }
  await wasmInitPromise;
}

/**
 * Создаём backend Application поверх faucet/wallet/client.
 */
async function createBackend(): Promise<Application> {
  await ensureWasmInitialized();

  console.log("[lineraWallet] creating backend...");
  console.log("[lineraWallet] faucet url =", LINERA_FAUCET_URL);

  // 1) Faucet Conway testnet
  const FaucetCtor = (linera as any).Faucet;
  const faucet = new FaucetCtor(LINERA_FAUCET_URL) as Faucet;

  // 2) Новый wallet
  const wallet = (await (faucet as any).createWallet()) as Wallet;
  console.log("[lineraWallet] wallet =", wallet);

  // 3) Claim chain для этого кошелька.
  const owner = "0x0000000000000000000000000000000000000000";
  try {
    await (faucet as any).claimChain(wallet as any, owner);
    console.log("[lineraWallet] claimChain ok (wallet + owner)");
  } catch (e) {
    console.error("[lineraWallet] claimChain ERROR", e);
    throw e;
  }

  // 4) Client поверх wallet
  const ClientCtor = (linera as any).Client;
  const client = new ClientCtor(wallet as any) as Client;
  console.log("[lineraWallet] client created =", client);

  // 5) frontend().application(APP_ID)
  const frontend = (client as any).frontend();
  const application = (await frontend.application(
    LINERA_APP_ID
  )) as Application;
  console.log("[lineraWallet] application ready, appId =", LINERA_APP_ID);

  return application;
}

/**
 * Публичная точка входа: получить backend Application (с кэшированием).
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
