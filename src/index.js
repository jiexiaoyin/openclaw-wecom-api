/**
 * 企业微信插件 - 统一入口
 * 
 * 模块清单（共32个）
 */

const Approval = require('./modules/approval');
const Contact = require('./modules/contact');
const CheckIn = require('./modules/checkin');
const Disk = require('./modules/disk');
const Custom = require('./modules/custom');
const Live = require('./modules/live');
const Intelligence = require('./modules/intelligence');
const AddressBook = require('./modules/addressbook');
const Message = require('./modules/message');
const App = require('./modules/app');
const Media = require('./modules/media');
const Schedule = require('./modules/schedule');
const Meeting = require('./modules/meeting');
const Document = require('./modules/document');
const Chain = require('./modules/chain');
const Phone = require('./modules/phone');
const Security = require('./modules/security');
const Auth = require('./modules/auth');
const HR = require('./modules/hr');
const Room = require('./modules/room');
const Advanced = require('./modules/advanced');
const Notify = require('./modules/notify');
const ThirdParty = require('./modules/thirdparty');
const Moments = require('./modules/moments');
const OceanEngine = require('./modules/oceanengine');
const Messenger = require('./modules/messenger');
const ContactStats = require('./modules/contact_stats');
const Sensitive = require('./modules/sensitive');
const CheckInRules = require('./modules/checkin_rules');
const School = require('./modules/school');
const OpenChat = require('./modules/openchat');
const Callback = require('./modules/callback');
const Permission = require('./core/permission');

class WeComPlugin {
  constructor(config) {
    this.config = config;
    
    // 核心办公
    this.approval = new Approval(config);
    this.contact = new Contact(config);
    this.checkin = new CheckIn(config);
    this.disk = new Disk(config);
    this.custom = new Custom(config);
    this.live = new Live(config);
    this.intelligence = new Intelligence(config);
    
    // 协作增强
    this.addressbook = new AddressBook(config);
    this.message = new Message(config);
    this.app = new App(config);
    this.media = new Media(config);
    
    // 协作效率
    this.schedule = new Schedule(config);
    this.meeting = new Meeting(config);
    this.document = new Document(config);
    
    // 高级功能
    this.chain = new Chain(config);
    this.phone = new Phone(config);
    this.security = new Security(config);
    
    // 身份与验证
    this.auth = new Auth(config);
    
    // 人事与场地
    this.hr = new HR(config);
    this.room = new Room(config);
    
    // 高级功能扩展
    this.advanced = new Advanced(config);
    this.notify = new Notify(config);
    
    // 补充模块
    this.thirdparty = new ThirdParty(config);
    this.moments = new Moments(config);
    this.oceanengine = new OceanEngine(config);
    this.messenger = new Messenger(config);
    this.contactstats = new ContactStats(config);
    this.sensitive = new Sensitive(config);
    this.checkinrules = new CheckInRules(config);
    this.school = new School(config);
    this.openchat = new OpenChat(config);
    
    // 回调处理（非 API 模块，直接实例化）
    this.callback = new Callback(config);
    
    // 权限控制（依赖 addressbook 模块）
    this.permission = new Permission(config, this.addressbook);
  }

  getConfig() {
    return { corpId: this.config.corpId, agentId: this.config.agentId };
  }

  async testConnection() {
    try {
      const token = await this.approval.getAccessToken();
      return { success: true, message: '连接成功', token };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  getModules() {
    return [
      'approval', 'contact', 'checkin', 'disk', 'custom', 'live', 'intelligence',
      'addressbook', 'message', 'app', 'media', 'schedule', 'meeting', 'document',
      'chain', 'phone', 'security', 'auth', 'hr', 'room', 'advanced', 'notify',
      'thirdparty', 'moments', 'oceanengine', 'messenger', 'contactstats', 'sensitive', 
      'checkinrules', 'school', 'openchat'
    ];
  }

  // ========== 权限控制 ==========

  /**
   * 获取用户角色
   * @param {string} userId 用户ID
   * @returns {Promise<string>} 角色名
   */
  async getUserRole(userId) {
    return this.permission.getUserRole(userId);
  }

  /**
   * 检查用户是否有权限
   * @param {string} userId 用户ID
   * @param {string} module 模块名
   * @param {string} action 操作名
   * @returns {Promise<boolean>}
   */
  async checkPermission(userId, module, action) {
    return this.permission.checkPermission(userId, module, action);
  }

  /**
   * 权限检查，失败则抛出异常
   * @param {string} userId 用户ID
   * @param {string} module 模块名
   * @param {string} action 操作名
   */
  async requirePermission(userId, module, action) {
    return this.permission.requirePermission(userId, module, action);
  }

  /**
   * 获取用户数据权限范围
   * @param {string} userId 用户ID
   * @param {string} module 模块名
   * @returns {Promise<Object>}
   */
  async getDataScope(userId, module) {
    return this.permission.getDataScope(userId, module);
  }

  /**
   * 根据权限过滤数据
   * @param {Array} data 数据列表
   * @param {string} userId 用户ID
   * @param {string} dataField 数据字段名
   * @returns {Promise<Array>}
   */
  async filterData(data, userId, dataField) {
    return this.permission.filterData(data, userId, dataField);
  }

  /**
   * 获取权限矩阵
   */
  getPermissionMatrix() {
    return this.permission.getPermissionMatrix();
  }

  /**
   * 获取角色定义
   */
  static getRoles() {
    return Permission.getRoles();
  }

  /**
   * 清除权限缓存
   */
  clearPermissionCache() {
    this.permission.clearCache();
  }
}

module.exports = WeComPlugin;
