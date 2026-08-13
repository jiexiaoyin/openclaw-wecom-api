/**
 * 审批管理模块
 * API 章节：二十二
 */

const WeComSDK = require('../../sdk');
const { loadApprovalTemplates, flattenTemplates } = require('../../utils/templates-loader');
const { diffTemplates, formatDiff } = require('../../utils/templates-diff');

class Approval extends WeComSDK {
  constructor(config) {
    super(config);
  }

  /**
   * 获取审批模板详情
   * v1.3.0 修复：原 /approval/get_template_detail 404，正确路径 /oa/gettemplatedetail
   * @param {string} templateId 模板 ID
   */
  async getTemplateDetail(templateId) {
    return this.post('/oa/gettemplatedetail', { template_id: templateId });
  }

  /**
   * 列出本地已知审批模板 (v2026-07-26 老板 query D)
   * 背景: 企微官方 API 不提供 list templates 接口, 老板 10:32 从企微 admin 后台 HTML 解析 33 个模板落盘 docs/approval-templates.json
   * @returns {Array<{group: string, name: string, template_id: string}>}
   */
  listTemplates() {
    const data = loadApprovalTemplates();
    return flattenTemplates(data);
  }

  /**
   * 按 group 名称分组列出本地已知模板
   * @returns {object} - { 组名: [{name, template_id}] }
   */
  listTemplatesByGroup() {
    const data = loadApprovalTemplates();
    const out = {};
    for (const [group, items] of Object.entries(data || {})) {
      if (group.startsWith('_')) continue;
      if (Array.isArray(items)) out[group] = items;
    }
    return out;
  }

  /**
   * 模糊查询审批模板 (v2026-07-26 老板 query 10:57)
   * 设计: 调 listTemplates() 平铺后 substring 过滤 (支持中文)
   * 老板用例: "请3天假" → searchTemplates({name:"请假"}) → 1 匹配
   *
   * @param {object} options
   * @param {string} options.name - 模板名关键字 (必填)
   * @param {string} [options.group] - 限制 group (可选)
   * @param {boolean} [options.exact=false] - 精确匹配 (默认 false = substring)
   * @returns {Array<{group, name, template_id}>}
   */
  searchTemplates(options = {}) {
    const { name, group, exact = false } = options;
    const kw = (name || '').toString().trim();
    if (!kw) return [];
    const all = flattenTemplates(loadApprovalTemplates());
    return all.filter(t => {
      // group 过滤
      if (group && t.group !== group) return false;
      // 名字匹配
      const nameHit = exact ? t.name === kw : t.name.includes(kw);
      const groupHit = exact ? t.group === kw : t.group.includes(kw);
      return nameHit || groupHit;
    });
  }

  /**
   * 同步审批模板详情 (v2026-07-26 老板 query B)
   * 背景: 企微 API 无 list templates 接口, 但 SDK 有 getTemplateDetail(templateId) 可拉单条
   * 设计: 读本地 docs/approval-templates.json + 并发调 getTemplateDetail 拼出完整详情
   * 用途: 老板需要“最新模板控件结构” 服务于以下场景
   *   1. 代码生 lI 跟 type/required/options
   *   2. 验证本地 docs 跟企微后台一致
   *   3. 避免手动 33 次复制模板 ID
   *
   * @param {object} [options]
   * @param {string[]} [options.templateIds] - 指定拉哪些 (默认: 本地全部)
   * @param {number} [options.concurrency=5] - 并发限制 (企微 API 限频考虑)
   * @param {boolean} [options.writeBack=false] - 是否写回 docs/approval-templates.json (同时需要添加 detail 字段)
   * @param {boolean} [options.controlsOnly=false] - 仅拉控件 (不拉名称/多语言)
   * @returns {Promise<Array<{
   *   template_id: string,
   *   errcode: number,
   *   errmsg: string,
   *   controls: Array<{ control, id, title, require, hidden }>,
   *   template_names: Array<{ text, lang }>
   * }>>}
   */
  async syncApprovalTemplates(options = {}) {
    const {
      templateIds = null,
      concurrency = 5,
      controlsOnly = false,
      writeBack = false
    } = options;

    // 1. 拿 ID 列表
    let ids;
    if (Array.isArray(templateIds) && templateIds.length > 0) {
      ids = templateIds;
    } else {
      ids = flattenTemplates(loadApprovalTemplates()).map(t => t.template_id);
    }
    if (!ids || ids.length === 0) return [];

    // 2. 并发拉详情 (v2026-07-26 老板 query 全做-A)
    //   concurrency=1 串行, >1 启用并发 (per SDK sdk.js batchWithDetails 模式)
    const results = new Array(ids.length);
    let nextIdx = 0;
    const workers = Array.from({ length: Math.min(concurrency, ids.length) }, () => (async () => {
      while (true) {
        const cur = nextIdx++;
        if (cur >= ids.length) return;
        const tid = ids[cur];
        try {
          const r = await this.getTemplateDetail(tid);
          if (r.errcode !== 0) {
            results[cur] = { template_id: tid, errcode: r.errcode, errmsg: r.errmsg, controls: [] };
            continue;
          }
          const controlsRaw = (r.template_content && r.template_content.controls) || [];
          const controls = controlsRaw.map(c => ({
            control: c.property?.control,
            id: c.property?.id,
            title: (c.property?.title || []).filter(t => t.lang === 'zh_CN').map(t => t.text).join('') || (c.property?.title?.[0]?.text || ''),
            require: c.property?.require,
            hidden: c.property?.display === 0 ? 1 : 0
          }));
          results[cur] = {
            template_id: tid,
            errcode: 0,
            errmsg: 'ok',
            controls,
            ...(controlsOnly ? {} : { template_names: r.template_names || [] })
          };
        } catch (e) {
          results[cur] = { template_id: tid, errcode: -1, errmsg: e.message, controls: [] };
        }
      }
    })());
    await Promise.all(workers);

    // 3. writeBack: 把控件细节写回 docs/approval-templates.json (v2026-07-26 老板 query 全做-A)
    if (writeBack) {
      this._writeBackTemplateDetails(results);
    }

    return results;
  }

