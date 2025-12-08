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
            disabled={loading}
            className={`comic-btn w-full py-3 text-2xl ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-500'
            }`}
          >
            {loading ? 'PROCESSANDO...' : isLogin ? 'ENTRAR' : 'CRIAR CONTA'}
          </button>
        </form>
      </div>
    </div>
  );
};

