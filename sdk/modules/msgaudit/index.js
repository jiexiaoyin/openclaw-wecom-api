const WeComSDK = require("../../sdk");

class Msgaudit extends WeComSDK {
    /** 获取会话内容存档开启成员列表 */
    async getPermitUserList() {
        return this.post("/msgaudit/get_permit_user_list", {});
    }

    /** 获取会话内容存档 */
    async getChatData(chatIdList, seq, limit) {
        return this.post("/msgaudit/chatrecord/get", {
            chat_id_list: chatIdList,
            seq: seq !== undefined ? seq : 0,
            limit: limit || 100
        });
    }

    /** 获取客户同意进行聊天内容存档的情况 */
    async checkSingleAgree(userids) {
        return this.post("/msgaudit/check_single_agree", { userid_list: userids });
    }
}

module.exports = Msgaudit;
