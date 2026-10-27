import { useSyncExternalStore } from 'react';
import type { SyncConflict } from '../core/syncMerge';
export type SyncPhase = 'off' | 'pending' | 'syncing' | 'synced' | 'offline' | 'conflict' | 'error';
export interface SyncStatus { phase: SyncPhase; lastSuccessAt?: number; error?: string; conflicts?: SyncConflict[]; revision?: number }
let state: SyncStatus = { phase: 'off' };
const listeners = new Set<() => void>();
export function setSyncStatus(patch: Partial<SyncStatus>) { state = { ...state, ...patch }; for (const fn of listeners) fn(); }
export function getSyncStatus() { return state; }
export function useSyncStatus() { return useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, getSyncStatus, getSyncStatus); }
export const SYNC_LABEL: Record<SyncPhase, string> = { off: '尚未啟用', pending: '待同步', syncing: '同步中', synced: '已同步', offline: '離線，待連線同步', conflict: '有資料需要確認', error: '同步失敗' };
