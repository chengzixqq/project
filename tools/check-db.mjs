#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const DB_FILE = path.resolve('src/data/db.js');

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

function checkSkill(skill, sourceLabel) {
  const issues = [];
  const warnings = [];

  if (!skill?.name || typeof skill.name !== 'string') {
    issues.push(`[${sourceLabel}] 缺失 name`);
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

  if (isNum(skill.dmg_reduction) && skill.dmg_reduction > 100) {
    issues.push(`[${sourceLabel}] ${skill.name} 减伤超过 100`);
  }

  if (isNum(skill.cast) && isNum(skill.duration) && skill.cast > skill.duration) {
    warnings.push(`[${sourceLabel}] ${skill.name} 读条时间大于持续时间（请确认是否为设计如此）`);
  }

  return { issues, warnings };
}

function checkBucket(skills, sourceLabel) {
  const issues = [];
  const warnings = [];
  const seen = new Set();
  const seenIds = new Set();

  for (const s of skills) {
    const key = (s?.name || '').trim();
    if (key) {
      if (seen.has(key)) {
        issues.push(`[${sourceLabel}] 存在重复技能名：${key}`);
      }
      seen.add(key);
    }

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

  return { issues, warnings };
}

function main() {
  const dbRaw = fs.readFileSync(DB_FILE, 'utf8');
  const db = parseDbModule(dbRaw);

  const issues = [];
  const warnings = [];

  for (const required of ['meta', 'modes', 'skills']) {
    if (!(required in db)) issues.push(`缺失顶层字段：${required}`);
  }

  const profession = db?.skills?.profession ?? {};
  const universal = db?.skills?.universal ?? {};

  let professionCount = 0;
  for (const [profName, skills] of Object.entries(profession)) {
    professionCount += skills.length;
    const result = checkBucket(skills, `职业:${profName}`);
    issues.push(...result.issues);
    warnings.push(...result.warnings);
  }

  let universalCount = 0;
  for (const [catName, skills] of Object.entries(universal)) {
    universalCount += skills.length;
    const result = checkBucket(skills, `通用:${catName}`);
    issues.push(...result.issues);
    warnings.push(...result.warnings);
  }

  console.log('== DB 统计 ==');
  console.log(`职业数量: ${Object.keys(profession).length}`);
  console.log(`职业技能总数: ${professionCount}`);
  console.log(`通用类别数量: ${Object.keys(universal).length}`);
  console.log(`通用技能总数: ${universalCount}`);

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
