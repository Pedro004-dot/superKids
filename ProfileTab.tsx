/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { PaymentModal } from './payment/components/PaymentModal';
import { PaymentButton } from './payment/components/PaymentButton';

interface ProfileTabProps {
  user: User | null;
  credits: number;
  totalComics?: number;
  onLogout: () => void;
  onCreditsUpdate?: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ user, credits, totalComics = 0, onLogout, onCreditsUpdate }) => {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  return (
    <div className="text-center text-white pt-20 pb-10">
      <h2 className="text-4xl md:text-5xl mb-8 font-comic" style={{textShadow: '2px 2px 0px black'}}>
        Perfil do Super Autor
      </h2>
      
      <div className="bg-white border-[6px] border-black shadow-[12px_12px_0px_rgba(0,0,0,1)] p-8 max-w-2xl mx-auto text-black">
        {/* Informações do Usuário */}
        <div className="mb-8">
          <div className="mb-4">
            <label className="font-comic text-sm text-gray-600 uppercase">Email</label>
            <p className="font-comic text-xl text-black">{user?.email}</p>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-yellow-100 border-4 border-yellow-400 p-6">
            <div className="text-4xl mb-2">📚</div>
            <p className="font-comic text-2xl text-yellow-600 mb-1">{totalComics}</p>
            <p className="font-comic text-sm text-gray-700 uppercase">Gibis Criados</p>
          </div>
          
          <div className="bg-blue-100 border-4 border-blue-400 p-6">
            <div className="text-4xl mb-2">⭐</div>
            <p className="font-comic text-2xl text-blue-600 mb-1">{credits}/4</p>
            <p className="font-comic text-sm text-gray-700 uppercase">Créditos Restantes</p>
          </div>
        </div>

        {/* Barra de Progresso de Créditos */}
        <div className="mb-8">
          <label className="font-comic text-sm text-gray-600 uppercase block mb-2">Progresso de Créditos</label>
          <div className="w-full h-6 bg-gray-200 border-2 border-black rounded-full overflow-hidden">
            <div 
              className="h-full bg-yellow-400 transition-all duration-500"
              style={{ width: `${(credits / 4) * 100}%` }}
            />
          </div>
          <p className="font-comic text-xs text-gray-500 mt-1">
            {4 - credits} de 4 gibis criados
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col gap-4">
          <PaymentButton 
            onClick={() => setShowPaymentModal(true)}
            disabled={!user}
          />
          
          <button 
            onClick={onLogout}
            className="comic-btn bg-red-600 text-white px-8 py-3 hover:bg-red-500 text-xl uppercase"
          >
            SAIR
          </button>
        </div>
      </div>

      {/* Modal de Pagamento */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        user={user}
        onPaymentSuccess={() => {
          setShowPaymentModal(false);
          onCreditsUpdate?.();
        }}
      />
    </div>
  );
};

