// frontend/app/lib/api.ts

import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://mfxiwq8mpg.execute-api.ap-northeast-2.amazonaws.com';

/* =========================
 * 공통 타입
 * ========================= */

export type RecipeStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type RecipeCategory =
  | '한식'
  | '중식'
  | '일식'
  | '양식'
  | '분식'
  | '디저트';

export type NutritionDetails = {
  sodium_mg: string;
  fat_g: string;
  sugar_g: string;
  carbs_g: string;
  protein_g: string;
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

export type RecipeStep = {
  video_timestamp: string;
  step: string;
  timer_sec: string;
  desc: string;
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

/* =========================
 * auth/me
 * ========================= */

export type MeResponse = {
  user_id: string;
  id?: string;
  nickname?: string;
  name?: string;
  email?: string;
  profile_image_url?: string;
};

/* =========================
 * 레시피 분석 / 상세
 * ========================= */

export type RecipeAnalyzeRequest = {
  video_id: string;
  original_url: string;
  sharer_nickname: string;
  title: string;
  channel_name: string;
};

export type RecipeAnalyzeResponse = {
  status: RecipeStatus;
  video_id: string;
  thumbnail_url: string;
  title: string;
  channel_name: string;
  data: RecipeData | null;
};

/* =========================
 * 추천 영상
 * ========================= */

export type RecommendationItem = {
  video_id: string;
  title: string;
  channel_name: string;
  thumbnail_url: string;
  url: string;
  category: string;
};

export type RecommendationResponse =
  | RecommendationItem[]
  | {
    items?: RecommendationItem[];
    data?: RecommendationItem[];
    recommendations?: RecommendationItem[];
    result?: RecommendationItem[];
  };

/* =========================
 * 사용자 히스토리
 * ========================= */

export type UserHistoryRecipeData = {
  steps?: RecipeStep[];
  ingredients?: RecipeIngredient[];
  nutrition_details?: NutritionDetails;
};

export type UserHistoryCreateRequest = {
  video_id: string;
  recipe_title: string;
  thumbnail_url?: string;
  original_url?: string;
  url?: string;

  channel_name?: string;
  category?: string;
  difficulty?: string;
  servings?: string | number;
  total_estimated_price?: string | number;
  total_calorie?: string | number;

  like_count?: string | number;
  comment_count?: string | number;
  share_count?: string | number;

  status?: RecipeStatus | string;
  saved_at?: string;

  recipe_data?: UserHistoryRecipeData;
};

export type UserHistoryItem = {
  video_id: string;

  recipe_title?: string;
  title?: string;
  thumbnail_url?: string;
  original_url?: string;
  url?: string;

  channel_name?: string;
  category?: string;
  difficulty?: string;
  servings?: string | number;
  total_estimated_price?: string | number;
  total_calorie?: string | number;

  like_count?: string | number;
  comment_count?: string | number;
  share_count?: string | number;

  status?: RecipeStatus | string;
  saved_at?: string;
  created_at?: string;

  recipe_data?: UserHistoryRecipeData;
};

export type UserHistoryResponse =
  | UserHistoryItem[]
  | {
    items?: UserHistoryItem[];
    data?: UserHistoryItem[];
    history?: UserHistoryItem[];
    result?: UserHistoryItem[];
  };

/* =========================
 * firebase auth
 * ========================= */

export type FirebaseAuthRequest = {
  id_token: string;
  nickname: string;
  profile_image?: string;
};

export type FirebaseAuthResponse = {
  success: boolean;
  is_new_user?: boolean;
  access_token?: string;
  refresh_token?: string;
  user?: {
    user_id: string;
    nickname: string;
    profile_image?: string;
    created_at?: string;
  };
};

/* =========================
 * 공통 request 함수
 * ========================= */

type RequestOptions = RequestInit & {
  token?: string;
};

async function getStoredAccessToken(): Promise<string | undefined> {
  const token =
    (await SecureStore.getItemAsync('accessToken')) ||
    (await SecureStore.getItemAsync('access_token')) ||
    undefined;

  return token;
}

async function request<T>(path: string, opts?: RequestOptions): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const { token, headers, ...restOpts } = opts ?? {};

  console.log('[API REQUEST]', {
    method: restOpts?.method ?? 'GET',
    url,
    body: restOpts?.body,
    hasToken: !!token,
  });

  let res: Response;

  try {
    res = await fetch(url, {
      credentials: 'include',
      ...restOpts,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers ?? {}),
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
    method: restOpts?.method ?? 'GET',
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

/* =========================
 * auth API
 * ========================= */

export async function getMe(): Promise<MeResponse> {
  const token = await getStoredAccessToken();

  return request<MeResponse>('/api/auth/me', {
    method: 'GET',
    token,
  });
}

export async function getMeWithToken(token: string): Promise<MeResponse> {
  return request<MeResponse>('/api/auth/me', {
    method: 'GET',
    token,
  });
}

export async function deleteMe(): Promise<void> {
  const token = await getStoredAccessToken();

  await request<null>('/api/auth/me', {
    method: 'DELETE',
    token,
  });
}

export function getUserIdFromMe(me: MeResponse | null | undefined): string {
  return me?.user_id ?? me?.id ?? '';
}

/* =========================
 * recipe API
 * ========================= */

export async function analyzeRecipe(
  body: RecipeAnalyzeRequest
): Promise<RecipeAnalyzeResponse> {
  const token = await getStoredAccessToken();

  return request<RecipeAnalyzeResponse>('/api/recipes/', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });
}

export async function getRecipe(
  videoId: string
): Promise<RecipeAnalyzeResponse> {
  const token = await getStoredAccessToken();

  return request<RecipeAnalyzeResponse>(
    `/api/recipes/${encodeURIComponent(videoId)}`,
    {
      method: 'GET',
      token,
    }
  );
}

export async function waitRecipeCompleted(
  videoId: string,
  opts?: { intervalMs?: number; timeoutMs?: number }
): Promise<RecipeAnalyzeResponse> {
  const intervalMs = opts?.intervalMs ?? 1500;
  const timeoutMs = opts?.timeoutMs ?? 180000;
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

/* =========================
 * recommendation API
 * ========================= */

export async function getRecommendationsByCategory(
  category: RecipeCategory | string
): Promise<RecommendationResponse> {
  return request<RecommendationResponse>(
    `/api/recommendations/${encodeURIComponent(category)}`,
    {
      method: 'GET',
    }
  );
}

export function normalizeRecommendations(
  response: RecommendationResponse | null | undefined
): RecommendationItem[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.recommendations)) return response.recommendations;
  if (Array.isArray(response.result)) return response.result;
  return [];
}

/* =========================
 * history API
 * ========================= */

export async function createUserHistory(
  userId: string,
  body: UserHistoryCreateRequest
) {
  const token = await getStoredAccessToken();

  return request(`/api/users/${encodeURIComponent(userId)}/history`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });
}

export async function getUserHistory(
  userId: string,
  limit = 20
): Promise<UserHistoryResponse> {
  const token = await getStoredAccessToken();

  return request<UserHistoryResponse>(
    `/api/users/${encodeURIComponent(userId)}/history?limit=${limit}`,
    {
      method: 'GET',
      token,
    }
  );
}

export function normalizeUserHistory(
  response: UserHistoryResponse | null | undefined
): UserHistoryItem[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.history)) return response.history;
  if (Array.isArray(response.result)) return response.result;
  return [];
}

