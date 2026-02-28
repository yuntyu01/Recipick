// frontend/app/lib/youtube.ts

export type YoutubeMeta = {
  video_id: string;
  original_url: string;
  title: string;
  channel_name: string;
  thumbnail_url: string;
};

/** "00:07" → 7초로 */
export function timestampToSec(ts: string): number {
  const parts = ts.split(':').map((v) => Number(v));
  if (parts.some((n) => Number.isNaN(n))) return 0;

  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

/** 유튜브 URL에서 videoId 추출 (watch / youtu.be / shorts / embed 대응) */
export function extractYouTubeVideoId(inputUrl: string): string {
  const raw = (inputUrl || '').trim();
  if (!raw) return '';

  // 그냥 ID만 온 경우(11자)도 허용
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // scheme 없는 경우 보정
    try {
      url = new URL(`https://${raw}`);
    } catch {
      return '';
    }
  }

  const host = url.hostname.replace('www.', '');

  // youtu.be/{id}
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
  }

  // youtube.com/watch?v={id}
  const v = url.searchParams.get('v');
  if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

  // /shorts/{id}
  const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch?.[1]) return shortsMatch[1];

  // /embed/{id}
  const embedMatch = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch?.[1]) return embedMatch[1];

  return '';
}

/**
 * oEmbed로 제목/채널명 가져오기
 * - 유튜브 oEmbed는 channel 이름이 author_name에 들어옴
 */
export async function fetchYoutubeOEmbed(originalUrl: string): Promise<{ title: string; channel_name: string; thumbnail_url?: string }> {
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
 * 링크 하나 받아서:
 * - video_id 추출
 * - oEmbed로 title/channel_name 가져오기
 * - thumbnail_url은 oEmbed 우선, 없으면 img.youtube.com으로 생성
 */
export async function buildYoutubeMetaFromUrl(inputUrl: string): Promise<YoutubeMeta> {
  const original_url = (inputUrl || '').trim();
  const video_id = extractYouTubeVideoId(original_url);
  if (!video_id) throw new Error('유효한 유튜브 링크가 아니야 (video_id 추출 실패)');

  const { title, channel_name, thumbnail_url } = await fetchYoutubeOEmbed(original_url);

  return {
    video_id,
    original_url,
    title: title || '제목을 불러오지 못했어요',
    channel_name: channel_name || '채널명을 불러오지 못했어요',
    thumbnail_url: thumbnail_url || `https://img.youtube.com/vi/${video_id}/hqdefault.jpg`,
  };
}