  /**
   * writeBack 内部辅助: 把 syncApprovalTemplates 结果写回本地 JSON
   * @private
   */
  _writeBackTemplateDetails(results) {
    const fs = require('fs');
    const path = require('path');
    const docsDir = path.join(__dirname, '../../../docs');
    const templatesPath = path.join(docsDir, 'approval-templates.json');

    let data = {};
    if (fs.existsSync(templatesPath)) {
      data = JSON.parse(fs.readFileSync(templatesPath, 'utf-8'));
    }

    // 加 controls 字段 (本地 docs 不存, writeBack 时是可选增强)
    for (const r of results) {
      if (r.errcode !== 0) continue;
      for (const group of Object.keys(data)) {
        if (group.startsWith('_')) continue;
        const item = data[group].find(t => t.template_id === r.template_id);
        if (item) {
          item.controls = r.controls;
          item.controls_count = r.controls.length;
          item.synced_at = new Date().toISOString();
          break;
        }
      }
    }

    // 加 _sync 元数据
    data._sync = {
      synced_at: new Date().toISOString(),
      source: '企微 SDK syncApprovalTemplates',
      total: Object.values(data).filter(v => Array.isArray(v)).reduce((a, b) => a + b.length, 0),
      total_groups: Object.keys(data).filter(k => !k.startsWith('_')).length,
      synced_controls_count: results.filter(r => r.errcode === 0).reduce((a, b) => a + (b.controls?.length || 0), 0),
      sync_tool: 'w.approval.syncApprovalTemplates()'
    };

    fs.writeFileSync(templatesPath, JSON.stringify(data, null, 2) + '\n');
  }

  /**
   * 对比本地 docs 与企微后台实际模板控件 (v2026-07-26 老板 query 全做-B)
   * 设计: 调 syncApprovalTemplates 拉企微后台 + 读本地 docs/approval-templates.json + diff
   * 用途: 检测老板后台改了控件但本地 docs 未同步
   *
   * @param {object} [options]
   * @param {string[]} [options.templateIds] - 只 diff 这些 (默认: 全部)
   * @param {boolean} [options.formatOutput=true] - 返回人类可读文本 (false: 返回 object)
   * @returns {Promise<object|string>} - diff 结果
   */
  async diffApprovalTemplates(options = {}) {
    const { templateIds = null, formatOutput = true } = options;

    // 1. 拉企微后台所有模板详情
    const remote = await this.syncApprovalTemplates({
      templateIds,
      controlsOnly: true
    });

    // 2. 读本地 docs
    const local = loadApprovalTemplates();
    const flat = flattenTemplates(local);
    // 转成跟 syncApprovalTemplates 同结构 (本地没 controls, 用空 array)
    const localData = flat.map(t => ({
      template_id: t.template_id,
      name: t.name,
      group: t.group,
      controls: []   // 本地 docs 不存 controls, 只能跟名称+ID 比
    }));

    // 3. diff
    const diffResult = diffTemplates(localData, remote);

    return formatOutput ? formatDiff(diffResult) : diffResult;
  }

