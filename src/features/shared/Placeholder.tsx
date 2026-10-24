import { EmptyState, PageHeader } from '../../ui/Layout';

/** 開發中頁面的暫時版面 */
export function Placeholder({ title, back }: { title: string; back?: string }) {
  return (
    <>
      <PageHeader title={title} back={back} />
      <EmptyState icon="info" title="這一頁還在建置中" />
    </>
  );
}
