// src/linera/lineraWallet.ts
//
// Инициализация Linera Web client (@linera/client) для Conway testnet:
//  - init WASM
//  - Faucet
//  - Wallet
//  - claimChain
//  - Client + Application(APP_ID)

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
 * Инициализация WASM один раз.
 */
async function ensureWasmInitialized(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = initLinera();
  }
  await wasmInitPromise;
}

/**
 * Фактическое создание backend (Application) поверх faucet/wallet/client.
 * Пока без сохранения кошелька – чистый Conway-flow.
 */
async function createBackend(): Promise<Application> {
  await ensureWasmInitialized();

  console.log("[lineraWallet] creating backend...");

  // 1) Подключаемся к faucet Conway testnet
  const faucet = new Faucet(LINERA_FAUCET_URL);

  // 2) Создаём wallet через faucet
  const wallet: Wallet = await faucet.createWallet();
  console.log("[lineraWallet] wallet =", wallet);

  // 3) Claim chain для этого кошелька (owner пока заглушка)
  const owner = "0x0000000000000000000000000000000000000000";

  try {
    await faucet.claimChain(wallet, owner);
    console.log("[lineraWallet] claimChain ok");
  } catch (e) {
    console.error("[lineraWallet] claimChain ERROR", e);
    throw e;
  }

  // 4) Создаём Client поверх этого wallet
  // Conway API: new Client(wallet)
  const client: Client = new Client(wallet as any);
  console.log("[lineraWallet] client created");

  // 5) Conway API: client.application(APP_ID)
  const application: Application = await (client as any).application(
    LINERA_APP_ID
  );
  console.log("[lineraWallet] application ready (Conway)");

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
 * Можно использовать как “ожидание готовности Linera” при старте.
 */
export const lineraReady: Promise<void> = getBackend().then(() => {
  console.log("[lineraWallet] ready");
});
