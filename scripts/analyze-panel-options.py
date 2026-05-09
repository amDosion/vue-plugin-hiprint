import re
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/hiprint/hiprint.bundle.js', 'r', encoding='utf-8') as f:
    content = f.read()

panel_opts = [
    'panelPaperRule', 'panelPageRule', 'paperHeader', 'paperFooter',
    'firstPaperFooter', 'evenPaperFooter', 'oddPaperFooter', 'lastPaperFooter',
    'leftOffset', 'topOffset', 'orient', 'paperNumberDisabled',
    'paperNumberContinue', 'paperNumberFormat', 'watermarkOptions',
    'gridOptions', 'panelLayoutOptions', 'printMarginOptions',
]

print(f'{"line":>6}  {"name":<22}  label  selects  inputs  checkboxes')
print('-' * 70)

for name in panel_opts:
    pat = re.compile(r'this\.name\s*=\s*"' + re.escape(name) + r'";')
    m = pat.search(content)
    if not m:
        print(f'{"-":>6}  {name:<22}  MISSING')
        continue
    line = content[:m.start()].count('\n') + 1
    seg = content[m.start():m.start() + 3500]
    has_label = 'hiprint-option-item-label' in seg
    select_count = seg.count('<select')
    input_count = seg.count('<input')
    chk_count = seg.count('type="checkbox"') + seg.count("type='checkbox'")
    print(f'{line:>6}  {name:<22}  {int(has_label):>5}  {select_count:>7}  {input_count:>6}  {chk_count:>10}')
