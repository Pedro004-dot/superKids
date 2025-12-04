/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { TokenStats } from './types';

interface AdminPageProps {
  stats: TokenStats;
  onClose: () => void;
  onReset: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ stats, onClose, onReset }) => {
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative max-w-2xl w-full bg-white border-[6px] border-black shadow-[16px_16px_0px_rgba(0,0,0,1)] p-8 animate-in fade-in zoom-in duration-300">
        
        {/* Header with Secret Badge */}
        <div className="flex items-center justify-between mb-8 border-b-4 border-black pb-4">
            <h2 className="font-comic text-5xl text-blue-600 uppercase tracking-wide leading-none" style={{textShadow: '2px 2px 0px black'}}>
            Painel Admin
            </h2>
            <div className="bg-yellow-400 border-2 border-black px-3 py-1 font-comic text-xl rotate-3">
                TOP SECRET
            </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-100 p-4 border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,0.2)]">
                <p className="font-comic text-xl text-gray-500 mb-1">Tokens de Entrada (Input)</p>
                <p className="font-mono text-4xl font-bold text-black">{stats.input.toLocaleString()}</p>
            </div>
            <div className="bg-gray-100 p-4 border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,0.2)]">
                <p className="font-comic text-xl text-gray-500 mb-1">Tokens de Saída (Output)</p>
                <p className="font-mono text-4xl font-bold text-black">{stats.output.toLocaleString()}</p>
            </div>
            <div className="bg-blue-50 p-4 border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,0.2)]">
                <p className="font-comic text-xl text-gray-500 mb-1">Total de Requisições</p>
                <p className="font-mono text-4xl font-bold text-blue-600">{stats.totalRequests}</p>
            </div>
            <div className="bg-purple-50 p-4 border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,0.2)]">
                <p className="font-comic text-xl text-gray-500 mb-1">Modelo Ativo</p>
                <p className="font-mono text-2xl font-bold text-purple-600 break-words">{stats.model}</p>
            </div>
        </div>

        {/* Info Box */}
        <div className="bg-yellow-100 border-l-8 border-yellow-400 p-4 mb-8 font-comic text-lg">
            <p>Estes contadores rastreiam o uso da API para a sessão atual. Use estes números para estimar o custo por quadrinho gerado.</p>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
            <button 
            onClick={onClose}
            className="flex-1 comic-btn bg-gray-200 text-black text-2xl px-6 py-3 hover:bg-gray-300 uppercase tracking-widest"
            >
            Fechar
            </button>
            <button 
            onClick={onReset}
            className="flex-1 comic-btn bg-red-500 text-white text-2xl px-6 py-3 hover:bg-red-400 uppercase tracking-widest"
            >
            Resetar Contadores
            </button>
        </div>
      </div>
    </div>
  );
};