/* =========================
 * firebase auth API
 * ========================= */

export async function firebaseSignup(
  body: FirebaseAuthRequest
): Promise<FirebaseAuthResponse> {
  return request<FirebaseAuthResponse>('/api/auth/firebase/signup', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function firebaseLogin(
  body: FirebaseAuthRequest
): Promise<FirebaseAuthResponse> {
  return request<FirebaseAuthResponse>('/api/auth/firebase/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/* =========================
 * 프론트 편의용 helper
 * ========================= */

export function buildUserHistoryPayloadFromRecipe(
  recipe: RecipeData
): UserHistoryCreateRequest {
  return {
    video_id: recipe.video_id,
    recipe_title: recipe.title,
    thumbnail_url: recipe.thumbnail_url,
    original_url: recipe.original_url,
    url: recipe.original_url,

    channel_name: recipe.channel_name,
    category: recipe.category,
    difficulty: recipe.difficulty,
    servings: recipe.servings,
    total_estimated_price: recipe.total_estimated_price,
    total_calorie: recipe.total_calorie,

    like_count: recipe.like_count,
    comment_count: recipe.comment_count,
    share_count: recipe.share_count,

    status: recipe.status,
    saved_at: new Date().toISOString(),

    recipe_data: {
      steps: recipe.steps,
      ingredients: recipe.ingredients,
      nutrition_details: recipe.nutrition_details,
    },
  };
}