  /**
   * 提交审批申请
   * v1.3.1 字段对齐官方 API：支持「高层封装」与「原生格式」双输入。
   *
   * 【高层格式】（向后兼容，推荐）
   * {
   *   templateId,                    → template_id
   *   creator,                       → creator_userid
   *   useTemplate_approver,          → use_template_approver
   *   approver: [{type, userid},..], → process.node_list
   *   content: [{control,id,value}], → apply_data.contents
   *   summary,                       → summary_list (可选)
   * }
   *
   * 【原生格式】（v1.3.1 新增，转发与高级用户）
   * 直接传文档字段：template_id / creator_userid / process / apply_data / summary_list
   * SDK 不会变动，原样转发。
   *
   * 文档参考：/cgi-bin/oa/applyevent 请求包体
   * @param {object} params 审批参数（高层或原生格式二选一）
   * @returns {Promise<{errcode, errmsg, sp_no}>}
   */
  async submitApproval(params) {
    const isNative = params && (
      'creator_userid' in params ||
      'process' in params ||
      'apply_data' in params ||
      'summary_list' in params
    );

    // v2026-07-26 修复: 多别名兼容 + use_template_approver bool→int 自动转
    // 老板 query 11:21 gewe 测试: agent 传 boolean true + camelCase templateId → 触发 40058/301025
    // FIX 1: use_template_approver 若为 boolean 自动转 uint32 (1/0)
    // FIX 2: 高层/原生两种格式的字段别名都接受
    const toUseTemplateApprover = (v) => {
      if (v == null) return 0;
      if (typeof v === 'boolean') return v ? 1 : 0;
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    // v2026-07-26 11:40 修复: apply_data.contents[] 缺少 control 字段
    // 老板 query 11:37 测试发现: {id,value} 不够, 需要 {control,id,value}
    // 企微 API 返 "has no require control X-..." 因为它期望根据 control 字段验证 value 结构
    // FIX 3: 调用方未传 control 字段时, 自动从模板详情缓存中查找并补充 (零重试调用)
    //   - 优先从 params._templateDetail (调用方预拉) 读
    //   - 退而从 docs/approval-templates.json 读 (同 sync_templates writeBack 落盘)
    //   - 最后退而从企微拉 (唯一一次, 异步 + 避免雪崩)
    // FIX 4: 高层 content 入口同样应用 (apply_data.contents 也需 control)
    const enrichContentsWithControl = (contents) => {
      if (!Array.isArray(contents)) return contents;
      const needFill = contents.filter(c => c && c.id && !c.control);
      if (needFill.length === 0) return contents;

      // 1) 优先从预拉模板详情读
      let templateDetail = params._templateDetail;
      const tid = params.templateId || params.template_id;
      if (!templateDetail && tid) {
        try {
          const ssot = require('../../utils/templates-loader');
          const all = ssot.flattenTemplates(ssot.loadApprovalTemplates());
          const found = all.find(t => t.template_id === tid);
          if (found) {
            // docs/approval-templates.json 的 controls 存的是 {control, id, title, require, hidden}
            templateDetail = { template_content: { controls: all.map(()=>null).filter(()=>false) } };
            const ssotDoc = JSON.parse(require('fs').readFileSync(
              require('path').join(__dirname, '../../../docs/approval-templates.json'), 'utf-8'
            ));
            for (const g of Object.keys(ssotDoc)) {
              if (g.startsWith('_')) continue;
              const arr = ssotDoc[g] || [];
              const t = arr.find(t => t.template_id === tid);
              if (t) { templateDetail = { template_content: { controls: t.controls || [] } }; break; }
            }
          }
        } catch (e) { /* 静默 fallback */ }
      }

      // 2) 构造 id -> control 映射表
      const idToControl = {};
      if (templateDetail?.template_content?.controls) {
        for (const c of templateDetail.template_content.controls) {
          if (c.id && c.control) idToControl[c.id] = c.control;
        }
      }

      // 3) 给缺 control 的 contents 补上 (不覆盖调用方已传的)
      return contents.map(c => {
        if (!c || !c.id) return c;
        if (c.control) return c;
        const ctrl = idToControl[c.id];
        return ctrl ? { ...c, control: ctrl } : c;
      });
    };

    let body;
    if (isNative) {
      // 原生格式：原样转发（保留 template_id / use_template_approver）
      body = {
        template_id: params.template_id || params.templateId,
        creator_userid: params.creator_userid || params.creator || params.callerUserid,
        use_template_approver: toUseTemplateApprover(params.use_template_approver !== undefined ? params.use_template_approver : params.useTemplateApprover),
        ...(params.process ? { process: params.process } : {}),
        ...(params.apply_data || params.applyData ? { apply_data: params.apply_data || params.applyData } : {}),
        ...(params.summary_list || params.summaryList ? { summary_list: params.summary_list || params.summaryList } : {}),
        ...(params.choose_department !== undefined ? { choose_department: params.choose_department } : {}),
      };
      // v2026-07-26 11:40 fix-3: 原生 apply_data.contents 也补 control 字段
      if (body.apply_data?.contents) {
        body.apply_data.contents = enrichContentsWithControl(body.apply_data.contents);
      }
    } else {
      // 高层格式：自动转换为文档字段名
      const {
        templateId, template_id,
        creator, creator_userid, callerUserid,
        useTemplate_approver, useTemplateApprover, use_template_approver,
        approver, approvers,
        content, contents, apply_data, applyData,
        summary, summary_list, summaryList,
        choose_department,
      } = params;
      // v2026-07-26 11:40 fix-3: 高层 content/contents 也补 control 字段
      const enrichedContent = enrichContentsWithControl(content || contents);
      body = {
        template_id: templateId || template_id,
        creator_userid: creator || creator_userid || callerUserid,
        use_template_approver: toUseTemplateApprover(
          use_template_approver !== undefined ? use_template_approver :
          useTemplateApprover !== undefined ? useTemplateApprover :
          useTemplate_approver
        ),
        ...(choose_department !== undefined ? { choose_department } : {}),
        ...(approver || approvers ? { process: { node_list: approver || approvers } } : {}),
        ...(apply_data || applyData ? { apply_data: apply_data || applyData } : {}),
        ...(content || contents ? { apply_data: { contents: enrichedContent } } : {}),
        ...(summary || summary_list || summaryList ? { summary_list: summary || summary_list || summaryList } : {}),
      };
    }

    return this.post('/oa/applyevent', body);
  }

  /**
   * 批量获取审批单号（正确路径：/oa/getapprovalinfo）
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   * @param {number} cursor 分页游标，默认 0（旧字段名 + 默认值选 '' 是 string 触发 40058，v1.0.1 修复）
   * @param {number} size 每页数量，1-100
   * @param {object|object[]} [filters] v1.5.1+ 服务端过滤，可选：
   *   - { key: 'sp_status',   value: '1' | '2' | '3' | '4' | '6' | '7' | '10' }
   *   - { key: 'template_id', value: 'tpl_xxx' }
   *   - { key: 'creator',     value: 'userid' }
   *   - { key: 'department',  value: 'dept_id' }
   *   - { key: 'record_type', value: '1..9' }（打卡补卡=2、会议室预定=7、退款审批=8...）
   *   简化传参也接受 { spStatus, templateId, creator, department, recordType }
   * @returns {Promise<{errcode, errmsg, sp_no_list, new_next_cursor}>}
   *
   * sp_status 取值：
   *   1=审批中 / 2=已通过 / 3=已驳回 / 4=已撤销
   *   6=通过后撤销 / 7=已删除 / 10=已支付
   */
  async getApprovalIds(startTime, endTime, cursor = 0, size = 100, filters = null) {
    // v1.5.1 服务端过滤：object/array 都支持，同一 object 多个 key 会转多条 filter（AND）
    let docFilters = null;
    if (filters) {
      const arr = Array.isArray(filters) ? filters : [filters];
      // 简化写法 → 官方格式
      // 同一 object 多个 key 都要拆成多条 filter（不能 if/else 丢）
      const toDoc = (f) => {
        if (!f) return [];
        if (f.key) return [{ key: f.key, value: String(f.value) }];
        const out = [];
        if (f.spStatus != null)   out.push({ key: 'sp_status',   value: String(f.spStatus) });
        if (f.sp_status != null)  out.push({ key: 'sp_status',   value: String(f.sp_status) });
        if (f.templateId)         out.push({ key: 'template_id', value: String(f.templateId) });
        if (f.template_id)        out.push({ key: 'template_id', value: String(f.template_id) });
        if (f.creator)            out.push({ key: 'creator',     value: String(f.creator) });
        if (f.department != null) out.push({ key: 'department',  value: String(f.department) });
        if (f.recordType != null) out.push({ key: 'record_type', value: String(f.recordType) });
        if (f.record_type != null) out.push({ key: 'record_type', value: String(f.record_type) });
        return out;
      };
      docFilters = arr.flatMap(toDoc);
      if (docFilters.length === 0) docFilters = null;
    }
    const body = {
      starttime: startTime,
      endtime: endTime,
      cursor: cursor,  // 老字段保留，避免老调用营错误发生
      limit: size     // 老字段保留
    };
    if (docFilters) body.filters = docFilters;
    return this.post('/oa/getapprovalinfo', body);
  }

  /**
   * 获取审批申请详情（正确路径：/oa/getapprovaldetail）
   * @param {string} spNo 审批单号
   */
  async getApprovalDetail(spNo) {
    return this.post('/oa/getapprovaldetail', { sp_no: spNo });
  }

  /**
   * 找出审批中单据的「卡点」（v1.5.1+）
   *
   * 用途：老板一键看「哪些审批卡住、卡在谁身上、停留多久、严重程度」。
   * 背后调 batchWithDetails：服务端过滤 spStatus=1 + 并发逐条拼详情。
   *
   * @param {object} options
   * @param {number} options.startTime 范围开始（秒）
   * @param {number} options.endTime 范围结束（秒）
   * @param {number} [options.spStatus=1] 状态过滤（1=审批中，默认）
   * @param {object} [options.filters] 透传给 getApprovalIds 的额外 filters
   * @param {number} [options.now] 「当前」参考时间（秒），默认 = Date.now()/1000
   * @returns {Promise<Array<{
   *   sp_no, sp_name, applyer, apply_time, age_hours,
   *   current_node, current_node_index,
   *   waiting_approvers: string[],
   *   is_parallel: boolean,
   *   severity: 'normal'|'low'|'medium'|'high'|'critical',
   *   notifyer
   * }>>}  按 severity 升序 + age_hours 降序
   */
  async findBottlenecks(options = {}) {
    const {
      startTime,
      endTime,
      spStatus = 1,
      filters = null,
      now = Math.floor(Date.now() / 1000)
    } = options;
    const mergedFilters = { ...(filters || {}), spStatus };

    const results = await this.batchWithDetails({
      listFn: (cursor, size) => this.getApprovalIds(startTime, endTime, cursor || 0, size, mergedFilters),
      detailFn: (sp) => this.getApprovalDetail(sp),
      listKey: 'sp_no_list',
      detailInfoKey: 'info',
    });

    const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, normal: 4 };
    const bottlenecks = [];
    for (const r of results) {
      if (r.error || !r.info) continue;
      const info = r.info;
      // 找最早 status=1 的节点
      const records = info.sp_record || [];
      const idx = records.findIndex(n => n.sp_status === 1);
      if (idx < 0) continue;
      const node = records[idx];
      const waiters = (node.details || [])
        .filter(d => d.sp_status === 1)
        .map(d => (d.approver && d.approver.userid) || 'auto');

      const applyTime = info.apply_time || 0;
      const ageHours = (now - applyTime) / 3600;

      let severity;
      if (ageHours >= 48)      severity = 'critical';
      else if (ageHours >= 24) severity = 'high';
      else if (ageHours >= 12) severity = 'medium';
      else if (ageHours >= 6)  severity = 'low';
      else                     severity = 'normal';

      bottlenecks.push({
        sp_no: r.id,
        sp_name: info.sp_name,
        applyer: (info.applyer && info.applyer.userid) || null,
        apply_time: applyTime,
        age_hours: Math.round(ageHours * 10) / 10,
        current_node: node.tagname || `节点 ${idx + 1}`,
        current_node_index: idx,
        waiting_approvers: waiters,
        is_parallel: waiters.length > 1,
        severity,
        notifyer: info.notifyer || []
      });
    }

    bottlenecks.sort((a, b) => {
      const sa = SEVERITY_ORDER[a.severity];
      const sb = SEVERITY_ORDER[b.severity];
      if (sa !== sb) return sa - sb;
      return b.age_hours - a.age_hours;
    });
    return bottlenecks;
  }

