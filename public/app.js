import { descriptions, levels, lessons, demoReply } from './lessons.js';
import { dimensions } from './reports.js';
import { createVoice } from './voice.js';

const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const status = message => { $('status').textContent = message; };
let level = 'A1';
let view = 'courses';
let mode = 'demo';
let enabled = false;
let session;

try { sessionStorage.removeItem('parlons-config'); } catch { /* Storage is optional. */ }

const voice = createVoice({
  browser: window,
  onStatus: status,
  onChange: controls,
  onDraft(final, interim) {
    if (final) $('reply').value = [session.dictationBase, final].filter(Boolean).join(' ').slice(0, 2000);
    $('draft').textContent = interim;
  },
  onTurn: send,
  canListen: () => view === 'practice' && session && !session.ended && !session.pending && !session.retry
});

function controls() {
  const active = view === 'practice' && session && !session.ended;
  $('handsfree').textContent = voice.active ? '暂停连续对话' : session?.voiceStarted ? '继续语音对话' : '开始连续对话';
  $('handsfree').disabled = !active || !voice.supported || (!voice.active && (voice.recording || session.retry));
  $('mic').textContent = voice.recording && !voice.active ? '结束录音' : '单次录音';
  $('mic').disabled = !active || !voice.supported || voice.active || voice.speaking || Boolean(session?.pending || session?.retry);
  $('send').disabled = !active || voice.recording || voice.speaking || Boolean(session?.pending || session?.retry);
  $('finish').disabled = !active;
  $('resumePractice').hidden = !session || session.ended;
  $('retry').hidden = !active || !session.retry;
  $('stopSpeak').disabled = !voice.speaking;
  $('export').disabled = !session?.history.length;
  $('retryReport').hidden = !session?.ended || !session.reportFailed;
  $('retryReport').disabled = Boolean(session?.pending);
  document.querySelectorAll('[data-speak]').forEach(button => {
    button.disabled = !active || voice.recording || Boolean(session?.pending);
  });
}

function show(next) {
  if (next !== 'practice') voice.pause();
  view = next;
  for (const name of ['courses', 'practice', 'report']) $(name + 'View').classList.toggle('hidden', name !== next);
  $('navCourses').classList.toggle('active', next === 'courses');
  $('navReport').classList.toggle('active', next === 'report');
  if (next === 'report') renderReport();
  controls();
}

function catalog() {
  $('levels').innerHTML = levels.map(name => `<button class="level ${name === level ? 'selected' : ''}" aria-pressed="${name === level}" data-level="${name}">${name}</button>`).join('');
  $('catalogTitle').textContent = level + ' · ' + descriptions[level];
  $('catalogCount').textContent = lessons[level].length + ' 个主题';
  $('coursegrid').innerHTML = lessons[level].map((lesson, index) => `<button class="course" data-index="${index}"><span class="n">UNIT ${String(index + 1).padStart(2, '0')}</span><strong lang="fr">${escape(lesson.title)}</strong><p>${escape(lesson.scene)}</p><span class="foot">${escape(lesson.unit)}　↗</span></button>`).join('');
}

function start(index) {
  voice.pause();
  session?.pending?.abort();
  const lesson = lessons[level][index];
  session = { level, index, lesson, mode, history: [], ended: false };
  $('lessonUnit').textContent = 'UNIT ' + String(index + 1).padStart(2, '0') + ' · ' + lesson.unit;
  $('lessonTitle').textContent = lesson.title;
  $('lessonGoal').textContent = lesson.scene;
  $('practiceLevel').textContent = level;
  $('modelStatus').textContent = mode === 'ai' ? 'AI 模式' : '脚本演示';
  $('reply').value = '';
  $('draft').textContent = '';
  for (const name of ['vocab', 'questions']) {
    $(name).innerHTML = lesson[name].map(value => `<button class="chip" lang="fr" data-insert="${escape(value)}">${escape(value)}</button>`).join('');
  }
  $('examples').innerHTML = lesson.examples.map(value => `<p class="example" lang="fr">${escape(value)}</p>`).join('');
  $('objectives').textContent = lesson.goal;
  renderChat();
  show('practice');
  reply();
}

