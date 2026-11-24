import React, { useState } from 'react';
import { LoginSession } from '../types';

declare const google: any;

interface LoginScreenProps {
  onSuccess: (session: LoginSession) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess }) => {
  const [user, setUser] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fuera de Apps Script (Vite local) no hay google.script.run: se permite el
  // acceso para probar la interfaz. El bundle publicado en GAS siempre valida.
  const isDev = typeof google === 'undefined' || !google.script || !google.script.run;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = user.trim();
    const cleanPin = pin.trim();
    if (!cleanUser || !cleanPin) {
      setError('Ingrese usuario y PIN.');
      return;
    }
    setError(null);
    setSubmitting(true);

    const signIn = (session: LoginSession) => {
      setSubmitting(false);
      onSuccess(session);
    };

    if (isDev) {
      signIn({ user: cleanUser, nombre: '', loginAt: new Date().toISOString(), dev: true });
      return;
    }

    google.script.run
      .withSuccessHandler((res: { ok?: boolean; user?: string; nombre?: string; error?: string }) => {
        setSubmitting(false);
        if (res && res.ok) {
          signIn({
            user: res.user || cleanUser,
            nombre: res.nombre || '',
            loginAt: new Date().toISOString()
          });
        } else {
          setError((res && res.error) || 'Usuario o PIN incorrectos.');
        }
      })
      .withFailureHandler((err: any) => {
        setSubmitting(false);
        setError('No se pudo validar el acceso. ' + (err && err.message ? err.message : 'Intente nuevamente.'));
      })
      .validateLogin(cleanUser, cleanPin);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f8fafc] px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#002d5a] flex items-center justify-center shadow-lg mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3l7 3v5.5c0 4.4-2.9 7.6-7 9.5-4.1-1.9-7-5.1-7-9.5V6l7-3z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-[22px] font-semibold text-[#002d5a] uppercase tracking-tight">Control Operativo</h1>
          <p className="text-[12px] text-slate-400 mt-1">Sistema de Seguridad Ciudadana · Surco</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl shadow-xl p-7">
          <h2 className="text-[16px] font-semibold text-slate-800 uppercase tracking-wider">Iniciar sesión</h2>
          <p className="text-[12px] text-slate-400 mt-1 mb-6">Ingrese su usuario y PIN operativo</p>

          <label htmlFor="login-user" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
            Usuario
          </label>
          <div className="relative mb-5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
              </svg>
            </span>
            <input
              id="login-user"
              type="text"
              value={user}
              onChange={(e) => { setUser(e.target.value); setError(null); }}
              autoComplete="username"
              autoFocus
              placeholder="persona_id"
              className="w-full h-11 pl-10 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-[13px] font-medium text-[#002d5a] uppercase placeholder:normal-case placeholder:text-slate-300 focus:outline-none focus:border-[#005ea5] focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>

          <label htmlFor="login-pin" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
            PIN operativo
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
            </span>
            <input
              id="login-pin"
              type={showPin ? 'text' : 'password'}
              value={pin}
              onChange={(e) => { setPin(e.target.value); setError(null); }}
              autoComplete="current-password"
              placeholder="••••••"
              className="w-full h-11 pl-10 pr-11 rounded-lg border border-slate-200 bg-slate-50 text-[13px] font-medium text-[#002d5a] focus:outline-none focus:border-[#005ea5] focus:ring-2 focus:ring-blue-100 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPin(v => !v)}
              title={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
              aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {showPin ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 3l18 18" />
                  <path d="M10.6 5.2A9.8 9.8 0 0 1 12 5c5 0 9 5 9 7a11 11 0 0 1-2.4 3.4M6.2 6.3C4.2 7.7 3 9.7 3 12c0 2 4 7 9 7a9 9 0 0 0 3.2-.6" />
                  <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 12c0-2 4-7 9-7s9 5 9 7-4 7-9 7-9-5-9-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {error && (
            <div role="alert" className="mt-5 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-[12px] font-medium text-red-700">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-px" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16.5h.01" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`mt-6 w-full h-11 rounded-lg text-white text-[12px] font-bold uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${
              submitting ? 'bg-[#005ea5]/60 cursor-wait' : 'bg-[#005ea5] hover:bg-[#004b82] active:scale-[0.99]'
            }`}
          >
            {submitting ? (
              <>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin" aria-hidden="true">
                  <path d="M12 3a9 9 0 1 0 9 9" />
                </svg>
                VALIDANDO...
              </>
            ) : (
              'INGRESAR'
            )}
          </button>

          {isDev && (
            <p className="mt-5 text-[11px] leading-relaxed text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Modo desarrollo: sin Apps Script el acceso no se valida. En la Web App publicada se exige usuario y PIN activos.
            </p>
          )}
        </form>

        <p className="text-center text-[11px] text-slate-400 mt-6">Acceso restringido al personal autorizado</p>
      </div>
    </div>
  );
};

export default LoginScreen;
