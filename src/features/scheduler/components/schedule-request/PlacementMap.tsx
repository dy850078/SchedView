import type { BaremetalGroup } from '../../hooks/useScheduleRequestDetail';
import type { SchedulePlacement } from '../../types';
import { Card } from '../ui/Card';
import { Pill } from '../ui/Pill';
import { SectionHeader } from '../ui/SectionHeader';
import { BaremetalCard } from './BaremetalCard';

export interface PlacementMapProps {
  groups: BaremetalGroup[];
  assignedByBm: Record<string, SchedulePlacement[]>;
  totalBaremetals: number;
}

export function PlacementMap({
  groups,
  assignedByBm,
  totalBaremetals,
}: PlacementMapProps) {
  return (
    <Card className="p-0">
      <SectionHeader
        emoji="🗺️"
        title="Placement map"
        sub={`${totalBaremetals} baremetals across ${groups.length} AGs`}
      />
      <div className="p-[18px]">
        {groups.length === 0 ? (
          <div className="py-5 text-center text-sm italic text-slate-400">
            此申請單沒有成功的 placement
          </div>
        ) : (
          <div className="flex flex-col gap-[18px]">
            {groups.map((g) => (
              <section key={g.ag}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm leading-none">📍</span>
                  <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {g.ag}
                  </span>
                  <Pill mono>{g.baremetals.length} BM</Pill>
                </div>
                <div className="ml-1.5 flex flex-col gap-2.5 border-l-[3px] border-indigo-200 pl-[18px] dark:border-indigo-900">
                  {g.baremetals.map((b) => (
                    <BaremetalCard
                      key={b.id}
                      baremetal={b}
                      assignedPlacements={assignedByBm[b.id] ?? []}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
