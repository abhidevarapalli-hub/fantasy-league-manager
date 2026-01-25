import { Toaster } from "@/components/ui/toaster";
import React, { useEffect } from 'react';


import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GameProvider } from "./contexts/GameContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Activity from "./pages/Activity";
import Admin from "./pages/Admin";
import TeamView from "./pages/TeamView";
import Draft from "./pages/Draft";
import LeagueHistory from "./pages/LeagueHistory";
import Dashboard from "./pages/Dashboard";
import Roster from "./pages/Roster";
import Players from "./pages/Players";
import Trades from "./pages/Trades";
import Login from "./pages/Login";
import ProfileSetup from "./pages/ProfileSetup";


import Leagues from "@/pages/Leagues";
import CreateLeague from "@/pages/CreateLeague";


import NotFound from "./pages/NotFound";
import { Outlet, useParams } from "react-router-dom";



const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, userProfile, managerProfile, isLeagueManager, isLoading, fetchManagerProfile } = useAuth();


  // Auto-fetch manager profile when league changing
  const { leagueId } = useParams<{ leagueId: string }>();
  useEffect(() => {
    if (user && leagueId && (!managerProfile || managerProfile.league_id !== leagueId)) {
      fetchManagerProfile(undefined, leagueId);
    }
  }, [leagueId, user, managerProfile, fetchManagerProfile]);


  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center p-4">Loading...</div>;
  }

  // Helper for protected routes
  // - Must be logged in
  // - Must have claimed a profile (unless we are on the login page which handles claiming)
  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (!user) return <Navigate to="/login" replace />;

    // Enforce username setup if not on setup page
    if (!userProfile?.username && window.location.pathname !== '/leagues/setup') {
      return <Navigate to="/leagues/setup" replace />;
    }

    return <>{children}</>;
  };


  const LeagueLayout = () => {
    return (
      <GameProvider>
        <Outlet />
      </GameProvider>
    );
  };


  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/leagues/setup" element={
        <ProtectedRoute><ProfileSetup /></ProtectedRoute>
      } />
      <Route path="/leagues" element={

        <ProtectedRoute><Leagues /></ProtectedRoute>
      } />
      <Route path="/leagues/create" element={
        <ProtectedRoute><CreateLeague /></ProtectedRoute>
      } />


      <Route element={<ProtectedRoute><LeagueLayout /></ProtectedRoute>}>
        <Route path="/:leagueId" element={<Dashboard />} />
        <Route path="/:leagueId/roster" element={<Roster />} />
        <Route path="/:leagueId/players" element={<Players />} />
        <Route path="/:leagueId/activity" element={<Activity />} />
        <Route path="/:leagueId/trades" element={<Trades />} />
        <Route path="/:leagueId/admin" element={<Admin />} />

        <Route path="/:leagueId/draft" element={<Draft />} />
        <Route path="/:leagueId/history" element={<LeagueHistory />} />
        <Route path="/:leagueId/team/:teamId" element={<TeamView />} />
      </Route>

      <Route path="/" element={<Navigate to="/leagues" replace />} />
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
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>

    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
