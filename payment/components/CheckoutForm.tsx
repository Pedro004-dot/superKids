/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import type { PaymentProvider } from '../types/payment.types';
import { paymentService } from '../PaymentService';

interface CheckoutFormProps {
  planId: string;
  amount: number;
  credits: number;
  onSuccess: (result: any) => void;
  onCancel: () => void;
}

export const CheckoutForm: React.FC<CheckoutFormProps> = ({
  planId,
  amount,
  credits,
  onSuccess,
  onCancel
}) => {
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableProviders = paymentService.getAvailableProviders();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProvider) {
      setError('Selecione um método de pagamento');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Em produção, isso seria feito via hook usePayment
      // Por enquanto, apenas estrutura básica
      onSuccess({
        provider: selectedProvider,
        planId,
        amount,
        credits
      });
    } catch (err: any) {
      setError(err.message || 'Erro ao processar pagamento');
    } finally {
      setProcessing(false);
    }
  };

  if (availableProviders.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600 font-comic text-lg">
          Nenhum provedor de pagamento configurado.
        </p>
        <p className="text-gray-600 text-sm mt-2">
          Configure as variáveis de ambiente para habilitar pagamentos.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="font-comic text-2xl text-black mb-4">Resumo</h3>
        <div className="bg-gray-100 p-4 border-2 border-black">
          <div className="flex justify-between mb-2">
            <span className="font-comic text-lg">Créditos:</span>
            <span className="font-bold">{credits}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-comic text-lg">Total:</span>
            <span className="font-bold text-2xl">{formatPrice(amount)}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-comic text-2xl text-black mb-4">Método de Pagamento</h3>
        <div className="space-y-3">
          {availableProviders.map((provider) => (
            <label
              key={provider}
              className={`flex items-center p-4 border-4 border-black cursor-pointer transition-all ${
                selectedProvider === provider
                  ? 'bg-yellow-100'
                  : 'bg-white hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="provider"
                value={provider}
                checked={selectedProvider === provider}
                onChange={() => setSelectedProvider(provider)}
                className="mr-3 w-5 h-5"
              />
              <span className="font-comic text-xl capitalize">{provider}</span>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border-4 border-red-600 p-4">
          <p className="text-red-800 font-comic">{error}</p>
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 border-4 border-black bg-gray-300 text-black font-comic text-xl uppercase hover:bg-gray-400"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={processing || !selectedProvider}
          className="flex-1 py-3 border-4 border-black bg-green-600 text-white font-comic text-xl uppercase hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? 'Processando...' : 'Finalizar Pagamento'}
        </button>
      </div>
    </form>
  );
};

