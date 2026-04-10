import { drawRadar } from './chart.js'
import { generateShareImage } from './share.js'
import { saveResult, getStats, getComments } from './api.js'

const LEVEL_LABEL = { L: '低', M: '中', H: '高' }
const LEVEL_CLASS = { L: 'level-low', M: 'level-mid', H: 'level-high' }

let currentChannel = null
let currentResult = null
let currentUserLevels = null
let isShared = false

/**
 * 渲染测试结果
 * @param {Object} result - 评测结果
 * @param {Object} userLevels - 用户各维度等级
 * @param {Array} dimOrder - 维度顺序
 * @param {Object} dimDefs - 维度定义
 * @param {Object} config - 配置
 * @param {string} channel - "human" | "agent"
 */
export async function renderResult(result, userLevels, dimOrder, dimDefs, config, channel) {
  currentChannel = channel
  currentResult = result
  currentUserLevels = userLevels
  isShared = false

  const { primary, secondary, rankings, mode } = result

  // Kicker
  const kicker = document.getElementById('result-kicker')
  if (mode === 'drunk') kicker.textContent = '隐藏人格已激活'
  else if (mode === 'fallback') kicker.textContent = '系统强制兜底'
  else kicker.textContent = '你的主类型'

  // 主类型
  document.getElementById('result-code').textContent = primary.code
  document.getElementById('result-name').textContent = primary.cn

  // 匹配度
  document.getElementById('result-badge').textContent =
    `匹配度 ${primary.similarity}%` + (primary.exact != null ? ` · 精准命中 ${primary.exact}/15 维` : '')

  // Intro & 描述
  document.getElementById('result-intro').textContent = primary.intro || ''
  document.getElementById('result-desc').textContent = primary.desc || ''

  // 次要匹配
  const secEl = document.getElementById('result-secondary')
  if (secondary && (mode === 'drunk' || mode === 'fallback')) {
    secEl.style.display = ''
    document.getElementById('secondary-info').textContent =
      `${secondary.code}（${secondary.cn}）· 匹配度 ${secondary.similarity}%`
  } else {
    secEl.style.display = 'none'
  }

  // 雷达图
  const canvas = document.getElementById('radar-chart')
  drawRadar(canvas, userLevels, dimOrder, dimDefs)

  // 维度详情
  const detailEl = document.getElementById('dimensions-detail')
  detailEl.innerHTML = ''
  for (const dim of dimOrder) {
    const level = userLevels[dim] || 'M'
    const def = dimDefs[dim]
    if (!def) continue

    const row = document.createElement('div')
    row.className = 'dim-row'
    row.innerHTML = `
      <div class="dim-header">
        <span class="dim-name">${def.name}</span>
        <span class="dim-level ${LEVEL_CLASS[level]}">${LEVEL_LABEL[level]}</span>
      </div>
      <div class="dim-desc">${def.levels[level]}</div>
    `
    detailEl.appendChild(row)
  }

  // TOP 5
  const topEl = document.getElementById('top-list')
  topEl.innerHTML = ''
  const top5 = rankings.slice(0, 5)
  top5.forEach((t, i) => {
    const item = document.createElement('div')
    item.className = 'top-item'
    item.innerHTML = `
      <span class="top-rank">#${i + 1}</span>
      <span class="top-code">${t.code}</span>
      <span class="top-name">${t.cn}</span>
      <span class="top-sim">${t.similarity}%</span>
    `
    topEl.appendChild(item)
  })

  // 免责声明
  document.getElementById('disclaimer').textContent =
    mode === 'normal' ? config.display.funNote : config.display.funNoteSpecial

  // 下载分享图
  const btnDownload = document.getElementById('btn-download')
  btnDownload.onclick = () => {
    generateShareImage(primary, userLevels, dimOrder, dimDefs, mode)
  }

  // 复制 AI Agent 命令
  const btnAgent = document.getElementById('btn-agent')
  btnAgent.onclick = () => {
    const cmd = `git clone https://github.com/pingfanfan/SBTI.git && cd SBTI && npm install && npm run dev`
    navigator.clipboard.writeText(cmd).then(() => {
      btnAgent.textContent = '已复制!'
      setTimeout(() => { btnAgent.textContent = '复制一键部署命令' }, 2000)
    })
  }

  // ===== 分享功能 =====
  await loadStats(primary.code)
  setupShareForm(primary, userLevels, mode)
}

/**
 * 加载并显示统计数据
 */
