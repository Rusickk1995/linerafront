// src/linera/lineraWallet.ts
//
// Conway Testnet frontend строго по офф. докам:
//
//  1) await linera.default()                    – init WASM
//  2) new linera.Faucet(LINERA_FAUCET_URL)     – Conway faucet
//  3) faucet.createWallet()                    – кошелёк
//  4) new linera.Client(wallet)                – клиент
//  5) faucet.claimChain(client)                – создаём microchain
//  6) client.frontend().application(APP_ID)    – backend твоего приложения

import * as linera from "@linera/client";
import { LINERA_APP_ID, LINERA_FAUCET_URL } from "./lineraEnv";

export type Application = linera.Application;
export type Client = linera.Client;
export type Wallet = linera.Wallet;
export type Faucet = linera.Faucet;

let wasmInitPromise: Promise<void> | null = null;
let backendPromise: Promise<Application> | null = null;

// ====================== init WASM ======================

async function ensureWasmInitialized(): Promise<void> {
  if (!wasmInitPromise) {
    const initFn = (linera as any).default;
    if (typeof initFn !== "function") {
      throw new Error("@linera/client: default init function not found");
    }
    wasmInitPromise = initFn();
  }
  await wasmInitPromise;
}

// ====================== backend ========================

async function createBackend(): Promise<Application> {
  await ensureWasmInitialized();

  console.log("[lineraWallet] creating backend...");
  console.log("[lineraWallet] faucet url =", LINERA_FAUCET_URL);

  const FaucetCtor = (linera as any).Faucet;
  const ClientCtor = (linera as any).Client;

  if (!FaucetCtor || !ClientCtor) {
    throw new Error("@linera/client: Faucet or Client ctor not found");
  }

  // 1) Conway faucet
  const faucet = (await new FaucetCtor(LINERA_FAUCET_URL)) as Faucet;

  // 2) Wallet
  const wallet = (await (faucet as any).createWallet()) as Wallet;
  console.log("[lineraWallet] wallet =", wallet);

  // 3) Client поверх wallet
  const client = (await new ClientCtor(wallet as any)) as Client;
  console.log("[lineraWallet] client created =", client);

  // 4) Claim chain — как в доках: claimChain(client)
  try {
    const chainId = await (faucet as any).claimChain(client as any);
    console.log("[lineraWallet] claimChain ok, chainId =", chainId);
  } catch (e) {
    console.error("[lineraWallet] claimChain ERROR", e);
    throw e;
  }

  // 5) Frontend application по APP_ID
  const frontend = (client as any).frontend();
  const application = (await frontend.application(
    LINERA_APP_ID
  )) as Application;
  console.log("[lineraWallet] application ready, appId =", LINERA_APP_ID);

  return application;
}

// Публичный API, как у тебя и было

export async function getBackend(): Promise<Application> {
  if (!backendPromise) {
    backendPromise = createBackend();
  }
  return backendPromise;
}

// Можно ждать lineraReady при старте страницы
export const lineraReady: Promise<void> = getBackend().then(() => {
  console.log("[lineraWallet] ready");
});
