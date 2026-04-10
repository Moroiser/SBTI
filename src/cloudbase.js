/**
 * CloudBase REST API — 数据存储模块
 * 替代 Firebase Firestore，实现匿名用户数据存储
 * 
 * 环境信息：
 *   环境 ID: personal-home-7ggu1328c1a431d9
 *   HTTP 访问域名: personal-home-7ggu1328c1a431d9-1319284967.ap-shanghai.app.tcloudbase.com
 *   API Key: 在 firestore_config 中配置
 */

const CLOUDBASE_CONFIG = {
  envId: 'personal-home-7ggu1328c1a431d9',
  baseUrl: 'https://personal-home-7ggu1328c1a431d9-1319284967.ap-shanghai.app.tcloudbase.com',
  apiKey: '' // TODO: 用户需要填入自己的 CloudBase API Key
};

// 集合名称（与 Firebase Firestore 一致）
const COLLECTION_NAME = 'results';

// 数据库相关 API 端点
const API = {
  query: '/tcb/doc/query',
  add: '/tcb/doc/add',
  update: '/tcb/doc/update',
  delete: '/tcb/doc/delete'
};

/**
 * 通用请求封装
 * @param {string} action - API 操作类型
 * @param {object} query - 查询条件（可选）
 * @param {object} data - 要添加/更新的数据（可选）
 * @returns {Promise<object>}
 */
async function cloudbaseRequest(action, { query = null, data = null } = {}) {
  const { baseUrl, apiKey, envId } = CLOUDBASE_CONFIG;
  
  const payload = {
    env: envId,
    collectionName: COLLECTION_NAME,
    queryType: action
  };
  
  if (query) {
    payload.query = query;
  }
  
  if (data) {
    payload.data = data;
  }
  
  try {
    const response = await fetch(`${baseUrl}${API[action] || API.query}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error_message || result.error);
    }
    
    return result;
  } catch (error) {
    console.error(`CloudBase ${action} 失败:`, error);
    throw error;
  }
}

/**
 * 查询所有结果（支持筛选）
 * @param {object} filter - 筛选条件，如 { openId: 'xxx' }
 * @returns {Promise<array>}
 */
async function getResults(filter = {}) {
  let query = {};
  
  if (filter.openId) {
    query.openId = filter.openId;
  }
  
  if (filter.limit) {
    query.limit = filter.limit;
  } else {
    query.limit = 50; // 默认最多返回50条
  }
  
  // 按时间降序排列
  query.orderBy = {
    fieldName: 'timestamp',
    order: 'desc'
  };
  
  const result = await cloudbaseRequest('query', { query });
  
  if (result.data && result.data.length > 0) {
    return result.data;
  }
  
  return [];
}

/**
 * 添加一条结果
 * @param {object} resultData - 结果数据
 * @returns {Promise<object>}
 */
async function addResult(resultData) {
  const data = {
    ...resultData,
    timestamp: Date.now(),
    createdAt: new Date().toISOString()
  };
  
  const result = await cloudbaseRequest('add', { data });
  
  return result;
}

/**
 * 根据 openId 获取某用户的所有结果
 * @param {string} openId - 用户 ID
 * @returns {Promise<array>}
 */
async function getResultsByOpenId(openId) {
  return getResults({ openId });
}

/**
 * 获取最新结果（用于匿名用户）
 * @param {number} limit - 返回数量
 * @returns {Promise<array>}
 */
async function getLatestResults(limit = 10) {
  return getResults({ limit });
}

// 导出模块
window.CloudBaseDB = {
  getResults,
  addResult,
  getResultsByOpenId,
  getLatestResults,
  CLOUDBASE_CONFIG
};
