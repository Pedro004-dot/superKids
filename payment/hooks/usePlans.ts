/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import type { SubscriptionPlan } from '../../types';

export const usePlans = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (fetchError) throw fetchError;

      const formattedPlans: SubscriptionPlan[] = (data || []).map(plan => ({
        id: plan.id,
        name: plan.name,
        price: parseFloat(plan.price),
        credits: plan.credits,
        features: plan.features || [],
        isActive: plan.is_active
      }));

      setPlans(formattedPlans);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar planos');
      console.error('Erro ao carregar planos:', err);
    } finally {
      setLoading(false);
    }
  };

  return { plans, loading, error, refetch: loadPlans };
};

