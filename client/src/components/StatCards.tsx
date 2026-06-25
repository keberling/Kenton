import type { Stats } from "../types";

interface StatCardsProps {
  stats: Stats;
}

export function StatCards({ stats }: StatCardsProps) {
  const items = [
    { label: "Total photos", value: stats.totalPhotos },
    { label: "Unassigned", value: stats.unassignedPhotos },
    { label: "Job sites", value: stats.sites },
    { label: "With GPS", value: stats.photosWithGps },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="glass rounded-2xl px-4 py-4">
          <p className="text-sm text-stone-500">{item.label}</p>
          <p className="font-display mt-1 text-2xl font-bold text-stone-900">{item.value}</p>
        </div>
      ))}
    </div>
  );
}