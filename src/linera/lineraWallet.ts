import { Application, Client, Faucet, Wallet } from "@linera/client";
import { LINERA_APP_ID, LINERA_FAUCET_URL } from "./lineraEnv";

let backendPromise: Promise<Application> | null = null;

async function createBackend(): Promise<Application> {
  console.log("[lineraWallet] creating backend...");
  console.log("[lineraWallet] faucet url =", LINERA_FAUCET_URL);

  // 1) Conway faucet
  const faucet = new Faucet(LINERA_FAUCET_URL as any);

  // 2) Wallet
  const wallet = (await (faucet as any).createWallet()) as Wallet;
  console.log("[lineraWallet] wallet =", wallet);

  // 3) Client поверх wallet
  const client = new (Client as any)(wallet as any) as Client;
  console.log("[lineraWallet] client created =", client);

  // 4) Claim chain (сигнатура может отличаться, поэтому через any)
  try {
    // либо claimChain(client), либо claimChain(wallet, owner)
    const owner = "0x0000000000000000000000000000000000000000";
    const chainId =
      (await (faucet as any).claimChain(client as any)) ??
      (await (faucet as any).claimChain(wallet as any, owner));
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

export async function getBackend(): Promise<Application> {
  if (!backendPromise) {
    backendPromise = createBackend();
  }
  return backendPromise;
}

export const lineraReady: Promise<void> = getBackend().then(() => {
  console.log("[lineraWallet] ready");
});
