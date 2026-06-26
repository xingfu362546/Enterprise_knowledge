/**
 * 季度 6Q3J 客观分 · 共享存储与展示（v1.2 演示）
 * HR 计划明细导入 → localStorage → 员工季表 / 上级评分只读
 */
(function () {
  'use strict';

  var ITEMS = [
    { key: 'cert', title: '1368 认证', max: 4 },
    { key: 'culture', title: '文化经句践行', max: 3 },
    { key: 'ai', title: 'AI 提效应用', max: 3 },
  ];

  var TOTAL_MAX = 10;
  var STORAGE_PREFIX = 'perf-sixq3j-';
  var DEFAULT_PLAN = '2026-Q2';
  var DEFAULT_EMP = 'E10021';

  /** 演示预置：2026-Q2 · 分项独立（含部分待导入） */
  var DEMO_SEED = {
    '2026-Q2': {
      E10021: { cert: 4, culture: null, ai: 2.5 },
      E10035: { cert: 4, culture: 3, ai: 3 },
      E10008: { cert: 3.5, culture: 2.5, ai: null },
      E10048: { cert: 4, culture: 2, ai: 2 },
    },
  };

  function sf() { return window.PerfScoreFormat; }

  function fmtScore(val) {
    if (val == null || val === '') return null;
    var n = parseFloat(val);
    if (isNaN(n)) return null;
    return sf() ? sf().format(n) : String(n);
  }

  function storageKey(planId) {
    return STORAGE_PREFIX + (planId || DEFAULT_PLAN);
  }

  function loadPlan(planId) {
    try {
      var raw = localStorage.getItem(storageKey(planId));
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function savePlan(planId, data) {
    localStorage.setItem(storageKey(planId), JSON.stringify(data));
    try {
      window.dispatchEvent(new CustomEvent('perf-sixq3j-updated', { detail: { planId: planId } }));
    } catch (err) { /* ignore */ }
  }

  /** 计划无数据时写入预置分；force 时覆盖为演示集 */
  function ensureDemoSeed(planId, force) {
    planId = planId || DEFAULT_PLAN;
    var seed = DEMO_SEED[planId];
    if (!seed) return false;
    var plan = loadPlan(planId);
    if (!force && Object.keys(plan).length) return false;
    Object.keys(seed).forEach(function (no) {
      plan[no] = {
        cert: seed[no].cert,
        culture: seed[no].culture,
        ai: seed[no].ai,
      };
    });
    savePlan(planId, plan);
    return true;
  }

  function resetDemoSeed(planId) {
    planId = planId || DEFAULT_PLAN;
    localStorage.removeItem(storageKey(planId));
    return ensureDemoSeed(planId, true);
  }

  function emptyRecord() {
    return { cert: null, culture: null, ai: null };
  }

  function get(planId, empNo) {
    var plan = loadPlan(planId);
    var rec = plan[empNo];
    if (!rec) return emptyRecord();
    return {
      cert: rec.cert != null ? rec.cert : null,
      culture: rec.culture != null ? rec.culture : null,
      ai: rec.ai != null ? rec.ai : null,
    };
  }

  function upsert(planId, empNo, partial) {
    var plan = loadPlan(planId);
    var rec = plan[empNo] || emptyRecord();
    ITEMS.forEach(function (it) {
      if (Object.prototype.hasOwnProperty.call(partial, it.key)) {
        var v = partial[it.key];
        rec[it.key] = v == null || v === '' ? null : parseFloat(v);
        if (rec[it.key] != null && isNaN(rec[it.key])) rec[it.key] = null;
      }
    });
    plan[empNo] = rec;
    savePlan(planId, plan);
    return rec;
  }

  function summarize(record) {
    var sum = 0;
    var imported = 0;
    var pending = [];
    ITEMS.forEach(function (it) {
      if (record[it.key] != null && !isNaN(record[it.key])) {
        sum += record[it.key];
        imported++;
      } else {
        pending.push(it.title);
      }
    });
    return { sum: sum, imported: imported, total: ITEMS.length, pending: pending, totalMax: TOTAL_MAX };
  }

  function statusLabel(record) {
    var s = summarize(record);
    if (s.imported === 0) return '待导入';
    if (s.pending.length) return s.imported + '/3 · ' + (sf() ? sf().format(s.sum) : s.sum.toFixed(2)) + ' 分';
    return (sf() ? sf().format(s.sum) : s.sum.toFixed(2)) + ' / ' + TOTAL_MAX;
  }

  function previewText(record, key) {
    var v = record[key];
    if (v == null || v === '') {
      return '<span class="sixq-pending">待导入</span>';
    }
    return (sf() ? sf().format(v) : String(v)) + ' 分';
  }

  function bodyText(record, key, max) {
    var v = record[key];
    if (v == null || v === '') {
      return '<span class="sixq-pending">待导入</span> · HR 尚未导入该项客观分';
    }
    return (sf() ? sf().format(v) : String(v)) + ' / ' + max + ' 分 · 系统导入';
  }

  function renderTotalBar(record) {
    var s = summarize(record);
    var sumStr = s.imported ? (sf() ? sf().format(s.sum) : s.sum.toFixed(2)) : '—';
    var pendingNote = s.pending.length
      ? '<span class="sixq-total-note">' + s.pending.map(function (t) { return t + ' 待导入'; }).join(' · ') + '</span>'
      : '<span class="sixq-total-note sixq-total-note--ok">三项均已导入</span>';
    return (
      '<div class="sixq-total-bar">' +
      '<span class="sixq-total-label">6Q3J 总分</span>' +
      '<span class="sixq-total-value">' + sumStr + ' / ' + TOTAL_MAX + '</span>' +
      pendingNote +
      '</div>'
    );
  }

  function renderCollapseCards(record, openFirst) {
    return ITEMS.map(function (it, i) {
      var open = openFirst && i === 0 ? ' open' : '';
      return (
        '<div class="collapse-card' + open + '">' +
        '<button type="button" class="collapse-head">' +
        '<span class="collapse-title">' + it.title + '</span>' +
        '<span class="collapse-preview">' + previewText(record, it.key) + '</span>' +
        '<span class="collapse-chevron">▼</span></button>' +
        '<div class="collapse-body"><div class="field-readonly">' + bodyText(record, it.key, it.max) + '</div></div>' +
        '</div>'
      );
    }).join('');
  }

  function renderStepHtml(planId, empNo) {
    var record = get(planId, empNo);
    return (
      '<p class="section-desc">6Q3J 客观分只读 · 由 HR 在计划明细导入；未导入项显示<strong>待导入</strong>。</p>' +
      renderTotalBar(record) +
      renderCollapseCards(record, true)
    );
  }

  function renderReadonlyPanel(planId, empNo, opts) {
    opts = opts || {};
    var record = get(planId, empNo);
    var title = opts.title || '6Q3J 人才评价（客观分 · 只读）';
    return (
      '<div class="sixq-panel q-card-panel">' +
      '<h3 class="sixq-panel-title">' + title + '</h3>' +
      renderTotalBar(record) +
      '<div class="sixq-grid">' +
      ITEMS.map(function (it) {
        var v = record[it.key];
        var cell = v != null
          ? '<span class="sixq-score">' + (sf() ? sf().format(v) : v) + '</span><span class="sixq-max">/ ' + it.max + ' 分</span>'
          : '<span class="sixq-pending">待导入</span>';
        return '<div class="sixq-grid-item"><div class="sixq-grid-label">' + it.title + '</div><div class="sixq-grid-val">' + cell + '</div></div>';
      }).join('') +
      '</div></div>'
    );
  }

  function parseImportText(text) {
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) return { rows: [], errors: ['文件为空'] };
    var rows = [];
    var errors = [];
    var start = 0;
    var first = lines[0].replace(/^\ufeff/, '');
    if (/工号|1368|文化|AI/i.test(first)) start = 1;

    for (var i = start; i < lines.length; i++) {
      var parts = lines[i].split(/[,，\t]/).map(function (p) { return p.trim(); });
      if (!parts[0]) continue;
      var row = { no: parts[0].toUpperCase(), cert: null, culture: null, ai: null };
      if (parts.length > 1 && parts[1] !== '') row.cert = parts[1];
      if (parts.length > 2 && parts[2] !== '') row.culture = parts[2];
      if (parts.length > 3 && parts[3] !== '') row.ai = parts[3];
      rows.push(row);
    }
    return { rows: rows, errors: errors };
  }

  function importRows(planId, rows, knownNos) {
    var updated = 0;
    var skipped = [];
    knownNos = knownNos || null;
    rows.forEach(function (row) {
      if (knownNos && knownNos.indexOf(row.no) === -1) {
        skipped.push(row.no);
        return;
      }
      var partial = {};
      if (row.cert != null) partial.cert = row.cert;
      if (row.culture != null) partial.culture = row.culture;
      if (row.ai != null) partial.ai = row.ai;
      if (Object.keys(partial).length) {
        upsert(planId, row.no, partial);
        updated++;
      }
    });
    return { updated: updated, skipped: skipped };
  }

  function templateCsv() {
    return '工号,1368认证,文化经句,AI提效\nE10021,4,,2.5\nE10035,4,3,3\nE10008,3.5,2.5,\n';
  }

  ensureDemoSeed(DEFAULT_PLAN);

  window.PerfSixQ3J = {
    ITEMS: ITEMS,
    TOTAL_MAX: TOTAL_MAX,
    DEFAULT_PLAN: DEFAULT_PLAN,
    DEFAULT_EMP: DEFAULT_EMP,
    DEMO_SEED: DEMO_SEED,
    get: get,
    upsert: upsert,
    summarize: summarize,
    statusLabel: statusLabel,
    renderStepHtml: renderStepHtml,
    renderReadonlyPanel: renderReadonlyPanel,
    parseImportText: parseImportText,
    importRows: importRows,
    templateCsv: templateCsv,
    ensureDemoSeed: ensureDemoSeed,
    resetDemoSeed: resetDemoSeed,
  };
})();
