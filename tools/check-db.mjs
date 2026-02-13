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
  if (!skill?.id || typeof skill.id !== 'string') {
    issues.push(`[${sourceLabel}] ${skill?.name || '<unknown>'} 缺失专属ID(id)`);
  }

  if (!skill?.id || typeof skill.id !== 'string' || !skill.id.trim()) {
    issues.push(`[${sourceLabel}] ${skill?.name || '<unknown>'} 缺失专属ID(id)`);
    warnings.push(`[${sourceLabel}] ${skill?.name || '<unknown>'} 将被构建流程跳过（缺失专属ID）`);
  }

  for (const key of ['cd', 'cast', 'duration', 'dmg_reduction']) {
    const value = skill[key];
    if (value != null && !isNum(value)) {
      issues.push(`[${sourceLabel}] ${skill.name || '<unknown>'} 字段 ${key} 必须为数字或空`);
    }
    if (isNum(value) && value < 0) {
      issues.push(`[${sourceLabel}] ${skill.name || '<unknown>'} 字段 ${key} 不能为负数`);
    }
  }

  if (!Array.isArray(db.rules)) {
    issues.push('rules 必须为数组');
  }

  if (issues.length > 0) {
    console.error('== 校验失败 ==');
    for (const i of issues) console.error(`- ${i}`);
    process.exit(1);
  }

  const idSeen = new Set();
  const namePerBucketSeen = new Map();

function checkBucket(skills, sourceLabel) {
  const issues = [];
  const warnings = [];
  const seen = new Set();
  const seenIds = new Set();

    if (idSeen.has(skill.id)) {
      issues.push(`存在重复技能 id：${skill.id}`);
    }
    idSeen.add(skill.id);

    const skillId = (s?.id || '').trim();
    if (skillId) {
      if (seenIds.has(skillId)) {
        issues.push(`[${sourceLabel}] 存在重复专属ID(id)：${skillId}`);
      }
      seenIds.add(skillId);
    }

    const result = checkSkill(s, sourceLabel);
    issues.push(...result.issues);
    warnings.push(...result.warnings);
  }

    if (!VALID_BUCKETS.has(skill.bucket)) {
      issues.push(`[${skill.id}] bucket 非法：${skill.bucket}`);
    }

    const dedupeKey = `${skill.bucket}::${skill.source || ''}::${skill.name || ''}`;
    if (namePerBucketSeen.has(dedupeKey)) {
      issues.push(`[${skill.id}] 重复技能名（同 bucket/source）：${skill.name}`);
    }
    namePerBucketSeen.set(dedupeKey, true);

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
  const actualProfessions = [...new Set(db.skills.filter((s) => s.bucket === '职业技能').map((s) => s.source).filter(Boolean))];
  if (JSON.stringify(metaProfessions) !== JSON.stringify(actualProfessions)) {
    issues.push('meta.professions 与职业技能中的所属不一致');
  }

  const metaJianghuCategories = db?.meta?.jianghu_categories ?? [];
  const actualJianghuCategories = [...new Set(db.skills.filter((s) => s.bucket === '江湖技能').map((s) => s.source).filter(Boolean))];
  if (JSON.stringify(metaJianghuCategories) !== JSON.stringify(actualJianghuCategories)) {
    issues.push('meta.jianghu_categories 与江湖技能中的所属不一致');
  }

  for (const rule of db.rules) {
    if (!rule?.skill || !rule?.related || !rule?.relation) {
      issues.push('rules 中存在缺失 skill/related/relation 的记录');
      continue;
    }
  }

  console.log('== DB 统计 ==');
  console.log(`技能总数: ${db.skills.length}`);
  console.log(`规则总数: ${db.rules.length}`);
  console.log(`职业列表: ${(db.meta.professions || []).join(', ') || '(空)'}`);
  console.log(`江湖分类: ${(db.meta.jianghu_categories || []).join(', ') || '(空)'}`);

  const relationTypes = new Set(['前置', '替换技能', '互斥', '共享时间', '共享冷却', '窗口期']);
  const allIds = new Set();
  for (const skills of Object.values(profession)) for (const s of skills) if (s?.id) allIds.add(s.id);
  for (const skills of Object.values(universal)) for (const s of skills) if (s?.id) allIds.add(s.id);

  const relations = db?.rules?.relations ?? [];
  for (const r of relations) {
    if (!relationTypes.has(r?.relation_type)) {
      issues.push(`机制关系类型非法: ${r?.relation_type || '<empty>'}`);
    }
    if (!allIds.has(r?.from_id)) issues.push(`机制 from_id 不存在: ${r?.from_id || '<empty>'}`);
    if (!allIds.has(r?.to_id)) issues.push(`机制 to_id 不存在: ${r?.to_id || '<empty>'}`);
    if ((r?.relation_type === '替换技能' || r?.relation_type === '窗口期') && !isNum(r?.param)) {
      issues.push(`机制 ${r?.relation_type} 缺少参数: ${r?.from_id} -> ${r?.to_id}`);
    }
  }

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
