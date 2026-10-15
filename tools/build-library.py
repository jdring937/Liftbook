"""Build public/ex/library.json: a small search index of free-exercise-db (Unlicense) so people can
find photos and steps for exercises they create. Photos and steps load from the source on demand.
Each row: [source id, name, equipment, primary muscles, our id if the app already has it built in]
Usage: python3 tools/build-library.py <dataset dist/exercises.json>
"""
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
data = json.load(open(sys.argv[1]))
native = {theirs: ours for ours, theirs in json.load(open(os.path.join(here, 'preview-map.json'))).items()}
rows = []
for e in sorted(data, key=lambda e: e['name'].lower()):
    if len(e.get('images') or []) < 2 or not e.get('id'):
        continue
    # images live at <id>/0.jpg and <id>/1.jpg; skip any entry that breaks that pattern
    if e['images'][:2] != [f"{e['id']}/0.jpg", f"{e['id']}/1.jpg"]:
        print('skip', e['id'], e['images'][:2]); continue
    rows.append([e['id'], e['name'], e.get('equipment') or '', ', '.join(e.get('primaryMuscles') or []), native.get(e['id'], 0)])
out = os.path.join(root, 'public', 'ex', 'library.json')
json.dump(rows, open(out, 'w'), separators=(',', ':'), ensure_ascii=False)
print(len(rows), 'exercises,', os.path.getsize(out) // 1024, 'KB,', sum(1 for r in rows if r[4]), 'already built in')
