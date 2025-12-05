// src/linera/lineraClient.ts
//
// Facade для фронта:
//  - Poker API (fetch*/create*/...)
//  - Хелперы Linera (getBackend, lineraReady)

export * from "./pokerApi";
export { getBackend, lineraReady } from "./lineraWallet";
