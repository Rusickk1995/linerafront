// src/App.tsx

import React from "react";
import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import CreateTournamentPage from "./pages/CreateTournamentPage";
import TablePage from "./pages/TablePage";

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/create" element={<CreateTournamentPage />} />
      <Route path="/table" element={<TablePage />} />
    </Routes>
  );
};

export default App;
