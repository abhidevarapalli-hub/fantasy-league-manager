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
import Trades from "./pages/Trades";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, managerProfile, isLeagueManager, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center p-4">Loading...</div>;
  }

  // Helper for protected routes
  // - Must be logged in
  // - Must have claimed a profile (unless we are on the login page which handles claiming)
  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (!user) return <Navigate to="/login" replace />;
    if (!managerProfile) return <Navigate to="/login" replace />; // Login page handles claiming
    return <>{children}</>;
  };

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />
      <Route path="/roster" element={
        <ProtectedRoute><Roster /></ProtectedRoute>
      } />
      <Route path="/players" element={
        <ProtectedRoute><Players /></ProtectedRoute>
      } />
      <Route path="/activity" element={
        <ProtectedRoute><Activity /></ProtectedRoute>
      } />
      <Route path="/trades" element={
        <ProtectedRoute><Trades /></ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute>
          {isLeagueManager ? <Admin /> : <Navigate to="/" replace />}
        </ProtectedRoute>
      } />
      <Route path="/draft" element={
        <ProtectedRoute><Draft /></ProtectedRoute>
      } />
      <Route path="/history" element={
        <ProtectedRoute><LeagueHistory /></ProtectedRoute>
      } />
      <Route path="/team/:teamId" element={
        <ProtectedRoute><TeamView /></ProtectedRoute>
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
