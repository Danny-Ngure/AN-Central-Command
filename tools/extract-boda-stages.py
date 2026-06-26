# Extract the Nyali sub-county bodaboda stage list from the source PDF, with each
# stage's ward derived from its CELL COLOUR (the PDF colour-codes by ward):
#   yellow=Ziwa La Ng'ombe, green=Mkomani, magenta=Kongowea, red=Kadzandani, blue=Frere Town.
# Output: tools/data/nyali-boda-stages.json  (consumed by seed-boda-stages.cjs)
#
#   python tools/extract-boda-stages.py "<path to the PDF>"

import sys, io, json, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pdfplumber

PDF = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\User\Downloads\NYALI SUB-COUNTY BODABODA LIST OF STAGE MEMBERS..pdf'
OUT = os.path.join(os.path.dirname(__file__), 'data', 'nyali-boda-stages.json')

def ward_of(col):
    if not isinstance(col, (list, tuple)) or len(col) < 3:
        return None
    r, g, b = (round(col[0], 2), round(col[1], 2), round(col[2], 2))
    if (r, g, b) == (1.0, 1.0, 0.0): return 'ziwa'
    if (r, g, b) == (0.0, 1.0, 0.0): return 'mkomani'
    if (r, g, b) == (1.0, 0.0, 1.0): return 'kongowea'
    if (r, g, b) == (1.0, 0.0, 0.0): return 'kadzandani'
    if b > 0.5 and r < 0.4 and g < 0.6: return 'freretown'   # blue shades
    return None

pdf = pdfplumber.open(PDF)
stages = []
for pi, p in enumerate(pdf.pages):
    midX = p.width / 2
    colored = []
    for rt in p.rects:
        w = ward_of(rt.get('non_stroking_color'))
        if w:
            colored.append((w, rt['x0'], rt['x1'], rt['top'], rt['bottom']))

    def ward_at(cx, cy):
        for w, x0, x1, t, b in colored:
            if x0 - 1 <= cx <= x1 + 1 and t - 1 <= cy <= b + 1:
                return w
        return None

    rows = {}
    for wd in p.extract_words():
        rows.setdefault(round(wd['top'] / 6), []).append(wd)
    for key in sorted(rows):
        ws = sorted(rows[key], key=lambda x: x['x0'])
        for side in ('L', 'R'):
            sw = [w for w in ws if (w['x1'] <= midX) == (side == 'L')]
            if not sw or not sw[0]['text'].strip().rstrip('.').isdigit() or not sw[-1]['text'].strip().isdigit():
                continue
            nameWords = sw[1:-1]
            if not nameWords:
                continue
            name = ' '.join(w['text'] for w in nameWords).strip()
            votes = {}
            for w in nameWords:
                wd2 = ward_at((w['x0'] + w['x1']) / 2, (w['top'] + w['bottom']) / 2)
                if wd2:
                    votes[wd2] = votes.get(wd2, 0) + 1
            stages.append({
                'name': name,
                'members': int(sw[-1]['text'].strip()),
                'ward': max(votes, key=votes.get) if votes else None,
            })

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(stages, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
from collections import Counter
print(f"wrote {len(stages)} stages -> {OUT}")
print("by ward:", dict(Counter(s['ward'] for s in stages)))
print("unassigned:", sum(1 for s in stages if not s['ward']))