function renderChat() {
  $('conversation').innerHTML = session.history.map(({ role, content }, index) =>
    `<div class="message ${role === 'user' ? 'user' : ''}"><div class="who">${role === 'user' ? 'VOUS · 你' : 'CAMILLE · 语伴'}</div><div class="bubble" lang="fr">${escape(content)}</div>${role === 'assistant' ? `<button data-speak="${index}">▶ 朗读法语</button>` : ''}</div>`).join('');
  $('conversation').scrollTop = $('conversation').scrollHeight;
}

async function api(operation, current, signal) {
  const response = await fetch('/api/' + operation, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level: current.level, lessonIndex: current.index, history: current.history }),
    signal
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

async function reply() {
  const current = session;
  const pending = new AbortController();
  current.pending = pending;
  current.retry = false;
  status('正在生成法语回复…');
  controls();
  let answer;
  try {
    answer = current.mode === 'ai'
      ? (await api('chat', current, pending.signal)).content
      : demoReply(current.level, current.history);
  } catch (error) {
    if (session === current && !current.ended) {
      current.retry = true;
      voice.pause();
      status(error.message + ' 可重试回复或结束练习。');
    }
  } finally {
    if (current.pending === pending) current.pending = undefined;
  }
  if (session !== current || current.ended) return;
  if (answer) {
    current.history.push({ role: 'assistant', content: answer });
    renderChat();
    status(voice.supported ? '轮到你了。' : '此浏览器可使用文字练习。');
    if (voice.active) voice.speak(answer);
  }
  controls();
}

function send(value) {
  const content = value.trim();
  if (view !== 'practice' || !session || session.ended || session.pending || session.retry || !content) return;
  if (session.history.length >= 159 || new Blob([JSON.stringify(session.history), content]).size > 220000) {
    voice.pause();
    status('已达单次练习长度上限，请结束并生成报告。');
    return;
  }
  if (content.length > 2000) {
    voice.pause();
    status('本轮发言超过 2000 字符，请简短重试。');
    return;
  }
  session.history.push({ role: 'user', content });
  renderChat();
  reply();
  return true;
}

function transcript(current) {
  return current.history.map(({ role, content }) => (role === 'user' ? '你' : 'Camille') + '：' + content).join('\n\n');
}

function renderReport() {
  const current = session;
  const report = current?.report;
  const section = (title, html) => `<section class="reportsection"><h3>${title}</h3>${html}</section>`;
  const list = items => items.length ? `<ul>${items.map(item => '<li>' + escape(item) + '</li>').join('')}</ul>` : '<p>暂无。</p>';
  let html = '<p>完成练习后将在这里显示报告。</p>';
  if (current?.ended) {
    html = `<p>${escape(report?.summary || current.reportMessage)}</p>`;
    if (report) {
      html += '<p class="status">报告基于文字记录。发音未评估。</p>';
      html += section('能力维度', Object.entries(dimensions).map(([key, label]) => {
        const row = report.dimensions[key];
        return `<p><strong>${label}</strong><br>${escape(row?.observation || '未评估。')}<br>${escape(row?.suggestion)}</p>`;
      }).join(''));
      html += section('逐句纠错', report.corrections.length ? '<ul>' + report.corrections.map(item =>
        `<li><strong>${escape(dimensions[item.category])}</strong><br>原文：${escape(item.original)}<br>修改：${escape(item.corrected)}<br>原因：${escape(item.reason)}</li>`).join('') + '</ul>' : '<p>本次报告暂无可引用的纠错。</p>');
      html += section('如何主动提问', list(report.questions)) + section('下次练习建议', list(report.nextSteps));
    }
    html += section('完整对话记录', `<div class="transcript">${escape(transcript(current))}</div>`);
  }
  $('reportBody').innerHTML = html;
  controls();
}

