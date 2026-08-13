// v2026-07-26 21:55 + 22:05 老板 query "BDE" + "91983 还哪些控件" 摸清的 11 个新 builder
// 91983 文档附4/6/8/9/10/11/12/14/15/16/18
// 加载到 Approval class (不污染主源)

module.exports = function attachExtraValueBuilders(ApprovalClass) {
  // 附4: Date
  ApprovalClass.prototype.buildDateValue = function({ type = 'day', timestamp } = {}) {
    if (timestamp == null) throw new Error('buildDateValue: timestamp 必填');
    return { date: { type, s_timestamp: String(timestamp) } };
  };

  // 附6/7: Contact (members + departments)
  ApprovalClass.prototype.buildContactValue = function({ userids = [], departmentIds = [] } = {}) {
    if ((!Array.isArray(userids) || userids.length === 0) &&
        (!Array.isArray(departmentIds) || departmentIds.length === 0)) {
      throw new Error('buildContactValue: userids 或 departmentIds 必填一个, 非空数组');
    }
    if (Array.isArray(userids) && userids.length > 0) {
      return { members: userids.map(u => ({ userid: String(u) })) };
    }
    return { departments: departmentIds.map(d => ({ department_id: String(d) })) };
  };

  // 附8: Tips (后台自动填, builder 显式构造可用)
  ApprovalClass.prototype.buildTipsValue = function({ content = '说明文字' } = {}) {
    return {
      new_tips: {
        tips_content: [{
          text: {
            sub_text: [{
              type: 1,
              content: { plain_text: { content: String(content) } },
            }],
          },
        }],
      },
    };
  };

  // 附9: File (注: file_id 来自 uploadMedia 接口, 9:58 [Fact] upload bug 已知)
  ApprovalClass.prototype.buildFileValue = function({ files = [] } = {}) {
    if (!Array.isArray(files) || files.length === 0) throw new Error('buildFileValue: files 必填, 非空数组');
    return {
      files: files.map(f => ({
        file_id: String(f.file_id || ''),
        file_name: String(f.file_name || ''),
        file_size: Number(f.file_size || 0),
        file_type: String(f.file_type || ''),
        file_url: String(f.file_url || ''),
      })),
    };
  };

  // 附10: Table (明细控件)
  ApprovalClass.prototype.buildTableValue = function({ rows = [] } = {}) {
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('buildTableValue: rows 必填, 非空数组');
    return {
      children: rows.map((row, ri) => ({
        list: (row.cells || []).map((c, ci) => {
          const id = c.id || `Tbl-${ri}-${ci}`;
          return {
            control: c.control || 'Text',
            id,
            title: Array.isArray(c.title) ? c.title : [{ text: c.title || '明细', lang: 'zh_CN' }],
            value: c.value || { text: '' },
          };
        }),
      })),
    };
  };

  // 附11/14: Vacation (请假) - 复用 buildVacationValue
  // (在主 sdk/modules/approval/index.js 已实现)

  // 附12/13: Attendance (假勤 - 出差/外出/加班/请假/补卡)
  ApprovalClass.prototype.buildAttendanceValue = function({ type = 5, beginTime, endTime, slice = true } = {}) {
    if (beginTime == null || endTime == null) throw new Error('buildAttendanceValue: beginTime + endTime 必填');
    if (![1, 2, 3, 4, 5].includes(Number(type))) throw new Error('buildAttendanceValue: type 必须是 1-5 (1请/2补/3出/4外/5加)');
    const dur = Number(endTime) - Number(beginTime);
    const v = {
      attendance: {
        date_range: { type: 'hour', new_begin: Number(beginTime), new_end: Number(endTime), new_duration: dur },
        type: Number(type),
      },
    };
    if (slice) {
      v.attendance.slice_info = {
        day_items: [{ daytime: Number(beginTime), duration: dur }],
        duration: dur,
        state: 1,
      };
    }
    return v;
  };

  // 附14 (时长): DateRange
  ApprovalClass.prototype.buildDateRangeValue = function({ type = 'hour', beginTime, endTime } = {}) {
    if (beginTime == null || endTime == null) throw new Error('buildDateRangeValue: beginTime + endTime 必填');
    return { date_range: { type, new_begin: Number(beginTime), new_end: Number(endTime), new_duration: Number(endTime) - Number(beginTime) } };
  };

  // 附14 (位置 - 重命名): Location
  ApprovalClass.prototype.buildLocationValue = function({ latitude, longitude, title, address, time } = {}) {
    if (latitude == null || longitude == null) throw new Error('buildLocationValue: latitude + longitude 必填');
    return {
      latitude: String(latitude),
      longitude: String(longitude),
      title: title || '',
      address: address || '',
      time: time || Math.floor(Date.now() / 1000),
    };
  };

  // 附15: RelatedApproval
  ApprovalClass.prototype.buildRelatedApprovalValue = function({ sp_no } = {}) {
    if (!sp_no) throw new Error('buildRelatedApprovalValue: sp_no 必填');
    return { related_approval: { sp_no: String(sp_no) } };
  };

  // 附16: Formula
  ApprovalClass.prototype.buildFormulaValue = function({ value = '' } = {}) {
    return { formula: { value: String(value) } };
  };

  // 附17: BankAccount
  ApprovalClass.prototype.buildBankAccountValue = function({ type = 1, name, number, remark = '', bank = '' } = {}) {
    if (!name || !number) throw new Error('buildBankAccountValue: name + number 必填');
    return {
      bank_account: {
        account_type: Number(type),
        account_name: String(name),
        account_number: String(number),
        remark: String(remark),
        bank: { bank_alias: String(bank) },
      },
    };
  };
};