async function loadStats(myTypeCode) {
  const statsEl = document.getElementById('stats-summary')
  statsEl.innerHTML = '<div class="stats-loading">加载中...</div>'

  try {
    const stats = await getStats(currentChannel)
    if (stats.length === 0) {
      statsEl.innerHTML = '<div class="stats-empty">暂无数据，来做第一个分享的吧！</div>'
      return
    }

    const myType = stats.find(s => s.typeCode === myTypeCode)
    const total = stats.reduce((sum, s) => sum + s.count, 0)

    let html = `<div class="stats-total">${currentChannel === 'human' ? '👤' : '🤖'} ${currentChannel === 'human' ? '人类' : 'AI Agent'} 通道 · 共 ${total} 人测试</div>`
    html += '<div class="stats-list">'

    // 显示前5名
    const topStats = stats.slice(0, 5)
    topStats.forEach((s, i) => {
      const pct = total > 0 ? Math.round(s.count / total * 100) : 0
      const isMe = s.typeCode === myTypeCode
      html += `
        <div class="stat-item ${isMe ? 'stat-me' : ''}">
          <span class="stat-rank">#${i + 1}</span>
          <span class="stat-code">${s.typeCode}</span>
          <span class="stat-name">${s.typeName}</span>
          <span class="stat-count">${s.count}人</span>
          <span class="stat-pct">${pct}%</span>
          <div class="stat-bar"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
        </div>
      `
    })
    html += '</div>'

    // 全部统计链接
    if (stats.length > 5) {
      html += `<button class="btn btn-small" id="btn-all-stats">查看全部 ${stats.length} 种人格 ▾</button>`
      html += '<div class="stats-all" id="stats-all" style="display:none">'
      stats.slice(5).forEach((s, i) => {
        const pct = total > 0 ? Math.round(s.count / total * 100) : 0
        const isMe = s.typeCode === myTypeCode
        html += `
          <div class="stat-item ${isMe ? 'stat-me' : ''}">
            <span class="stat-rank">#${i + 6}</span>
            <span class="stat-code">${s.typeCode}</span>
            <span class="stat-name">${s.typeName}</span>
            <span class="stat-count">${s.count}人</span>
            <span class="stat-pct">${pct}%</span>
          </div>
        `
      })
      html += '</div>'
    }

    statsEl.innerHTML = html

    // 绑定全部统计展开
    const btnAll = document.getElementById('btn-all-stats')
    if (btnAll) {
      btnAll.onclick = () => {
        const allEl = document.getElementById('stats-all')
        allEl.style.display = allEl.style.display === 'none' ? '' : 'none'
        btnAll.textContent = allEl.style.display === 'none' ? `查看全部 ${stats.length} 种人格 ▾` : '收起 ▲'
      }
    }
  } catch (e) {
    console.error('加载统计失败:', e)
    statsEl.innerHTML = '<div class="stats-error">统计加载失败</div>'
  }
}

/**
 * 设置分享表单
 */
function setupShareForm(primary, userLevels, mode) {
  const shareForm = document.getElementById('share-form')
  const shareSuccess = document.getElementById('share-success')
  const commentsSection = document.getElementById('comments-section')

  // 先加载评论
  loadComments(primary.code)

  // 分享按钮
  document.getElementById('btn-share').onclick = async () => {
    if (isShared) return
    const nickname = document.getElementById('share-nickname').value.trim()
    const comment = document.getElementById('share-comment').value.trim()

    if (comment && comment.length > 50) {
      alert('评论不能超过50字！')
      return
    }

    try {
      await saveResult({
        channel: currentChannel,
        typeCode: primary.code,
        typeName: primary.cn,
        nickname: nickname || '匿名用户',
        comment: comment || '',
        similarity: primary.similarity,
        levels: userLevels,
      })
      isShared = true
      shareForm.style.display = 'none'
      shareSuccess.style.display = ''
      shareSuccess.textContent = '✅ 感谢分享！'
      // 刷新统计和评论
      await loadStats(primary.code)
      await loadComments(primary.code)
    } catch (e) {
      console.error('分享失败:', e)
      alert('分享失败: ' + e.message)
    }
  }

  // 跳过按钮
  document.getElementById('btn-skip-share').onclick = () => {
    shareForm.style.display = 'none'
    shareSuccess.style.display = ''
    shareSuccess.textContent = '已跳过，可以随时重新分享'
  }

  // 评论区标题显示人格名称
  const commentsTitle = document.querySelector('.comments-title')
  if (commentsTitle) {
    commentsTitle.textContent = `💬 ${primary.cn}（${primary.code}）的评论`
  }
}

/**
 * 加载某人格的评论
 */
async function loadComments(typeCode) {
  const listEl = document.getElementById('comments-list')
  listEl.innerHTML = '<div class="comments-loading">加载中...</div>'

  try {
    const comments = await getComments(currentChannel, typeCode, 20)
    if (comments.length === 0) {
      listEl.innerHTML = '<div class="comments-empty">暂无评论，来做第一个吧！</div>'
      return
    }

    let html = ''
    comments.forEach(c => {
      const time = c.createdAt ? new Date(c.createdAt.seconds * 1000).toLocaleDateString('zh-CN') : ''
      html += `
        <div class="comment-item">
          <div class="comment-header">
            <span class="comment-name">${escapeHtml(c.nickname || '匿名')}</span>
            <span class="comment-type">${c.typeCode}</span>
          </div>
          ${c.comment ? `<div class="comment-text">${escapeHtml(c.comment)}</div>` : ''}
          ${time ? `<div class="comment-time">${time}</div>` : ''}
        </div>
      `
    })
    listEl.innerHTML = html
  } catch (e) {
    console.error('加载评论失败:', e)
    listEl.innerHTML = '<div class="comments-error">评论加载失败</div>'
  }
}

/**
 * HTML转义防注入
 */
function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