  /**
   * 获取企业假期管理配置
   * v1.0.1 修复：原 /approval/getcorpconf 404，正确路径 /oa/vacation/getcorpconf
   */
  async getLeaveConfig() {
    return this.post('/oa/vacation/getcorpconf', {});
  }

  /**
   * 获取成员假期余额
   * v1.3.0 修复：原 /approval/get_balances 404，正确路径 /oa/vacation/getuservacationquota
   * @param {string} userId 成员 userid
   * @param {string} [leaveType] 假期类型（v1.3.0 新增参数；老版本可不传）
   */
  async getLeaveBalance(userId, leaveType) {
    return this.post('/oa/vacation/getuservacationquota', { userid: userId, leave_type: leaveType });
  }

  /**
   * 修改成员假期余额
   * @param {string} userId 成员 userid
   * @param {string} leaveType 假期类型
   * @param {number} balance 假期时长（天数）
   */
  async updateLeaveBalance(userId, leaveType, balance) {
    // v1.3.0 修复：原 /approval/set_balances 404，正确路径 /oa/vacation/setoneuserquota
    return this.post('/oa/vacation/setoneuserquota', {
      userid: userId,
      leave_type: leaveType,
      balance
    });
  }

  /**
   * 创建审批模板
   * v1.3.0 修复：原 /approval/template/create 404，正确路径 /oa/approval/create
   * @param {object} params 模板参数
   */
  async createTemplate(params) {
    return this.post('/oa/approval/create_template', params);
  }

