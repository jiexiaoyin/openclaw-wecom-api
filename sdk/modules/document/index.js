/**
 * 文档管理模块（wedoc）— v1.1.0 全量重写
 * 数据源：2026-06-06 抓取的官方文档 wechat-work-api-docs.md（56 URL）
 * 覆盖范围：35 个接口 — 文档 CRUD + 文档内容 + 表格内容 + 智能表格 12 个 + 权限 4 + 收集表 5 + VIP 3 + 素材 1
 * 单独 webhook 客户端：./webhook.js（9 章：接收外部数据到智能表格，webhook URL 模式）
 *
 * 重要 path 踩坑（v1.1.0 vs openapi spec 0.0.10 旧版）:
 *   - 收集表编辑: /wedoc/modify_form（不是 /wedoc/modify_collect）
 *   - 文档权限: mod_doc_safty_setting（typo: "safty"）
 *   - 智能表格: 全 /wedoc/smartsheet/* 路径（openapi 0.0.10 没有）
 *   - 文档内容: /wedoc/document/batch_update + /wedoc/document/get（openapi 没有）
 *
 * v2026-07-26 老板 query 11:04 + 11:06: 业务数据 SSOT 化
 *   - smartsheet-registry.js (utils/) 提供零依赖加载 + 校验
 *   - SDK 3 个业务方法: loadSmartSheetRegistry / registerSmartSheet / searchSheets
 *   - 避免 docid/formid 硬编码在 cron/JSON 中
 */

const WeComSDK = require('../../sdk');
const { loadSmartSheetRegistry } = require('../../utils/smartsheet-registry');

