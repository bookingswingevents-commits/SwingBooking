import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const request_id = searchParams.get('request_id');
    if (!request_id) {
      return NextResponse.json({ ok: false, error: 'request_id manquant' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: 'Variables Supabase manquantes' }, { status: 500 });
    }
    const rest = async (path: string, init?: RequestInit) => {
      const res = await fetch(`${supabaseUrl}/rest/v1${path}`, {
        ...init,
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
          ...(init?.headers || {}),
        },
        cache: 'no-store',
      });
      const json = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, json };
    };

    // Récup demande + prop + artiste
    const rq = await rest(`/booking_requests?id=eq.${encodeURIComponent(request_id)}`);
    const requestRow = Array.isArray(rq.json) ? rq.json[0] : null;
    if (!requestRow) return NextResponse.json({ ok:false, error:'Request not found' }, { status:404 });

    const pr = await rest(
      `/proposals?select=id,artist_id,status&request_id=eq.${encodeURIComponent(request_id)}&order=created_at.desc&limit=1`
    );
    const proposal = Array.isArray(pr.json) ? pr.json[0] : null;
    if (!proposal) return NextResponse.json({ ok:false, error:'Proposal not found' }, { status:404 });

    // Générer 2 feuilles simples (client / artiste) dans `itineraries`
    const payload = {
      request_id,
      proposal_id: proposal.id,
      title: `Feuille de route – ${requestRow.title}`,
      data_json: {
        event_date: requestRow.event_date,
        start_time: requestRow.start_time,
        duration_minutes: requestRow.duration_minutes,
        venue_address: requestRow.venue_address,
      },
    };

    await rest('/itineraries', { method: 'POST', body: JSON.stringify([
      { ...payload, target: 'client' },
      { ...payload, target: 'artist' },
    ])});

    // Enqueue 2 mails
    await rest('/mail_queue', { method: 'POST', body: JSON.stringify([
      { template: 'roadmap_client', payload_json: { request_id, proposal_id: proposal.id } },
      { template: 'roadmap_artist', payload_json: { request_id, proposal_id: proposal.id } },
    ]) });

    // Optionnel : passer la demande à "confirmed"
    await rest(`/booking_requests?id=eq.${request_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'confirmed' }),
    });
    await rest('/request_status_history', {
      method: 'POST',
      body: JSON.stringify({ request_id, status: 'confirmed', note: 'Roadmaps envoyées' }),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Erreur serveur' }, { status: 500 });
  }
}
