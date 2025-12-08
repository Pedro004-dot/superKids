/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useState } from 'react';
import { paymentService } from '../PaymentService';
import { supabase } from '../../supabase';
import type { PaymentProvider, CreatePaymentParams, PaymentResult } from '../types/payment.types';
import type { User } from '@supabase/supabase-js';

export const usePayment = () => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPayment = async (
    planId: string,
    provider: PaymentProvider,
    user: User | null
  ): Promise<PaymentResult | null> => {
    if (!user) {
      setError('Usuário não autenticado');
      return null;
    }

    try {
      setProcessing(true);
      setError(null);

      // Buscar plano
      const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (planError || !plan) {
        throw new Error('Plano não encontrado');
      }

      // Criar pagamento via adapter
      const paymentParams: CreatePaymentParams = {
        planId: plan.id,
        userId: user.id,
        amount: parseFloat(plan.price),
        credits: plan.credits,
        provider,
        metadata: {
          planName: plan.name
        }
      };

      const result = await paymentService.createPayment(paymentParams);

      if (!result.success) {
        throw new Error(result.error || 'Erro ao criar pagamento');
      }

      // Salvar registro de compra no banco
      const { error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          user_id: user.id,
          plan_id: plan.id,
          credits_added: plan.credits,
          price_paid: parseFloat(plan.price),
          payment_provider: provider,
          payment_status: 'pending',
          external_payment_id: result.externalPaymentId,
          metadata: result
        });

      if (purchaseError) {
        console.error('Erro ao salvar compra:', purchaseError);
        // Não falhar o pagamento por causa disso
      }

      return result;
    } catch (err: any) {
      setError(err.message || 'Erro ao processar pagamento');
      return {
        success: false,
        paymentId: '',
        error: err.message
      };
    } finally {
      setProcessing(false);
    }
  };

  const checkPaymentStatus = async (
    provider: PaymentProvider,
    paymentId: string
  ) => {
    try {
      setProcessing(true);
      const status = await paymentService.checkPaymentStatus(provider, paymentId);
      
      // Se pagamento completado, atualizar créditos
      if (status.status === 'completed') {
        await updateCreditsAfterPayment(paymentId);
      }

      return status;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setProcessing(false);
    }
  };

  const updateCreditsAfterPayment = async (paymentId: string) => {
    try {
      // Buscar compra
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .select('*, subscription_plans(*)')
        .eq('external_payment_id', paymentId)
        .single();

      if (purchaseError || !purchase) {
        console.error('Compra não encontrada:', purchaseError);
        return;
      }

      // Verificar se já foi processado
      if (purchase.payment_status === 'completed') {
        return; // Já processado
      }

      // Atualizar status da compra
      await supabase
        .from('purchases')
        .update({ 
          payment_status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', purchase.id);

      // Atualizar créditos do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('credits, total_credits_purchased')
        .eq('id', purchase.user_id)
        .single();

      const newCredits = (profile?.credits || 0) + purchase.credits_added;
      const currentTotalPurchased = (profile?.total_credits_purchased as number) || 0;

      await supabase
        .from('profiles')
        .update({
          credits: newCredits,
          total_credits_purchased: currentTotalPurchased + purchase.credits_added,
          last_purchase_at: new Date().toISOString(),
          current_plan_id: purchase.plan_id
        })
        .eq('id', purchase.user_id);

    } catch (err) {
      console.error('Erro ao atualizar créditos:', err);
    }
  };

  return {
    createPayment,
    checkPaymentStatus,
    processing,
    error,
    clearError: () => setError(null)
  };
};

