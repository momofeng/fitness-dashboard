import { Link } from 'react-router';
import { SYNC_LABEL, useSyncStatus } from '../../sync/status';
export function SyncBadge() {
  const state = useSyncStatus(); if (state.phase === 'off') return null;
  return <Link to="/sync" className={'press inline-flex min-h-11 items-center gap-2 text-sm ' + (['error', 'conflict'].includes(state.phase) ? 'text-warn' : 'text-chalk-3')}>
    <span aria-hidden="true" className={'h-2 w-2 rounded-full ' + (state.phase === 'synced' ? 'bg-go' : 'bg-warn')} />
    {SYNC_LABEL[state.phase]}{state.lastSuccessAt && state.phase === 'synced' ? ' · ' + new Date(state.lastSuccessAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : ''}
  </Link>;
}
