#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const XLSX_PATH = path.resolve(ROOT, '逆水寒数据.xlsx');
const OUTPUT_PATH = path.resolve(ROOT, 'src/data/db.js');

function loadWorkbookRows(xlsxPath) {
  const pyScript = String.raw`
import json, zipfile, xml.etree.ElementTree as ET, re, sys

NS = {'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
COL_RE = re.compile(r'([A-Z]+)')


def col_to_index(col):
    idx = 0
    for ch in col:
        idx = idx * 26 + (ord(ch) - 64)
    return idx - 1


def parse_sheet(xml_bytes, shared_strings):
    ws = ET.fromstring(xml_bytes)
    rows = []
    max_col = 0

    for row in ws.findall('.//a:sheetData/a:row', NS):
        row_map = {}
        for c in row.findall('a:c', NS):
            ref = c.attrib.get('r', '')
            m = COL_RE.match(ref)
            if not m:
                continue
            col_idx = col_to_index(m.group(1))
            t = c.attrib.get('t')
            v = c.find('a:v', NS)
            val = None
            if t == 'inlineStr':
                is_node = c.find('a:is', NS)
                if is_node is not None:
                    val = ''.join((tn.text or '') for tn in is_node.findall('.//a:t', NS))
            elif v is not None:
                text = v.text
                if t == 's':
                    val = shared_strings[int(text)]
                else:
                    val = text
            row_map[col_idx] = val
            max_col = max(max_col, col_idx + 1)
        rows.append(row_map)

    if not rows:
        return []

    headers = [(rows[0].get(i) or '').strip() if isinstance(rows[0].get(i), str) else (rows[0].get(i) or '') for i in range(max_col)]
    data = []
    for row in rows[1:]:
        item = {}
        for i in range(max_col):
            header = headers[i]
            if not header:
                continue
            value = row.get(i)
            item[header] = value
        if any(v not in (None, '') for v in item.values()):
            data.append(item)
    return data

xlsx_path = sys.argv[1]
with zipfile.ZipFile(xlsx_path) as z:
    shared_strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        sst_root = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in sst_root.findall('a:si', NS):
            shared_strings.append(''.join((t.text or '') for t in si.findall('.//a:t', NS)))

    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rel_map = {r.attrib['Id']: r.attrib['Target'] for r in rels}

    result = {}
    for sh in wb.find('a:sheets', NS):
        name = sh.attrib['name']
        rid = sh.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        target = rel_map[rid]
        if not target.startswith('xl/'):
            target = 'xl/' + target
        xml_bytes = z.read(target)
        result[name] = parse_sheet(xml_bytes, shared_strings)

print(json.dumps(result, ensure_ascii=False))
`;

  const result = spawnSync('python3', ['-c', pyScript, xlsxPath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || '读取 Excel 失败');
  }

  return JSON.parse(result.stdout);
}

function toNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function buildSkill(row, bucket, fallbackSource) {
  const name = toText(row['名称']);
  if (!name) return null;
  const source = toText(row['所属']) ?? fallbackSource ?? null;
  const id = toText(row['专属ID']) ?? (source ? `${source}__${name}` : name);

  return {
    id,
    name,
    source,
    bucket,
    cd: toNumber(row['冷却时间']),
    duration: toNumber(row['持续时间']),
    cast: toNumber(row['霸体时间']),
    dmg_reduction: toNumber(row['减伤']),
    note: toText(row['备注'])
  };
}

function buildDb(sheets) {
  const professionRows = sheets['职业技能'] ?? [];
  const jianghuRows = sheets['江湖技能'] ?? [];
  const neigongRows = sheets['内功'] ?? [];
  const ruleRows = sheets['机制'] ?? [];

  const skills = [
    ...professionRows.map((row) => buildSkill(row, '职业技能')).filter(Boolean),
    ...jianghuRows.map((row) => buildSkill(row, '江湖技能')).filter(Boolean),
    ...neigongRows.map((row) => buildSkill(row, '内功', '内功')).filter(Boolean)
  ];

  const rules = ruleRows
    .map((row) => ({
      skill: toText(row['技能']),
      related: toText(row['关联']),
      relation: toText(row['关系类型']),
      param: toText(row['参数'])
    }))
    .filter((rule) => rule.skill && rule.related && rule.relation);

  const professions = [...new Set(
    professionRows
      .map((row) => toText(row['所属']))
      .filter(Boolean)
  )];

  const jianghuCategories = [...new Set(
    jianghuRows
      .map((row) => toText(row['所属']))
      .filter(Boolean)
  )];

  const legacyProfession = {};
  for (const profession of professions) {
    legacyProfession[profession] = skills
      .filter((skill) => skill.bucket === '职业技能' && skill.source === profession)
      .map((skill) => ({
        name: skill.name,
        cd: skill.cd,
        cast: skill.cast,
        duration: skill.duration,
        dmg_reduction: skill.dmg_reduction,
        note: skill.note
      }));
  }

  const legacyUniversal = {};
  for (const category of [...jianghuCategories, '内功']) {
    legacyUniversal[category] = skills
      .filter((skill) => (skill.bucket === '江湖技能' && skill.source === category) || (skill.bucket === '内功' && category === '内功'))
      .map((skill) => ({
        name: skill.name,
        cd: skill.cd,
        cast: skill.cast,
        duration: skill.duration,
        dmg_reduction: skill.dmg_reduction,
        note: skill.note
      }));
  }

  return {
    meta: {
      generated_at: new Date().toISOString(),
      source_file: path.basename(XLSX_PATH),
      profession_sheets: professions,
      professions,
      jianghu_categories: jianghuCategories
    },
    modes: [
      { id: 'fair', name: '公平论武', duration: 120 },
      { id: 'tournament', name: '比武大会', duration: 180 }
    ],
    skills_legacy: {
      profession: legacyProfession,
      universal: legacyUniversal
    },
    skills,
    rules
  };
}

function main() {
  const sheets = loadWorkbookRows(XLSX_PATH);
  const db = buildDb(sheets);
  const output = `export const DB = ${JSON.stringify(db, null, 2)};\n`;
  fs.writeFileSync(OUTPUT_PATH, output, 'utf8');
  console.log(`已生成 ${path.relative(ROOT, OUTPUT_PATH)}，共 ${db.skills.length} 条技能，${db.rules.length} 条规则。`);
}

main();
