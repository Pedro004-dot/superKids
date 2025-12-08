/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

interface PaymentButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export const PaymentButton: React.FC<PaymentButtonProps> = ({ 
  onClick, 
  disabled = false,
  className = '' 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`comic-btn bg-green-600 text-white px-8 py-3 hover:bg-green-500 text-xl uppercase disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      Comprar Créditos
    </button>
  );
};

