/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { supabase } from './supabase';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        if (data.user) {
          onAuthSuccess();
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;
        
        if (data.user) {
          setMessage('Conta criada com sucesso! Verifique seu email para confirmar (ou faça login se já confirmou).');
          // Se não precisar de confirmação de email, fazer login automaticamente
          setTimeout(() => {
            onAuthSuccess();
          }, 1500);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoadingGoogle(true);
    setError(null);
    setMessage(null);

    try {
      // Obter a URL atual para redirecionamento
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
        },
      });

      if (error) throw error;
      // O redirecionamento acontecerá automaticamente
      // O onAuthStateChange no App.tsx capturará a autenticação quando retornar
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar com Google');
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#222] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border-[6px] border-black shadow-[12px_12px_0px_rgba(0,0,0,1)] p-8 text-center relative rotate-1">
        <div className="mb-6">
          <h1 className="font-comic text-5xl text-red-600 leading-none tracking-wide inline-block mr-3" style={{textShadow: '2px 2px 0px black'}}>SUPER</h1>
          <h1 className="font-comic text-5xl text-yellow-400 leading-none tracking-wide inline-block" style={{textShadow: '2px 2px 0px black'}}>KIDS</h1>
        </div>

        <div className="mb-6">
          <button
            onClick={() => {
              setIsLogin(true);
              setError(null);
              setMessage(null);
            }}
            className={`comic-btn px-6 py-2 mr-2 ${isLogin ? 'bg-yellow-400 text-black' : 'bg-gray-200 text-gray-600'}`}
          >
            ENTRAR
          </button>
          <button
            onClick={() => {
              setIsLogin(false);
              setError(null);
              setMessage(null);
            }}
            className={`comic-btn px-6 py-2 ${!isLogin ? 'bg-yellow-400 text-black' : 'bg-gray-200 text-gray-600'}`}
          >
            CADASTRAR
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-left font-comic text-lg mb-2 text-black">EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-3 border-2 border-black font-comic text-lg shadow-[3px_3px_0px_rgba(0,0,0,0.1)] focus:outline-none bg-white text-black"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-left font-comic text-lg mb-2 text-black">SENHA</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full p-3 border-2 border-black font-comic text-lg shadow-[3px_3px_0px_rgba(0,0,0,0.1)] focus:outline-none bg-white text-black"
              placeholder="••••••"
            />
          </div>

          {error && (
            <div className="bg-red-100 border-4 border-red-500 p-3 font-comic text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-100 border-4 border-green-500 p-3 font-comic text-green-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || loadingGoogle}
            className={`comic-btn w-full py-3 text-2xl ${
              loading || loadingGoogle
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-500'
            }`}
          >
            {loading ? 'PROCESSANDO...' : isLogin ? 'ENTRAR' : 'CRIAR CONTA'}
          </button>
        </form>

        {/* Separador */}
        <div className="my-6 flex items-center">
          <div className="flex-1 border-t-2 border-black"></div>
          <span className="px-4 font-comic text-lg text-black font-bold">OU</span>
          <div className="flex-1 border-t-2 border-black"></div>
        </div>

        {/* Botão Google */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading || loadingGoogle}
          className={`comic-btn w-full py-3 text-xl flex items-center justify-center gap-3 ${
            loading || loadingGoogle
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-white text-black border-2 border-black hover:bg-gray-100'
          }`}
        >
          {loadingGoogle ? (
            'PROCESSANDO...'
          ) : (
            <>
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="font-comic font-bold">ENTRAR COM GOOGLE</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

