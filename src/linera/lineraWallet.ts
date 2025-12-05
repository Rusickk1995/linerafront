// src/linera/lineraWallet.ts
//
// Инициализация Linera Web client (@linera/client):
// - init WASM
// - Faucet
// - Wallet
// - claimChain
// - Client + Application
//
// Здесь НЕТ GraphQL и покерной логики, только инфраструктура.

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
 * Гарантируем, что wasm инициализирован только один раз.
 */
async function ensureWasmInitialized(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = initLinera();
  }
  await wasmInitPromise;
}

/**
 * Фактическое создание backend (Application) поверх faucet/wallet/client.
 * Пока мы всё ещё создаём новый wallet и claimChain как в старой версии.
 * Позже сюда добавим нормальный createOrLoadWallet().
 */
async function createBackend(): Promise<Application> {
  await ensureWasmInitialized();

  console.log("[lineraWallet] creating backend...");

  // 1) Подключаемся к faucet Conway testnet
  const faucet = new (Faucet as any)(LINERA_FAUCET_URL as any);

  // 2) Создаём wallet через faucet
  const wallet: Wallet = await (faucet as any).createWallet();
  console.log("[lineraWallet] wallet =", wallet);

  // 3) Claim chain — передаём wallet и owner-строку (пока заглушка)
  const ownerAddress = "0x0000000000000000000000000000000000000000";

  try {
    await (faucet as any).claimChain(wallet as any, ownerAddress);
    console.log("[lineraWallet] claimChain ok");
  } catch (e) {
    console.error("[lineraWallet] claimChain failed:", e);
    throw e;
  }

  // 4) Создаём Client поверх этого wallet
  const client: Client = new (Client as any)(wallet as any);
  console.log("[lineraWallet] client created =", client);

  // 5) Берём frontend твоего приложения по APP_ID
  const frontend = (client as any).frontend();
  const application: Application = await frontend.application(LINERA_APP_ID);

  console.log("[lineraWallet] application ready");
  return application;
}

/**
 * Публичная точка входа: получить backend Application.
 * Результат кэшируется в backendPromise.
 */
export async function getBackend(): Promise<Application> {
  if (!backendPromise) {
    backendPromise = createBackend();
  }
  return backendPromise;
}

/**
 * Промис, который можно использовать для “ожидания готовности Linera”.
 * Например, если ты хочешь что-то логировать при старте.
 */
async function init() {
  try {
    await getBackend();
    console.log("[lineraWallet] init ok");
  } catch (e) {
    console.error("[lineraWallet] init failed:", e);
  }
}

export const lineraReady: Promise<void> = init();
