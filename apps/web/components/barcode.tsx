// Self-contained Code-128 (set B) barcode → SVG. No dependency.
// Encodes an ASCII string into a scannable barcode for ID verification.

const PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
];

function encode128B(input: string): number[] {
  const data = input.replace(/[^\x20-\x7E]/g, '').slice(0, 32) || ' ';
  const values = [104]; // Start B
  let checksum = 104;
  [...data].forEach((ch, i) => {
    const v = ch.charCodeAt(0) - 32;
    values.push(v);
    checksum += v * (i + 1);
  });
  values.push(checksum % 103);
  values.push(106); // Stop
  return values;
}

export function Barcode({
  value,
  height = 44,
  module = 1.6,
  className = '',
}: { value: string; height?: number; module?: number; className?: string }) {
  const codes = encode128B(value);
  const bars: { x: number; w: number }[] = [];
  let x = 10; // quiet zone
  for (const code of codes) {
    const pat = PATTERNS[code];
    for (let j = 0; j < pat.length; j++) {
      const w = Number(pat[j]) * module;
      if (j % 2 === 0) bars.push({ x, w }); // even index = bar (black)
      x += w;
    }
  }
  const total = x + 10; // trailing quiet zone
  return (
    <svg
      viewBox={`0 0 ${total} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label={`Barcode ${value}`}
    >
      <rect x={0} y={0} width={total} height={height} fill="#ffffff" />
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={2} width={b.w} height={height - 4} fill="#111111" />
      ))}
    </svg>
  );
}
