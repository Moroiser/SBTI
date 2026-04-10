/**
 * SBTI REST API — 自建服务器版本（无密钥设计）
 * 调用 sbti.morois.cn 后端
 * 安全机制：验证码 + session token + IP频率限制
 */

const API_BASE_URL = 'https://sbti.morois.cn';

const SESSION_KEY = 'sbti_session';
const CODE_KEY = 'sbti_code';

// ===== Auth: 匿名用户 ID =====
function getAnonymousId() {
  let id = localStorage.getItem('sbti_anonymous_id');
  if (!id) {
    id = 'anon_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
    localStorage.setItem('sbti_anonymous_id', id);
  }
  return id;
}

// ===== 通用请求函数（无认证） =====
async function apiRequest(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE_URL}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `请求失败: HTTP ${res.status}`);
  }
  return res.json();
}

// ===== 开始测试 → 获取验证码 =====
export async function startTest() {
  const resp = await apiRequest('POST', '/api/start-test');
  localStorage.setItem(SESSION_KEY, resp.sessionToken);
  localStorage.setItem(CODE_KEY, resp.code);
  return resp; // { sessionToken, code }
}

// ===== 保存结果（需要 sessionToken + code） =====
export async function saveResult(data) {
  const sessionToken = localStorage.getItem(SESSION_KEY);
  const code = localStorage.getItem(CODE_KEY);

  if (!sessionToken || !code) {
    throw new Error('验证码已失效，请刷新页面重新开始测试');
  }

  return apiRequest('POST', '/api/save-result', {
    sessionToken,
    code,
    channel: data.channel || 'feishu',
    typeCode: data.typeCode,
    typeName: data.typeName,
    nickname: data.nickname || '匿名',
    comment: data.comment || '',
    similarity: data.similarity || 0,
    levels: data.levels || {}
  });
}

// ===== 公开接口（无需认证） =====

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
