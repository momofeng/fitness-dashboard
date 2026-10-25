// 補給品知識卡：列表（依證據等級篩選）與單張卡片頁（每條宣稱附來源）。

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { GRADE_INFO, SOURCES, SUPPLEMENT_CARDS, SUPPLEMENT_DISCLAIMER, type Claim, type EvidenceGrade, type SourceId } from '../../content/supplementCards';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { EmptyState, PageHeader, Section } from '../../ui/Layout';

const GRADES: EvidenceGrade[] = ['A', 'B', 'C', 'D'];

export function GradeBadge({ grade, withLabel = false }: { grade: EvidenceGrade; withLabel?: boolean }) {
  const strong = grade === 'A' || grade === 'B';
  return (
    <span
      className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-sm px-2 text-sm font-semibold ${strong ? (grade === 'A' ? 'bg-chalk text-on-chalk' : 'border border-chalk-2 text-chalk') : 'border border-seam-strong text-chalk-3'}`}
      title={GRADE_INFO[grade].desc}
    >
      證據 {grade}
      {withLabel && <span className="font-normal">· {GRADE_INFO[grade].label}</span>}
    </span>
  );
}

export function GradeLegend() {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
      {GRADES.map((g) => (
        <div key={g} className="contents">
          <dt>
            <GradeBadge grade={g} />
          </dt>
          <dd className="text-chalk-2">
            <span className="font-medium text-chalk">{GRADE_INFO[g].label}：</span>
            {GRADE_INFO[g].desc}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function SupplementsPage() {
  const [grade, setGrade] = useState<EvidenceGrade | null>(null);
  const [legend, setLegend] = useState(false);
  const list = SUPPLEMENT_CARDS.filter((c) => !grade || c.grade === grade);
  return (
    <div className="flex flex-col gap-4 pb-6">
      <PageHeader title="補給品知識卡" back="/more" sub={`${SUPPLEMENT_CARDS.length} 種常見補給品的證據與用法`} />
      <p className="text-sm text-chalk-2">先把飲食與睡眠顧好，補給品只是「補」。等級針對增肌與阻力訓練，每條說法都附國際運動營養學會（ISSN）、國際奧會（IOC）或研究來源。</p>
      <button type="button" onClick={() => setLegend((v) => !v)} aria-expanded={legend} className="press flex h-9 items-center gap-1 self-start text-sm text-chalk-3">
        <Icon name={legend ? 'chevronDown' : 'chevronRight'} size={16} />
        證據等級怎麼看
      </button>
      {legend && (
        <div className="card p-4">
          <GradeLegend />
        </div>
      )}
      <div className="flex gap-1.5 overflow-x-auto" role="radiogroup" aria-label="依證據等級篩選">
        {[null, ...GRADES].map((g) => (
          <button
            key={g ?? 'all'}
            type="button"
            role="radio"
            aria-checked={grade === g}
            onClick={() => setGrade(g)}
            className={`press h-10 shrink-0 rounded-full border px-4 text-sm ${grade === g ? 'border-chalk bg-chalk font-medium text-on-chalk' : 'border-seam text-chalk-2'}`}
          >
            {g ? `${g} 級` : '全部'}
          </button>
        ))}
      </div>
      <div className="card divide-y divide-seam overflow-hidden">
        {list.map((c) => (
          <Link key={c.id} to={`/supplements/${c.id}`} className="press flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-iron-2">
            <GradeBadge grade={c.grade} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{c.name}</span>
              <span className="block text-sm text-chalk-3">{c.oneLiner}</span>
            </span>
            <Icon name="chevronRight" size={18} className="shrink-0 text-chalk-3" />
          </Link>
        ))}
      </div>
      <p className="px-1 text-cap text-chalk-3">{SUPPLEMENT_DISCLAIMER}</p>
    </div>
  );
}

function SourceList({ ids }: { ids: SourceId[] }) {
  return (
    <ul className="mt-1 flex flex-col gap-1">
      {ids.map((id) => {
        const s = SOURCES[id];
        return (
          <li key={id} className="text-sm text-chalk-3">
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center text-sm underline decoration-chalk-4 underline-offset-2 hover:text-chalk-2">
              {s.label}
            </a>
            {'pmid' in s && s.pmid ? ` · PMID ${s.pmid}` : ''}
            {'doi' in s && s.doi ? ` · DOI ${s.doi}` : ''}
          </li>
        );
      })}
    </ul>
  );
}

function ClaimList({ claims }: { claims: readonly Claim[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ol className="flex flex-col gap-3">
      {claims.map((c, i) => (
        <li key={i} className="flex flex-col">
          <p className="text-base text-chalk">{c.text}</p>
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            className="press mt-0.5 flex h-8 items-center gap-1 self-start text-sm text-chalk-3 hover:text-chalk-2"
          >
            <Icon name="note" size={14} />
            來源（{c.sources.length}）
          </button>
          {open === i && <SourceList ids={c.sources} />}
        </li>
      ))}
    </ol>
  );
}

export function SupplementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const c = SUPPLEMENT_CARDS.find((x) => x.id === id);
  if (!c)
    return (
      <div className="flex flex-col gap-4 pb-6">
        <PageHeader title="找不到這張卡片" back="/supplements" />
        <EmptyState icon="info" title="找不到這張卡片" action={<Button onClick={() => navigate('/supplements')}>回到知識卡</Button>} />
      </div>
    );
  const allSources = [...new Set([...c.claims, ...c.dose, ...c.safety].flatMap((x) => x.sources))];
  return (
    <div className="flex flex-col gap-5 pb-6">
      <PageHeader title={c.name} back="/supplements" />
      <div className="flex flex-col gap-2">
        <p className="text-sm text-chalk-3">也叫：{c.aka.join('、')}</p>
        <GradeBadge grade={c.grade} withLabel />
        <p className="text-h4 font-semibold">{c.oneLiner}</p>
        <p className="text-base text-chalk-2">{c.whatItIs}</p>
      </div>
      <section className="rounded-lg border border-seam-strong bg-iron-2 p-4" aria-label="對新手增肌的意義">
        <p className="label mb-1">對你的意義</p>
        <p className="text-base">{c.forYou}</p>
      </section>
      <Section title="研究怎麼說">
        <div className="card p-4">
          <ClaimList claims={c.claims} />
        </div>
      </Section>
      <Section title="劑量與用法">
        <div className="card p-4">
          <ClaimList claims={c.dose} />
        </div>
      </Section>
      <Section title="安全與注意">
        <div className="card p-4">
          <ClaimList claims={c.safety} />
        </div>
      </Section>
      {c.skipIf.length > 0 && (
        <Section title="先問醫師或避免">
          <ul className="card flex list-disc flex-col gap-1 p-4 pl-8 text-base text-chalk-2">
            {c.skipIf.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Section>
      )}
      {c.grade !== 'D' && (
        <Button icon="plus" block onClick={() => navigate(`/products?new=${c.productCategory ?? 'other'}&name=${encodeURIComponent(c.name)}`)}>
          加到我的補給品（比價、庫存、打卡）
        </Button>
      )}
      <Section title={`全部來源（${allSources.length}）`}>
        <div className="card p-4">
          <SourceList ids={allSources} />
        </div>
      </Section>
      <p className="px-1 text-cap text-chalk-3">{SUPPLEMENT_DISCLAIMER}</p>
    </div>
  );
}
