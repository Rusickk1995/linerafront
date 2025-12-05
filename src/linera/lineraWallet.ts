// src/linera/lineraWallet.ts
//
// Linera Conway / Testnet frontend инициализация "как в доках":
//
//  1) initLinera()  – init WASM
//  2) Faucet        – Conway faucet
//  3) Wallet        – кошелёк пользователя
//  4) claimChain    – создаём microchain
//  5) Client        – клиент поверх wallet
//  6) frontend().application(APP_ID)
//
// НИКАКОГО MetaMask, НИКАКОГО signer – только базовый встроенный кошелёк.

import initLinera, {
  Application,
  Client,
  Faucet,
  Wallet,
} from "@linera/client";
import { LINERA_APP_ID, LINERA_FAUCET_URL } from "./lineraEnv";

let wasmInitPromise: Promise<unknown> | null = null;
let backendPromise: Promise<Application> | null = null;

/**
 * Один раз инициализируем WASM.
 * Здесь мы просто вызываем initLinera() как в официальных примерах.
 */
async function ensureWasmInitialized(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = initLinera();
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
  //    В runtime конструктор асинхронный, поэтому используем await new.
  const faucet = (await new (Faucet as any)(
    LINERA_FAUCET_URL
  )) as unknown as Faucet;

  // 2) Новый wallet
  const wallet = (await (faucet as any).createWallet()) as Wallet;
  console.log("[lineraWallet] wallet =", wallet);

  // 3) Claim chain для этого кошелька.
  //    Можно делать и через faucet + wallet, и через faucet + client.
  const owner = "0x0000000000000000000000000000000000000000";
  try {
    // если твой faucet ожидает (wallet, owner):
    await (faucet as any).claimChain(wallet as any, owner);
    console.log("[lineraWallet] claimChain ok (wallet + owner)");
  } catch (e) {
    console.error("[lineraWallet] claimChain ERROR", e);
    throw e;
  }

  // 4) Client поверх wallet
  //    В runtime конструктор тоже асинхронный – await new Client(wallet).
  const client = (await new (Client as any)(wallet)) as unknown as Client;
  console.log("[lineraWallet] client created =", client);

  // 5) frontend().application(APP_ID) – как в доках Linera.
  const frontend = (client as any).frontend();
  const application = (await frontend.application(
    LINERA_APP_ID
  )) as Application;
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
