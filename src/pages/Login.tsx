import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';

import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/integrations/supabase/client';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const leagueId = searchParams.get('leagueId');
  const user = useAuthStore(state => state.user);
  const userProfile = useAuthStore(state => state.userProfile);
  const managerProfile = useAuthStore(state => state.managerProfile);
  const fetchManagerProfile = useAuthStore(state => state.fetchManagerProfile);
  const authLoading = useAuthStore(state => state.isLoading);

  const [error, setError] = useState('');


  useEffect(() => {
    // If we have a user and leagueId but no managerProfile, try to fetch it automatically by user_id
    if (user && leagueId && !managerProfile && !authLoading) {
      fetchManagerProfile(undefined, leagueId);
    }
  }, [user, leagueId, managerProfile, authLoading, fetchManagerProfile]);

  useEffect(() => {
    // If fully authenticated and has a profile for this context, go to dashboard
    if (!authLoading && user && userProfile?.username) {
      const isNative = Capacitor.isNativePlatform();
      if (isNative) {
        Browser.close().catch(() => {
          // Ignore errors when not running inside Capacitor Browser
        });
      }

      // Check if there's a saved redirect from join link
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath) {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(redirectPath);
        return;
      }

      // Otherwise, normal navigation
      if (!leagueId) {
        navigate('/leagues');
      } else if (managerProfile) {
        navigate(`/${leagueId}`);
      }
    }
  }, [user, userProfile, managerProfile, authLoading, navigate, leagueId]);

  const handleGoogleLogin = async () => {
    try {
      const isNative = Capacitor.isNativePlatform();

      // Use saved redirect path so user returns to their intended page after auth
      const savedRedirect = sessionStorage.getItem('redirectAfterLogin');
      const webRedirectTo = savedRedirect
        ? `${window.location.origin}${savedRedirect}`
        : `${window.location.origin}/leagues`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: isNative ? 'com.cricfantasy.app://callback' : webRedirectTo,
          skipBrowserRedirect: isNative,
        }
      });
      if (error) throw error;

      if (isNative && data?.url) {
        await Browser.open({ url: data.url, windowName: '_blank' });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
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
    // Transfer the redirect from login to setup if it exists
    const redirectPath = sessionStorage.getItem('redirectAfterLogin');
    if (redirectPath) {
      sessionStorage.removeItem('redirectAfterLogin');
      sessionStorage.setItem('redirectAfterSetup', redirectPath);
    }
    return <Navigate to="/leagues/setup" replace />;
  }

  // State 1: Authentication (Google Only)
  return (

    <div className="min-h-screen bg-background flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[70%] h-[70%] rounded-full bg-primary/8 blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute -bottom-[30%] -right-[20%] w-[60%] h-[60%] rounded-full bg-violet-500/6 blur-[100px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-emerald-500/5 blur-[80px] animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
      </div>

      {/* Floating decorative dots */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary/20 animate-bounce"
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
              animationDuration: `${3 + i * 0.7}s`,
              animationDelay: `${i * 0.5}s`,
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-sm space-y-8 relative z-10">
        {/* Branding */}
        <div className="text-center space-y-3">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl scale-125 animate-pulse" style={{ animationDuration: '3s' }} />
            <div className="relative w-56 h-auto mx-auto" style={{
              maskImage: 'radial-gradient(ellipse 85% 80% at center, black 50%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 85% 80% at center, black 50%, transparent 100%)',
            }}>
              <img
                src="/logo.png"
                alt="CricFantasy"
                className="w-full h-auto drop-shadow-2xl"
                style={{ mixBlendMode: 'lighten' }}
              />
            </div>
          </div>
          <p className="text-muted-foreground text-sm font-medium tracking-wide">
            Draft. Strategize. Dominate. 🏏
          </p>
        </div>

        {/* Auth Card */}
        <div className="relative group">
          {/* Card glow border */}
          <div className="absolute -inset-[1px] bg-gradient-to-b from-primary/30 via-primary/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          <div className="relative bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden shadow-2xl">
            {/* Subtle top gradient stripe */}
            <div className="h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

            <div className="p-8 space-y-6">
              <div className="text-center space-y-1.5">
                <h2 className="text-lg font-bold tracking-tight">Get Started</h2>
                <p className="text-sm text-muted-foreground">Sign in to build your team and dominate the league</p>
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-xl border border-destructive/20">
                  {error}
                </div>
              )}

              <Button
                variant="default"
                size="lg"
                className="w-full h-14 text-base font-bold transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98] rounded-xl bg-gradient-to-r from-primary to-primary/80 relative overflow-hidden group/btn"
                onClick={handleGoogleLogin}
              >
                {/* Button shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                <svg className="w-5 h-5 mr-3 relative z-10" viewBox="0 0 24 24">
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
                <span className="relative z-10">Continue with Google</span>
              </Button>

              <p className="text-[11px] text-muted-foreground/60 text-center leading-relaxed">
                By signing in, you agree to the league terms and roster rules.
              </p>
            </div>
          </div>
        </div>

        {leagueId && (
          <div className="text-center">
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-4 py-2 rounded-full border border-border/50 backdrop-blur-sm">
              🔗 Joining League
              <span className="font-mono text-primary font-bold">{leagueId.slice(0, 8)}...</span>
            </span>
          </div>
        )}

        {/* Bottom tagline */}
        <p className="text-center text-[10px] text-muted-foreground/40 tracking-widest uppercase font-medium">
          Fantasy Cricket • Season 2026
        </p>
      </div>
    </div>
  );
};

export default Login;
