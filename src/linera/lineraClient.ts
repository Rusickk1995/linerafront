import * as linera from "@linera/client";

const FAUCET_URL =
  import.meta.env.VITE_LINERA_FAUCET_URL ??
  "https://faucet.testnet-conway.linera.net";

const APP_ID = import.meta.env.VITE_LINERA_APP_ID as string | undefined;

export type Backend = {
  query(request: string): Promise<string>;
};

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

let wasmInitPromise: Promise<void> | null = null;
async function ensureLineraWasmInitialized(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = (async () => {
      const m = linera as unknown as {
        initialize?: () => Promise<unknown>;
        default?: () => Promise<unknown>;
        initSync?: () => void;
      };

      if (typeof m.initialize === "function") {
        await m.initialize();
        return;
      }
      if (typeof m.default === "function") {
        await m.default();
        return;
      }
      if (typeof m.initSync === "function") {
        m.initSync();
        return;
      }

      throw new Error(
        "@linera/client WASM init function not found (expected initialize() or default() or initSync())"
      );
    })().then(() => undefined);
  }
  return wasmInitPromise;
}

let clientPromise: Promise<linera.Client> | null = null;
let backendPromise: Promise<Backend> | null = null;

async function getClient(): Promise<linera.Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      await ensureLineraWasmInitialized();

      const faucet = new linera.Faucet(FAUCET_URL);
      const wallet = await faucet.createWallet();

      const client = new linera.Client(wallet);

      // В разных сборках/версиях встречались разные сигнатуры claimChain.
      // Делаем строго: сначала пробуем как в официальном гайде linera.dev (claimChain(client)),
      // если упало — пробуем альтернативу (claimChain(wallet, owner)).
      try {
        const chainId = await (faucet as any).claimChain(client);
        console.info("[Linera] chain:", chainId);
      } catch (e1) {
        // fallback — только если реально надо
        try {
          const owner =
            (typeof (client as any).address === "function" && (await (client as any).address())) ||
            (typeof (wallet as any).defaultOwner === "function" && (await (wallet as any).defaultOwner())) ||
            undefined;

          if (!owner) throw e1;

          const chainId = await (faucet as any).claimChain(wallet, owner);
          console.info("[Linera] chain:", chainId);
        } catch (e2) {
          const m1 = e1 instanceof Error ? e1.message : String(e1);
          const m2 = e2 instanceof Error ? e2.message : String(e2);
          throw new Error(`claimChain failed. primary=${m1}; fallback=${m2}`);
        }
      }

      return client;
    })();
  }
  return clientPromise;
}

export async function getBackend(): Promise<Backend> {
  if (!backendPromise) {
    backendPromise = (async () => {
      if (!APP_ID) throw new Error("VITE_LINERA_APP_ID is missing (.env.local / Vercel env).");

      const client = await getClient();
      const backend = await client.frontend().application(APP_ID);

      const maybe = backend as unknown;
      if (!isRecord(maybe) || typeof (maybe as any).query !== "function") {
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

  const errors = (parsed as any).errors;
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

export async function listGraphQLOperations(): Promise<{
  queries: string[];
  mutations: string[];
}> {
  const q = `
    query {
      __schema {
        queryType { fields { name } }
        mutationType { fields { name } }
      }
    }
  `;

  const data = await gql<{
    __schema: {
      queryType: { fields: { name: string }[] } | null;
      mutationType: { fields: { name: string }[] } | null;
    };
  }>(q);

  return {
    queries: (data.__schema.queryType?.fields ?? []).map((f) => f.name),
    mutations: (data.__schema.mutationType?.fields ?? []).map((f) => f.name),
  };
}

// Важно: чтобы Lobby/TablePage и т.д. могли импортить fetchTournaments и прочее из lineraClient.ts
export * from "./pokerApi";