async function generateReport() {
  const current = session;
  const learner = current.history.filter(turn => turn.role === 'user');
  current.reportFailed = false;
  if (!learner.length) {
    current.reportMessage = '本次没有学习者发言，证据不足。';
  } else if (current.mode === 'demo') {
    current.report = {
      summary: '脚本演示 · 共记录 ' + learner.length + ' 次学习者发言。',
      dimensions: { questions: { observation: learner.filter(turn => /[?？]/.test(turn.content)).length + ' 轮发言包含问号。' } },
      corrections: [], questions: current.lesson.questions, nextSteps: ['结合本课情景，尝试提出一个追问。']
    };
  } else {
    const pending = new AbortController();
    current.pending = pending;
    current.reportMessage = '正在分析完整对话…';
    renderReport();
    try { current.report = await api('report', current, pending.signal); }
    catch (error) {
      current.reportFailed = true;
      current.reportMessage = '报告生成失败。' + error.message;
    } finally { current.pending = undefined; }
  }
  if (session === current && view === 'report') renderReport();
}

function finish() {
  session.ended = true;
  session.pending?.abort();
  session.pending = undefined;
  session.reportMessage = '正在生成报告…';
  show('report');
  generateReport();
}

function sendDraft() {
  if ($('send').disabled) return;
  const value = $('reply').value;
  if (send(value)) $('reply').value = '';
}

$('levels').onclick = event => {
  const selection = event.target.closest('[data-level]');
  if (selection) {
    level = selection.dataset.level;
    catalog();
  }
};
$('coursegrid').onclick = event => {
  const course = event.target.closest('[data-index]');
  if (course) start(Number(course.dataset.index));
};
$('practiceView').onclick = event => {
  const hint = event.target.closest('[data-insert]');
  const replay = event.target.closest('[data-speak]');
  if (hint) {
    $('reply').value = [$('reply').value, hint.dataset.insert].filter(Boolean).join(' ').slice(0, 2000);
    $('reply').focus();
  }
  if (replay) voice.speak(session.history[Number(replay.dataset.speak)].content);
};
$('send').onclick = sendDraft;
$('reply').onkeydown = event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    sendDraft();
  }
};
$('handsfree').onclick = () => {
  if (voice.active) {
    voice.pause();
    status('已暂停连续对话。');
  } else {
    const last = session.history.at(-1);
    const opener = !session.voiceStarted && last?.role === 'assistant' ? last.content : '';
    session.voiceStarted = true;
    voice.start(opener);
    if (session.pending) status('AI 正在回复，朗读结束后将开启聆听。');
  }
};
$('mic').onclick = () => {
  if (!voice.recording) session.dictationBase = $('reply').value.trim();
  voice.dictate();
};
$('stopSpeak').onclick = () => {
  voice.stopSpeaking();
  status('已停止朗读。');
};
$('retry').onclick = reply;
$('retryReport').onclick = generateReport;
$('finish').onclick = finish;
$('back').onclick = $('returnCourse').onclick = $('navCourses').onclick = () => show('courses');
$('resumePractice').onclick = () => show('practice');
$('navReport').onclick = () => show('report');
$('export').onclick = () => {
  const text = `Parlons — ${session.level} · ${session.lesson.title}\n\n${transcript(session)}\n\n${session.report ? JSON.stringify(session.report, null, 2) : ''}`;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'parlons-session.txt';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('navSettings').onclick = $('settingsTop').onclick = () => {
  $('availability').textContent = (enabled ? '服务器已配置模型。' : '服务器当前提供脚本演示。') +
    ' 当前选择：' + (mode === 'ai' ? 'AI' : '演示') + '。切换将在下次打开课程时生效。';
  $('settings').showModal();
};
$('useAI').onclick = () => { if (enabled) mode = 'ai'; };
$('demoMode').onclick = () => { mode = 'demo'; };
$('useAI').disabled = true;
fetch('/api/config').then(response => response.json()).then(config => {
  enabled = config.enabled === true;
  $('useAI').disabled = !enabled;
}).catch(() => { /* Scripted practice remains available. */ });
catalog();
controls();
