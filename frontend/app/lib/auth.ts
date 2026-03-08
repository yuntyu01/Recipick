import * as SecureStore from "expo-secure-store";
import { BASE_URL } from "./api";

type FirebaseAuthBody = {
  id_token: string;
  nickname?: string;          // signup에서 필요할 수 있음
  profile_image?: string | null;
};

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text as any;
  }

  if (!res.ok) {
    const msg = (json && (json.detail || json.message)) || `HTTP ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return json as T;
}

export async function backendFirebaseLogin(idToken: string) {
  return request("/api/auth/firebase/login", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken } satisfies FirebaseAuthBody),
  });
}

export async function backendFirebaseSignup(params: {
  idToken: string;
  nickname: string;
  profileImage?: string | null;
}) {
  return request("/api/auth/firebase/signup", {
    method: "POST",
    body: JSON.stringify({
      id_token: params.idToken,
      nickname: params.nickname,
      profile_image: params.profileImage ?? null,
    } satisfies FirebaseAuthBody),
  });
}

export async function saveIdToken(idToken: string) {
  await SecureStore.setItemAsync("accessToken", idToken); // 이름은 accessToken이지만 실체는 firebase idToken
}

export async function getIdToken() {
  return SecureStore.getItemAsync("accessToken");
}

export async function logout() {
  await SecureStore.deleteItemAsync("accessToken");
}