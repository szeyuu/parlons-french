export function createVoice({ browser, onStatus, onChange, onDraft, onTurn, canListen }) {
  const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
  const synth = browser.speechSynthesis;
  let recognition;
  let playback;
  let timer;
  let continuous = false;
  let emptyTurns = 0;

  function cancelPlayback() {
    if (!playback) return;
    playback = undefined;
    synth.cancel();
  }

  function pause() {
    continuous = false;
    clearTimeout(timer);
    if (recognition) {
      recognition.discard = true;
      try { recognition.engine.abort(); } catch { /* Wait for the recognizer to end. */ }
    }
    cancelPlayback();
    onChange();
  }

  function schedule(delay = 300) {
    clearTimeout(timer);
    if (continuous) timer = setTimeout(() => listen(true), delay);
  }

  function listen(automatic) {
    if (!Recognition || recognition || playback || !canListen()) return;
    const engine = new Recognition();
    engine.lang = 'fr-FR';
    engine.interimResults = true;
    engine.continuous = false;
    const turn = { engine, discard: false };
    recognition = turn;
    let error;
    let final = '';
    engine.onstart = () => {
      if (!turn.discard) onStatus('正在听你说法语…');
    };
    engine.onresult = event => {
      if (turn.discard) return;
      const results = Array.from(event.results);
      final = results.filter(row => row.isFinal).map(row => row[0].transcript.trim()).join(' ').trim();
      const interim = results.filter(row => !row.isFinal).map(row => row[0].transcript).join(' ');
      onDraft(automatic ? '' : final, interim);
    };
    engine.onerror = event => { error = event.error; };
    engine.onend = () => {
      if (recognition !== turn) return;
      recognition = undefined;
      onChange();
      onDraft('', '');
      if (turn.discard) {
        schedule();
        return;
      }
      if (error && error !== 'no-speech') {
        pause();
        onStatus('语音识别已停止（' + error + '）。可继续尝试或使用文字输入。');
      } else if (automatic && final) {
        emptyTurns = 0;
        onTurn(final);
      } else if (automatic && ++emptyTurns >= 3) {
        pause();
        onStatus('连续多次未听到语音，已暂停。');
      } else if (automatic) {
        onStatus('正在等待你说话…');
        schedule();
      } else {
        onStatus('可以编辑转写内容并发送。');
      }
    };
    try {
      engine.start();
      onChange();
    } catch {
      recognition = undefined;
      pause();
      onStatus('无法启动麦克风，可使用文字输入。');
    }
  }

  function speak(text) {
    if (recognition) return;
    clearTimeout(timer);
    cancelPlayback();
    if (!text || !synth || !browser.SpeechSynthesisUtterance) {
      schedule();
      return;
    }
    const utterance = new browser.SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    const frenchVoice = synth.getVoices().find(voice => voice.lang.toLowerCase().startsWith('fr'));
    if (frenchVoice) utterance.voice = frenchVoice;
    utterance.rate = 0.92;
    playback = utterance;
    const done = failed => {
      if (playback !== utterance) return;
      playback = undefined;
      onStatus(failed ? '朗读失败，可阅读对话文字。' : '轮到你了。');
      onChange();
      schedule();
    };
    utterance.onend = () => done(false);
    utterance.onerror = () => done(true);
    onStatus('Camille 正在说话…');
    onChange();
    try { synth.speak(utterance); } catch { done(true); }
  }

  return {
    supported: Boolean(Recognition),
    get active() { return continuous; },
    get recording() { return Boolean(recognition); },
    get speaking() { return Boolean(playback); },
    start(text) {
      continuous = true;
      emptyTurns = 0;
      onChange();
      speak(text);
    },
    pause,
    speak,
    next: schedule,
    stopSpeaking() {
      cancelPlayback();
      onChange();
      schedule();
    },
    dictate() {
      if (recognition) recognition.engine.stop();
      else listen(false);
    }
  };
}
