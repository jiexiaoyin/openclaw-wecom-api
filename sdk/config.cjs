/**
 * 企业微信插件配置管理
 * 
 * 支持多环境配置、敏感信息分离、便捷部署
 * 
 * 配置文件优先级：
 * 1. .env 文件（敏感信息）
 * 2. config.{env}.json（环境配置）
 * 3. config.json（默认配置）
 */

const fs = require('fs');
const path = require('path');

class Config {
  constructor(options = {}) {
    this.env = options.env || process.env.NODE_ENV || 'development';
    this.configDir = options.configDir || './';
    this.envPrefix = options.envPrefix || 'WECOM_';
    
    // 加载配置
    this.config = this._loadConfig(options);
  }

  /**
   * 加载配置
   */
  _loadConfig(options) {
    let config = {};
    
    // 1. 加载默认配置
    config = this._mergeConfig(config, 'config.json');
    
    // 2. 加载环境配置
    if (this.env !== 'development') {
      config = this._mergeConfig(config, `config.${this.env}.json`);
    }
    
    // 3. 加载代码传入的配置
    if (Object.keys(options).length > 0) {
      config = { ...config, ...options };
    }
    
    // 4. 从环境变量加载（覆盖其他配置）
    config = this._loadFromEnv(config);
    
    // 5. 加载 .env 文件（敏感信息）
    config = this._loadEnvFile(config);
    
    return config;
  }

  /**
   * 合并配置文件
   */
  _mergeConfig(config, filename) {
    const filePath = path.join(this.configDir, filename);
    if (fs.existsSync(filePath)) {
      try {
        const fileConfig = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return { ...config, ...fileConfig };
      } catch (e) {
        console.warn(`配置文件 ${filename} 加载失败:`, e.message);
      }
    }
    return config;
  }

  /**
   * 从环境变量加载
   */
  _loadFromEnv(config) {
    const envMappings = {
      'CORP_ID': 'corpId',
      'CORP_SECRET': 'corpSecret', 
      'AGENT_ID': 'agentId',
      'TOKEN': 'token',
      'ENCODING_AES_KEY': 'encodingAESKey',
      'CALLBACK_URL': 'callbackUrl'
    };

    for (const [envKey, configKey] of Object.entries(envMappings)) {
      const envValue = process.env[`${this.envPrefix}${envKey}`];
      if (envValue !== undefined) {
        config[configKey] = envValue;
      }
    }
    return config;
  }

  /**
   * 加载 .env 文件
   */
  _loadEnvFile(config) {
    const envPath = path.join(this.configDir, '.env');
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envVars = this._parseEnv(envContent);
        
        const envMappings = {
          'WECOM_CORP_ID': 'corpId',
          'WECOM_CORP_SECRET': 'corpSecret',
          'WECOM_AGENT_ID': 'agentId',
          'WECOM_TOKEN': 'token',
          'WECOM_ENCODING_AES_KEY': 'encodingAESKey'
        };

        for (const [envKey, configKey] of Object.entries(envMappings)) {
          if (envVars[envKey]) {
            config[configKey] = envVars[envKey];
          }
        }
      } catch (e) {
        console.warn('.env 文件加载失败:', e.message);
      }
    }
    return config;
  }

  /**
   * 解析 .env 内容
   */
  _parseEnv(content) {
    const result = {};
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          result[key.trim()] = valueParts.join('=').trim();
        }
      }
    }
    return result;
  }

  /**
   * 获取配置值
   */
  get(key, defaultValue = null) {
    return this.config[key] || defaultValue;
  }

  /**
   * 设置配置值
   */
  set(key, value) {
    this.config[key] = value;
  }

  /**
   * 获取完整配置
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * 获取企业基本配置（用于 SDK）
   */
  getCorpConfig() {
    return {
      corpId: this.get('corpId'),
      corpSecret: this.get('corpSecret'),
      agentId: this.get('agentId')
    };
  }

  /**
   * 获取回调配置
   */
  getCallbackConfig() {
    return {
      token: this.get('token'),
      encodingAESKey: this.get('encodingAESKey'),
      corpId: this.get('corpId'),
      callbackUrl: this.get('callbackUrl')
    };
  }

  /**
   * 验证配置
   */
  validate() {
    const required = ['corpId', 'corpSecret'];
    const missing = required.filter(key => !this.get(key));
    return { valid: missing.length === 0, missing };
  }

  /**
   * 导出安全配置（不含敏感信息）
   */
  exportSafeConfig() {
    const safe = { ...this.config };
    delete safe.corpSecret;
    delete safe.token;
    delete safe.encodingAESKey;
    return safe;
  }

  /**
   * 创建配置文件
   */
  static init(options = {}) {
    const configDir = options.configDir || './';
    
    // 1. 创建 config.json
    const defaultConfig = {
      env: "development",
      callbackUrl: "https://your-domain.com/wecom/callback",
      maxHistorySize: 5000
    };
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify(defaultConfig, null, 2)
    );
    
    // 2. 创建 .env.example
    const envExample = `# 企业微信配置
# 请复制此文件为 .env 并填入真实值

WECOM_CORP_ID=your_corp_id
WECOM_CORP_SECRET=your_corp_secret
WECOM_AGENT_ID=your_agent_id
WECOM_TOKEN=your_callback_token
WECOM_ENCODING_AES_KEY=your_encoding_aes_key
`;
    fs.writeFileSync(
      path.join(configDir, '.env.example'),
      envExample
    );
    
    // 3. 创建 .gitignore
    const gitignore = `# 敏感配置
.env
config.local.json
*.local.json

# 日志
logs/
*.log

# 事件记录
events_*.json
`;
    fs.writeFileSync(
      path.join(configDir, '.gitignore'),
      gitignore
    );
    
    console.log(`
✅ 配置文件已创建：

1. config.json       - 基础配置（可提交到代码仓库）
2. .env.example      - 环境变量示例（可提交）
3. .gitignore        - Git 忽略配置

请执行以下步骤：

1. 复制 .env.example 为 .env
   cp .env.example .env

2. 编辑 .env 填入真实配置
   vim .env

3. 开始使用
   npm run callback
`);
  }
}

// 导出类和便捷函数
module.exports = Config;
module.exports.Config = Config;

// 便捷函数：加载配置
module.exports.loadConfig = function(options = {}) {
  const config = new Config(options);
  return config.getAll();
};

// ESM 导出
module.exports.__esModule = true;
module.exports.default = Config;
