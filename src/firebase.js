/**
 * Firebase Firestore REST API — SBTI 项目
 * 通过原生 Firestore REST API 实现数据存取
 * 注意：Firebase SDK在国内加载失败，但 REST API 可以正常访问
 * 
 * 配置：项目 ID + API Key（见下方 FIREBASE_CONFIG）
 */

// ===== Firebase Firestore REST API 配置 =====
const FIREBASE_CONFIG = {
  projectId: 'sbti-personality-test',
  apiKey: 'AIzaSyAfJ8W9QZbP7IKu3CKFKEZ5TSAetcF4fnc',
  
  get baseUrl() {
    return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents`;
  }
};

// 集合名称
const COLLECTION_RESULTS = 'results';

/**
 * 通用 GET 请求（查询）
 */
async function fbGet(action, params = {}) {
  const { baseUrl, apiKey } = FIREBASE_CONFIG;
  const qs = new URLSearchParams({ key: apiKey, ...params }).toString();
  const response = await fetch(`${baseUrl}:${action}?${qs}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Firebase GET 失败: HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * 通用 POST 请求（添加/执行）
 */
async function fbPost(action, body) {
  const { baseUrl, apiKey } = FIREBASE_CONFIG;
  const response = await fetch(`${baseUrl}:${action}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Firebase POST 失败: HTTP ${response.status}`);
  }
  return response.json();
}

// ===== 模拟 Auth（匿名用户 ID） =====
function getAnonymousId() {
  let id = localStorage.getItem('sbti_anonymous_id');
  if (!id) {
    id = 'anon_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
    localStorage.setItem('sbti_anonymous_id', id);
  }
  return id;
}

/**
 * 将本地 levels 对象转换为 Firebase 格式
 */
function toFirebaseLevels(levels) {
  const result = {};
  for (const [k, v] of Object.entries(levels)) {
    result[k] = { stringValue: v };
  }
  return result;
}

/**
 * 将 Firebase 文档转换为本地格式
 */
function fromFirestoreDoc(doc) {
  if (!doc.fields) return null;
  const f = doc.fields;
  // 解析 levels 字段（mapValue）
  let levels = {};
  if (f.levels?.mapValue?.fields) {
    for (const [k, v] of Object.entries(f.levels.mapValue.fields)) {
      levels[k] = v.stringValue || v.integerValue || v;
    }
  }
  return {
    id: doc.name?.split('/').pop(),
    userId: f.userId?.stringValue,
    channel: f.channel?.stringValue,
    typeCode: f.typeCode?.stringValue,
    typeName: f.typeName?.stringValue,
    nickname: f.nickname?.stringValue || '匿名',
    comment: f.comment?.stringValue || '',
    similarity: parseInt(f.similarity?.integerValue || f.similarity?.stringValue || '0'),
    levels,
    createdAt: f.createdAt?.timestampValue || f.createdAt?.stringValue,
  };
}

/**
 * 保存用户结果到 Firebase Firestore
 * @param {Object} data
 */
export async function saveResult(data) {
  const doc = {
    fields: {
      userId: { stringValue: getAnonymousId() },
      channel: { stringValue: data.channel || 'human' },
      typeCode: { stringValue: data.typeCode },
      typeName: { stringValue: data.typeName },
      nickname: { stringValue: data.nickname || '匿名' },
      comment: { stringValue: data.comment || '' },
      similarity: { integerValue: String(data.similarity) },
      levels: { mapValue: { fields: toFirebaseLevels(data.levels) } },
      createdAt: { timestampValue: new Date().toISOString() },
    }
  };
  
  const result = await fbPost(`documents/${COLLECTION_RESULTS}`, doc);
  console.log('结果已保存到 Firebase:', result);
  return result;
}

/**
 * 获取某通道的人格统计
 * @param {string} channel - "human" | "agent"
 * @returns {Promise<Array>}
 */
export async function getStats(channel) {
  // Firestore REST API 不支持服务端聚合，分页获取后在内存聚合
  // 先查该通道最新几条确认能通，再按实际需求获取
  const statsMap = {};
  let pageToken = undefined;
  
  do {
    const params = { pageSize: 1000 };
    if (pageToken) params.pageToken = pageToken;
    
    // 查询条件：channel = ?
    // Firestore REST API 的 structured query 在 documents 端点不支持直接 field filter，
    // 改用 collection group query 或先获取全量再客户端过滤
    // 由于数据量可能较大，我们用 filter 参数
    const filterParam = `channel=${encodeURIComponent(channel)}`;
    
    let url = `${FIREBASE_CONFIG.baseUrl}/${COLLECTION_RESULTS}?key=${FIREBASE_CONFIG.apiKey}&pageSize=1000`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      // 如果全部获取失败（比如项目是空的），返回空统计
      console.warn('Firebase 查询失败，返回空统计');
      break;
    }
    
    const data = await response.json();
    const docs = data.documents || [];
    
    for (const doc of docs) {
      const f = doc.fields || {};
      const docChannel = f.channel?.stringValue;
      const docTypeCode = f.typeCode?.stringValue;
      const docTypeName = f.typeName?.stringValue;
      
      // 客户端过滤 channel
      if (docChannel !== channel) continue;
      
      const key = docTypeCode;
      if (!statsMap[key]) {
        statsMap[key] = {
          typeCode: docTypeCode,
          typeName: docTypeName,
          channel: docChannel,
          count: 0
        };
      }
      statsMap[key].count++;
    }
    
    pageToken = data.nextPageToken;
    // 无更多数据
    if (!pageToken) break;
    
  } while (Object.keys(statsMap).length < 100); // 最多聚合100种类型
  
  const stats = Object.values(statsMap).sort((a, b) => b.count - a.count);
  return stats;
}

/**
 * 获取某通道+某人格的最新评论
 * @param {string} channel
 * @param {string} typeCode
 * @param {number} count
 * @returns {Promise<Array>}
 */
export async function getComments(channel, typeCode, count = 20) {
  let pageToken = undefined;
  const comments = [];
  
  do {
    let url = `${FIREBASE_CONFIG.baseUrl}/${COLLECTION_RESULTS}?key=${FIREBASE_CONFIG.apiKey}&pageSize=100`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) break;
    const data = await response.json();
    const docs = data.documents || [];
    
    for (const doc of docs) {
      const f = doc.fields || {};
      const docChannel = f.channel?.stringValue;
      const docTypeCode = f.typeCode?.stringValue;
      const docComment = f.comment?.stringValue || '';
      
      if (docChannel !== channel) continue;
      if (typeCode !== 'ALL' && docTypeCode !== typeCode) continue;
      if (!docComment.trim()) continue;
      
      comments.push({
        id: doc.name?.split('/').pop(),
        typeCode: docTypeCode,
        typeName: f.typeName?.stringValue,
        nickname: f.nickname?.stringValue || '匿名',
        comment: docComment,
        similarity: parseInt(f.similarity?.integerValue || '0'),
        createdAt: f.createdAt?.timestampValue || f.createdAt?.stringValue,
      });
      
      if (comments.length >= count) break;
    }
    
    pageToken = data.nextPageToken;
    if (!pageToken || comments.length >= count) break;
    
  } while (comments.length < count);
  
  return comments.slice(0, count);
}

/**
 * 兼容旧接口：waitForAuth（静态网站不需要）
 */
export async function waitForAuth() {
  return { uid: getAnonymousId() };
}
