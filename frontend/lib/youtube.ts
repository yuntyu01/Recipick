// frontend/app/lib/youtube.ts

export type YoutubeMeta = {
  video_id: string;
  original_url: string;
  title: string;
  channel_name: string;
  thumbnail_url: string;
};

/** "00:07" → 7초 */
export function timestampToSec(ts: string): number {
  const parts = ts.split(':').map((v) => Number(v));
  if (parts.some((n) => Number.isNaN(n))) return 0;

  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

/** 유튜브 URL에서 videoId 추출 */
export function extractYouTubeVideoId(inputUrl: string): string {
  const raw = (inputUrl || '').trim();
  if (!raw) return '';

  // ID만 들어온 경우
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    try {
      url = new URL(`https://${raw}`);
    } catch {
      return '';
    }
  }

  const host = url.hostname.replace('www.', '');

  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
  }

  const v = url.searchParams.get('v');
  if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

  const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch?.[1]) return shortsMatch[1];

  const embedMatch = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch?.[1]) return embedMatch[1];

  return '';
}

/** oEmbed로 제목/채널명 가져오기 */
export async function fetchYoutubeOEmbed(
  originalUrl: string
): Promise<{ title: string; channel_name: string; thumbnail_url?: string }> {
  const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(originalUrl)}&format=json`;

  const res = await fetch(oembed);
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`oEmbed 실패: HTTP ${res.status}`);
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('oEmbed 응답 파싱 실패');
  }

  return {
    title: String(json?.title ?? ''),
    channel_name: String(json?.author_name ?? ''),
    thumbnail_url: json?.thumbnail_url ? String(json.thumbnail_url) : undefined,
  };
}

/**
 * 링크 하나 받아서
 * - video_id 추출
 * - oEmbed로 title/channel_name 가져오기
 * - 실패해도 기본값으로 진행
 */
export async function buildYoutubeMetaFromUrl(inputUrl: string): Promise<YoutubeMeta> {
  const original_url = (inputUrl || '').trim();
  const video_id = extractYouTubeVideoId(original_url);

  if (!video_id) {
    throw new Error('유효한 유튜브 링크가 아니야.');
  }

  let title = '유튜브 레시피';
  let channel_name = 'YouTube';
  let thumbnail_url = `https://img.youtube.com/vi/${video_id}/hqdefault.jpg`;

  try {
    const oembed = await fetchYoutubeOEmbed(original_url);
    title = oembed.title || title;
    channel_name = oembed.channel_name || channel_name;
    thumbnail_url = oembed.thumbnail_url || thumbnail_url;
  } catch (e) {
    console.log('oEmbed 실패, 기본값으로 진행');
  }

  return {
    video_id,
    original_url,
    title,
    channel_name,
    thumbnail_url,
  };
}