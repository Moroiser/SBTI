import { calcDimensionScores, scoresToLevels, determineResult } from './engine.js'
import { createQuiz } from './quiz.js'
import { renderResult } from './result.js'
import './style.css'

let selectedChannel = null

async function loadJSON(path) {
  const res = await fetch(path)
  return res.json()
}

async function init() {
  const [questions, dimensions, types, config] = await Promise.all([
    loadJSON(new URL('../data/questions.json', import.meta.url).href),
    loadJSON(new URL('../data/dimensions.json', import.meta.url).href),
    loadJSON(new URL('../data/types.json', import.meta.url).href),
    loadJSON(new URL('../data/config.json', import.meta.url).href),
  ])

  const pages = {
    intro: document.getElementById('page-intro'),
    channel: document.getElementById('page-channel'),
    quiz: document.getElementById('page-quiz'),
    result: document.getElementById('page-result'),
  }

  function showPage(name) {
    Object.values(pages).forEach((p) => p.classList.remove('active'))
    if (pages[name]) pages[name].classList.add('active')
    window.scrollTo(0, 0)
  }

  let currentResult = null
  let currentLevels = null
  let currentAnswers = null
  let isDrunk = false

  function onQuizComplete(answers, result, levels, drunk) {
    currentAnswers = answers
    currentResult = result
    currentLevels = levels
    isDrunk = drunk
    renderResult(result, levels, dimensions.order, dimensions.definitions, config, selectedChannel)
    showPage('result')
  }

  const quiz = createQuiz(questions, dimensions, types, config, onQuizComplete)

  // 首页 → 通道选择
  document.getElementById('btn-start').addEventListener('click', () => {
    showPage('channel')
  })

  // 通道选择 → 答题
  document.getElementById('btn-channel-human').addEventListener('click', () => {
    selectedChannel = 'human'
    quiz.start()
    showPage('quiz')
  })

  document.getElementById('btn-channel-agent').addEventListener('click', () => {
    selectedChannel = 'agent'
    quiz.start()
    showPage('quiz')
  })

  // 重新测试 → 回到通道选择
  document.getElementById('btn-restart').addEventListener('click', () => {
    selectedChannel = null
    showPage('channel')
  })
}

init()
