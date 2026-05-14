import { prisma } from '@/lib/prisma';
import { FeaturesView } from './features-view';

export const dynamic = 'force-dynamic';

export default async function FeaturesPage() {
  const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  const audit = await prisma.featureFlagAudit.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const auditByKey = new Map<string, typeof audit>();
  for (const row of audit) {
    let arr = auditByKey.get(row.key);
    if (!arr) {
      arr = [];
      auditByKey.set(row.key, arr);
    }
    if (arr.length < 5) arr.push(row);
  }

  const initial = flags.map((f) => ({
    key: f.key,
    enabled: f.enabled,
    value: f.value,
    updatedBy: f.updatedBy,
    updatedAt: f.updatedAt.toISOString(),
    recentAudit: (auditByKey.get(f.key) ?? []).map((a) => ({
      id: a.id,
      enabled: a.enabled,
      value: a.value,
      updatedBy: a.updatedBy,
      createdAt: a.createdAt.toISOString(),
    })),
  }));

  return <FeaturesView initial={initial} />;
}
