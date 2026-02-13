#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const DB_FILE = path.resolve('src/data/db.js');
const VALID_BUCKETS = new Set(['职业技能', '江湖技能', '内功']);

function parseDbModule(fileContent) {
  const prefix = 'export const DB = ';
  if (!fileContent.startsWith(prefix) || !fileContent.trimEnd().endsWith(';')) {
    throw new Error('src/data/db.js 格式不符合 `export const DB = {...};`');
  }
  const jsonText = fileContent.slice(prefix.length).trim().replace(/;\s*$/, '');
  return JSON.parse(jsonText);
}

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function main() {
  const dbRaw = fs.readFileSync(DB_FILE, 'utf8');
  const db = parseDbModule(dbRaw);

  const issues = [];
  const warnings = [];

  for (const required of ['meta', 'skills', 'rules']) {
    if (!(required in db)) issues.push(`缺失顶层字段：${required}`);
  }

  if (!Array.isArray(db.skills)) issues.push('skills 必须为数组');
  if (!Array.isArray(db.rules)) issues.push('rules 必须为数组');

  const idSeen = new Set();
  const namePerBucketSeen = new Set();

  for (const skill of db.skills || []) {
    if (!skill?.id || typeof skill.id !== 'string' || !skill.id.trim()) {
      issues.push(`[${skill?.name || '<unknown>'}] 缺失专属ID(id)`);
      continue;
    }

    if (idSeen.has(skill.id)) {
      issues.push(`存在重复技能 id：${skill.id}`);
    }
    idSeen.add(skill.id);

    if (!VALID_BUCKETS.has(skill.bucket)) {
      issues.push(`[${skill.id}] bucket 非法：${skill.bucket}`);
    }

    const dedupeKey = `${skill.bucket}::${skill.source || ''}::${skill.name || ''}`;
    if (namePerBucketSeen.has(dedupeKey)) {
      issues.push(`[${skill.id}] 重复技能名（同 bucket/source）：${skill.name}`);
    }
    namePerBucketSeen.add(dedupeKey);

    for (const key of ['cd', 'cast', 'duration', 'dmg_reduction']) {
      const value = skill[key];
      if (value != null && !isNum(value)) {
        issues.push(`[${skill.id}] 字段 ${key} 必须为数字或空`);
      }
      if (isNum(value) && value < 0) {
        issues.push(`[${skill.id}] 字段 ${key} 不能为负数`);
      }
    }

    if (isNum(skill.dmg_reduction) && skill.dmg_reduction > 100) {
      issues.push(`[${skill.id}] 减伤超过 100`);
    }

    if (isNum(skill.cast) && isNum(skill.duration) && skill.cast > skill.duration) {
      warnings.push(`[${skill.id}] 霸体时间(cast) 大于持续时间(duration)，请确认`);
    }
  }

  const metaProfessions = db?.meta?.professions ?? [];
  const actualProfessions = [
    ...new Set((db.skills || []).filter((s) => s.bucket === '职业技能').map((s) => s.source).filter(Boolean))
  ];
  if (JSON.stringify(metaProfessions) !== JSON.stringify(actualProfessions)) {
    issues.push('meta.professions 与职业技能中的所属不一致');
  }

  const metaJianghuCategories = db?.meta?.jianghu_categories ?? [];
  const actualJianghuCategories = [
    ...new Set((db.skills || []).filter((s) => s.bucket === '江湖技能').map((s) => s.source).filter(Boolean))
  ];
  if (JSON.stringify(metaJianghuCategories) !== JSON.stringify(actualJianghuCategories)) {
    issues.push('meta.jianghu_categories 与江湖技能中的所属不一致');
  }

  for (const rule of db.rules || []) {
    if (!rule?.skill || !rule?.related || !rule?.relation) {
      issues.push('rules 中存在缺失 skill/related/relation 的记录');
    }
  }

  console.log('== DB 统计 ==');
  console.log(`技能总数: ${(db.skills || []).length}`);
  console.log(`规则总数: ${(db.rules || []).length}`);
  console.log(`职业列表: ${(db?.meta?.professions || []).join(', ') || '(空)'}`);
  console.log(`江湖分类: ${(db?.meta?.jianghu_categories || []).join(', ') || '(空)'}`);

  if (warnings.length > 0) {
    console.warn('\n== 校验警告 ==');
    for (const w of warnings) console.warn(`- ${w}`);
  }

  if (issues.length > 0) {
    console.error('\n== 校验失败 ==');
    for (const i of issues) console.error(`- ${i}`);
    process.exit(1);
  }

  console.log('\n校验通过。');
}

main();
