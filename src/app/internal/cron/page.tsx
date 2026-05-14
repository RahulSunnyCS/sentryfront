import { CronView } from './cron-view';

export const dynamic = 'force-dynamic';

const CRONS = [
  {
    name: 'aggregate-fp-rates',
    description:
      'Re-runs the daily FP-rate aggregator and writes today\'s FpRateSnapshot rows. Idempotent per UTC day.',
  },
];

export default function CronPage() {
  return <CronView crons={CRONS} />;
}
