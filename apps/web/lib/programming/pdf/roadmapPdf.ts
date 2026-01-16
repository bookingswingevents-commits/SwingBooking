import { renderSimplePdf } from '@/lib/pdf';
import type { RoadmapOutput } from '@/lib/programming/types';

type RoadmapPdfHeader = {
  title: string;
  artistName?: string | null;
  period: string;
};

function pushSection(lines: string[], title: string, items: { label: string; value: string }[]) {
  if (items.length === 0) return;
  lines.push(title.toUpperCase());
  items.forEach((entry) => {
    const label = entry.label ? `${entry.label}: ` : '';
    lines.push(`- ${label}${entry.value}`.trim());
  });
  lines.push('');
}

export function buildRoadmapPdf(header: RoadmapPdfHeader, roadmap: RoadmapOutput): Buffer {
  const lines: string[] = [];
  lines.push(header.title);
  if (header.artistName) lines.push(`Artiste: ${header.artistName}`);
  lines.push(header.period);
  lines.push('');

  if (roadmap.schedule.length) {
    lines.push('PLANNING');
    roadmap.schedule.forEach((entry) => {
      const parts = [entry.date, entry.time].filter(Boolean).join(' ');
      const place = entry.place ? ` - ${entry.place}` : '';
      lines.push(`- ${parts}${place}`.trim());
      if (entry.notes) lines.push(`  ${entry.notes}`);
    });
    lines.push('');
  }

  pushSection(lines, 'Frais', roadmap.fees);
  pushSection(lines, 'Logement', roadmap.lodging);
  pushSection(lines, 'Repas', roadmap.meals);
  pushSection(lines, 'Acces', roadmap.access);
  pushSection(lines, 'Logistique', roadmap.logistics);
  pushSection(lines, 'Contacts', roadmap.contacts);

  return renderSimplePdf(
    lines.filter((line, idx, arr) => {
      if (line !== '') return true;
      return idx === 0 || arr[idx - 1] !== '';
    })
  );
}
