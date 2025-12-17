import dynamic from 'next/dynamic';

const MortgageAIPrototype = dynamic(() => import('./MortgageAIPrototype'), { ssr: false });

export default function MortgagePage() {
  return <MortgageAIPrototype />;
}
