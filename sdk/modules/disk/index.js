/**
 * 微盘管理模块
 * API 章节：十八
 */

const WeComSDK = require('../../sdk');
const fs = require('fs');
const path = require('path');

class Disk extends WeComSDK {
  constructor(config) {
    super(config);
  }

  // ========== 空间管理 ==========

  /**
   * 新建空间
   * @param {string} spaceName 空间名称
   * @param {string} spaceOwner 空间负责人 userid
   * @param {number} spaceType 空间类型: 0-企业空间 1-公共空间 2-共享空间
   */
  async createSpace(spaceName, spaceOwner, spaceType = 0) {
    // v1.5.2-fix: CHANGELOG v1.1.0 起错至今，未修
    return this.post('/wedrive/space_create', {
      space_name: spaceName,
      space_owner: spaceOwner,
      space_type: spaceType
    });
  }

  /**
   * 重命名空间
   * @param {string} spaceId 空间 id
   * @param {string} newName 新名称
   */
  async renameSpace(spaceId, newName) {
    return this.post('/disk/rename_space', { spaceid: spaceId, new_name: newName });
  }

  /**
   * 解散空间
   * @param {string} spaceId 空间 id
   */
  async deleteSpace(spaceId) {
    return this.post('/disk/delete_space', { spaceid: spaceId });
  }

  /**
   * 获取空间信息
   * @param {string} spaceId 空间 id
   */
  async getSpaceInfo(spaceId) {
    return this.post('/disk/get_space_info', { spaceid: spaceId });
  }

  // ========== 空间权限管理 ==========

  /**
   * 添加成员/部门
   * @param {string} spaceId 空间 id
   * @param {string} type 成员类型: 1-成员 2-部门
   * @param {string} id 成员或部门 id
   * @param {number} permission 权限: 1-可查看 2-可编辑
   */
  async addSpaceMember(spaceId, type, id, permission = 1) {
    return this.post('/disk/add_space_member', {
      spaceid: spaceId,
      type,
      id,
      permission
    });
  }

  /**
   * 移除成员/部门
   * @param {string} spaceId 空间 id
   * @param {string} type 成员类型: 1-成员 2-部门
   * @param {string} id 成员或部门 id
   */
  async removeSpaceMember(spaceId, type, id) {
    return this.post('/disk/remove_space_member', { spaceid: spaceId, type, id });
  }

  /**
   * 获取邀请链接
   * @param {string} spaceId 空间 id
   */
  async getShareLink(spaceId) {
    return this.post('/disk/get_share_link', { spaceid: spaceId });
  }

  // ========== 文件管理 ==========

  /**
   * 获取文件列表
   * @param {string} spaceId 空间 id
   * @param {string} folderId 文件夹 id
   * @param {number} start 分页起始位置
   * @param {number} limit 每页数量
   */
  async getFileList(spaceId, folderId, start = 0, limit = 100) {
    return this.post('/disk/get_file_list', {
      spaceid: spaceId,
      folder_id: folderId,
      start,
      limit
    });
  }

  /**
   * 上传文件
   * @param {string} spaceId 空间 id
   * @param {string} folderId 上级文件夹 id
   * @param {string} fileName 文件名
   * @param {string} filePath 本地文件路径
   */
  async uploadFile(spaceId, folderId, fileName, filePath) {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}/disk/upload_file?access_token=${token}`;

    const FormData = require('form-data');
    const form = new FormData();
    form.append('spaceid', spaceId);
    form.append('folder_id', folderId);
    form.append('file_name', fileName);
    form.append('file', fs.createReadStream(filePath));

    const response = await axios.post(url, form, {
      headers: form.getHeaders()
    });

    if (response.data.errcode !== 0) {
      throw new Error(`上传文件失败: ${response.data.errmsg}`);
    }
    return response.data;
  }

  /**
   * 下载文件
   * @param {string} fileId 文件 id
   * @param {string} savePath 保存路径
   */
  async downloadFile(fileId, savePath) {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}/disk/download_file?access_token=${token}`;

    const response = await axios.post(url, { fileid: fileId }, {
      responseType: 'arraybuffer'
    });

    fs.writeFileSync(savePath, response.data);
    return { savePath };
  }

  /**
   * 新建文件夹
   * @param {string} spaceId 空间 id
   * @param {string} parentFolderId 上级文件夹 id
   * @param {string} folderName 文件夹名
   */
  async createFolder(spaceId, parentFolderId, folderName) {
    return this.post('/disk/create_folder', {
      spaceid: spaceId,
      parent_folder_id: parentFolderId,
      folder_name: folderName
    });
  }

  /**
   * 重命名文件
   * @param {string} fileId 文件 id
   * @param {string} newName 新名称
   */
  async renameFile(fileId, newName) {
    return this.post('/disk/rename_file', { fileid: fileId, new_name: newName });
  }

  /**
   * 移动文件
   * @param {string} fileId 文件 id
   * @param {string} spaceId 目标空间 id
   * @param {string} targetFolderId 目标文件夹 id
   */
  async moveFile(fileId, spaceId, targetFolderId) {
    return this.post('/disk/move_file', {
      fileid: fileId,
      spaceid: spaceId,
      target_folder_id: targetFolderId
    });
  }

  /**
   * 删除文件
   * @param {string} fileId 文件 id
   */
  async deleteFile(fileId) {
    return this.post('/disk/delete_file', { fileid: fileId });
  }

  /**
   * 获取文件信息
   * @param {string} fileId 文件 id
   */
  async getFileInfo(fileId) {
    return this.post('/disk/get_file_info', { fileid: fileId });
  }

  // ========== 文件权限管理 ==========

  /**
   * 新增成员
   * @param {string} fileId 文件 id
   * @param {string} type 成员类型: 1-成员 2-部门
   * @param {string} id 成员或部门 id
   * @param {number} permission 权限: 1-可查看 2-可编辑
   */
  async addFileMember(fileId, type, id, permission = 1) {
    return this.post('/disk/add_file_member', {
      fileid: fileId,
      type,
      id,
      permission
    });
  }

  /**
   * 删除成员
   * @param {string} fileId 文件 id
   * @param {string} type 成员类型: 1-成员 2-部门
   * @param {string} id 成员或部门 id
   */
  async removeFileMember(fileId, type, id) {
    return this.post('/disk/remove_file_member', { fileid: fileId, type, id });
  }

  /**
   * 获取文件权限信息
   * @param {string} fileId 文件 id
   */
  async getFilePermission(fileId) {
    return this.post('/disk/get_file_permission', { fileid: fileId });
  }
}

module.exports = Disk;
