import { NextResponse } from 'next/server';

/**
 * Route serveur oEmbed pour Instagram.
 * 
 * Permet d'afficher automatiquement un post ou reel Instagram dans les pages client/proposition.
 * Nécessite la variable d'env INSTAGRAM_OEMBED_TOKEN = {app-id}|{app-secret} ou un user token.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    if (!url) return NextResponse.json({ html: '' }, { status: 400 });

    const token = process.env.INSTAGRAM_OEMBED_TOKEN;
    if (!token) {
      console.warn('INSTAGRAM_OEMBED_TOKEN manquant');
      return NextResponse.json({ html: '' });
    }

    // Instagram n’accepte que les URL de médias (posts, reels, tv)
    if (!/(\/(p|reel|tv)\/)/i.test(url)) {
      return NextResponse.json({ html: '' });
    }

    const endpoint = `https://graph.facebook.com/v18.0/instagram_oembed?omitscript=true&url=${encodeURIComponent(
      url
    )}&access_token=${encodeURIComponent(token)}`;

    const res = await fetch(endpoint);
    if (!res.ok) {
      console.error('Erreur oEmbed IG:', res.status, res.statusText);
      return NextResponse.json({ html: '' });
    }

    const data = await res.json();
    return NextResponse.json({ html: data?.html || '' });
  } catch (e) {
    console.error('Erreur route Instagram oEmbed', e);
    return NextResponse.json({ html: '' });
  }
}