  /**
   * 更新审批模板
   * v1.3.0 修复：原 /approval/template/update 404，正确路径 /oa/approval/update
   * @param {string} templateId 模板 ID
   * @param {object} params 更新参数
   */
  async updateTemplate(templateId, params) {
    return this.post('/oa/approval/update_template', {
      template_id: templateId,
      ...params
    });
  }

  /**
   * 获取审批流程引擎配置
   * ⚠️ v1.3.0 暂禁：官方文档无 /approval/get_process 端点
   * 保留方法签名以便未来官方补 API 后启用；当前调用必返 60011
   * @param {string} templateId 模板 ID
   */
  async getApprovalProcess(templateId) {
    throw new Error('getApprovalProcess 已废弃：官方文档无此端点（v1.3.0）');
    // return this.post('/approval/get_process', { template_id: templateId });
  }

  /**
   * 设置审批流程
   * ⚠️ v1.3.0 暂禁：官方文档无 /approval/set_process 端点
   * @param {string} templateId 模板 ID
   * @param {object} process 流程配置
   */
  async setApprovalProcess(templateId, process) {
    throw new Error('setApprovalProcess 已废弃：官方文档无此端点（v1.3.0）');
    // return this.post('/approval/set_process', {
    //   template_id: templateId,
    //   process
    // });
  }

  /**
   * 审批单回调通知（通过回调模块处理，此处仅提供查询）
   * ⚠️ v1.3.0 暂禁：官方文档无 /approval/callback_list 端点
   * 回调请走 callback 模块（/cgi-bin/callback/...），不要走审批
   * @param {number} startTime 开始时间戳
   * @param {number} endTime 结束时间戳
   * @param {number} cursor 分页游标（v1.0.1 修复：与 getApprovalIds 一致，API 要 integer）
   * @param {number} size 每页数量
   */
  async getApprovalCallbackList(startTime, endTime, cursor = 0, size = 100) {
    throw new Error('getApprovalCallbackList 已废弃：官方文档无此端点（v1.3.0），请走 callback 模块');
    // return this.post('/approval/callback_list', {
    //   starttime: startTime,
    //   endtime: endTime,
    //   cursor,
    //   limit: size
    // });
  }

  // ========== Corp 审批数据 ==========

  /**
   * v1.5.2 coverage-enhance: 获取企业审批数据 (汇总)
   * 用于审批管理报表
   * @param {number} startTime 起始时间 (秒)
   * @param {number} endTime 结束时间 (秒)
   * @returns {Promise<object>} { errcode, errmsg, data_list }
   */
  async getCorpApprovalData(startTime, endTime) {
    return this.post('/corp/getapprovaldata', {
      starttime: startTime,
      endtime: endTime
    });
  }

  /**
   * v1.5.2 coverage-enhance: 获取企业开放审批数据 (跨审批)
   * @param {number} startTime 起始时间 (秒)
   * @param {number} endTime 结束时间 (秒)
   * @returns {Promise<object>} { errcode, errmsg, data_list }
   */
  async getOpenApprovalData(startTime, endTime) {
    return this.post('/corp/getopenapprovaldata', {
      starttime: startTime,
      endtime: endTime
    });
  }


  // ========== OA 域 (顶层 OA API) ==========

  /**
   * v1.5.2 coverage-enhance: 发起预约会议事件
   * 用于把日程预约作为事件推送给相关人
   * @param {object} params { schedule_id, attendees, create_time }
   * @returns {Promise<object>} { errcode, errmsg }
   */
  async applyScheduleEvent(params) {
    return this.post('/oa/applyevent', params);
  }

