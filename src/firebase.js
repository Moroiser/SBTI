/**
 * SBTI REST API — 自建服务器版本
 * 调用 morois.cn/sbti-api 后端
 * 
 * 配置：API_BASE_URL（见下方）
 */

const API_BASE_URL = 'https://morois.cn/sbti-api';
const API_KEY = 'sbti-api-secret-2026-morois';

// ===== Auth: 匿名用户 ID =====
function getAnonymousId() {
  let id = localStorage.getItem('sbti_anonymous_id');
  if (!id) {
    id = 'anon_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
    localStorage.setItem('sbti_anonymous_id', id);
  }
  return id;
}

// ===== 通用请求函数 =====
async function apiRequest(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    }
  };
  if (body) opts.body = JSON.stringify(body);
  
  const res = await fetch(`${API_BASE_URL}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `请求失败: HTTP ${res.status}`);
  }
  return res.json();
}

// ===== 公开接口 =====

/**
 * 保存用户测试结果
 */
export async function saveResult(data) {
  return apiRequest('POST', '/api/save-result', {
    channel: data.channel || 'feishu',
    typeCode: data.typeCode,
    typeName: data.typeName,
    nickname: data.nickname || '匿名',
    comment: data.comment || '',
    similarity: data.similarity || 0,
    levels: data.levels || {}
  });
}

/**
 * 获取某通道的人格统计
 */
export async function getStats(channel) {
  return apiRequest('GET', `/api/stats/${encodeURIComponent(channel)}`);
}

/**
 * 获取某通道+某人格的最新评论
 */
export async function getComments(channel, typeCode = 'ALL', count = 20) {
  return apiRequest('GET', `/api/comments/${encodeURIComponent(channel)}?typeCode=${typeCode}&limit=${count}`);
}

/**
 * 兼容旧接口：waitForAuth
 */
export async function waitForAuth() {
  return { uid: getAnonymousId() };
}
