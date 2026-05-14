import { getPricingDataset } from '@/lib/pricing/loader';
import PricingClient from './PricingClient';

export default function PricingPage() {
  const dataset = getPricingDataset();
  return <PricingClient items={dataset.items} meta={dataset.meta} />;
}
