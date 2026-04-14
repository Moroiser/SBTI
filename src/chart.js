/**
 * 雷达图渲染 — Canvas API，无外部依赖
 */

const LEVEL_NUM = { L: 1, M: 2, H: 3 }

/**
 * 绘制 15 维度雷达图
 * @param {HTMLCanvasElement} canvas
 * @param {Object} userLevels  { S1: 'H', S2: 'L', ... }
 * @param {Array}  dimOrder    ['S1','S2',...]
 * @param {Object} dimDefs     维度定义 { S1: { name: '自尊自信', ... }, ... }
 */
export function drawRadar(canvas, userLevels, dimOrder, dimDefs) {
  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  const size = 320
  canvas.width = size * dpr
  canvas.height = size * dpr
  canvas.style.width = size + 'px'
  canvas.style.height = size + 'px'
  ctx.scale(dpr, dpr)

  const cx = size / 2
  const cy = size / 2
  const maxR = size / 2 - 40
  const n = dimOrder.length
  const angleStep = (Math.PI * 2) / n
  const startAngle = -Math.PI / 2

  ctx.clearRect(0, 0, size, size)

  // 背景圆环 (3层: L=1, M=2, H=3)
  for (let level = 3; level >= 1; level--) {
    const r = (level / 3) * maxR
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = level === 3 ? 'rgba(30, 215, 96, 0.10)' : level === 2 ? 'rgba(30, 215, 96, 0.06)' : 'rgba(30, 215, 96, 0.03)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.lineWidth = 0.5
    ctx.stroke()
  }

  // 轴线 + 标签
  ctx.font = '10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep
    const x = cx + Math.cos(angle) * maxR
    const y = cy + Math.sin(angle) * maxR

    // 轴线
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(x, y)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
    ctx.lineWidth = 0.5
    ctx.stroke()

    // 标签
    const labelR = maxR + 22
    const lx = cx + Math.cos(angle) * labelR
    const ly = cy + Math.sin(angle) * labelR
    const dim = dimOrder[i]
    const label = dimDefs[dim]?.name?.replace(/^[A-Za-z0-9]+\s*/, '') || dim
    ctx.fillStyle = '#b3b3b3'
    ctx.fillText(label, lx, ly)
  }

  // 数据多边形
  const values = dimOrder.map((dim) => LEVEL_NUM[userLevels[dim]] || 2)

  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep
    const r = (values[i] / 3) * maxR
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = 'rgba(30, 215, 96, 0.20)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(30, 215, 96, 0.8)'
  ctx.lineWidth = 2
  ctx.stroke()

  // 数据点
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep
    const r = (values[i] / 3) * maxR
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fillStyle = '#1ed760'
    ctx.fill()
  }
}