class Document extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ============================================================
  // 二、管理文档 (5)
  // ============================================================

  /**
   * 新建文档/表格/智能表格
   * @param {object} params
   *   - spaceid {string} 空间 ID（可选，同时要传 fatherid）
   *   - fatherid {string} 父目录 fileid（根目录时 = spaceid）
   *   - docType {number} 必填：3=文档 4=表格 10=智能表格
   *   - docName {string} 必填：文档名（≤255 字符）
   *   - adminUsers {string[]} 文档管理员 userid
   * @returns {Promise<{url, docid}>}
   */
  async createDoc(params) {
    return this.post('/wedoc/create_doc', {
      spaceid: params.spaceid,
      fatherid: params.fatherid,
      doc_type: params.docType,
      doc_name: params.docName,
      admin_users: params.adminUsers,
    });
  }
  /**
   * v1.5.2 coverage-enhance: 获取文档图片素材 (临时 url)
   * 用于在文档/SmartSheet 中显示图片, 返回临时访问 URL
   * @param {string} docid 文档 ID
   * @param {string} imageMediaId 图片素材 media_id
   * @returns {Promise<object>} { errcode, errmsg, tmp_url, expires_in }
   */
  async getDocImage(docid, imageMediaId) {
    return this.post('/wedoc/image', {
      docid,
      image_media_id: imageMediaId
    });
  }

  /**
   * v1.5.2 coverage-enhance: 配置智能表格事件回调 (webhook)
   * 当智能表格记录增删改时, 企微会 POST 事件到用户配置的 callback URL
   * @param {object} params { docid, sheet_id, url, secret, enable }
   *   - docid 智能表格 ID
   *   - sheet_id 子表 ID (可选, 不传则整表生效)
   *   - url 回调地址
   *   - secret 签名密钥 (用于回调验签)
   *   - enable 1=启用, 0=关闭
   * @returns {Promise<object>} { errcode, errmsg }
   */
  async configSmartSheetWebhook(params) {
    const { docid, sheetId, url, secret, enable } = params;
    return this.post('/wedoc/smartsheet/webhook', {
      docid,
      sheet_id: sheetId,
      url,
      secret,
      enable
    });
  }


  /**
   * 重命名文档/收集表（docid / formid 二选一）
   */
  async renameDoc({ docid, formid, newName }) {
    return this.post('/wedoc/rename_doc', { docid, formid, new_name: newName });
  }

  /**
   * 删除文档/收集表（docid / formid 二选一）
   */
  async deleteDoc({ docid, formid }) {
    return this.post('/wedoc/del_doc', { docid, formid });
  }

  /**
   * 获取文档/表格/智能表格/收集表基础信息
   * @returns {Promise<{doc_base_info: {docid, doc_name, create_time, modify_time, doc_type}}>}
   */
  async getDocBaseInfo(docid) {
    return this.post('/wedoc/get_doc_base_info', { docid });
  }

  /**
   * 获取分享链接
   */
  async shareDoc({ docid, formid }) {
    return this.post('/wedoc/doc_share', { docid, formid });
  }

  // ============================================================
  // 三、管理文档内容 (2)
  // requests 是 UpdateRequest 数组（≤30 个），每个 UpdateRequest 只能填一个字段
  //   replace_text / insert_text / delete_content / insert_image /
  //   insert_page_break / insert_table / insert_paragraph / update_text_property
  // ============================================================

  /**
   * 批量编辑文档内容
   * @param {string} docid
   * @param {object[]} requests UpdateRequest 数组（≤30 个）
   * @param {number} [version] 文档版本号（最新版本-100 范围内）
   */
  async updateDocument(docid, requests, version) {
    const body = { docid, requests };
    if (version != null) body.version = version;
    return this.post('/wedoc/document/batch_update', body);
  }

  /**
   * 获取文档数据（返回 Node 树 + version）
   */
  async getDocument(docid) {
    return this.post('/wedoc/document/get', { docid });
  }

  // ============================================================
  // 四、管理普通表格内容 (3)
  // ============================================================

  /**
   * 批量编辑表格内容（操作会逐个执行，任一报错则停止）
   * @param {string} docid
   * @param {object[]} requests UpdateRequest 数组（≤5 个）
   *   add_sheet_request / delete_sheet_request / update_range_request / delete_dimension_request
   */
  async updateSpreadsheet(docid, requests) {
    return this.post('/wedoc/spreadsheet/batch_update', { docid, requests });
  }

  /**
   * 获取表格的工作表/行/列元信息
   * @returns {Promise<{properties: Array<{sheet_id, title, row_count, column_count}>}>}
   */
  async getSpreadsheetProperties(docid) {
    return this.post('/wedoc/spreadsheet/get_sheet_properties', { docid });
  }

  /**
   * 获取表格指定范围数据（A1 表示法）
   * @param {string} docid
   * @param {string} sheetId
   * @param {string} range e.g. "A1:B2"
   */
  async getSpreadsheetRange(docid, sheetId, range) {
    return this.post('/wedoc/spreadsheet/get_sheet_range_data', { docid, sheet_id: sheetId, range });
  }

  // ============================================================
  // 五、管理智能表格内容 (12) — 子表 4 + 视图 4 + 字段 4
  // ============================================================

  // --- 子表 ---

  /**
   * 添加子表
   * @param {string} docid
   * @param {object} properties { title, index? }
   */
  async addSmartSheet(docid, properties) {
    return this.post('/wedoc/smartsheet/add_sheet', { docid, properties });
  }

  /**
   * 删除子表
   */
  async deleteSmartSheet(docid, sheetId) {
    return this.post('/wedoc/smartsheet/delete_sheet', { docid, sheet_id: sheetId });
  }

  /**
   * 更新子表（仅改标题）
   * @param {object} properties { sheet_id, title }
   */
  async updateSmartSheet(docid, properties) {
    return this.post('/wedoc/smartsheet/update_sheet', { docid, properties });
  }

  /**
   * 查询子表
   * @param {string} docid
   * @param {string} [sheetId] 不传 = 查全部
   * @param {boolean} [needAllTypeSheet] 是否含仪表盘/说明页
   */
  async getSmartSheet(docid, sheetId, needAllTypeSheet) {
    return this.post('/wedoc/smartsheet/get_sheet', { docid, sheet_id: sheetId, need_all_type_sheet: needAllTypeSheet });
  }

  // --- 视图 ---

  /**
   * 添加视图
   * @param {object} params { docid, sheetId, viewTitle, viewType, propertyGantt?, propertyCalendar? }
   *   viewType: VIEW_TYPE_GRID / KANBAN / GALLERY / GANTT / CALENDAR
   */
  async addView({ docid, sheetId, viewTitle, viewType, propertyGantt, propertyCalendar }) {
    const body = { docid, sheet_id: sheetId, view_title: viewTitle, view_type: viewType };
    if (propertyGantt) body.property_gantt = propertyGantt;
    if (propertyCalendar) body.property_calendar = propertyCalendar;
    return this.post('/wedoc/smartsheet/add_view', body);
  }

  /**
   * 删除视图（多个）
   */
  async deleteViews(docid, sheetId, viewIds) {
    return this.post('/wedoc/smartsheet/delete_views', { docid, sheet_id: sheetId, view_ids: viewIds });
  }

  /**
   * 更新视图
   * @param {object} params { docid, sheetId, viewId, viewTitle?, property? }
   */
  async updateView({ docid, sheetId, viewId, viewTitle, property }) {
    const body = { docid, sheet_id: sheetId, view_id: viewId };
    if (viewTitle) body.view_title = viewTitle;
    if (property) body.property = property;
    return this.post('/wedoc/smartsheet/update_view', body);
  }

  /**
   * 查询视图
   * @param {object} params { docid, sheetId, viewIds?, offset?, limit? }
   */
  async getViews({ docid, sheetId, viewIds, offset, limit }) {
    return this.post('/wedoc/smartsheet/get_views', {
      docid, sheet_id: sheetId, view_ids: viewIds, offset,
      limit: Math.min(limit || 0, 1000),  // v1.5.2 文档上限 1000
    });
  }

  // --- 字段 ---

  /**
   * 添加字段（多个）
   * @param {object[]} fields AddField 数组（field_title + field_type + 对应 property_*）
   */
  async addFields(docid, sheetId, fields) {
    return this.post('/wedoc/smartsheet/add_fields', { docid, sheet_id: sheetId, fields });
  }

  /**
   * 删除字段（多个）
   */
  async deleteFields(docid, sheetId, fieldIds) {
    return this.post('/wedoc/smartsheet/delete_fields', { docid, sheet_id: sheetId, field_ids: fieldIds });
  }

  /**
   * 更新字段（仅改标题 + property，不能改类型）
   */
  async updateFields(docid, sheetId, fields) {
    return this.post('/wedoc/smartsheet/update_fields', { docid, sheet_id: sheetId, fields });
  }

  /**
   * 查询字段
   * @param {object} params { docid, sheetId, viewId?, fieldIds?, fieldTitles?, offset?, limit? }
   */
  async getFields({ docid, sheetId, viewId, fieldIds, fieldTitles, offset, limit }) {
    return this.post('/wedoc/smartsheet/get_fields', {
      docid, sheet_id: sheetId, view_id: viewId,
      field_ids: fieldIds, field_titles: fieldTitles, offset,
      limit: Math.min(limit || 0, 1000),  // v1.5.2 文档上限 1000
    });
  }

  // ============================================================
  // 六、设置文档权限 (4)
  // ============================================================

  /**
   * 修改文档查看规则
   * @param {object} params { docid, ... }
   */
  async modDocJoinRule(params) {
    return this.post('/wedoc/mod_doc_join_rule', params);
  }

  /**
   * 修改文档通知范围及权限
   * @param {object} params { docid, ... }
   */
  async modDocMember(params) {
    return this.post('/wedoc/mod_doc_member', params);
  }

  /**
   * 修改文档安全设置
   * @param {object} params { docid, ... }
   * @note path 有 typo: "safty" 不是 "safety"
   */
  async modDocSafetySetting(params) {
    return this.post('/wedoc/mod_doc_safty_setting', params);
  }

  /**
   * 获取文档权限信息
   */
  async getDocAuth(params) {
    return this.post('/wedoc/doc_get_auth', params);
  }

  // ============================================================
  // 七、管理收集表 (5)
  // ============================================================

  /**
   * 创建收集表
   * @param {object} params { formTitle, formDesc?, formHeader?, formQuestion, formSetting, ... }
   */
  async createCollect(params) {
    return this.post('/wedoc/create_collect', params);
  }

  /**
   * 编辑收集表
   * @param {object} params { oper: 1|2, formid, form_info? }
   *   oper=1: 全量修改问题；oper=2: 全量修改设置
   * @note path 是 /modify_form（不是 openapi 旧版的 /modify_collect）
   */
  async modifyForm(params) {
    return this.post('/wedoc/modify_form', params);
  }

  /**
   * 获取收集表信息
   * @returns {Promise<{form_info, repeated_id[]}>}
   */
  async getFormInfo(formid) {
    return this.post('/wedoc/get_form_info', { formid });
  }

  /**
   * 收集表统计查询
   * @param {object} params { repeatedId, reqType: 1|2|3, startTime?, endTime?, limit?, cursor? }
   *   reqType: 1=只统计 2=已提交列表 3=未提交列表
   */
  async getFormStatistic({ repeatedId, reqType, startTime, endTime, limit, cursor }) {
    return this.post('/wedoc/get_form_statistic', {
      repeated_id: repeatedId, req_type: reqType,
      start_time: startTime, end_time: endTime, limit, cursor,
    });
  }

  /**
   * 读取收集表答案
   * @param {object} params { repeatedId, answerIds: number[] }
   */
  async getFormAnswer({ repeatedId, answerIds }) {
    return this.post('/wedoc/get_form_answer', { repeated_id: repeatedId, answer_ids: answerIds });
  }

  // ============================================================
  // 十、高级功能账号管理 (3) — 仅自建应用可用
  // ============================================================

  /**
   * 分配高级功能账号（≤100 userid）
   * @returns {Promise<{succ_userid_list, fail_userid_list}>}
   */
  async vipBatchAdd(useridList) {
    return this.post('/wedoc/vip/batch_add', { userid_list: useridList });
  }

  /**
   * 取消高级功能账号（≤100 userid）
   */
  async vipBatchDel(useridList) {
    return this.post('/wedoc/vip/batch_del', { userid_list: useridList });
  }

  /**
   * 获取已分配的高级功能账号列表（分页）
   * @param {object} [params] { cursor?, limit? } limit ≤ 200, 默认 100
   * @returns {Promise<{has_more, next_cursor, userid_list}>}
   */
  async vipList({ cursor, limit } = {}) {
    return this.post('/wedoc/vip/list', { cursor, limit });
  }

  // ============================================================
  // 智能表格 — 记录 CRUD (v1.2.1 新增 get_records)
  // ============================================================

  /**
   * 查询子表记录（v1.2.1 新增）
   * 透传 WeCom 官方 API：/cgi-bin/wedoc/smartsheet/get_records
   *
   * 背景：v1.0~v1.2 仅支持 add/update/delete（v1.1 走 webhook + access_token 通道），
   * 读记录一直缺失 → 老板 6/6 16:33 "go 1a" 拍板先补这一个。
   * v1.3 修复：字段名 filter → filter_spec（文档原字段名为 filter_spec；文档同时明确
   *          filter_spec 不支持和 sort 一起使用）
   * v1.3 计划：add_records 走 access_token 通道 + 过滤/排序/视图原生透传（暂不二次封装）。
   *
   * @param {object} params
   *   - docid {string} 必填，文档 ID
   *   - sheetId {string} 必填，子表 ID
   *   - viewId {string} 可选，视图 ID（用视图的字段顺序/过滤）
   *   - fieldIds {string[]} 可选，限定返回字段
   *   - fieldTitles {string[]} 可选，按字段名限定（与 fieldIds 互斥）
   *   - offset {number} 可选，分页偏移（默认 0）
   *   - limit {number} 可选，每页条数（默认 100，文档最大 1000）
   *   - filter {object} 可选，过滤条件 {conjunction, conditions[]}（v1.3 自动转 filter_spec）
   *   - sort {object} 可选，排序 {field_id, desc}（注意：与 filter 互斥）
   * @returns {Promise<{errcode, errmsg, records, total, has_more}>}
   */
  async getRecords({ docid, sheetId, viewId, recordIds, keyType, fieldIds, fieldTitles, offset, limit, ver, filter, sort }) {
    return this.post('/wedoc/smartsheet/get_records', {
      docid,
      sheet_id: sheetId,
      view_id: viewId,
      record_ids: recordIds,
      key_type: keyType,
      field_ids: fieldIds,
      field_titles: fieldTitles,
      offset,
      limit,
      ver,
      filter_spec: filter,  // v1.3 修复：filter → filter_spec（文档原字段名）
      sort,
    });
  }

  /**
   * 添加记录（v1.3.0 新增，access_token 通道）
   * 透传 WeCom 官方 API：/cgi-bin/wedoc/smartsheet/add_records
   *
   * 与 document_webhook.update_records（webhook URL 推入）不同：addRecords
   * 走 access_token 通道，可在后台 SDK 直接添加记录（无需开 webhook）。
   *
   * ⚠️ 不能添加/更新以下字段：
   *   - 创建时间、最后编辑时间、创建人、最后编辑人
   *
   * @param {string} docid 必填，文档 ID
   * @param {string} sheetId 必填，子表 ID
   * @param {string} [keyType] 可选，'CELL_VALUE_KEY_TYPE_FIELD_TITLE'（默认）| 'CELL_VALUE_KEY_TYPE_FIELD_ID'
   * @param {Array<{values: object}>} records 记录数组，每条 values 用字段标题或 ID 作 key
   *   单次 ≤ 500 行；单表最多 100000 行 / 15000000 单元格
   * @returns {Promise<{errcode, errmsg, records: CommonRecord[]}>}
   */
  async addRecords(docid, sheetId, records, keyType = 'CELL_VALUE_KEY_TYPE_FIELD_TITLE') {
    return this.post('/wedoc/smartsheet/add_records', {
      docid,
      sheet_id: sheetId,
      key_type: keyType,
      records,
    });
  }

  /**
   * 修改记录（v1.2.2 新增，access_token 通道）
   * 透传 WeCom 官方 API：/cgi-bin/wedoc/smartsheet/update_records
   *
   * ⚠️ 与 document_webhook.update_records 区别：
   * - webhook.update_records — webhook URL 推入（外部数据源）
   * - updateRecords（v1.2.2）— access_token 主动调入（后台 SDK 调用）
   *
   * sidecar（bin/sidecar-notifier.js）专用，监听 update_record 事件后拉变更后 values 推送。
   *
   * @param {string} docid 必填，文档 ID
   * @param {string} sheetId 必填，子表 ID
   * @param {Array<{record_id: string, values: object}>} records
   *   record_id: 要修改的记录 ID
   *   values: 字段 ID → CellValue，CellValue 类型同 v1.1.0 webhook add_records
   * @returns {Promise<{errcode, errmsg, update_records: CommonRecord[]}>}
   */
  async updateRecords(docid, sheetId, records) {
    return this.post('/wedoc/smartsheet/update_records', {
      docid,
      sheet_id: sheetId,
      records,
    });
  }

  /**
   * 删除记录（v1.2.2 新增，access_token 通道）
   * 透传 WeCom 官方 API：/cgi-bin/wedoc/smartsheet/delete_records
   *
   * ⚠️ 与 document_webhook.update_records 区别：删除是物理删除，不可恢复。
   *
   * @param {string} docid 必填，文档 ID
   * @param {string} sheetId 必填，子表 ID
   * @param {string[]} recordIds 要删除的记录 ID 列表（≤1000）
   * @returns {Promise<{errcode, errmsg, record_id_list: string[]}>}
   */
  async deleteRecords(docid, sheetId, recordIds) {
    // v1.5.2 修复：record_id_list → record_ids（文档要求字段名）
    return this.post('/wedoc/smartsheet/delete_records', {
      docid,
      sheet_id: sheetId,
      record_ids: recordIds,
    });
  }

  // ============================================================
  // 十一、素材管理 (1)
  // ============================================================

  /**
   * 上传文档图片（base64 模式，非 multipart）
   * @param {string} docid 必填
   * @param {string} base64Content 图片 base64（不带 "data:image/...;base64," 前缀）
   * @returns {Promise<{url, height, width, size}>}
   */
  // ============================================================
  // 十二、智能文档 smartdoc（轻文档，v1.5.2 新增）
  // 智能文档 = 页面 + 块 + 数据表，分页式结构不同于智能表格
  // ============================================================

  /**
   * 添加内容块（v1.5.2 新增）
   * @param {string} docid
   * @param {string} pageId
   * @param {object[]} blocks 块对象数组（含 type/text/image/miniprogram 等字段）
   * @returns {Promise<{errcode, errmsg, block_id_list}>}
   */
  async addSmartBlock(docid, pageId, blocks) {
    return this.post('/wedoc/smartdoc/add', {
      docid,
      page_id: pageId,
      blocks
    });
  }

  /**
   * 添加数据表（v1.5.2 新增）
   * @param {string} docid
   * @param {object} info { title, after_id? }
   */
  async addSmartGrid(docid, info) {
    return this.post('/wedoc/smartdoc/add', { docid, info });
  }

  /**
   * 添加页面（v1.5.2 新增）
   * @param {string} docid
   * @param {object} info { title, parent_id?, after_id?, layout_mode? }
   */
  async addSmartPage(docid, info) {
    return this.post('/wedoc/smartdoc/add', { docid, info });
  }

  /**
   * 获取数据源（v1.5.2 新增）— 列出页面/块/数据表
   * @param {string} docid
   */
  async getSmartSources(docid) {
    return this.post('/wedoc/smartdoc/get', { docid });
  }

  /**
   * 获取页面结构（v1.5.2 新增）
   * @param {string} docid
   * @returns 页面树结构
   */
  async getSmartPageStructure(docid) {
    return this.post('/wedoc/smartdoc/get', { docid, with_structure: true });
  }

  /**
   * 更新内容块（v1.5.2 新增）
   * @param {string} docid
   * @param {string} pageId
   * @param {object[]} blocks
   */
  async updateSmartBlock(docid, pageId, blocks) {
    return this.post('/wedoc/smartdoc/update', {
      docid,
      page_id: pageId,
      blocks
    });
  }

  /**
   * 更新数据表（v1.5.2 新增）
   * @param {string} docid
   * @param {object} info { block_id, title?, after_id? }
   */
  async updateSmartGrid(docid, info) {
    return this.post('/wedoc/smartdoc/update', { docid, info });
  }

  /**
   * 更新页面（v1.5.2 新增）
   * @param {string} docid
   * @param {object} info
   */
  async updateSmartPage(docid, info) {
    return this.post('/wedoc/smartdoc/update', { docid, info });
  }

  /**
   * 删除内容块（v1.5.2 新增）
   * @param {string} docid
   * @param {string} pageId
   * @param {string[]} ids 块 ID 列表
   */
  async deleteSmartBlock(docid, pageId, ids) {
    return this.post('/wedoc/smartdoc/delete', {
      docid,
      page_id: pageId,
      ids
    });
  }

  /**
   * 删除数据表（v1.5.2 新增）
   * @param {string} docid
   * @param {string} blockId 数据表块 ID
   */
  async deleteSmartGrid(docid, blockId) {
    return this.post('/wedoc/smartdoc/delete', {
      docid,
      block_id: blockId
    });
  }

  /**
   * 删除页面（v1.5.2 新增）
   * @param {string} docid
   * @param {string} pageId
   */
  async deleteSmartPage(docid, pageId) {
    return this.post('/wedoc/smartdoc/delete', { docid, page_id: pageId });
  }

  /**
   * 发布智能文档（v1.5.2 新增）
   * @param {string} docid
   * @param {number} publishRange 发布范围（具体值见文档）
   * @param {object[]} authList 访问权限列表 [{ type, userid }]
   */
  async publishSmartDoc(docid, publishRange, authList) {
    return this.post('/wedoc/smartdoc/publish', {
      docid,
      publish_range: publishRange,
      auth_list: authList
    });
  }

  /**
   * 取消发布智能文档（v1.5.2 新增）
   * @param {string} docid
   */
  async cancelSmartDoc(docid) {
    return this.post('/wedoc/smartdoc/cancel', { docid });
  }

  /**
   * 导出智能文档内容块（v1.5.2 新增）
   * @param {string} docid
   * @param {object} params { content_type, url, page_id }
   */
  async exportSmartBlock(docid, params) {
    return this.post('/wedoc/smartdoc/export', { docid, ...params });
  }

  // ============================================================
  // 十三、智能表格 + 群聊会话（v1.5.2 新增）
  // ============================================================

  /**
   * 获取群聊列表（v1.5.2 新增）
   * @param {string} docid
   * @param {object} [params] { cursor?, limit? }
   */
  async getSmartGroupChatList(docid, params = {}) {
    return this.post('/wedoc/smartsheet/groupchat/list', { docid, ...params });
  }

  /**
   * 获取群聊会话（v1.5.2 新增）
   * @param {string} docid
   * @param {string} chatId 群聊 ID
   */
  async getSmartGroupChat(docid, chatId) {
    return this.post('/wedoc/smartsheet/groupchat/get', {
      docid,
      chat_id: chatId
    });
  }

  /**
   * 修改群聊会话（v1.5.2 新增）
   * @param {string} docid
   * @param {object} params { chat_id, name?, owner?, add_user_list?, del_user_list? }
   */
  async updateSmartGroupChat(docid, params) {
    return this.post('/wedoc/smartsheet/groupchat/update', { docid, ...params });
  }

  /**
   * 管理智能表格内容权限（v1.5.2 新增）
   * @param {string} docid
   * @param {number} type 操作类型（1=设置 2=取消）
   * @param {string[]} ruleIdList 规则 ID 列表
   */
  async manageSmartContentRule(docid, type, ruleIdList) {
    return this.post('/wedoc/smartsheet/content', {
      docid,
      type,
      rule_id_list: ruleIdList
    });
  }

  // ========== v2026-07-26: 智能表格 SSOT 业务方法 ==========

  /**
   * 加载本地智能表格 SSOT 登记表 (docid/sheetId/name/purpose/owner)
   * 零依赖, 默认 validate=true (违反 schema 抛错)
   * @param {object} [options]
   * @param {boolean} [options.validate=true] - 是否校验 schema
   * @returns {object} - registry { _meta, sheets, list(), getByDocId(), ... }
   */
  loadSmartSheetRegistry(options = {}) {
    return loadSmartSheetRegistry(options);
  }

  /**
   * 登记一个新的智能表格到 SSOT (供业务方调用)
   * 会写回 docs/smartsheet-registry.json
   * @param {object} entry - { docid, sheetId?, name, purpose?, owner?, tags?, notes? }
   * @returns {object} - { ok, entry, registry }
   */
  registerSmartSheet(entry = {}) {
    const reg = loadSmartSheetRegistry();
    if (!entry.docid || !entry.name) {
      return { ok: false, error: 'docid + name 必填' };
    }
    // 重复检查
    const exists = reg.getByDocId(entry.docid);
    if (exists) {
      return { ok: false, error: `docid ${entry.docid} 已登记 (name: ${exists.name})` };
    }
    // 追加
    const newEntry = {
      docid: entry.docid,
      sheetId: entry.sheetId || null,
      name: entry.name,
      purpose: entry.purpose || '',
      owner: entry.owner || 'JieXiaoYin',
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      created_at: new Date().toISOString().slice(0, 10),
      last_used_at: null,
      notes: entry.notes || '',
    };
    reg.sheets.push(newEntry);
    // 写回 docs/ - 重新读 + 写 (确保 _meta 也保留)
    const fs = require('fs');
    const path = require('path');
    const docsDir = path.join(__dirname, '..', '..', 'docs');
    const filePath = path.join(docsDir, 'smartsheet-registry.json');
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    raw.sheets.push(newEntry);
    raw._meta = raw._meta || {};
    raw._meta.last_modified_at = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(raw, null, 2) + '\n');
    return { ok: true, entry: newEntry, total: raw.sheets.length };
  }

  /**
   * 模糊查智能表格 (按 name / tag / purpose)
   * @param {object} query - { name?, tag?, purpose? }
   * @returns {Array}
   */
  searchSheets(query = {}) {
    const reg = loadSmartSheetRegistry();
    let results = reg.list();
    if (query.name) results = results.filter(s => s.name && s.name.includes(query.name));
    if (query.tag) results = results.filter(s => Array.isArray(s.tags) && s.tags.includes(query.tag));
    if (query.purpose) results = results.filter(s => s.purpose && s.purpose.includes(query.purpose));
    if (query.docid) results = results.filter(s => s.docid === query.docid);
    return results;
  }
}

module.exports = Document;
