// api.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper: current user (cached on window)
window.sqGetCurrentUser = async function sqGetCurrentUser() {
  if (window._sqUser) return window._sqUser;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  window._sqUser = data.user;
  return data.user;
};

// Auth

export async function signup(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  return { user: data.user };
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) return { error: error.message };
  window._sqUser = data.user;
  return { user: data.user };
}

export async function logout() {
  await supabase.auth.signOut();
  window._sqUser = null;
}

// Providers & services

export async function listProviders({ search = '', category = '' } = {}) {
  let query = supabase
    .from('providers')
    .select(
      'id, business_name, address, phone, category, capacity, is_open, current_wait_mins, people_in_line'
    )
    .order('current_wait_mins', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }

  if (search) {
    query = query.or(
      `business_name.ilike.%${search}%,address.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error('listProviders error', error);
    return [];
  }
  return data || [];
}

export async function getProviderServices(providerId) {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, duration')
    .eq('provider_id', providerId)
    .order('name', { ascending: true });

  if (error) {
    console.error('getProviderServices error', error);
    return [];
  }
  return data || [];
}

export async function getProviderProfile(providerId) {
  const { data, error } = await supabase
    .from('providers')
    .select(
      'id, business_name, address, phone, category, capacity, is_open, current_wait_mins, people_in_line'
    )
    .eq('id', providerId)
    .maybeSingle();

  if (error) {
    console.error('getProviderProfile error', error);
    return null;
  }
  return data;
}

// Queue logic

export function computeEtaMinutes(position, serviceDuration) {
  const pos = Number(position) || 0;
  const dur = Number(serviceDuration) || 15;
  return Math.max(0, pos * dur);
}

export async function joinQueue(payload) {
  const {
    user_id,
    provider_id,
    customer_name,
    customer_phone,
    selected_service,
    service_duration
  } = payload;

  // Optional: compute estimated_time client-side
  const now = new Date();
  const estimated_time = new Date(
    now.getTime() + service_duration * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from('queues')
    .insert({
      user_id,
      provider_id,
      business_name: payload.business_name || null,
      customer_name,
      customer_phone,
      selected_service,
      service_duration,
      status: 'waiting',
      estimated_time
    })
    .select()
    .single();

  if (error) {
    console.error('joinQueue error', error);
    return { error: 'Unable to join queue. Please try again.' };
  }

  return { queue: data };
}

export async function getMyQueues(userId) {
  // You can later replace this with a view that includes position_in_queue
  const { data, error } = await supabase
    .from('queues')
    .select(
      'id, provider_id, business_name, customer_name, selected_service, service_duration, status, joined_at, estimated_time'
    )
    .eq('user_id', userId)
    .in('status', ['waiting', 'serving'])
    .order('joined_at', { ascending: true });

  if (error) {
    console.error('getMyQueues error', error);
    return [];
  }

  // naive position based on order
  return (data || []).map((q, index) => ({
    ...q,
    position_in_queue: index + 1
  }));
}

export async function getProviderQueue(providerId) {
  const { data, error } = await supabase
    .from('queues')
    .select(
      'id, user_id, provider_id, customer_name, customer_phone, selected_service, service_duration, status, joined_at'
    )
    .eq('provider_id', providerId)
    .in('status', ['waiting', 'serving'])
    .order('joined_at', { ascending: true });

  if (error) {
    console.error('getProviderQueue error', error);
    return [];
  }
  return data || [];
}

export async function updateQueueStatus(queueId, status) {
  const now = new Date().toISOString();
  let patch = { status };

  if (status === 'serving') {
    patch.served_at = now;
  } else if (status === 'completed') {
    patch.completed_at = now;
    patch.completed_date = now.slice(0, 10);
  }

  const { error } = await supabase
    .from('queues')
    .update(patch)
    .eq('id', queueId);

  if (error) {
    console.error('updateQueueStatus error', error);
    return { error: error.message };
  }
  return {};
}

// Provider signup

export async function providerSignup(payload) {
  const {
    email,
    password,
    business_name,
    category,
    address,
    phone,
    capacity
  } = payload;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password
  });

  if (authError) {
    console.error('providerSignup authError', authError);
    return { error: authError.message || 'Unable to create account.' };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return { error: 'Unable to create account. No user ID returned.' };
  }

  const { error: providerError } = await supabase.from('providers').insert({
    id: userId,
    business_name,
    category,
    address,
    phone,
    capacity: Number(capacity) || 1,
    is_open: true,
    current_wait_mins: 0,
    people_in_line: 0
  });

  if (providerError) {
    console.error('providerSignup providerError', providerError);
    return { error: 'Account created, but failed to save business details.' };
  }

  return { userId };
}

// Landing stats

export async function getLandingStats() {
  const { data, error } = await supabase
    .from('providers')
    .select('id, people_in_line')
    .eq('is_open', true);

  if (error) {
    console.error('getLandingStats error', error);
    return { liveProviders: 0, peopleInLine: 0 };
  }

  const liveProviders = data.length;
  const peopleInLine = data.reduce(
    (sum, p) => sum + (p.people_in_line || 0),
    0
  );

  return { liveProviders, peopleInLine };
}
