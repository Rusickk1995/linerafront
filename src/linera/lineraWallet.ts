import { Application, Client, Faucet, Wallet } from "@linera/client";
import { LINERA_APP_ID, LINERA_FAUCET_URL } from "./lineraEnv";

let backendPromise: Promise<Application> | null = null;

async function createBackend(): Promise<Application> {
  console.log("[lineraWallet] creating backend...");
  console.log("[lineraWallet] faucet url =", LINERA_FAUCET_URL);

  const faucet = new (Faucet as any)(LINERA_FAUCET_URL) as Faucet;

  const wallet = (await (faucet as any).createWallet()) as Wallet;
  console.log("[lineraWallet] wallet =", wallet);

  const owner = "0x0000000000000000000000000000000000000000";
  try {
    await (faucet as any).claimChain(wallet as any, owner);
    console.log("[lineraWallet] claimChain ok (wallet + owner)");
  } catch (e) {
    console.error("[lineraWallet] claimChain ERROR", e);
    throw e;
  }

  const client = new (Client as any)(wallet as any) as Client;
  console.log("[lineraWallet] client created =", client);

  const frontend = (client as any).frontend();
  const application = (await frontend.application(
    LINERA_APP_ID
  )) as Application;
  console.log("[lineraWallet] application ready, appId =", LINERA_APP_ID);

  return application;
}

export async function getBackend(): Promise<Application> {
  if (!backendPromise) {
    backendPromise = createBackend();
  }
  return backendPromise;
}

export const lineraReady: Promise<void> = getBackend().then(() => {
  console.log("[lineraWallet] ready");
});
