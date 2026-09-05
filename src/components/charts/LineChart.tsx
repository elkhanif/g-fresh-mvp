import { rupiah } from '@/lib/utils';

export type Series = {
  label: string;
  color: string;
  dashed?: boolean;
  values: Array<number | null>;
};

/**
 * Grafik garis SVG tanpa dependensi.
 *
 * Sengaja tidak memakai Recharts/Chart.js: satu grafik statis tidak sepadan
 * dengan menambah ~500 KB ke bundle sebuah PWA yang target penggunanya ada di
 * jaringan pesisir. Ini komponen server murni — tidak ada JS yang dikirim ke
 * klien sama sekali.
 */
export function LineChart({
  labels,
  series,
  height = 220,
}: {
  labels: string[];
  series: Series[];
  height?: number;
}) {
  const W = 720;
  const H = height;
  const padL = 64;
  const padR = 16;
  const padT = 12;
  const padB = 28;

  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  if (all.length === 0 || labels.length < 2) {
    return <p className="text-sm text-ink/50">Belum cukup data untuk digambarkan.</p>;
  }

  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  // Beri ruang 8% atas-bawah supaya garis tidak menempel tepi.
  const span = Math.max(1, rawMax - rawMin);
  const min = Math.max(0, rawMin - span * 0.08);
  const max = rawMax + span * 0.08;

  const x = (i: number) => padL + (i * (W - padL - padR)) / (labels.length - 1);
  const y = (v: number) => padT + ((max - v) / (max - min)) * (H - padT - padB);

  // Segmentasi: nilai null memutus garis, bukan digambar sebagai nol.
  function path(values: Array<number | null>) {
    const segs: string[] = [];
    let open = false;
    values.forEach((v, i) => {
      if (v == null) {
        open = false;
        return;
      }
      segs.push(`${open ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`);
      open = true;
    });
    return segs.join(' ');
  }

  const ticks = [max, (max + min) / 2, min];
  const labelEvery = Math.max(1, Math.ceil(labels.length / 7));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[560px]" role="img">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#C8E6C9" strokeWidth="1" />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6b7280">
              {rupiah(Math.round(t))}
            </text>
          </g>
        ))}

        {labels.map((l, i) =>
          i % labelEvery === 0 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#6b7280">
              {l}
            </text>
          ) : null,
        )}

        {series.map((s) => (
          <path
            key={s.label}
            d={path(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeDasharray={s.dashed ? '5 4' : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink/60">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-5"
              style={{
                backgroundColor: s.dashed ? 'transparent' : s.color,
                borderTop: s.dashed ? `2px dashed ${s.color}` : undefined,
              }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
