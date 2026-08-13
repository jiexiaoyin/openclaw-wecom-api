/**
 * smartsheet-registry.js (v2026-07-26)
 *
 * 智能表格 SSOT 加载器 + zero-deps validator + 业务工具方法
 *
 * 用途：
 *   - 加载 docs/smartsheet-registry.json (智能表格登记)
 *   - 校验数据 schema (跟 docs/smartsheet-registry.schema.json 一致, zero-deps)
 *   - 提供 list / search / getByDocId / getByName / getByTag 业务方法
 *
 * 设计原则 (跟 templates-loader 完全同模式):
 *   1. 零依赖 (无 ajv/zod), 手写 ~50 行 validator
 *   2. 默认 validate=true (读到非法 JSON 抛错, 防格式漂移)
 *   3. 业务方法放在类里 (loadSmartSheetRegistry().list() etc.)
 *
 * 老板用例 (per query 11:04):
 *   const reg = loadSmartSheetRegistry();
 *   reg.searchByName('晨报');        // → [{docid, sheetId, name, ...}]
 *   reg.getByDocId('DC1ARtPa...');   // → 单条记录
 *   reg.list();                       // → 全部
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const DOCS_DIR_DEFAULT = path.join(__dirname, '..', '..', 'docs');
const REGISTRY_FILE = 'smartsheet-registry.json';
const SCHEMA_FILE = 'smartsheet-registry.schema.json';

/**
 * Zero-deps JSON Schema validator (跟 templates-validator.js 同模式 - 简化版)
 * @param {object} data - 待校验数据
 * @param {object} schema - JSON Schema (Draft-07 子集)
 * @returns {{ok: boolean, errors: string[]}}
 */
function validateJsonSchema(data, schema) {
  const errors = [];

  function checkType(value, expected, path) {
    if (expected === 'string' && typeof value !== 'string') {
      errors.push(`${path}: expected string, got ${typeof value}`);
    } else if (expected === 'number' && typeof value !== 'number') {
      errors.push(`${path}: expected number, got ${typeof value}`);
    } else if (expected === 'boolean' && typeof value !== 'boolean') {
      errors.push(`${path}: expected boolean, got ${typeof value}`);
    } else if (expected === 'array' && !Array.isArray(value)) {
      errors.push(`${path}: expected array, got ${typeof value}`);
    } else if (expected === 'object' && (typeof value !== 'object' || Array.isArray(value) || value === null)) {
      errors.push(`${path}: expected object, got ${typeof value}`);
    }
  }

  function validateNode(value, subSchema, path) {
    if (!subSchema || typeof subSchema !== 'object') return;

    // type check
    if (subSchema.type) checkType(value, subSchema.type, path);

    // required
    if (subSchema.required && Array.isArray(subSchema.required)) {
      for (const k of subSchema.required) {
        if (!(k in (value || {}))) errors.push(`${path}: missing required field "${k}"`);
      }
    }

    // additionalProperties
    if (subSchema.additionalProperties === false && subSchema.properties) {
      for (const k of Object.keys(value || {})) {
        if (!(k in subSchema.properties)) errors.push(`${path}: unexpected field "${k}"`);
      }
    }

    // string constraints
    if (subSchema.type === 'string' && typeof value === 'string') {
      if (subSchema.minLength != null && value.length < subSchema.minLength) {
        errors.push(`${path}: string length ${value.length} < minLength ${subSchema.minLength}`);
      }
      if (subSchema.maxLength != null && value.length > subSchema.maxLength) {
        errors.push(`${path}: string length ${value.length} > maxLength ${subSchema.maxLength}`);
      }
      if (subSchema.pattern && !new RegExp(subSchema.pattern).test(value)) {
        errors.push(`${path}: pattern mismatch "${value}"`);
      }
    }

    // array constraints
    if (subSchema.type === 'array' && Array.isArray(value)) {
      if (subSchema.minItems != null && value.length < subSchema.minItems) {
        errors.push(`${path}: array length ${value.length} < minItems ${subSchema.minItems}`);
      }
      if (subSchema.items) value.forEach((v, i) => validateNode(v, subSchema.items, `${path}[${i}]`));
    }

    // object properties
    if (subSchema.type === 'object' && subSchema.properties && typeof value === 'object') {
      for (const [k, propSchema] of Object.entries(subSchema.properties)) {
        if (k in (value || {})) validateNode(value[k], propSchema, `${path}.${k}`);
      }
    }
  }

  validateNode(data, schema, '$');
  return { ok: errors.length === 0, errors };
}

/**
 * 加载 smartsheet registry JSON
 * @param {object} [options]
 * @param {boolean} [options.validate=true] - 是否校验 schema
 * @param {string} [options.docsPath] - docs 目录路径
 * @returns {object} - { _meta, sheets, list(), searchByName(), ... }
 */
function loadSmartSheetRegistry(options = {}) {
  const { validate = true, docsPath = DOCS_DIR_DEFAULT } = options;
  const filePath = path.join(docsPath, REGISTRY_FILE);
  const schemaPath = path.join(docsPath, SCHEMA_FILE);

  if (!fs.existsSync(filePath)) {
    throw new Error(`smartsheet-registry.json not found: ${filePath}`);
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  if (validate) {
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`smartsheet-registry.schema.json not found: ${schemaPath}`);
    }
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const result = validateJsonSchema(raw, schema);
    if (!result.ok) {
      throw new Error(`smartsheet-registry.json schema validation failed:\n  - ${result.errors.join('\n  - ')}`);
    }
  }

  // 业务方法绑定
  const data = raw;
  const sheets = data.sheets || [];

  return {
    _meta: data._meta || {},
    sheets,

    /** 列出全部 */
    list() {
      return [...sheets];
    },

    /** 按 docid 查 */
    getByDocId(docid) {
      return sheets.find(s => s.docid === docid) || null;
    },

    /** 按 name 精确查 */
    getByName(name) {
      return sheets.find(s => s.name === name) || null;
    },

    /** 按 name 模糊查 (substring match) */
    searchByName(name) {
      const kw = (name || '').toString().trim();
      if (!kw) return [];
      return sheets.filter(s => s.name && s.name.includes(kw));
    },

    /** 按 tag 查 (任一 tag 命中即返回) */
    getByTag(tag) {
      return sheets.filter(s => Array.isArray(s.tags) && s.tags.includes(tag));
    },

    /** 按 purpose 模糊查 */
    searchByPurpose(text) {
      const kw = (text || '').toString().trim();
      if (!kw) return [];
      return sheets.filter(s => s.purpose && s.purpose.includes(kw));
    },

    /** 计数 */
    count() {
      return sheets.length;
    },

    /** 标记使用时间 (业务方调用) */
    markUsed(docid) {
      const item = this.getByDocId(docid);
      if (item) {
        item.last_used_at = new Date().toISOString().slice(0, 10);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
      }
    },
  };
}

module.exports = {
  loadSmartSheetRegistry,
  validateJsonSchema,
  REGISTRY_FILE,
  SCHEMA_FILE,
};