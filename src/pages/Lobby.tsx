// src/pages/Lobby.tsx
//
// Лобби турниров/столов на базе on-chain DTO.
// Берёт данные из Linera service + отправляет турнирные команды.

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

export default function Lobby() {
  const [tournaments, setTournaments] = useState<OnChainTournamentViewDto[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<number[]>([]); // турниры, по которым идёт запрос

  async function loadTournaments() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchTournaments();
      setTournaments(data);
    } catch (e: any) {
      console.error("fetchTournaments failed", e);
      setError(e?.message ?? "Failed to load tournaments");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTournaments();
  }, []);

  function markBusy(id: number, busy: boolean) {
    setBusyIds((prev) =>
      busy ? [...prev, id] : prev.filter((x) => x !== id)
    );
  }

  function patchTournament(updated: OnChainTournamentViewDto) {
    setTournaments((prev) => {
      const exists = prev.some(
        (t) => t.tournament_id === updated.tournament_id
      );
      if (!exists) {
        return [updated, ...prev];
      }
      return prev.map((t) =>
        t.tournament_id === updated.tournament_id ? updated : t
      );
    });
  }

  const handleRegister = async (id: number) => {
    markBusy(id, true);
    try {
      const updated = await registerToTournament(id);
      patchTournament(updated);
    } catch (e: any) {
      console.error("registerToTournament failed", e);
      alert(e?.message ?? "Failed to register");
    } finally {
      markBusy(id, false);
    }
  };

  const handleUnregister = async (id: number) => {
    markBusy(id, true);
    try {
      const updated = await unregisterFromTournament(id);
      patchTournament(updated);
    } catch (e: any) {
      console.error("unregisterFromTournament failed", e);
      alert(e?.message ?? "Failed to unregister");
    } finally {
      markBusy(id, false);
    }
  };

  const handleStart = async (id: number) => {
    markBusy(id, true);
    try {
      const updated = await startTournament(id);
      patchTournament(updated);
    } catch (e: any) {
      console.error("startTournament failed", e);
      alert(e?.message ?? "Failed to start tournament");
    } finally {
      markBusy(id, false);
    }
  };

  const handleAdvance = async (id: number) => {
    markBusy(id, true);
    try {
      const updated = await advanceTournamentLevel(id);
      patchTournament(updated);
    } catch (e: any) {
      console.error("advanceTournamentLevel failed", e);
      alert(e?.message ?? "Failed to advance level");
    } finally {
      markBusy(id, false);
    }
  };

  const handleClose = async (id: number) => {
    markBusy(id, true);
    try {
      const updated = await closeTournament(id);
      patchTournament(updated);
    } catch (e: any) {
      console.error("closeTournament failed", e);
      alert(e?.message ?? "Failed to close tournament");
    } finally {
      markBusy(id, false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-red-950 to-black p-8">
      <div className="container mx-auto space-y-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-1">
              Tournaments Lobby
            </h1>
            <p className="text-sm text-white/70">
              On-chain tournaments powered by your Rust engine & Linera.
            </p>
          </div>
          <button
            onClick={loadTournaments}
            className="px-4 py-2 rounded-full border border-white/20 bg-white/10 text-sm text-white hover:bg-white/20 transition"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-500/60 text-sm text-red-100 rounded-2xl px-4 py-3">
            {error}
          </div>
        )}

        {isLoading && tournaments.length === 0 ? (
          <div className="text-white/70 text-center py-20">
            Loading tournaments from chain...
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-white/70 text-center py-20">
            No tournaments yet. Create one from the Create page.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((t) => {
              const busy = busyIds.includes(t.tournament_id);
              return (
                <div
                  key={t.tournament_id}
                  className="bg-gradient-to-br from-red-900/40 to-black/60 backdrop-blur-sm border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col gap-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {t.name}
                      </h2>
                      <p className="text-xs text-white/60">
                        ID: {t.tournament_id}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/80">
                      {t.status}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-white/80">
                    <div className="flex justify-between">
                      <span>Players registered</span>
                      <span className="font-semibold">
                        {t.players_registered}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tables running</span>
                      <span className="font-semibold">
                        {t.tables_running}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Current level</span>
                      <span className="font-semibold">
                        {t.current_level}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      disabled={busy}
                      onClick={() => handleRegister(t.tournament_id)}
                      className="flex-1 px-3 py-2 rounded-2xl bg-red-600 hover:bg-red-500 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Register
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => handleUnregister(t.tournament_id)}
                      className="flex-1 px-3 py-2 rounded-2xl bg-black/40 border border-white/20 text-sm text-white hover:bg-black/60 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Unregister
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-white/80">
                    <button
                      disabled={busy}
                      onClick={() => handleStart(t.tournament_id)}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Start
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => handleAdvance(t.tournament_id)}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next level
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => handleClose(t.tournament_id)}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
