/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import type { SubscriptionPlan } from '../../types';

interface PlanCardProps {
  plan: SubscriptionPlan;
  onSelect: (plan: SubscriptionPlan) => void;
  isSelected?: boolean;
}

export const PlanCard: React.FC<PlanCardProps> = ({ plan, onSelect, isSelected = false }) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  return (
    <div
      onClick={() => onSelect(plan)}
      className={`bg-white border-[6px] border-black shadow-[8px_8px_0px_rgba(0,0,0,1)] p-6 cursor-pointer transition-all hover:shadow-[12px_12px_0px_rgba(0,0,0,1)] hover:translate-x-[-4px] hover:translate-y-[-4px] ${
        isSelected ? 'ring-4 ring-yellow-400' : ''
      }`}
    >
      <div className="text-center mb-4">
        <h3 className="font-comic text-3xl text-black mb-2 uppercase">{plan.name}</h3>
        <div className="text-4xl font-bold text-black mb-2">{formatPrice(plan.price)}</div>
        <div className="text-xl text-gray-600 mb-4">{plan.credits} Créditos</div>
      </div>

      <div className="space-y-2 mb-6">
        {plan.features.map((feature, idx) => (
          <div key={idx} className="flex items-center text-black">
            <span className="text-2xl mr-2">✓</span>
            <span className="font-comic text-sm capitalize">{feature}</span>
          </div>
        ))}
      </div>

      <button
        className={`w-full py-3 border-4 border-black font-comic text-xl uppercase transition-all ${
          isSelected
            ? 'bg-yellow-400 text-black shadow-[0px_4px_0px_#000]'
            : 'bg-blue-500 text-white hover:bg-blue-400 shadow-[0px_4px_0px_#000] active:translate-y-1 active:shadow-none'
        }`}
      >
        {isSelected ? 'Selecionado' : 'Escolher'}
      </button>
    </div>
  );
};

