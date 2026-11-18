import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createVoice } from '../public/voice.js';

function harness(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const engines = [];
  const utterances = [];
  const turns = [];
  const drafts = [];
  class Recognition {
    start() { engines.push(this); this.onstart(); }
    abort() { this.aborted = true; }
  }
  class Utterance {}
  const voice = createVoice({
    browser: {
      SpeechRecognition: Recognition,
      SpeechSynthesisUtterance: Utterance,
      speechSynthesis: { getVoices: () => [], speak: utterance => utterances.push(utterance), cancel() {} }
    },
    onStatus() {}, onChange() {}, canListen: () => true,
    onTurn: turn => turns.push(turn),
    onDraft: (...draft) => drafts.push(draft)
  });
  const tick = () => t.mock.timers.tick(300);
  return { voice, engines, utterances, turns, drafts, tick };
}

function result(engine, text, final) {
  engine.onresult({ results: [Object.assign([{ transcript: text }], { isFinal: final })] });
}

test('waits for speech playback, ignores interim words, and sends final text exactly once', t => {
  const { voice, engines, utterances, turns, tick } = harness(t);
  voice.start('Salut !');
  tick();
  assert.equal(engines.length, 0);
  utterances[0].onend();
  tick();
  result(engines[0], 'bonjour?', false);
  engines[0].onend();
  assert.deepEqual(turns, []);
  tick();
  result(engines[1], 'Bonjour !', true);
  engines[1].onend();
  engines[1].onend();
  assert.deepEqual(turns, ['Bonjour !']);
  voice.speak('Ça va ?');
  tick();
  assert.equal(engines.length, 2);
  utterances[1].onend();
  tick();
  assert.equal(engines.length, 3);
});

test('pause discards stale recognition and resume starts a fresh turn', t => {
  const { voice, engines, turns, tick } = harness(t);
  voice.start();
  tick();
  result(engines[0], 'Salut', true);
  voice.pause();
  assert.equal(engines[0].aborted, true);
  engines[0].onend();
  tick();
  assert.deepEqual(turns, []);
  assert.equal(engines.length, 1);
  voice.start();
  tick();
  assert.equal(engines.length, 2);
  engines[1].onerror({ error: 'not-allowed' });
  engines[1].onend();
  assert.equal(voice.active, false);
});
