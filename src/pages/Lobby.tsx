// src/pages/Lobby.tsx
//
// Лобби турниров на базе on-chain DTO.
// Читает список турниров из Linera service и отправляет турнирные команды.

import { useEffect, useState } from "react";
import {
  fetchTournaments,
  registerToTournament,
  unregisterFromTournament,
  startTournament,
  advanceTournamentLevel,
  closeTournament,
} from "../linera/lineraClient";
import type { OnChainTournamentViewDto } from "../types/onchain";

// Флаг "админ-режима": позволяет показывать кнопки Start / Next level / Close.
// Для обычных игроков их быть не должно.
const ADMIN_MODE =
  (import.meta as any).env.VITE_ADMIN_MODE === "true" ||
  (import.meta as any).env.VITE_ADMIN_MODE === "1";

type LoadingState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

type ActionKind =
  | "register"
  | "unregister"
  | "start"
  | "next_level"
  | "close";

interface ActionBusyMap {
  [tournamentId: number]: ActionKind | undefined;
}

export default function LobbyPage() {
  const [tournaments, setTournaments] = useState<OnChainTournamentViewDto[]>(
    []
  );
  const [loading, setLoading] = useState<LoadingState>({ kind: "idle" });
  const [actionBusy, setActionBusy] = useState<ActionBusyMap>({});
  const [bannerError, setBannerError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Загрузка турниров
  // ---------------------------------------------------------------------------

  const loadTournaments = async () => {
    setLoading({ kind: "loading" });
    setBannerError(null);

    try {
      const data = await fetchTournaments();
      setTournaments(data);
      setLoading({ kind: "idle" });
    } catch (e) {
      console.error("[Lobby] Failed to fetch tournaments", e);
      const msg =
        e instanceof Error ? e.message : "Failed to load tournaments list";
      setLoading({ kind: "error", message: msg });
      setBannerError(msg);
    }
  };

  useEffect(() => {
    void loadTournaments();
  }, []);

  // ---------------------------------------------------------------------------
  // Вспомогательные функции
  // ---------------------------------------------------------------------------

  function setBusy(tournamentId: number, kind?: ActionKind) {
    setActionBusy((prev) => ({ ...prev, [tournamentId]: kind }));
  }

  function patchTournament(updated: OnChainTournamentViewDto) {
    setTournaments((prev) =>
      prev.map((t) =>
        t.tournament_id === updated.tournament_id ? updated : t
      )
    );
  }

  function statusBadge(t: OnChainTournamentViewDto): string {
    switch (t.status) {
      case "Registering":
        return "Registering";
      case "Running":
        return "Running";
      case "OnBreak":
        return "On break";
      case "Finished":
        return "Finished";
      default:
        return t.status;
    }
  }

  function statusBadgeClasses(t: OnChainTournamentViewDto): string {
    switch (t.status) {
      case "Registering":
        return "bg-amber-500/20 text-amber-300";
      case "Running":
        return "bg-emerald-500/20 text-emerald-300";
      case "OnBreak":
        return "bg-sky-500/20 text-sky-300";
      case "Finished":
        return "bg-gray-500/30 text-gray-200";
      default:
        return "bg-gray-500/20 text-gray-200";
    }
  }

  // ---------------------------------------------------------------------------
  // Обработчики действий игрока (Register / Unregister)
  // ---------------------------------------------------------------------------

  const handleRegister = async (tournamentId: number) => {
    setBannerError(null);
    setBusy(tournamentId, "register");

    try {
      const updated = await registerToTournament(tournamentId);
      patchTournament(updated);
    } catch (e) {
      console.error("[Lobby] registerToTournament failed", e);
      const msg =
        e instanceof Error ? e.message : "Failed to register to tournament";
      setBannerError(msg);
    } finally {
      setBusy(tournamentId, undefined);
    }
  };

  const handleUnregister = async (tournamentId: number) => {
    setBannerError(null);
    setBusy(tournamentId, "unregister");

    try {
      const updated = await unregisterFromTournament(tournamentId);
      patchTournament(updated);
    } catch (e) {
      console.error("[Lobby] unregisterFromTournament failed", e);
      const msg =
        e instanceof Error
          ? e.message
          : "Failed to unregister from tournament";
      setBannerError(msg);
    } finally {
      setBusy(tournamentId, undefined);
    }
  };

  // ---------------------------------------------------------------------------
  // Админские обработчики (Start / Next level / Close)
  // ---------------------------------------------------------------------------

  const handleStart = async (tournamentId: number) => {
    if (!ADMIN_MODE) return;
    setBannerError(null);
    setBusy(tournamentId, "start");

    try {
      const updated = await startTournament(tournamentId);
      patchTournament(updated);
    } catch (e) {
      console.error("[Lobby] startTournament failed", e);
      const msg =
        e instanceof Error ? e.message : "Failed to start tournament";
      setBannerError(msg);
    } finally {
      setBusy(tournamentId, undefined);
    }
  };

  const handleNextLevel = async (tournamentId: number) => {
    if (!ADMIN_MODE) return;
    setBannerError(null);
    setBusy(tournamentId, "next_level");

    try {
      const updated = await advanceTournamentLevel(tournamentId);
      patchTournament(updated);
    } catch (e) {
      console.error("[Lobby] advanceTournamentLevel failed", e);
      const msg =
        e instanceof Error ? e.message : "Failed to advance tournament level";
      setBannerError(msg);
    } finally {
      setBusy(tournamentId, undefined);
    }
  };

  const handleClose = async (tournamentId: number) => {
    if (!ADMIN_MODE) return;
    setBannerError(null);
    setBusy(tournamentId, "close");

    try {
      const updated = await closeTournament(tournamentId);
      patchTournament(updated);
    } catch (e) {
      console.error("[Lobby] closeTournament failed", e);
      const msg =
        e instanceof Error ? e.message : "Failed to close tournament";
      setBannerError(msg);
    } finally {
      setBusy(tournamentId, undefined);
    }
  };

  // ---------------------------------------------------------------------------
  // Рендер
  // ---------------------------------------------------------------------------

  const isLoading = loading.kind === "loading";

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-red-950 to-black p-8 text-white">
      <div className="container mx-auto space-y-6">
        {/* Заголовок + Refresh */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl font-bold mb-1">Tournaments Lobby</h1>
            <p className="text-sm text-white/70">
              On-chain tournaments powered by your Rust engine &amp; Linera.
            </p>
          </div>
          <button
            onClick={loadTournaments}
            disabled={isLoading}
            className="px-4 py-2 rounded-2xl border border-white/20 bg-white/5 hover:bg-white/10 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Верхний баннер ошибок */}
        {bannerError && (
          <div className="rounded-xl bg-red-900/70 border border-red-500/60 px-4 py-3 text-sm">
            {bannerError}
          </div>
        )}

        {/* Состояние загрузки / пустого списка */}
        {isLoading && tournaments.length === 0 && (
          <div className="text-white/70 text-sm">Loading tournaments…</div>
        )}

        {!isLoading && tournaments.length === 0 && (
          <div className="text-white/60 text-sm">
            No tournaments yet. Create one from the Create Tournament page.
          </div>
        )}

        {/* Сетка турниров */}
        {tournaments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {tournaments.map((t) => {
              const busyKind = actionBusy[t.tournament_id];

              const isRegistering = t.status === "Registering";
              const isFinished = t.status === "Finished";

              const canRegister = isRegistering && !busyKind;
              const canUnregister = isRegistering && !busyKind;

              return (
                <div
                  key={t.tournament_id}
                  className="relative rounded-3xl bg-gradient-to-br from-white/5 via-red-950/40 to-black/60 border border-white/10 shadow-xl p-5 flex flex-col gap-4"
                >
                  {/* Заголовок и статус */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold leading-tight">
                        {t.name || "Unnamed tournament"}
                      </div>
                      <div className="text-xs text-white/60 mt-1">
                        ID: {t.tournament_id}
                      </div>
                    </div>
                    <span
                      className={
                        "px-3 py-1 rounded-full text-xs font-semibold " +
                        statusBadgeClasses(t)
                      }
                    >
                      {statusBadge(t)}
                    </span>
                  </div>

                  {/* Основные цифры */}
                  <div className="text-xs space-y-1 text-white/70">
                    <div className="flex justify-between">
                      <span>Players registered</span>
                      <span className="font-semibold">
                        {t.players_registered}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tables running</span>
                      <span className="font-semibold">{t.tables_running}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Current level</span>
                      <span className="font-semibold">{t.current_level}</span>
                    </div>
                  </div>

                  {/* Кнопки регистрации игрока */}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleRegister(t.tournament_id)}
                      disabled={!canRegister}
                      className="flex-1 px-4 py-2 rounded-2xl bg-red-600 hover:bg-red-500 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busyKind === "register" ? "Registering…" : "Register"}
                    </button>
                    <button
                      onClick={() => handleUnregister(t.tournament_id)}
                      disabled={!canUnregister}
                      className="flex-1 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busyKind === "unregister"
                        ? "Unregistering…"
                        : "Unregister"}
                    </button>
                  </div>

                  {/* Админские кнопки – только если включён ADMIN_MODE */}
                  {ADMIN_MODE && (
                    <div className="flex gap-2 mt-3 text-xs">
                      <button
                        onClick={() => handleStart(t.tournament_id)}
                        disabled={
                          busyKind !== undefined ||
                          isFinished ||
                          t.status !== "Registering"
                        }
                        className="flex-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {busyKind === "start" ? "Starting…" : "Start"}
                      </button>
                      <button
                        onClick={() => handleNextLevel(t.tournament_id)}
                        disabled={
                          busyKind !== undefined ||
                          isFinished ||
                          t.status !== "Running"
                        }
                        className="flex-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {busyKind === "next_level"
                          ? "Advancing…"
                          : "Next level"}
                      </button>
                      <button
                        onClick={() => handleClose(t.tournament_id)}
                        disabled={
                          busyKind !== undefined ||
                          isFinished ||
                          (t.status !== "Running" &&
                            t.status !== "Registering" &&
                            t.status !== "OnBreak")
                        }
                        className="flex-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {busyKind === "close" ? "Closing…" : "Close"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
