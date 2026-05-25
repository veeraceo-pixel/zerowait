// api.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

// FIX: Supabase credentials are read from the globally-loaded supabase-config.js
// (which defines SUPABASE_URL and SUPABASE_ANON_KEY) so that credentials live in
// exactly one place and can be updated without touching this file.
// supabase-config.js must be loaded via <script> before this module is imported.
if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') {
  throw new Error('[skipQs] supabase-config.js must be loaded before api.js');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper: current user (cached; exported AND placed on window for non-module pages)
export async function sqGetCurrentUser() {
  if (window._sqUser) return window._sqUser;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) { window._sqUser = null; return null; }
  window._sqUser = data.user;
  return data.user;
}
// Also expose on window so pages that load api.js as a classic script can call it
window.sqGetCurrentUser = sqGetCurrentUser;

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

/**
 * computeEtaMinutes
 * @param {number} position       – 1-based position in queue
 * @param {number} serviceDuration – minutes per customer for this department
 * @param {number} capacity        – how many customers the counter serves simultaneously (default 1)
 * @returns {number} estimated wait in minutes
 */
export function computeEtaMinutes(position, serviceDuration, capacity = 1) {
  const pos = Math.max(0, Number(position) || 0);
  const dur = Math.max(1, Number(serviceDuration) || 15);
  const cap = Math.max(1, Number(capacity) || 1);
  // With capacity > 1, multiple slots run in parallel:
  // effective positions = ceil(pos / cap), then multiply by duration
  const effectiveSlot = Math.ceil(pos / cap);
  return Math.max(0, effectiveSlot * dur);
}

export async function joinQueue(payload) {
  const {
    user_id,
    provider_id,
    department_id,
    customer_name,
    customer_phone,
    selected_service,
    service_duration
  } = payload;

  // Guard: prevent duplicate active entries for the same user+provider+department
  if (user_id) {
    let dupQ = supabase
      .from('queues')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('provider_id', provider_id)
      .in('status', ['waiting', 'serving']);
    if (department_id) dupQ = dupQ.eq('department_id', department_id);
    const { count } = await dupQ;
    if (count > 0) {
      return { error: 'already_in_queue' };
    }
  }

  // Compute estimated_time client-side based on current queue length
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
  // Fetch the user's active queue entries
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

  const myQueues = data || [];

  // FIX: Compute accurate position by counting all earlier entries in the same
  // provider queue, not just the user's own entries sorted arbitrarily.
  // We batch a single query per unique provider to avoid N+1 requests.
  const providerIds = [...new Set(myQueues.map((q) => q.provider_id))];

  // For each provider, count how many entries joined before each of ours
  const positionMap = {};

  await Promise.all(
    providerIds.map(async (pid) => {
      const { data: ahead, error: posErr } = await supabase
        .from('queues')
        .select('id, joined_at, provider_id')
        .eq('provider_id', pid)
        .in('status', ['waiting', 'serving'])
        .order('joined_at', { ascending: true });

      if (posErr || !ahead) return;

      // Map each queue entry id → its 1-based position within this provider's queue
      ahead.forEach((entry, index) => {
        positionMap[entry.id] = index + 1;
      });
    })
  );

  return myQueues.map((q) => ({
    ...q,
    position_in_queue: positionMap[q.id] ?? null
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
  } else if (status === 'cancelled') {
    patch.completed_at = now;
    // Position recalculation for sibling entries is handled by the DB trigger
    // trg_recalculate_positions (see queue-recalc.sql). No extra client call needed.
  } else if (status === 'no_show') {
    patch.completed_at = now;
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
