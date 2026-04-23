import { Card } from '../ui/Card';
import { Pill } from '../ui/Pill';
import { SectionHeader } from '../ui/SectionHeader';

/**
 * Stubbed constraints list. In a real integration this should come from the
 * solver API — `request.constraints[]` with human-readable labels.
 */
export function ConstraintsPanel() {
  return (
    <Card className="p-0">
      <SectionHeader emoji="🔗" title="Constraints applied" />
      <div className="flex flex-wrap gap-1.5 p-3.5">
        <Pill variant="indigo">AG anti-affinity (auto)</Pill>
        <Pill variant="indigo">ip_type match</Pill>
        <Pill variant="indigo">max_vm_count limit</Pill>
        <Pill>soft: cross-cluster dc spread · w=5</Pill>
        <Pill>candidate_baremetals · none</Pill>
      </div>
    </Card>
  );
}
