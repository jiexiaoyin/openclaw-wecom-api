const WeComSDK = require("../../sdk");

class KF extends WeComSDK {
    /** 获取客服账号列表 */
    async accountList() {
        return this.get("/kf/account/list", {});
    }

    /** 获取在线客服账号列表 */
    async onlineList() {
        return this.get("/kf/account/getonline_list", {});
    }

    /** 获取客服账号详情 */
    async accountGet(openKfid) {
        return this.post("/kf/account/get", { open_kfid: openKfid });
    }

    /** 添加客服账号 */
    async accountAdd(name, mediaId) {
        return this.post("/kf/account/add", { name, media_id: mediaId });
    }

    /** 删除客服账号 */
    async accountDel(openKfid) {
        return this.post("/kf/account/del", { open_kfid: openKfid });
    }

    /** 修改客服账号 */
    async accountUpdate(openKfid, name, mediaId) {
        return this.post("/kf/account/update", { open_kfid: openKfid, name, media_id: mediaId });
    }

    /** 获取客服账号链接 */
    async addContactWay(openKfid, scene, style, remark) {
        return this.post("/kf/add_contact_way", {
            open_kfid: openKfid,
            scene: scene || 1,
            style: style || 1,
            remark: remark || ""
        });
    }

    /** 获取会话状态 */
    async getState(openKfid) {
        return this.post("/kf/service_state/get", { open_kfid: openKfid });
    }

    /** 变更会话状态 */
    async stateTrans(openKfid, serviceState, servicerUserid) {
        return this.post("/kf/service_state/trans", {
            open_kfid: openKfid,
            service_state: serviceState,
            servicer_userid: servicerUserid || ""
        });
    }

    /** 同步消息 */
    async syncMsg(token) {
        return this.post("/kf/sync_msg", { token, limit: 100, voice_format: 0, openids: [] });
    }

    /** 发送消息 */
    async sendMsg({ openKfid, touser, msgtype, text }) {
        return this.post("/kf/send_msg", { open_kfid: openKfid, touser, msgtype, text });
    }

    /** 发送事件消息 */
    async sendEvent(msg) {
        return this.post("/kf/send_msg_on_event", msg);
    }

    /**
     * v1.5.2 coverage-enhance: 批量获取客服客户列表
     * 用于一次性拉取多个客服账号下的客户列表
     * @param {string[]} openKfIds 客服账号 open_kfid 列表 (最多 100)
     * @returns {Promise<object>} { errcode, errmsg, customer_list }
     */
    async batchGetCustomers(openKfIds) {
        return this.post("/kf/customer/batchget", {
            open_kfid_list: openKfIds
        });
    }
}

module.exports = KF;