  /**
   * v1.5.2 coverage-enhance: 获取审批申请详细信息 (含流程状态)
   * 与 getApprovalDetail 类似, 但本 API 是 /oa/getapprovalinfo (顶层接口)
   * @param {string[]} spNoList 审批单号列表 (最多 100 个)
   * @returns {Promise<object>} { errcode, errmsg, info_list }
   */
  async getApprovalInfo(spNoList) {
    return this.post('/oa/getapprovalinfo', { sp_no_list: spNoList });
  }

  /**
   * v1.5.2 coverage-enhance: 下载审批附件/日志文件
   * 用于下载审批流程中上传的附件或日志文件
   * @param {object} params { fileid, save_path? }
   * @returns {Promise<Buffer>} 文件二进制流
   */
  async downloadJournal(params) {
    return this.request({
      method: 'POST',
      url: '/oa/journal/download',
      data: params,
      responseType: 'arraybuffer'
    });
  }

  // ========== v2026-07-26 Vacation 控件 + 请假场景 helper ==========

  /**
   * 构建 Vacation 控件的 value 结构
   *
   * v2026-07-26 12:21 老板 query: 用真实 SDK 审批单重构。
   * 背景: 之前 11:24 简化 helper 不知道 Vacation 真实结构 (value.vacation.{selector, attendance.{date_range, type, slice_info}})
   *       → 连续 301025/301057 错。
   * 本方法依据 WxJava 权威 SDK  + 老板 12:16 真实提交 sp_no=202607260010 验证过的结构构造 value。
   *
   * @param {object} options
   * @param {number|string} options.leaveTypeId - 事假=2 / 病假=3 / 年假=1 / 调休假=4 等
   * @param {number} options.startTime - 起始时间戳 (秒) **⚠️ 必项是 UTC 中譾表 CST 0:00 对齐的秒数**
   *   侧如: CST 2026-07-27 0:00 → `Math.floor(Date.UTC(2026, 6, 26, 16, 0, 0) / 1000)` = 1753574400
   * @param {number} options.endTime - 结束时间戳 (秒) **⚠️ 必项是 UTC 中譾表 CST 0:00 对齐的秒数**
   *   侧如: CST 2026-07-30 0:00 → `Math.floor(Date.UTC(2026, 6, 29, 16, 0, 0) / 1000)` = 1753833600
   * @param {string} [options.leaveTypeName='事假'] - 假期类型名称 (用于 selector.value[].text)
   * @param {string} [options.dateRangeType='hour'] - 企微 'hour' (按小时) / 'day' (按天)。真实请假用 hour
   * @returns {object} { vacation: { selector, attendance: { date_range, type, slice_info } } }
   *
   * v2026-07-26 12:21 实跳实录:
   *   const r = await w.approval.submitLeaveRequest({
   *     templateId: 'C4Ramzh8A3FGmQvzq1HDv9nqnwu5rqSRRNULTxReQ',  // 请假模板
   *     creator: 'JieXiaoYin',
   *     leaveTypeId: 2,  // 事假
   *     startTime: 1753574400,  // CST 2026-07-27 0:00
   *     endTime: 1753833600,    // CST 2026-07-30 0:00 (3 天)
   *     reasonText: '外出学习',
   *     leaveTypeName: '事假',
   *   });
   *   → sp_no=202607260010 ✅
   */
  /**
   * 构建 Money 控件的 value 结构 (老板 query 13:17 B 步骤)
   * 背景: 真实企微期望 new_money 是**字符串**不是 number (11:38 踩坑 0.01 vs "0.01")
   * 例如: w.approval.buildMoneyValue({ new_money: 1.00 })
   *   → { new_money: "1.00" }
   *
   * @param {object} options { new_money }
   * @returns {object} { new_money: "1.00" }
   */
  buildMoneyValue({ new_money } = {}) {
    if (new_money == null) {
      throw new Error('buildMoneyValue: new_money 必填');
    }
    return { new_money: String(new_money) };
  }

  /**
   * 构建 Selector 控件的 value 结构 (老板 query 13:17 B 步骤)
   * 背景: 报销申请控件验证, options[].value 必须是 [{text,lang}] 数组
   * 例如: w.approval.buildSelectorValue({ type:'single', options:[{key:'option-xxx', value:[{text:'差旅费',lang:'zh_CN'}]}] })
   *   → { selector: { type:'single', options:[...], op_relations:[] } }
   *
   * @param {object} options { type, options }
   * @returns {object} { selector: {...} }
   */
  buildSelectorValue({ type = 'single', options = [] } = {}) {
    if (!Array.isArray(options) || options.length === 0) {
      throw new Error('buildSelectorValue: options 必填, 非空数组');
    }
    // 自动补 value: 如果用户传的是简单 {key} 1个字段, 自动加 value:[{text:key,lang:'zh_CN'}]
    const normalized = options.map(o => {
      if (o.value && Array.isArray(o.value)) return o;  // 已是 [{text,lang}]
      return { key: String(o.key), value: [{ text: o.text || o.key, lang: o.lang || 'zh_CN' }] };
    });
    return { selector: { type, options: normalized, op_relations: [] } };
  }

  /**
   * 构建 Number 控件的 value 结构 (老板 query 13:17 B 步骤)
   * 对应企微控件类型 Number, 需返回 { new_number } - 类似 Money 但不限于金额
   * 例如: w.approval.buildNumberValue({ number: 3 }) → { new_number: "3" }
   *
   * @param {object} options { number }
   * @returns {object} { new_number: "3" }
   */
  buildNumberValue({ number } = {}) {
    if (number == null) {
      throw new Error('buildNumberValue: number 必填');
    }
    return { new_number: String(number) };
  }

