import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/seo';

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || getBaseUrl();
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>WcashExplorer Updates</title>
    <description>W.cash scanner release notes and network updates.</description>
    <link>${siteUrl}/newsletter</link>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  </channel>
</rss>`;
  return new NextResponse(rss, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
