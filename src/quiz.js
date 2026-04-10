import { shuffle, insertAtRandom, insertAfter } from './utils.js'
import { calcDimensionScores, scoresToLevels, determineResult } from './engine.js'

/**
 * 答题控制器
 * @param {Object} questions - 题目数据
 * @param {Object} dimensions - 维度数据 { order, definitions }
 * @param {Object} types - 人格类型数据 { standard, special }
 * @param {Object} config - 配置
 * @param {Function} onComplete - 完成回调 (answers, result, levels, isDrunk)
 */
export function createQuiz(questions, dimensions, types, config, onComplete) {
  const mainQuestions = shuffle(questions.main)
  const drinkGateQ1 = questions.special.find((q) => q.id === config.drinkGate.questionId)
  const drinkGateQ2 = questions.special.find((q) => q.id === 'drink_gate_q2')

  let queue = insertAtRandom(mainQuestions, drinkGateQ1)
  let current = 0
  let answers = {}
  let isDrunk = false

  const els = {
    fill: document.getElementById('progress-fill'),
    text: document.getElementById('progress-text'),
    qText: document.getElementById('question-text'),
    options: document.getElementById('options'),
  }

  function totalCount() {
    return queue.length
  }

  function updateProgress() {
    const pct = (current / totalCount()) * 100
    els.fill.style.width = pct + '%'
    els.text.textContent = `${current} / ${totalCount()}`
  }

  function renderQuestion() {
    const q = queue[current]
    els.qText.textContent = q.text

    els.options.innerHTML = ''
    q.options.forEach((opt) => {
      const btn = document.createElement('button')
      btn.className = 'btn btn-option'
      btn.textContent = opt.label
      btn.addEventListener('click', () => selectOption(q, opt))
      els.options.appendChild(btn)
    })

    updateProgress()
  }

  function selectOption(question, option) {
    answers[question.id] = option.value

    // 酒鬼门：如果选了"饮酒"，插入追问
    if (question.id === config.drinkGate.questionId && option.value === config.drinkGate.triggerValue) {
      queue = insertAfter(queue, question.id, drinkGateQ2)
    }

    // 酒鬼检测
    if (question.id === 'drink_gate_q2' && option.value === config.drinkGate.drunkTriggerValue) {
      isDrunk = true
    }

    current++
    if (current >= totalCount()) {
      // 计算结果
      const scores = calcDimensionScores(answers, questions.main)
      const levels = scoresToLevels(scores, config.scoring.levelThresholds)
      const result = determineResult(
        levels,
        dimensions.order,
        types.standard,
        types.special,
        { isDrunk }
      )
      onComplete(answers, result, levels, isDrunk)
    } else {
      renderQuestion()
    }
  }

  function start() {
    current = 0
    answers = {}
    isDrunk = false
    queue = insertAtRandom(shuffle(questions.main), drinkGateQ1)
    renderQuestion()
  }

  return { start, renderQuestion }
}
