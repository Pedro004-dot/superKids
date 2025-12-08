/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import type { PaymentAdapter } from './PaymentAdapter';
import type { CreatePaymentParams, PaymentResult, PaymentStatus, WebhookResult, RefundResult } from '../types/payment.types';

/**
 * Adapter para Stripe
 * Implementação básica - requer integração com backend para segurança
 */
export class StripeAdapter implements PaymentAdapter {
  name = 'stripe';
  private publishableKey: string;
  private isConfiguredFlag: boolean;

  constructor() {
    this.publishableKey = (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY || '';
    this.isConfiguredFlag = !!this.publishableKey;
  }

  isConfigured(): boolean {
    return this.isConfiguredFlag;
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        paymentId: '',
        error: 'Stripe não está configurado. Configure VITE_STRIPE_PUBLISHABLE_KEY'
      };
    }

    try {
      // NOTA: Em produção, isso deve ser feito no backend por segurança
      // O frontend não deve ter a secret key do Stripe
      // Esta é uma implementação básica que requer um endpoint backend
      
      // Por enquanto, retornar estrutura básica
      // Em produção, fazer chamada para seu backend que processa o pagamento
      const response = await fetch('/api/payments/stripe/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: params.planId,
          amount: params.amount,
          credits: params.credits,
          userId: params.userId
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao criar pagamento');
      }

      const data = await response.json();
      
      return {
        success: true,
        paymentId: data.paymentId,
        externalPaymentId: data.clientSecret,
        checkoutUrl: data.checkoutUrl,
        expiresAt: data.expiresAt
      };
    } catch (error: any) {
      return {
        success: false,
        paymentId: '',
        error: error.message || 'Erro ao processar pagamento Stripe'
      };
    }
  }

  async checkPaymentStatus(paymentId: string): Promise<import('../types/payment.types').PaymentStatusResponse> {
    try {
      const response = await fetch(`/api/payments/stripe/status/${paymentId}`);
      const data = await response.json();
      
      return {
        status: data.status as 'pending' | 'completed' | 'failed' | 'refunded',
        externalPaymentId: data.externalPaymentId,
        metadata: data.metadata
      };
    } catch (error: any) {
      return {
        status: 'failed',
        externalPaymentId: paymentId,
        metadata: { error: error.message }
      };
    }
  }

  async handleWebhook(payload: any): Promise<WebhookResult> {
    // Webhooks devem ser processados no backend
    // Esta função é apenas para tipagem
      return {
        success: false,
        paymentId: '',
        status: 'failed' as 'pending' | 'completed' | 'failed' | 'refunded',
        error: 'Webhooks devem ser processados no backend'
      };
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    try {
      const response = await fetch('/api/payments/stripe/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, amount })
      });

      const data = await response.json();
      
      return {
        success: data.success || false,
        refundId: data.refundId,
        error: data.error
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

