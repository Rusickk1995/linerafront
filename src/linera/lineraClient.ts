// src/linera/lineraClient.ts
import * as linera from "@linera/client";

const FAUCET_URL =
  import.meta.env.VITE_LINERA_FAUCET_URL ??
  "https://faucet.testnet-conway.linera.net";

const APP_ID = import.meta.env.VITE_LINERA_APP_ID as string | undefined;

export type Backend = { query(request: string): Promise<string> };

type GraphQLError = { message: string };
type GraphQLResponse<TData> = { data?: TData; errors?: GraphQLError[] };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Backend returned invalid JSON");
  }
}

let wasmInit: Promise<void> | null = null;
async function ensureWasmReady(): Promise<void> {
  if (!wasmInit) wasmInit = linera.initialize(); // 0.15.7: default() нет, есть initialize()
  await wasmInit;
}

let clientPromise: Promise<linera.Client> | null = null;
let backendPromise: Promise<Backend> | null = null;

async function getClient(): Promise<linera.Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      await ensureWasmReady();

      const faucet = new linera.Faucet(FAUCET_URL);
      const wallet = await faucet.createWallet();

      // Критично: сначала claimChain, потом Client
      // (в разных сборках claimChain может принимать wallet или быть без аргументов;
      // делаем строго безопасно по рантайму, чтобы НЕ ломать 0.15.7)
      const claimFn = (faucet as unknown as { claimChain: (...args: any[]) => Promise<any> }).claimChain;
      const chainId =
        claimFn.length === 0
          ? await claimFn()
          : await claimFn(wallet);

      console.info("[Linera] claimed chain:", chainId);

      const client = new linera.Client(wallet);
      return client;
    })();
  }
  return clientPromise;
}

export async function getBackend(): Promise<Backend> {
  if (!backendPromise) {
    backendPromise = (async () => {
      if (!APP_ID) throw new Error("VITE_LINERA_APP_ID is missing (.env.local).");
      const client = await getClient();

      const backend = await client.frontend().application(APP_ID);

      const maybe = backend as unknown;
      if (!isRecord(maybe) || typeof maybe.query !== "function") {
        throw new Error("Backend does not expose query(request: string): Promise<string>");
      }
      return maybe as Backend;
    })();
  }
  return backendPromise;
}

export async function gql<TData>(
  query: string,
  variables?: Record<string, unknown>,
  operationName?: string
): Promise<TData> {
  const backend = await getBackend();
  const request = JSON.stringify({ query, variables, operationName });

  const raw = await backend.query(request);
  const parsed = parseJson(raw);

  if (!isRecord(parsed)) throw new Error("Unexpected GraphQL response shape");

  const errors = parsed.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const msg = errors
      .map((e) => (isRecord(e) && typeof e.message === "string" ? e.message : "Unknown error"))
      .join("; ");
    throw new Error(msg);
  }

  const data = (parsed as GraphQLResponse<TData>).data;
  if (data === undefined) throw new Error("GraphQL response has no data");
  return data;
}

export * from "./pokerApi";
