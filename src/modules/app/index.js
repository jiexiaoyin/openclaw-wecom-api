/**
 * 应用管理模块
 * API 章节：九 - 应用管理
 * 包含：应用管理、自定义菜单
 */

const WeComSDK = require('../sdk');

class App extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ========== 应用管理 ==========

  /**
   * 获取应用
   * @param {number} agentId 应用 id
   */
  async getAgent(agentId) {
    return this.get('/agent/get', { agentid: agentId });
  }

  /**
   * 设置应用
   * @param {number} agentId 应用 id
   * @param {object} params 应用参数
   */
  async setAgent(agentId, { name, description, squareLogoUrl, redirectDomain, reportLocationFlag, isreportenter, homeUrl }) {
    return this.post('/agent/set', {
      agentid: agentId,
      name,
      description,
      square_logo_url: squareLogoUrl,
      redirect_domain: redirectDomain,
      report_location_flag: reportLocationFlag,
      isreportenter,
      home_url: homeUrl
    });
  }

  /**
   * 获取应用列表
   */
  async getAgentList() {
    return this.get('/agent/list', {});
  }

  // ========== 自定义菜单 ==========

  /**
   * 创建菜单
   * @param {number} agentId 应用 id
   * @param {object} menu 菜单配置
   */
  async createMenu(agentId, menu) {
    return this.post('/menu/create', {
      agentid: agentId,
      button: menu.button || menu
    });
  }

  /**
   * 获取菜单
   * @param {number} agentId 应用 id
   */
  async getMenu(agentId) {
    return this.get('/menu/get', { agentid: agentId });
  }

  /**
   * 删除菜单
   * @param {number} agentId 应用 id
   */
  async deleteMenu(agentId) {
    return this.post('/menu/delete', { agentid: agentId });
  }

  // ========== 工作台自定义展示 ==========

  /**
   * 设置工作台自定义展示
   * @param {number} agentId 应用 id
   * @param {object} config 工作台配置
   */
  async setWorkbench(agentId, config) {
    return this.post('/agent/set_workbench', {
      agentid: agentId,
      ...config
    });
  }

  /**
   * 获取工作台自定义展示
   * @param {number} agentId 应用 id
   */
  async getWorkbench(agentId) {
    return this.post('/agent/get_workbench', { agentid: agentId });
  }
}

module.exports = App;
