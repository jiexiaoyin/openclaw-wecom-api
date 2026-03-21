# Nginx Mirror 企业微信多插件分发方案

适用于企业微信自建应用只能配置一个回调 URL，但需要多个 OpenClaw 插件同时接收消息的场景。

## ✨ 适用场景

- 1 个企业微信自建应用
- 仅 1 个回调地址
- 需同时分发给多个插件
- 无需新建应用、无需重复配置

## 🌍 环境兼容

- 物理机 / 虚拟机
- Docker / 1Panel / 宝塔面板（容器环境自动适配）

## 🚀 核心说明

### 1. 主回调地址

示例（@YanHaidao/wecom 默认）：
```
/plugins/wecom/agent/default
```

使用者可根据自己使用的插件修改。

### 2. 容器环境特别说明

如果你的 Nginx 运行在 1Panel / Docker / 宝塔面板容器中：

```nginx
# 容器内 127.0.0.1 指向自身，无法访问宿主机
# 正确写法：
proxy_pass http://host.docker.internal:18789$request_uri;
```

非容器环境（物理机）：
```nginx
proxy_pass http://127.0.0.1:18789$request_uri;
```

### 3. 扩展插件

复制以下结构即可添加新插件：

```nginx
# 在主回调 location 中添加：
mirror /mirror/your-plugin;

# 添加新的 mirror location：
location /mirror/your-plugin {
    internal;
    proxy_pass http://host.docker.internal:18789/plugins/your-plugin/callback;
}
```

## ⚠️ 重要安全提示

- 企业微信加密消息只能解密一次
- 主插件负责解密，其他插件建议兼容明文模式
- 所有镜像路由均使用 `internal`，外部无法访问

## 📋 完整 Nginx 配置

```nginx
# ================================================================
# 【通用模板】Nginx Mirror - 企业微信单回调 → 多插件分发
# 适用：OpenClaw 生态 / 企业微信自建应用 / 单回调多插件场景
# 兼容：物理机 / 虚拟机 / Docker / 1Panel / 宝塔面板
# 说明：无任何隐私信息，安全可开源
# ================================================================

server {
    listen 80;
    listen 443 ssl;
    server_name your-domain.com; # 【必填】修改为你的域名
    index index.html;

    # 日志路径
    access_log /path/to/access.log main;
    error_log /path/to/error.log;

    # ------------------------------
    # 通用安全规则
    # ------------------------------
    location ~ ^/(\.user\.ini|\.htaccess|\.git|\.env|\.svn|\.project|LICENSE|README\.md) {
        return 404;
    }
    location ^~ /.well-known/acme-challenge {
        allow all;
        root /usr/share/nginx/html;
    }
    if ($uri ~ "^/\.well-known/.*\.(php|jsp|py|js|css|lua|ts|go|zip|tar\.gz|rar|7z|sql|bak)$") {
        return 403;
    }

    # ------------------------------
    # 【核心】主回调入口
    # ------------------------------
    location = /plugins/wecom/agent/default {

        # 镜像分发（可无限添加）
        mirror /mirror/wecomtool;
        # mirror /mirror/your-plugin;

        # 【A 非容器环境：物理机/虚拟机】
        # proxy_pass http://127.0.0.1:18789$request_uri;

        # 【B 容器环境：1Panel/Docker/宝塔】
        proxy_pass http://host.docker.internal:18789$request_uri;

        # 通用代理配置
        proxy_http_version 1.1;
        proxy_set_header Upgrade $websocket_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # ------------------------------
    # 镜像路由 → wecomtool
    # ------------------------------
    location /mirror/wecomtool {
        internal;
        proxy_pass http://host.docker.internal:18789/plugins/wecomtool/callback;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # ------------------------------
    # 全局插件代理
    # ------------------------------
    location ^~ /plugins/ {
        proxy_pass http://host.docker.internal:18789$request_uri;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $websocket_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # ------------------------------
    # HTTP → HTTPS
    # ------------------------------
    if ($scheme = http) {
        return 301 https://$host$request_uri;
    }

    # ------------------------------
    # SSL 证书（必须修改）
    # ------------------------------
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # ------------------------------
    # SSL 通用安全配置
    # ------------------------------
    ssl_protocols TLSv1.3 TLSv1.2;
    ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:!aNULL:!eNULL:!MD5;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
}
```

## 🔧 使用步骤

1. 修改 `your-domain.com` 为你的域名
2. 填写 SSL 证书路径
3. 选择容器 / 非容器代理地址（注释掉不需要的）
4. 添加 / 删除 mirror 规则
5. 重启 Nginx

## 📁 文件说明

```
wecomtool/
├── README.md                 # 主文档
├── nginx-mirror.md          # 本文档（Nginx 配置说明）
└── nginx.conf              # 完整 Nginx 配置（可选）
```
