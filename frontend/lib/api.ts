// frontend/app/lib/api.ts

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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
  channel_profile_url?: string;
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
  channel_profile_url?: string;
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
  // 1. 웹 환경일 때
  if (Platform.OS === 'web') {
    const token =
      (await AsyncStorage.getItem('accessToken')) ||
      (await AsyncStorage.getItem('access_token')) ||
      undefined;
    return token;
  }

  // 2. 모바일(앱) 환경일 때
  try {
    const token =
      (await SecureStore.getItemAsync('accessToken')) ||
      (await SecureStore.getItemAsync('access_token')) ||
      undefined;
    return token;
  } catch (error) {
    console.error('SecureStore 에러:', error);
    return undefined;
  }
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
      //credentials: 'include',
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

export async function getRecommendationsByCategory(category: string, limit = 20) {
  // 백엔드 테스트 코드의 경로(/api/recipes/recommendations/...)와 맞춰줍니다.
  const res = await request(`/api/recipes/recommendations/${category}?limit=${limit}`);
  return res;
}

export function normalizeRecommendations(response: any): RecommendationItem[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  return response.data || response.items || [];
}

/* =========================
 * trending API (인기 레시피)
 * ========================= */

// 1. 인기 레시피 타입 정의
export interface TrendingRecipe {
  video_id: string;
  title: string;
  channel_name: string;
  thumbnail_url: string;
  url: string;
  category: string;
  like_count: number | string;
  comment_count: number | string;
  share_count: number | string;
}

// 2. 인기 레시피 가져오기 함수
export async function getTrendingRecipes(limit = 20): Promise<TrendingRecipe[]> {
  // 인증이 필요 없으므로 token은 생략합니다.
  // 이전에 정의하신 request 함수를 그대로 활용합니다.
  const response = await request<TrendingRecipe[]>(`/api/recipes/trending?limit=${limit}`, {
    method: 'GET',
  });

  return response;
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

export function normalizeUserHistory(response: any): any[] {
  if (!response) return [];

  // 서버 로그를 보면 { "data": [...] } 형태로 오고 있습니다.
  // 이 'data' 안의 배열을 꺼내줘야 메인 화면에 리스트가 뜹니다!
  if (response && typeof response === 'object' && Array.isArray(response.data)) {
    return response.data;
  }

  if (Array.isArray(response)) {
    return response;
  }

  return response.items || response.history || response.result || [];
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

// frontend/app/lib/api.ts

export function buildUserHistoryPayloadFromRecipe(
  recipe: RecipeData
): UserHistoryCreateRequest {
  return {
    video_id: String(recipe.video_id), // 확실하게 문자열로 변환
    recipe_title: String(recipe.title),
    thumbnail_url: recipe.thumbnail_url || '',
    original_url: recipe.original_url || '',
    url: recipe.original_url || '',

    channel_name: recipe.channel_name || '',
    category: recipe.category || '기타',
    difficulty: recipe.difficulty || '중',
    servings: String(recipe.servings || '1'), // 숫자일 경우 문자열로
    total_estimated_price: String(recipe.total_estimated_price || '0'),
    total_calorie: String(recipe.total_calorie || '0'),

    like_count: String(recipe.like_count || '0'),
    comment_count: String(recipe.comment_count || '0'),
    share_count: String(recipe.share_count || '0'),

    status: recipe.status || 'COMPLETED',
    saved_at: new Date().toISOString(),

    recipe_data: {
      steps: recipe.steps || [],
      ingredients: recipe.ingredients || [],
      nutrition_details: recipe.nutrition_details || {
        sodium_mg: "0",
        fat_g: "0",
        sugar_g: "0",
        carbs_g: "0",
        protein_g: "0"
      },
    },
  };
}
export type AiAskRequest = {
  video_id: string;
  question: string;
  current_step: number; 
};

export type AiAskResponse = {
  answer: string;
  current_step: number;
  video_id: string;
};

export async function askAi(body: AiAskRequest): Promise<AiAskResponse> {
  const token = await getStoredAccessToken();

  return request<AiAskResponse>('/api/ai/ask', {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });
}