/**
 * 분석 중인 레시피를 메모리에 보관하는 간단한 스토어.
 * 앱 재시작 시 자동으로 초기화됨 (프론트 전용).
 */

export type PendingStatus = 'ANALYZING' | 'COMPLETED' | 'FAILED';

export type PendingRecipe = {
  videoId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  url: string;
  status: PendingStatus;
  addedAt: number; // Date.now()
};

let pendingRecipes: PendingRecipe[] = [];
let listeners: Array<() => void> = [];

function notify() {
  listeners.forEach((fn) => fn());
}

export function addPendingRecipe(recipe: Omit<PendingRecipe, 'status' | 'addedAt'>) {
  // 같은 videoId가 이미 있으면 제거 후 다시 추가
  pendingRecipes = pendingRecipes.filter((r) => r.videoId !== recipe.videoId);
  pendingRecipes.unshift({
    ...recipe,
    status: 'ANALYZING',
    addedAt: Date.now(),
  });
  notify();
}

export function updatePendingStatus(videoId: string, status: PendingStatus) {
  const item = pendingRecipes.find((r) => r.videoId === videoId);
  if (item) {
    item.status = status;
    notify();
  }
}

export function removePending(videoId: string) {
  pendingRecipes = pendingRecipes.filter((r) => r.videoId !== videoId);
  notify();
}

export function getPendingRecipes(): PendingRecipe[] {
  return [...pendingRecipes];
}

export function subscribePending(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((fn) => fn !== listener);
  };
}
