import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';

import { AlertCircle, Trophy, Crown, Loader2 } from 'lucide-react';
import { useAuth, MANAGER_NAMES } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const leagueId = searchParams.get('leagueId');
  const { user, userProfile, managerProfile, selectManager, fetchManagerProfile, isLoading: authLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedManager, setSelectedManager] = useState('');

  useEffect(() => {
    // If we have a user and leagueId but no managerProfile, try to fetch it automatically by user_id
    if (user && leagueId && !managerProfile && !authLoading) {
      fetchManagerProfile(undefined, leagueId);
    }
  }, [user, leagueId, managerProfile, authLoading]);

  useEffect(() => {
    // If fully authenticated and has a profile for this context, go to dashboard
    if (!authLoading && user && userProfile?.username) {
      if (!leagueId) {
        navigate('/leagues');
      } else if (managerProfile) {
        navigate(`/${leagueId}`);
      }
    }
  }, [user, userProfile, managerProfile, authLoading, navigate, leagueId]);

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/leagues`
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleClaimManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    setError('');

    try {
      await selectManager(selectedManager, leagueId || undefined);
      toast.success(`Welcome, ${selectedManager}!`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // State: Authenticated but missing username (Handled by App.tsx ProtectedRoute usually, but here for safety)
  if (user && !userProfile?.username) {
    return <Navigate to="/leagues/setup" replace />;
  }

  // State: Authenticated with username, but viewing legacy league without a linked manager
  if (user && leagueId === 'legacy' && !managerProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-2 border-primary/10 shadow-2xl glass-morphism">
          <CardHeader className="text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 border-2 border-primary/20">
              <Crown className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="text-3xl font-black italic uppercase tracking-tighter">Enter Legacy League</CardTitle>
            <CardDescription className="text-base font-medium">
              Claim your original identity from the historic 2024 season.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleClaimManager} className="space-y-6">
              {error && (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                  <p className="text-sm font-semibold text-destructive">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="manager" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Select Your Name</Label>
                <Select value={selectedManager} onValueChange={setSelectedManager}>
                  <SelectTrigger className="h-14 text-lg font-bold bg-background/50 border-primary/20">
                    <SelectValue placeholder="Which one are you?" />
                  </SelectTrigger>
                  <SelectContent>
                    {MANAGER_NAMES.map(name => (
                      <SelectItem key={name} value={name} className="py-3 text-lg font-medium">{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full h-14 text-lg font-black italic uppercase tracking-tight shadow-lg shadow-primary/20" disabled={isLoading || !selectedManager}>
                {isLoading ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : null}
                Claim Legacy Profile
              </Button>
            </form>
          </CardContent>
          <CardFooter>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/leagues')}
            >
              Go Back
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }


  // State 1: Authentication (Google Only)
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">IPL Fantasy Manager</h1>
          <p className="text-muted-foreground mt-1">Sign in with your Google account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center transition-colors">Authentication Required</CardTitle>
            <CardDescription className="text-center transition-colors">Please sign in to manage your team and follow the league</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}

            <Button
              variant="default"
              size="lg"
              className="w-full h-12 text-base font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
              onClick={handleGoogleLogin}
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground text-center">
              By signing in, you agree to the league terms and roster rules.
            </p>
          </CardFooter>
        </Card>

        {leagueId && (
          <p className="text-center text-sm text-muted-foreground">
            Joining League ID: <span className="font-mono text-primary">{leagueId}</span>
          </p>
        )}
      </div>
    </div>
  );
};

export default Login;
