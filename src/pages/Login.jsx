import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

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
            <label htmlFor="login-email" className="text-sm text-slate-600">
              אימייל
            </label>
            <input
              id="login-email"
              data-testid="login-email"
              className="w-full rounded-md border px-3 py-2"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              dir="ltr"
              required
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="login-password" className="text-sm text-slate-600">
              סיסמה
            </label>
            <div className="relative">
              <input
                id="login-password"
                data-testid="login-password"
                className="w-full rounded-md border px-3 py-2 pl-12"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-800"
                aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            data-testid="login-submit"
            className="w-full rounded-md bg-[#00214d] px-3 py-2 text-white disabled:opacity-50"
            disabled={loading}
            type="submit"
          >
            {loading ? 'מתחבר...' : 'התחבר'}
          </button>
        </form>
      </div>
    </div>
  );
}
