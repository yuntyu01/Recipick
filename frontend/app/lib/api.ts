// frontend/app/lib/api.ts

const AWS_BASE_URL = 'https://mfxiwq8mpg.execute-api.ap-northeast-2.amazonaws.com';

// ✅ 너 PC IP (아이폰 Expo Go에서 로컬 백엔드 붙이려면 이게 필요)
const LAN_IP = '192.168.0.13';
const LOCAL_BASE_URL = `http://${LAN_IP}:8000`;

// ✅ 개발 모드면 로컬로, 아니면 AWS로
export const BASE_URL = __DEV__ ? LOCAL_BASE_URL : AWS_BASE_URL;

export type RecipeStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type RecipeAnalyzeRequest = {
  video_id: string;
  original_url: string;
  sharer_nickname: string;
  title: string;
  channel_name: string;
};

export type RecipeStep = {
  video_timestamp: string; // "00:07"
  step: string;            // "1"
  timer_sec: string;       // "1800"
  desc: string;
};

export type RecipeIngredientAlt = {
  name: string;
  estimated_price: string;
  amount: string;
};

export type RecipeIngredient = {
  name: string;
  estimated_price: string;
  amount: string;
  alternatives: RecipeIngredientAlt[];
};

export type NutritionDetails = {
  sodium_mg: string;
  fat_g: string;
  sugar_g: string;
  carbs_g: string;
  protein_g: string;
};

export type RecipeData = {
  PK: string;
  SK: 'INFO';
  status: RecipeStatus;

  video_id: string;
  original_url: string;
  title: string;
  channel_name: string;
  thumbnail_url: string;

  category: string;
  difficulty: string;
  servings: string;
  total_estimated_price: string;
  total_calorie: string;

  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  nutrition_details: NutritionDetails;

  sharer_nickname: string;
  created_at: string;

  like_count: string;
  comment_count: string;
  share_count: string;
};

export type RecipeAnalyzeResponse = {
  status: RecipeStatus;
  video_id: string;
  thumbnail_url: string;
  title: string;
  channel_name: string;
  data: RecipeData | null;
};

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts?.headers ?? {}),
    },
  });

  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // 서버가 text로만 주는 경우 대비
    json = text as any;
  }

  if (!res.ok) {
    const msg =
      (json && (json.detail || json.message)) ||
      `HTTP ${res.status} ${res.statusText}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  return json as T;
}

/** 레시피 분석 요청 (POST /api/recipes/) */
export async function analyzeRecipe(
  body: RecipeAnalyzeRequest
): Promise<RecipeAnalyzeResponse> {
  return request<RecipeAnalyzeResponse>('/api/recipes/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 레시피 조회 (GET /api/recipes/{video_id}) */
export async function getRecipe(videoId: string): Promise<RecipeAnalyzeResponse> {
  return request<RecipeAnalyzeResponse>(
    `/api/recipes/${encodeURIComponent(videoId)}`,
    { method: 'GET' }
  );
}

/**
 * PROCESSING이면 폴링해서 COMPLETED/FAILED로 만들어줌
 * - intervalMs: 몇 ms마다 확인할지
 * - timeoutMs: 몇 ms 지나면 타임아웃
 */
export async function waitRecipeCompleted(
  videoId: string,
  opts?: { intervalMs?: number; timeoutMs?: number }
): Promise<RecipeAnalyzeResponse> {
  const intervalMs = opts?.intervalMs ?? 1500;
  const timeoutMs = opts?.timeoutMs ?? 60_000; // 1분 기본
  const started = Date.now();

  while (true) {
    const r = await getRecipe(videoId);
    if (r.status === 'COMPLETED' || r.status === 'FAILED') return r;

    if (Date.now() - started > timeoutMs) {
      throw new Error('분석 시간이 너무 오래 걸려서 중단했어요. 잠시 후 다시 시도해줘.');
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}