  buildVacationValue({ leaveTypeId, startTime, endTime, leaveTypeName, dateRangeType = 'hour' } = {}) {
    if (leaveTypeId == null || startTime == null || endTime == null) {
      throw new Error('buildVacationValue: leaveTypeId + startTime + endTime 必填');
    }
    const start = Number(startTime);
    const end = Number(endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      throw new Error('buildVacationValue: 时间戳不合法');
    }
    const dur = end - start;  // 秒

    // 构造 day_items (N+1 个: N 天 + 末尾 boundary)
    // v2026-07-26 12:21: 预期 day_items 包含 N+1 个元素
    //   - 前 N 天: 从 start 开始, 每个 daytime = startCST + i*daySec, duration = 86400
    //   - 最后1个: boundary (daytime=end, duration=0)
    const daySec = 86400;
    const days = Math.ceil(dur / daySec);  // 向上取整 (保证 >= N 天)
    const day_items = [];
    for (let i = 0; i < days; i++) {
      day_items.push({
        daytime: start + i * daySec,
        time_sections: [],
        duration: daySec,
      });
    }
    day_items.push({
      daytime: end,
      time_sections: [],
      duration: 0,
    });

    return {
      vacation: {
        selector: {
          type: 'single',
          options: [
            {
              key: String(leaveTypeId),
              value: [{ text: leaveTypeName || `假期类型${leaveTypeId}`, lang: 'zh_CN' }],
            },
          ],
          op_relations: [],
        },
        attendance: {
          date_range: {
            type: dateRangeType,
            new_begin: start,
            new_end: end,
            new_duration: dur,
          },
          type: 1,
          slice_info: {
            day_items,
            state: 1,
            duration: dur,
          },
        },
      },
    };
  }

  /**
   * 请假申请一站式提交 (老板 query 12:21 二次完善: 用真实 SDK 审批单 structure)
   * 默认查询 get_template_detail 拿各控件 id，然后只填空字段。
   *
   * @param {object} options
   * @param {string} options.templateId - 请假模板 id (人事组 '请假' = C4R...)
   * @param {string} options.creator - 申请人 userid
   * @param {number|string} options.leaveTypeId - 事假=2 / 病假=3 / 年假=1 / 调休假=4
   * @param {number} options.startTime - 起始时间戳 (秒)
   * @param {number} options.endTime - 结束时间戳 (秒)
   * @param {string} options.reasonText - 请假事由 (reasonText Textarea 控件)
   * @param {string} [options.leaveTypeName='事假'] - 假期类型名称 (用于 selector.value[].text)
   * @returns {Promise<{errcode, errmsg, sp_no}>}
   */
  async submitLeaveRequest({ templateId, creator, leaveTypeId, startTime, endTime, reasonText, useTemplateApprover = 1, leaveTypeName } = {}) {
    if (!templateId || !creator) {
      throw new Error('submitLeaveRequest: templateId + creator 必填');
    }
    // 1. 拿模板结构拿控件 id
    const detail = await this.getTemplateDetail(templateId);
    if (detail.errcode !== 0) return detail;
    const controls = detail.template_content?.controls || [];
    const vacation = controls.find(c => c.property?.control === 'Vacation');
    const textarea = controls.find(c => c.property?.control === 'Textarea');
    if (!vacation) {
      return { errcode: -1, errmsg: '模板不是请假模板 (无 Vacation 控件)' };
    }
    // 2. 构造 value (v2026-07-26 12:21 修复: 真实 SDK 结构)
    const vacationValue = this.buildVacationValue({ leaveTypeId, startTime, endTime, leaveTypeName });
    const content = [
      { id: vacation.property.id, value: vacationValue, control: 'Vacation' },
      ...(textarea && reasonText ? [{ id: textarea.property.id, value: { text: reasonText }, control: 'Textarea' }] : []),
    ];
    // 3. 提交 (submitApproval 11:40 已加 auto-fill control, 这里预填防 301025)
    return this.submitApproval({
      templateId,
      creator,
      useTemplate_approver: useTemplateApprover,
      content,
    });
  }

