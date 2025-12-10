// src/linera/lineraWallet.ts
//
// Адаптер между @linera/wallet-sdk и твоим Poker-приложением:
//  - поднятие Linera Client (getLineraClient)
//  - создание Application по LINERA_APP_ID
//  - единый BackendContext + кеш в window.*

import type { Application, Client } from "@linera/client";
import { LINERA_APP_ID } from "./lineraEnv";

import { getLineraClient } from "@linera/wallet-sdk";

export type BackendContext = {
  client: Client;
  application: Application;
  appId: string;
};

let backendPromise: Promise<BackendContext> | null = null;

function log(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.log("[lineraWallet]", ...args);
}

type FrontendLike = {
  frontend(): {
    application(id: string): Application;
  };
};

// Расширяем Window для отладочных хэндлов, чтобы не использовать any.
interface LineraDebugWindow extends Window {
  LINERA_BACKEND?: BackendContext;
  LINERA_BACKEND_ERROR?: unknown;
}

function getDebugWindow(): LineraDebugWindow | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window as LineraDebugWindow;
}

// Небольшой helper, чтобы не висеть бесконечно в случае зависания промиса.
async function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  ms = 15000
): Promise<T> {
  let timeoutId: number | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`Timeout in ${label} after ${ms} ms`));
    }, ms);
  });

  try {
    const result = await Promise.race<[T, never] | T>([
      promise,
      timeoutPromise as unknown as Promise<T>,
    ]);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    return result as T;
  } catch (e) {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    throw e;
  }
}

async function createBackend(): Promise<BackendContext> {
  log("Initializing Linera wallet backend…");

  try {
    // 1) Получаем Conway client из @linera/wallet-sdk
    log("Calling getLineraClient()…");

    const client: Client = await withTimeout(
      getLineraClient().then(
        (c: Client) => {
          log("[DEBUG] getLineraClient RESOLVED");
          return c;
        },
        (e: unknown) => {
          // eslint-disable-next-line no-console
          console.error("[DEBUG] getLineraClient REJECTED:", e);
          throw e;
        }
      ),
      "getLineraClient()"
    );

    log("getLineraClient returned control");

    const clientWithFrontend = client as unknown as FrontendLike;

    // 2) Application по APP_ID
    log("Creating Application frontend for APP_ID =", LINERA_APP_ID);
    const application = clientWithFrontend
      .frontend()
      .application(LINERA_APP_ID);

    const backend: BackendContext = {
      client,
      application,
      appId: LINERA_APP_ID,
    };

    const debugWindow = getDebugWindow();
    if (debugWindow) {
      debugWindow.LINERA_BACKEND = backend;
    }

    log("Backend ready:", {
      appId: backend.appId,
    });

    return backend;
  } catch (e: unknown) {
    // eslint-disable-next-line no-console
    console.error("[lineraWallet] FATAL error in createBackend:", e);

    const debugWindow = getDebugWindow();
    if (debugWindow) {
      debugWindow.LINERA_BACKEND_ERROR = e;
    }

    throw e;
  }
}

export async function getBackend(): Promise<BackendContext> {
  if (!backendPromise) {
    log("getBackend(): starting new backend init");
    backendPromise = createBackend().catch((e: unknown) => {
      // eslint-disable-next-line no-console
      console.error("[lineraWallet] Backend init failed:", e);
      backendPromise = null; // позволяем повторную попытку
      throw e;
    });
  } else {
    log("getBackend(): reusing existing backendPromise");
  }
  return backendPromise;
}

export function lineraReady(): Promise<BackendContext> {
  return getBackend();
}

export async function getApplication(): Promise<Application> {
  const backend = await getBackend();
  return backend.application;
}
