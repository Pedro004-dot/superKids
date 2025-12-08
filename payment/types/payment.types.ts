/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export type PaymentProvider = 'stripe' | 'mercadopago' | 'pix';
export type PaymentMethod = 'credit_card' | 'debit_card' | 'pix' | 'boleto';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface CreatePaymentParams {
  planId: string;
  userId: string;
  amount: number;
  credits: number;
  provider: PaymentProvider;
  method?: PaymentMethod;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  externalPaymentId?: string;
  checkoutUrl?: string; // Para PIX, boleto, etc
  qrCode?: string; // Para PIX
  expiresAt?: string;
  error?: string;
}

export interface PaymentStatusResponse {
  status: PaymentStatus;
  externalPaymentId: string;
  metadata?: Record<string, any>;
}

export interface WebhookResult {
  success: boolean;
  paymentId: string;
  status: PaymentStatus;
  creditsToAdd?: number;
  error?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

