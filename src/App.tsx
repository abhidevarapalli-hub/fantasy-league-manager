import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GameProvider } from "./contexts/GameContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import Roster from "./pages/Roster";
import Players from "./pages/Players";
import Activity from "./pages/Activity";
import Admin from "./pages/Admin";
import TeamView from "./pages/TeamView";
import Draft from "./pages/Draft";
import LeagueHistory from "./pages/LeagueHistory";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, isLeagueManager } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={
        user ? <Navigate to="/" replace /> : <Login />
      } />
      <Route path="/" element={
        user ? <Dashboard /> : <Navigate to="/login" replace />
      } />
      <Route path="/roster" element={
        user ? <Roster /> : <Navigate to="/login" replace />
      } />
      <Route path="/players" element={
        user ? <Players /> : <Navigate to="/login" replace />
      } />
      <Route path="/activity" element={
        user ? <Activity /> : <Navigate to="/login" replace />
      } />
      <Route path="/admin" element={
        !user ? <Navigate to="/login" replace /> :
        !isLeagueManager ? <Navigate to="/" replace /> :
        <Admin />
      } />
      <Route path="/draft" element={
        user ? <Draft /> : <Navigate to="/login" replace />
      } />
      <Route path="/history" element={
        user ? <LeagueHistory /> : <Navigate to="/login" replace />
      } />
      <Route path="/team/:teamId" element={
        user ? <TeamView /> : <Navigate to="/login" replace />
      } />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <GameProvider>
            <AppRoutes />
          </GameProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
