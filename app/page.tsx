import BtcTreasuryGrowthSimulation from './components/organisms/BtcTreasuryGrowthSimulation';
import { BtcTreasuryGrowthSimulationProvider } from './components/providers/BtcTreasuryGrowthSimulationProvider';

export default function Home() {
  return (
    <BtcTreasuryGrowthSimulationProvider>
      <BtcTreasuryGrowthSimulation />;
    </BtcTreasuryGrowthSimulationProvider>
  );
}
