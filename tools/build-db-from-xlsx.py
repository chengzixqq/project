#!/usr/bin/env python3
import datetime as dt
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / '逆水寒数据.xlsx'
OUT = ROOT / 'src/data/db.js'

NS = {'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def col_of(ref: str) -> str:
    m = re.match(r'[A-Z]+', ref)
    return m.group(0) if m else ''


def parse_sheet(zf: zipfile.ZipFile, path: str, shared: list[str]) -> list[dict[str, str]]:
    root = ET.fromstring(zf.read(path))

    def cell_value(c: ET.Element) -> str:
        t = c.attrib.get('t')
        v = c.find('a:v', NS)
        if v is None:
            return ''
        text = v.text or ''
        if t == 's':
            return shared[int(text)]
        return text

    rows = []
    for r in root.findall('.//a:sheetData/a:row', NS):
        row = {}
        for c in r.findall('a:c', NS):
            row[col_of(c.attrib.get('r', ''))] = cell_value(c).strip()
        rows.append(row)
    return rows


def num_or_none(v: str):
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def build():
    with zipfile.ZipFile(XLSX) as zf:
        ss_root = ET.fromstring(zf.read('xl/sharedStrings.xml'))
        shared = [''.join((t.text or '') for t in si.findall('.//a:t', NS)) for si in ss_root.findall('a:si', NS)]

        mechanisms = parse_sheet(zf, 'xl/worksheets/sheet1.xml', shared)
        prof_rows = parse_sheet(zf, 'xl/worksheets/sheet2.xml', shared)
        jianghu_rows = parse_sheet(zf, 'xl/worksheets/sheet3.xml', shared)
        neigong_rows = parse_sheet(zf, 'xl/worksheets/sheet4.xml', shared)

    prof_skills = {}
    universal = {}
    id_to_name = {}

    for row in prof_rows[1:]:
        name = row.get('A', '').strip()
        source = row.get('F', '').strip()
        sid = row.get('G', '').strip()
        if not (name and source and sid):
            continue
        skill = {
            'id': sid,
            'name': name,
            'cd': num_or_none(row.get('B', '')),
            'cast': num_or_none(row.get('D', '')),
            'duration': num_or_none(row.get('C', '')),
            'dmg_reduction': num_or_none(row.get('E', '')),
            'note': None,
        }
        prof_skills.setdefault(source, []).append(skill)
        id_to_name[sid] = name

    for row in jianghu_rows[1:]:
        name = row.get('A', '').strip()
        source = row.get('F', '').strip()
        sid = row.get('G', '').strip()
        if not (name and source and sid):
            continue
        skill = {
            'id': sid,
            'name': name,
            'cd': num_or_none(row.get('B', '')),
            'cast': num_or_none(row.get('D', '')),
            'duration': num_or_none(row.get('C', '')),
            'dmg_reduction': num_or_none(row.get('E', '')),
            'note': None,
        }
        universal.setdefault(source, []).append(skill)
        id_to_name[sid] = name

    neigong_source = '内功'
    for row in neigong_rows[1:]:
        name = row.get('A', '').strip()
        if not name:
            continue
        sid = f'{neigong_source}__{name}'
        skill = {
            'id': sid,
            'name': name,
            'cd': num_or_none(row.get('B', '')),
            'cast': num_or_none(row.get('D', '')),
            'duration': num_or_none(row.get('C', '')),
            'dmg_reduction': num_or_none(row.get('E', '')),
            'note': row.get('F', '').strip() or None,
        }
        universal.setdefault(neigong_source, []).append(skill)
        id_to_name[sid] = name

    relations = []
    for row in mechanisms[1:]:
        from_id = row.get('A', '').strip()
        to_id = row.get('B', '').strip()
        rtype = row.get('C', '').strip()
        param = num_or_none(row.get('D', ''))
        if not (from_id and to_id and rtype):
            continue
        relations.append({
            'from_id': from_id,
            'to_id': to_id,
            'relation_type': rtype,
            'param': param,
            'from_name': id_to_name.get(from_id) or from_id,
            'to_name': id_to_name.get(to_id) or to_id,
        })

    db = {
        'meta': {
            'generated_at': dt.datetime.now().isoformat(timespec='seconds'),
            'source_file': XLSX.name,
            'universal_sheets': sorted(universal.keys(), key=lambda x: (x != '内功', x)),
            'profession_sheets': sorted(prof_skills.keys()),
            'jianghu_categories': sorted([x for x in universal.keys() if x != '内功']),
        },
        'modes': [
            {'id': 'fair', 'name': '公平论武', 'duration': 120},
            {'id': 'tournament', 'name': '比武大会', 'duration': 180},
        ],
        'skills': {
            'profession': prof_skills,
            'universal': universal,
        },
        'rules': {
            'relations': relations,
        },
    }

    OUT.write_text('export const DB = ' + json.dumps(db, ensure_ascii=False) + ';\n', encoding='utf-8')
    print(f'Wrote {OUT}')


if __name__ == '__main__':
    build()
