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

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Admin-only route wrapper
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLeagueManager } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (!isLeagueManager) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

// Public route that redirects to home if already logged in
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  
  if (user) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      } />
      <Route path="/" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/roster" element={
        <ProtectedRoute>
          <Roster />
        </ProtectedRoute>
      } />
      <Route path="/players" element={
        <ProtectedRoute>
          <Players />
        </ProtectedRoute>
      } />
      <Route path="/activity" element={
        <ProtectedRoute>
          <Activity />
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <AdminRoute>
          <Admin />
        </AdminRoute>
      } />
      <Route path="/draft" element={
        <ProtectedRoute>
          <Draft />
        </ProtectedRoute>
      } />
      <Route path="/history" element={
        <ProtectedRoute>
          <LeagueHistory />
        </ProtectedRoute>
      } />
      <Route path="/team/:teamId" element={
        <ProtectedRoute>
          <TeamView />
        </ProtectedRoute>
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
