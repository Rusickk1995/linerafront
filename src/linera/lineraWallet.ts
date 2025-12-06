// src/linera/lineraWallet.ts
//
// Linera Conway / Testnet frontend:
//
//  1) Faucet        – Conway faucet
//  2) Wallet        – кошелёк пользователя
//  3) claimChain    – создаём microchain
//  4) Client        – клиент поверх wallet
//  5) frontend().application(APP_ID)
//
// НИКАКОГО init(), НИКАКОГО default – @linera/client сам инициализирует WASM.

import * as linera from "@linera/client";
import { LINERA_APP_ID, LINERA_FAUCET_URL } from "./lineraEnv";

export type Application = linera.Application;
export type Client = linera.Client;
export type Wallet = linera.Wallet;
export type Faucet = linera.Faucet;

let backendPromise: Promise<Application> | null = null;

/**
 * Создаём backend Application поверх faucet/wallet/client.
 */
async function createBackend(): Promise<Application> {
  console.log("[lineraWallet] creating backend...");
  console.log("[lineraWallet] faucet url =", LINERA_FAUCET_URL);

  const FaucetCtor = (linera as any).Faucet;
  const ClientCtor = (linera as any).Client;

  if (!FaucetCtor || !ClientCtor) {
    throw new Error("@linera/client: Faucet or Client constructor not found");
  }

  // 1) Faucet Conway testnet
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
