/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import type { PaymentAdapter } from './adapters/PaymentAdapter';
import type { PaymentProvider, CreatePaymentParams, PaymentResult } from './types/payment.types';
import { StripeAdapter } from './adapters/StripeAdapter';
import { MercadoPagoAdapter } from './adapters/MercadoPagoAdapter';
import { PixAdapter } from './adapters/PixAdapter';

/**
 * Factory pattern para gerenciar adapters de pagamento
 * Permite trocar provedores facilmente
 */
export class PaymentService {
  private adapters: Map<PaymentProvider, PaymentAdapter>;

  constructor() {
    this.adapters = new Map();
    this.initializeAdapters();
  }

  private initializeAdapters() {
    const stripe = new StripeAdapter();
    const mercadoPago = new MercadoPagoAdapter();
    const pix = new PixAdapter();

    if (stripe.isConfigured()) {
      this.adapters.set('stripe', stripe);
    }
    if (mercadoPago.isConfigured()) {
      this.adapters.set('mercadopago', mercadoPago);
    }
    if (pix.isConfigured()) {
      this.adapters.set('pix', pix);
    }
  }

  /**
   * Obter adapter para um provedor específico
   */
  getAdapter(provider: PaymentProvider): PaymentAdapter | null {
    return this.adapters.get(provider) || null;
  }

  /**
   * Listar provedores disponíveis (configurados)
   */
  getAvailableProviders(): PaymentProvider[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Criar pagamento usando o adapter apropriado
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const adapter = this.getAdapter(params.provider);
    
    if (!adapter) {
      return {
        success: false,
        paymentId: '',
        error: `Provedor ${params.provider} não está configurado ou disponível`
      };
    }

    return adapter.createPayment(params);
  }

  /**
   * Verificar status de pagamento
   */
  async checkPaymentStatus(provider: PaymentProvider, paymentId: string) {
    const adapter = this.getAdapter(provider);
    
    if (!adapter) {
      throw new Error(`Provedor ${provider} não está disponível`);
    }

    return adapter.checkPaymentStatus(paymentId);
  }

  /**
   * Processar webhook
   */
  async handleWebhook(provider: PaymentProvider, payload: any) {
    const adapter = this.getAdapter(provider);
    
    if (!adapter) {
      throw new Error(`Provedor ${provider} não está disponível`);
    }

    return adapter.handleWebhook(payload);
  }

  /**
   * Reembolsar pagamento
   */
  async refundPayment(provider: PaymentProvider, paymentId: string, amount?: number) {
    const adapter = this.getAdapter(provider);
    
    if (!adapter) {
      throw new Error(`Provedor ${provider} não está disponível`);
    }

    return adapter.refundPayment(paymentId, amount);
  }
}

// Singleton instance
export const paymentService = new PaymentService();

