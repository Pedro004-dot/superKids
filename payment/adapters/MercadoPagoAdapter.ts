/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import type { PaymentAdapter } from './PaymentAdapter';
import type { CreatePaymentParams, PaymentResult, PaymentStatusResponse, WebhookResult, RefundResult } from '../types/payment.types';

/**
 * Adapter para Mercado Pago
 */
export class MercadoPagoAdapter implements PaymentAdapter {
  name = 'mercadopago';
  private publicKey: string;
  private isConfiguredFlag: boolean;

  constructor() {
    this.publicKey = (import.meta as any).env?.VITE_MERCADOPAGO_PUBLIC_KEY || '';
    this.isConfiguredFlag = !!this.publicKey;
  }

  isConfigured(): boolean {
    return this.isConfiguredFlag;
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        paymentId: '',
        error: 'Mercado Pago não está configurado. Configure VITE_MERCADOPAGO_PUBLIC_KEY'
      };
    }

    try {
      // NOTA: Em produção, isso deve ser feito no backend
      const response = await fetch('/api/payments/mercadopago/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: params.planId,
          amount: params.amount,
          credits: params.credits,
          userId: params.userId,
          method: params.method
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao criar pagamento');
      }

      const data = await response.json();
      
      return {
        success: true,
        paymentId: data.paymentId,
        externalPaymentId: data.externalPaymentId,
        checkoutUrl: data.checkoutUrl,
        qrCode: data.qrCode, // Para PIX via Mercado Pago
        expiresAt: data.expiresAt
      };
    } catch (error: any) {
      return {
        success: false,
        paymentId: '',
        error: error.message || 'Erro ao processar pagamento Mercado Pago'
      };
    }
  }

  async checkPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
    try {
      const response = await fetch(`/api/payments/mercadopago/status/${paymentId}`);
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
    return {
      success: false,
      paymentId: '',
      status: 'failed',
      error: 'Webhooks devem ser processados no backend'
    };
  }

  async refundPayment(paymentId: string, amount?: number): Promise<RefundResult> {
    try {
      const response = await fetch('/api/payments/mercadopago/refund', {
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

