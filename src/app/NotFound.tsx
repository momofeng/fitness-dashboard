import { Link } from 'react-router';
import { EmptyState, PageHeader } from '../ui/Layout';

export default function NotFound() {
  return (
    <>
      <PageHeader title="找不到頁面" />
      <EmptyState
        icon="search"
        title="這個頁面不存在"
        action={
          <Link to="/" className="press inline-flex h-11 items-center rounded-md bg-chalk px-4 font-semibold text-on-chalk">
            回首頁
          </Link>
        }
      />
    </>
  );
}
