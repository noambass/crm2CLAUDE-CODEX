import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Login() {
  const { signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(event) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await signInWithPassword(email, password);
      if (signInError) throw signInError;
    } catch {
      setError('ההתחברות נכשלה. בדוק אימייל וסיסמה ונסה שוב.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl border bg-white p-6 text-right shadow-sm">
        <h1 className="mb-4 text-xl font-semibold text-slate-900">התחברות</h1>

        <form data-testid="login-form" onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="login-email">אימייל</Label>
            <Input
              id="login-email"
              data-testid="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              dir="ltr"
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="login-password">סיסמה</Label>
            <div className="relative">
              <Input
                id="login-password"
                data-testid="login-password"
                className="pl-12"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                dir="ltr"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute left-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-md text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button data-testid="login-submit" className="w-full app-cta" disabled={loading} type="submit">
            {loading ? 'מתחבר...' : 'התחבר'}
          </Button>
        </form>
      </div>
    </div>
  );
}
