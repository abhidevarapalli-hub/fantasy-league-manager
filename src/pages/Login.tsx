import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, AlertCircle, Trophy } from 'lucide-react';
import { useAuth, MANAGER_NAMES } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [selectedManager, setSelectedManager] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!selectedManager) {
      setError('Please select a manager');
      return;
    }
    
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);
    
    // Small delay for UX
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const result = login(selectedManager, password);
    
    setIsLoading(false);
    
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Login failed');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">IPL Fantasy League</h1>
          <p className="text-muted-foreground mt-1">Sign in to manage your team</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 bg-card rounded-xl border border-border p-6">
          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Manager Selection */}
          <div className="space-y-2">
            <Label htmlFor="manager" className="text-muted-foreground">
              Select Manager
            </Label>
            <Select value={selectedManager} onValueChange={setSelectedManager}>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue placeholder="Choose your manager..." />
              </SelectTrigger>
              <SelectContent>
                {MANAGER_NAMES.map(name => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-muted-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-muted border-border"
            />
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? (
              'Signing in...'
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </>
            )}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Contact Abhi if you've forgotten your password
        </p>
      </div>
    </div>
  );
};

export default Login;
