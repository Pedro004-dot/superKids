/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import type { PaymentAdapter } from './PaymentAdapter';
import type { CreatePaymentParams, PaymentResult, PaymentStatusResponse, WebhookResult, RefundResult } from '../types/payment.types';

/**
 * Adapter para PIX direto
 * Pode usar API de banco ou serviço de pagamento
 */
export class PixAdapter implements PaymentAdapter {
  name = 'pix';
  private apiKey: string;
  private isConfiguredFlag: boolean;

  constructor() {
    this.apiKey = (import.meta as any).env?.VITE_PIX_API_KEY || '';
    this.isConfiguredFlag = !!this.apiKey;
  }

  isConfigured(): boolean {
    return this.isConfiguredFlag;
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        paymentId: '',
        error: 'PIX não está configurado. Configure VITE_PIX_API_KEY'
      };
    }

    try {
      // NOTA: Em produção, isso deve ser feito no backend
      const response = await fetch('/api/payments/pix/create', {
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
        throw new Error('Erro ao criar pagamento PIX');
      }

      const data = await response.json();
      
      return {
        success: true,
        paymentId: data.paymentId,
        externalPaymentId: data.externalPaymentId,
        qrCode: data.qrCode, // QR Code para pagamento
        checkoutUrl: data.checkoutUrl,
        expiresAt: data.expiresAt // PIX geralmente expira em 30 minutos
      };
    } catch (error: any) {
      return {
        success: false,
        paymentId: '',
        error: error.message || 'Erro ao processar pagamento PIX'
      };
    }
  }

  async checkPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
    try {
      const response = await fetch(`/api/payments/pix/status/${paymentId}`);
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
      const response = await fetch('/api/payments/pix/refund', {
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

