const WeComSDK = require("../../sdk");

class Customer extends WeComSDK {
    /** 获取客户列表（GET方法） */
    async getCustomerList(userid) {
        return this.get("/externalcontact/list", { userid });
    }

    /** 获取客户详情 */
    async getCustomerDetail(externalUserId) {
        return this.get("/externalcontact/get", { external_userid: externalUserId });
    }

    /** 批量获取客户详情 */
    async batchGetByUser(userids) {
        return this.post("/externalcontact/batch/get_by_user", { userid_list: userids });
    }

    /** 获取客户群列表 */
    async getGroupChatList(statusFilter, creatorUserid, limit, cursor) {
        return this.post("/externalcontact/groupchat/list", {
            status_filter: statusFilter !== undefined ? statusFilter : 0,
            creator_userid: creatorUserid || "",
            limit: limit || 100,
            cursor: cursor || ""
        });
    }

    /** 获取客户群详情 */
    async getGroupChat(chatId) {
        return this.post("/externalcontact/groupchat/get", { chat_id: chatId });
    }

    /** 获取企业标签列表 */
    async getCorpTagList() {
        return this.get("/externalcontact/get_corp_tag_list", {});
    }

    /** 设置客户标签（需同时传userid和external_userid） */
    async markTag(externalUserId, tagIds, userid, operation) {
        const op = operation || "add";
        return this.post("/externalcontact/mark_tag", {
            userid: userid,
            external_userid: externalUserId,
            add_tag: op === "add" ? tagIds : [],
            remove_tag: op === "remove" ? tagIds : []
        });
    }
}

module.exports = Customer;
