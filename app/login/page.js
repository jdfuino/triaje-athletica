"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleLogin(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );

        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

        if (authError) {
            setError('Credenciales incorrectas. Verifica tu correo y contraseña.');
            setLoading(false);
            return;
        }

        const rol = data.user?.user_metadata?.rol;
        if (rol === 'nutricionista') {
            router.push('/nutricion');
        } else if (rol === 'oftalmologo') {
            router.push('/oftalmologia');
        } else {
            router.push('/');
        }
    }

    return (
        <div className="login-page">

            {/* Panel izquierdo — branding */}
            <div className="login-panel-left">
                <div className="login-panel-circles">
                    <div className="login-circle-outer" />
                    <div className="login-circle-inner" />
                    <div className="login-circle-bottom" />
                </div>
                <div className="login-brand">
                    <div className="login-brand-content">
                        <img src="/Silver_Atletas.png" alt="Silvers Games" className="login-brand-img" />
                        <p className="login-tagline">Plataforma de triaje deportivo</p>
                    </div>
                </div>
            </div>

            {/* Panel derecho — formulario */}
            <div className="login-panel-right">
                <div className="login-card">
                    <div className="login-logo-area">
                        <img src="/SilverGame_informe.png" alt="Silvers Games" className="login-logo" />
                    </div>
                    <h1 className="login-title">Sistema de evaluación</h1>
                    <p className="login-subtitle">Ingresa tus credenciales para continuar</p>

                    <form onSubmit={handleLogin} className="login-form">
                        <div className="form-group">
                            <label htmlFor="email">Correo electrónico</label>
                            <div className="login-input-wrap">
                                <svg className="login-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <rect x="2" y="4" width="20" height="16" rx="2" />
                                    <path d="M2 7l10 7 10-7" />
                                </svg>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="especialista@silvergames.org"
                                    required
                                    autoComplete="email"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="password">Contraseña</label>
                            <div className="login-input-wrap">
                                <svg className="login-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <rect x="3" y="11" width="18" height="11" rx="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    className="login-toggle-password"
                                    onClick={() => setShowPassword(v => !v)}
                                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                >
                                    {showPassword ? (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && <p className="login-error">{error}</p>}

                        <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
                            {loading ? (
                                <>
                                    <svg className="login-spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                    </svg>
                                    Verificando...
                                </>
                            ) : 'Ingresar'}
                        </button>
                    </form>
                </div>
                <p className="login-footer">By Athletica 360</p>
            </div>

        </div>
    );
}
