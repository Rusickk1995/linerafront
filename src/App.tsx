// src/App.tsx

import React from "react";
import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import CreateTournamentPage from "./pages/CreateTournamentPage";
import TablePage from "./pages/TablePage";
import Lobby from "./pages/Lobby"; // ← ДОБАВЛЯЕМ

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/create" element={<CreateTournamentPage />} />
      <Route path="/table" element={<TablePage />} />

      {/* НОВЫЙ маршрут для /lobby */}
      <Route path="/lobby" element={<Lobby />} />

      {/* опционально, чтобы на левом URL не было чёрного экрана */}
      {/* <Route path="*" element={<LandingPage />} /> */}
    </Routes>
  );
};

export default App;
