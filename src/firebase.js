/**
 * CloudBase 集成 — SBTI 项目
 * 替代 Firebase Firestore，使用腾讯云开发 REST API 实现数据存取
 * 
 * 配置：环境 ID + API Key（见下方 CLOUDBASE_CONFIG）
 * 
 * CloudBase REST API 端点格式：
 *   POST https://{envId}-{envRegion}.app.tcloudbase.com/tcb/doc/query
 *   POST https://{envId}-{envRegion}.app.tcloudbase.com/tcb/doc/add
 */

// ===== CloudBase 配置 =====
const CLOUDBASE_CONFIG = {
  envId: 'personal-home-7ggu1328c1a431d9',
  // ⬆️ 环境 ID（必填）
  
  // ⬇️ 在腾讯云控制台 API Key 配置 页生成的 API Key（必填）
  // 格式：eyJhbGciOiJSUzI1NiIsImtpZCI6I...
  apiKey: '', 
  
  // HTTP 访问服务域名（自动拼接）
  get baseUrl() {
    return `https://personal-home-7ggu1328c1a431d9-1319284967.ap-shanghai.app.tcloudbase.com`
  }
};

// 集合名称（需在 CloudBase 控制台创建）
const COLLECTION_RESULTS = 'results';

/**
 * 通用请求封装
 */
async function cbRequest(action, payload) {
  const { baseUrl, apiKey } = CLOUDBASE_CONFIG;
  
  if (!apiKey) {
    throw new Error('CloudBase API Key 未配置！请在 firebase.js 中填入你的 API Key。');
  }
  
  const response = await fetch(`${baseUrl}/tcb/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      env: CLOUDBASE_CONFIG.envId,
      collectionName: COLLECTION_RESULTS,
      ...payload
    })
  });
  
  if (!response.ok) {
    throw new Error(`CloudBase 请求失败: HTTP ${response.status}`);
  }
  
  const result = await response.json();
  
  // 检查业务错误
  if (result.error) {
    const msg = result.error_message || result.error || '未知错误';
    throw new Error(`CloudBase 错误: ${msg}`);
  }
  
  return result;
}

// ===== 模拟 Auth（匿名用户 ID） =====
// 静态网站无法真正做匿名认证，这里生成一个随机 ID 模拟
function getAnonymousId() {
  let id = localStorage.getItem('sbti_anonymous_id');
  if (!id) {
    id = 'anon_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
    localStorage.setItem('sbti_anonymous_id', id);
  }
  return id;
}

/**
 * 保存用户结果到 CloudBase
 * @param {Object} data
 * @param {string} data.channel - "human" | "agent"
 * @param {string} data.typeCode - 人格代码
 * @param {string} data.typeName - 人格名称
 * @param {string} data.nickname - 昵称（可选）
 * @param {string} data.comment - 评论（可选，最多50字）
 * @param {number} data.similarity - 相似度
 * @param {Object} data.levels - 各维度等级
 */
export async function saveResult(data) {
  const result = await cbRequest('doc/add', {
    data: {
      ...data,
      userId: getAnonymousId(),
      createdAt: new Date().toISOString(),
      timestamp: Date.now()
    }
  });
  
  // 更新统计计数（简单方式：先查后更新，或直接记录到统计集合）
  // 这里直接用 addDoc 会自动创建统计文档
  // 注：CloudBase 免费版没有原子递增，我们这里不做计数更新
  console.log('结果已保存到 CloudBase:', result);
  return result;
}

/**
 * 获取某通道的人格统计
 * @param {string} channel - "human" | "agent"
 * @returns {Promise<Array>} [{ typeCode, typeName, count, channel }, ...]
 */
export async function getStats(channel) {
  // 查询该通道的所有结果，内存中聚合统计
  const result = await cbRequest('doc/query', {
    query: {
      channel: channel
    },
    limit: 1000, // 免费版限制
    orderBy: {
      fieldName: 'timestamp',
      order: 'desc'
    }
  });
  
  const docs = result.data || [];
  
  // 内存中聚合
  const statsMap = {};
  docs.forEach(doc => {
    const key = `${doc.channel}_${doc.typeCode}`;
    if (!statsMap[key]) {
      statsMap[key] = {
        typeCode: doc.typeCode,
        typeName: doc.typeName,
        channel: doc.channel,
        count: 0
      };
    }
    statsMap[key].count++;
  });
  
  // 转为数组并按计数降序排列
  const stats = Object.values(statsMap).sort((a, b) => b.count - a.count);
  return stats;
}

/**
 * 获取某通道+某人格的最新评论
 * @param {string} channel
 * @param {string} typeCode
 * @param {number} count - 返回数量
 * @returns {Promise<Array>}
 */
export async function getComments(channel, typeCode, count = 20) {
  // CloudBase 查询条件
  const query = {
    channel: channel,
    comment: { $ne: '' } // 有评论的记录
  };
  
  if (typeCode !== 'ALL') {
    query.typeCode = typeCode;
  }
  
  const result = await cbRequest('doc/query', {
    query: query,
    limit: count,
    orderBy: {
      fieldName: 'timestamp',
      order: 'desc'
    }
  });
  
  const docs = result.data || [];
  
  // 过滤出有评论的记录
  const comments = docs
    .filter(doc => doc.comment && doc.comment.trim())
    .slice(0, count);
  
  return comments;
}

/**
 * 兼容旧接口：waitForAuth（静态网站不需要）
 */
export async function waitForAuth() {
  return { uid: getAnonymousId() };
}
