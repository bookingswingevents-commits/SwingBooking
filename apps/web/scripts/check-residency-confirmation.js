#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing env NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run() {
  const clientId = randomUUID();
  const residencyId = randomUUID();
  const weekId = randomUUID();
  const artistA = randomUUID();
  const artistB = randomUUID();

  try {
    const insClient = await supabase.from('clients').insert({ id: clientId, name: 'Test Client' });
    if (insClient.error) throw insClient.error;
    const insResidency = await supabase.from('residencies').insert({
      id: residencyId,
      client_id: clientId,
      name: 'Test Residency',
      start_date: '2025-01-05',
      end_date: '2025-01-12',
      lodging_included: true,
      meals_included: true,
      companion_included: true,
    });
    if (insResidency.error) throw insResidency.error;
    const insWeek = await supabase.from('residency_weeks').insert({
      id: weekId,
      residency_id: residencyId,
      start_date_sun: '2025-01-05',
      end_date_sun: '2025-01-12',
      type: 'CALM',
      performances_count: 2,
      fee_cents: 15000,
      status: 'OPEN',
    });
    if (insWeek.error) throw insWeek.error;
    const insProfiles = await supabase.from('profiles').insert([
      { id: artistA, full_name: 'Artist A', email: 'artistA@test.local', role: 'artist' },
      { id: artistB, full_name: 'Artist B', email: 'artistB@test.local', role: 'artist' },
    ]);
    if (insProfiles.error) throw insProfiles.error;
    const insArtists = await supabase.from('artists').insert([
      { id: artistA, stage_name: 'Artist A', is_active: true },
      { id: artistB, stage_name: 'Artist B', is_active: true },
    ]);
    if (insArtists.error) throw insArtists.error;
    const insApps = await supabase.from('week_applications').insert([
      { residency_week_id: weekId, artist_id: artistA, status: 'APPLIED' },
      { residency_week_id: weekId, artist_id: artistB, status: 'APPLIED' },
    ]);
    if (insApps.error) throw insApps.error;

    const first = await supabase.rpc('confirm_residency_week', {
      p_week_id: weekId,
      p_artist_id: artistA,
    });
    if (first.error) throw first.error;

    const second = await supabase.rpc('confirm_residency_week', {
      p_week_id: weekId,
      p_artist_id: artistB,
    });
    if (!second.error) {
      throw new Error('Expected second confirmation to fail, but it succeeded.');
    }

    console.log('Confirmation atomicity OK');
  } finally {
    await supabase.from('week_applications').delete().eq('residency_week_id', weekId);
    await supabase.from('week_bookings').delete().eq('residency_week_id', weekId);
    await supabase.from('residency_weeks').delete().eq('id', weekId);
    await supabase.from('residencies').delete().eq('id', residencyId);
    await supabase.from('clients').delete().eq('id', clientId);
    await supabase.from('artists').delete().in('id', [artistA, artistB]);
    await supabase.from('profiles').delete().in('id', [artistA, artistB]);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
