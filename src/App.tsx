import { Toaster } from "@/components/ui/toaster";
import React, { useEffect } from 'react';

import { useAuthStore } from '@/store/useAuthStore';


import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Activity from "./pages/Activity";
import Admin from "./pages/Admin";
import TeamView from "./pages/TeamView";
import Draft from "./pages/Draft";
import LeagueHistory from "./pages/LeagueHistory";
import Dashboard from "./pages/Dashboard";
import Players from "./pages/Players";
import Trades from "./pages/Trades";
import Login from "./pages/Login";
import ProfileSetup from "./pages/ProfileSetup";


import Leagues from "@/pages/Leagues";
import CreateLeague from "@/pages/CreateLeague";
import JoinLeague from "@/pages/JoinLeague";
import LiveScores from "@/pages/LiveScores";
import ScoringRules from "@/pages/ScoringRules";
import PointsCalculatorTest from "@/pages/PointsCalculatorTest";

import NotFound from "./pages/NotFound";



const queryClient = new QueryClient();

// Root-level auth initialization hook
const AuthInitializer = () => {
  const initializeAuth = useAuthStore(state => state.initialize);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return null;
};

// Helper for protected routes
// - Must be logged in
// - Must have claimed a profile (unless we are on the login page which handles claiming)
const ProtectedRoute = ({ children, requireUsername = true }: { children: React.ReactNode; requireUsername?: boolean }) => {
  const user = useAuthStore(state => state.user);
  const userProfile = useAuthStore(state => state.userProfile);
  const isLoading = useAuthStore(state => state.isLoading);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center p-4">Loading...</div>;
  }

  if (!user) {
    // Save the intended destination for join links
    if (window.location.pathname.startsWith('/join/')) {
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
    }
    return <Navigate to="/login" replace />;
  }

  // Wait for userProfile to load before checking username
  // This prevents false redirects when profile is still loading
  if (userProfile === null) {
    return <div className="min-h-screen flex items-center justify-center p-4">Loading profile...</div>;
  }

  // Only enforce username for routes that require it
  if (requireUsername && !userProfile?.username && window.location.pathname !== '/leagues/setup') {
    // Save the intended destination for join links
    if (window.location.pathname.startsWith('/join/')) {
      sessionStorage.setItem('redirectAfterSetup', window.location.pathname);
    }
    return <Navigate to="/leagues/setup" replace />;
  }

  return <>{children}</>;
};

import { LeagueLayout } from "@/components/LeagueLayout";

const AppRoutes = () => {
  const isLoading = useAuthStore(state => state.isLoading);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center p-4">Loading...</div>;
  }

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
      <Route path="/join/:leagueId" element={
        <ProtectedRoute><JoinLeague /></ProtectedRoute>
      } />
      <Route path="/scores/live" element={
        <ProtectedRoute requireUsername={false}><LiveScores /></ProtectedRoute>
      } />
      <Route path="/test/points-calculator" element={<PointsCalculatorTest />} />

      <Route element={<ProtectedRoute><LeagueLayout /></ProtectedRoute>}>
        <Route path="/:leagueId" element={<Dashboard />} />
        <Route path="/:leagueId/players" element={<Players />} />
        <Route path="/:leagueId/activity" element={<Activity />} />
        <Route path="/:leagueId/trades" element={<Trades />} />
        <Route path="/:leagueId/admin" element={<Admin />} />
        <Route path="/:leagueId/scoring" element={<ScoringRules />} />
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
        <AuthInitializer />
        <AppRoutes />
      </BrowserRouter>

    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
