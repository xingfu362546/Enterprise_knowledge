/**
 * 绩效评分 · 两位小数格式（员工自评 / 上级 / 分管）
 * 填写最多 2 位小数；整数展示为 x.00
 */
(function () {
  'use strict';

  function parseScore(value) {
    if (value === null || value === undefined || value === '') return null;
    var n = parseFloat(String(value).replace(/,/g, ''));
    return isNaN(n) ? null : n;
  }

  function roundScore(n) {
    return Math.round(n * 100) / 100;
  }

  /** 只读展示：整数也显示 x.00，空值 — */
  function format(value) {
    var n = parseScore(value);
    if (n === null) return '—';
    return roundScore(n).toFixed(2);
  }

  /** input value 属性：空串或 x.00 */
  function inputVal(value) {
    var n = parseScore(value);
    if (n === null) return '';
    return roundScore(n).toFixed(2);
  }

  function clampTyping(raw) {
    var v = String(raw);
    if (v === '' || v === '-' || v === '.') return v;
    if (/^-?\d*\.?\d{0,2}$/.test(v)) return v;
    var m = v.match(/^(-?\d*\.?\d{0,2})/);
    return m ? m[1] : '';
  }

  function bindScoreInput(input, onChange) {
    if (!input || input.dataset.perfScoreBound) return;
    input.dataset.perfScoreBound = '1';
    input.setAttribute('step', '0.01');
    input.classList.add('perf-score-input');

    input.addEventListener('input', function () {
      var next = clampTyping(input.value);
      if (next !== input.value) input.value = next;
    });

    input.addEventListener('blur', function () {
      var raw = input.value;
      if (raw === '' || raw === '-' || raw === '.') {
        input.value = '';
        if (onChange) onChange('');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      var n = parseScore(raw);
      if (n === null) {
        input.value = '';
        if (onChange) onChange('');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      n = roundScore(n);
      input.value = n.toFixed(2);
      if (onChange) onChange(String(n));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function bindAll(root) {
    var scope = root || document;
    scope.querySelectorAll('input.perf-score-input, input[data-perf-score]').forEach(function (inp) {
      bindScoreInput(inp);
    });
  }

  window.PerfScoreFormat = {
    parse: parseScore,
    round: roundScore,
    format: format,
    inputVal: inputVal,
    bindScoreInput: bindScoreInput,
    bindAll: bindAll,
  };
})();
