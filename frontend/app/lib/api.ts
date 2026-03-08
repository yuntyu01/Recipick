// frontend/app/lib/api.ts

const BASE_URL = 'https://mfxiwq8mpg.execute-api.ap-northeast-2.amazonaws.com';

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
  step: string; // "1"
  timer_sec: string; // "1800"
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

  console.log('[API REQUEST]', {
    method: opts?.method ?? 'GET',
    url,
    body: opts?.body,
  });

  let res: Response;

  try {
    res = await fetch(url, {
      ...opts,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(opts?.headers ?? {}),
      },
    });
  } catch (error) {
    console.error('[API NETWORK ERROR]', error);
    throw new Error(
      '서버에 연결하지 못했어요. 주소가 틀렸거나 서버가 응답하지 않는 상태일 수 있어요.'
    );
  }

  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  console.log('[API RESPONSE]', {
    method: opts?.method ?? 'GET',
    url,
    status: res.status,
    ok: res.ok,
    data: json,
  });

  if (!res.ok) {
    const msg =
      (json && (json.detail || json.message || json.error)) ||
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
export async function getRecipe(
  videoId: string
): Promise<RecipeAnalyzeResponse> {
  return request<RecipeAnalyzeResponse>(
    `/api/recipes/${encodeURIComponent(videoId)}`,
    {
      method: 'GET',
    }
  );
}

/**
 * PROCESSING이면 폴링해서 COMPLETED/FAILED 될 때까지 기다림
 */
export async function waitRecipeCompleted(
  videoId: string,
  opts?: { intervalMs?: number; timeoutMs?: number }
): Promise<RecipeAnalyzeResponse> {
  const intervalMs = opts?.intervalMs ?? 1500;
  const timeoutMs = opts?.timeoutMs ?? 180000; // 3분
  const started = Date.now();

  while (true) {
    const result = await getRecipe(videoId);

    if (result.status === 'COMPLETED' || result.status === 'FAILED') {
      return result;
    }

    if (Date.now() - started > timeoutMs) {
      throw new Error('분석 시간이 너무 오래 걸려서 중단했어요. 잠시 후 다시 시도해줘.');
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}