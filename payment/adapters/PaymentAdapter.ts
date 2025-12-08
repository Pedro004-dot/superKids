/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import type { 
  CreatePaymentParams, 
  PaymentResult, 
  PaymentStatus, 
  WebhookResult, 
  RefundResult 
} from '../types/payment.types';

/**
 * Interface base para adapters de pagamento
 * Permite trocar provedores sem mudar o código principal
 */
export interface PaymentAdapter {
  /** Nome do provedor */
  name: string;
  
  /** Criar um novo pagamento */
  createPayment(params: CreatePaymentParams): Promise<PaymentResult>;
  
  /** Verificar status de um pagamento */
  checkPaymentStatus(paymentId: string): Promise<import('../types/payment.types').PaymentStatusResponse>;
  
  /** Processar webhook do provedor */
  handleWebhook(payload: any): Promise<WebhookResult>;
  
  /** Cancelar/Reembolsar um pagamento */
  refundPayment(paymentId: string, amount?: number): Promise<RefundResult>;
  
  /** Verificar se o adapter está configurado */
  isConfigured(): boolean;
}

