/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { usePlans } from '../hooks/usePlans';
import { usePayment } from '../hooks/usePayment';
import { PlanCard } from './PlanCard';
import { CheckoutForm } from './CheckoutForm';
import type { SubscriptionPlan } from '../../types';
import type { User } from '@supabase/supabase-js';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onPaymentSuccess?: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  user,
  onPaymentSuccess
}) => {
  const { plans, loading: plansLoading } = usePlans();
  const { createPayment, processing } = usePayment();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  if (!isOpen) return null;

  const handlePlanSelect = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setShowCheckout(true);
  };

  const handleCheckoutSuccess = async (data: any) => {
    if (!user || !selectedPlan) return;

    try {
      const result = await createPayment(selectedPlan.id, data.provider, user);
      
      if (result?.success) {
        // Se tem checkoutUrl (PIX, boleto), redirecionar
        if (result.checkoutUrl) {
          window.open(result.checkoutUrl, '_blank');
        }
        
        // Se tem QR Code (PIX), mostrar modal com QR
        if (result.qrCode) {
          // TODO: Mostrar modal com QR Code
          alert('QR Code PIX gerado! (Implementar modal de QR Code)');
        }

        onPaymentSuccess?.();
        onClose();
      }
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
    }
  };

  const handleBack = () => {
    setShowCheckout(false);
    setSelectedPlan(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white border-[6px] border-black shadow-[12px_12px_0px_rgba(0,0,0,1)] max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-comic text-4xl text-black uppercase">
              {showCheckout ? 'Finalizar Compra' : 'Escolha Seu Plano'}
            </h2>
            <button
              onClick={onClose}
              className="text-4xl text-black hover:text-red-600 transition-colors"
            >
              ×
            </button>
          </div>

          {/* Content */}
          {showCheckout && selectedPlan ? (
            <div>
              <button
                onClick={handleBack}
                className="mb-4 text-blue-600 hover:text-blue-800 font-comic text-lg"
              >
                ← Voltar
              </button>
              <CheckoutForm
                planId={selectedPlan.id}
                amount={selectedPlan.price}
                credits={selectedPlan.credits}
                onSuccess={handleCheckoutSuccess}
                onCancel={onClose}
              />
            </div>
          ) : (
            <div>
              {plansLoading ? (
                <div className="text-center py-20">
                  <div className="text-4xl mb-4 animate-pulse">⏳</div>
                  <p className="font-comic text-xl">Carregando planos...</p>
                </div>
              ) : plans.length === 0 ? (
                <div className="text-center py-20">
                  <p className="font-comic text-xl text-gray-600">
                    Nenhum plano disponível no momento.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {plans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      onSelect={handlePlanSelect}
                      isSelected={selectedPlan?.id === plan.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