  /**
   * 通用审批提交 helper (老板 query 12:26 + 13:17)
   * 背景: 老板问"能否找到通用模式, 便于快速调用任意一个审批模板?"
   * 思想: 不需记 template_id + 不需手填 每个控件 id/value - 只需选起 名字 + 中文标题 → 提交
   *
   * @param {object} options
   * @param {string|object} options.template - 模板名字 (e.g. "退款给客户" / "请假") 或直接传 { templateId }
   * @param {string} options.caller - 申请人 userid (默认从 this.config 取)
   * @param {object} options.data - 控件值, key = 控件中文标题 (e.g. "客户姓名") 或控件 id 或控件 type
   * @param {boolean} [options.useTemplateApprover=true] - 是否使用模板默认审批流
   * @returns {Promise<{errcode, errmsg, sp_no}>}
   *
   * v2026-07-26 13:17 实现状态:
   *   ✅ 支持的控件 value 构造器: Text / Textarea / Money / Number / Selector / Vacation (6 种)
   *   ⚠️ 其余 12 控件 (File/Date/Table/Attendance/Onboarding/Regularization/Resignation/
   *      Transfer/RelatedApproval/Location/PunchCorrection/SwitchSchedule) 需 raw value
   *      调用方需透传 value (SDK 会原样送企微)
   *
   * 例 1: 请事假 3 天
   *   await w.approval.submit({
   *     template: '请假',
   *     caller: 'JieXiaoYin',
   *     data: { '请假类型': '事假', '请假事由': '外出学习' },
   *   });
   *
   * 例 2: 退款给客户
   *   await w.approval.submit({
   *     template: '退款给客户',
   *     caller: 'JieXiaoYin',
   *     data: { '客户姓名': '张某某', '退款金额': 1.00, '退款原因': '...' },
   *   });
   *
   * 例 3: 报销申请 (用 title 因为报销类模板控件名复杂)
   *   await w.approval.submit({
   *     template: '报销申请',
   *     caller: 'JieXiaoYin',
   *     data: { '报销类型': '差旅费', '总额': 1000, '报销事由': '...' },
   *   });
   */
  async submit({ template, caller, data = {}, useTemplateApprover = true } = {}) {
    if (!template) throw new Error('submit: template 必填 (模板名 或 { templateId })');
    if (!caller) throw new Error('submit: caller 必填 (userid)');

    // 1. 找模板 → template_id
    let templateId, templateMeta;
    if (typeof template === 'object' && template.templateId) {
      templateId = template.templateId;
      templateMeta = template;
    } else {
      const hits = this.searchTemplates({ name: template });
      if (hits.length === 0) {
        return { errcode: -1, errmsg: `submit: 未找到模板 "${template}"。用法: searchTemplates({ name }) 先查` };
      }
      if (hits.length > 1) {
        return {
          errcode: -1,
          errmsg: `submit: 模板名 "${template}" 命中 ${hits.length} 个 (${hits.map(h=>h.group+'/'+h.name).join(', ')}). 请用 searchTemplates 查询后传 templateId: ${hits[0].template_id}`,
        };
      }
      templateId = hits[0].template_id;
      templateMeta = hits[0];
    }

    // 2. 拉模板详情拿控件定义 (含 property.id + title)
    const detail = await this.getTemplateDetail(templateId);
    if (detail.errcode !== 0) {
      return { errcode: -1, errmsg: `submit: getTemplateDetail(${templateId}) 失败: ${detail.errmsg}` };
    }
    const controls = detail.template_content?.controls || [];

    // 3. 按控件中文标题映射 data key → 控件 id
    const titleToCtrl = {};
    const idToCtrl = {};
    for (const c of controls) {
      const title = c.property?.title?.[0]?.text;
      const id = c.property?.id || c.id;  // 企微返回在 property.id 不是 c.id (13:17 踩坑)
      if (title) titleToCtrl[title] = c;
      if (id) idToCtrl[id] = c;
    }

    // 4. 逐个控件填值 (按 title 或 id 或 control type lookup)
    const content = [];
    const usedKeys = new Set();
    for (const ctrl of controls) {
      const ctrlTitle = ctrl.property?.title?.[0]?.text;
      const ctrlId = ctrl.property?.id || ctrl.id;  // 11:38 Money bug 后兼容
      const ctrlType = ctrl.property?.control;

      // 优先在 data 里找匹配项 (按 title → id → type 顺序)
      let value;
      if (ctrlTitle && data[ctrlTitle] !== undefined) value = data[ctrlTitle], usedKeys.add(ctrlTitle);
      else if (ctrlId && data[ctrlId] !== undefined) value = data[ctrlId], usedKeys.add(ctrlId);
      else if (data[ctrlType] !== undefined) value = data[ctrlType], usedKeys.add(ctrlType);

      // 按控件类型调对应 builder (或透传 raw value)
      let builtValue;
      try {
        switch (ctrlType) {
          case 'Text':
          case 'Textarea':
            builtValue = { text: String(value !== undefined ? value : '') };
            break;
          case 'Money':
            builtValue = this.buildMoneyValue({ new_money: value });
            break;
          case 'Number':
            builtValue = this.buildNumberValue({ number: value });
            break;
          case 'Selector':
            // Selector value 期望: { selector: { type, options, op_relations } }
            if (typeof value === 'string') {
              // 简化: data[title]='事假' → options=[{key, value:[{text}]}]
              builtValue = this.buildSelectorValue({
                type: 'single',
                options: [{ key: value, value: [{ text: value, lang: 'zh_CN' }] }],
              });
            } else {
              builtValue = this.buildSelectorValue(value);
            }
            break;
          case 'Vacation':
            // Vacation 需特殊语义, 调用方传 { leaveTypeId, leaveTypeName, startTime, endTime }
            builtValue = this.buildVacationValue(value);
            break;
          default:
            // 未验证控件: 透传 raw value 或默认值 { files: [], ... }
            builtValue = value !== undefined ? value : {};
            break;
        }
      } catch (e) {
        return { errcode: -1, errmsg: `submit: 控件 "${ctrlTitle}" (${ctrlType}) value 构造失败: ${e.message}` };
      }

      content.push({ id: ctrlId, value: builtValue, control: ctrlType });
    }

    // 警告未用到的 key
    const unusedKeys = Object.keys(data).filter(k => !usedKeys.has(k));
    if (unusedKeys.length > 0) {
      // 不报错, 只提示
      this.post;  // noop - 避免 warning
      console.warn(`[submit] 警告: data 中有 ${unusedKeys.length} 个 key 未被任何控件匹配: ${unusedKeys.join(', ')}`);
    }

    // 5. 调用底层 submitApproval
    return this.submitApproval({
      templateId,
      creator: caller,
      useTemplate_approver: useTemplateApprover ? 1 : 0,
      content,
    });
  }
}

module.exports = Approval;
