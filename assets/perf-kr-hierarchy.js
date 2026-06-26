/**
 * 考核三级结构 · 关键目标(L2) → 考核目标(L3)
 * 月度 85% / 季度 90% / 下月·下季 100%
 */
(function () {
  'use strict';

  var WEIGHT_TARGETS = { month: 85, quarter: 90, next: 100 };

  function genId(prefix) {
    return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 9);
  }

  function defaultTiers(w) {
    if (typeof defaultStandardTiers === 'function') return defaultStandardTiers(w || 25);
    return [];
  }

  function emptyTarget(block) {
    return { id: genId('t'), block: block || 'V', smart: '', weight: '', standardTiers: defaultTiers(25), attachRules: '', m: '', selfScore: '', challenge: '' };
  }

  function emptyKeyObjective(block, withDemo) {
    var ko = {
      id: genId('ko'),
      o: '',
      targets: [emptyTarget(block), emptyTarget(block)],
    };
    if (withDemo && block === 'V') {
      ko.o = '推动绩效系统 MVP 需求评审与方案落地';
      ko.targets[0].smart = '6/30 前完成 PRD 评审，覆盖月/季模板与双端填表主链路';
      ko.targets[0].weight = '25';
      ko.targets[0].m = '已完成 PRD v1.0 并组织 2 轮评审';
      ko.targets[0].selfScore = '23';
      ko.targets[1].smart = '5/28 前交付双端 HTML 原型主链路';
      ko.targets[1].weight = '20';
      ko.targets[1].m = '交付 prototype/index.html 及 20+ 页面';
      ko.targets[1].selfScore = '18';
      if (typeof syncStandardTierScores === 'function') {
        ko.targets.forEach(function (t) { syncStandardTierScores(t); });
      }
    }
    if (withDemo && block === 'X') {
      ko.o = '跨部门协同与文档沉淀';
      ko.targets[0].smart = '工作日内 24h 响应；重要会议提前 1 天准备材料';
      ko.targets[0].weight = '8';
      ko.targets[0].m = '参与跨部门会议 11 次';
      ko.targets[1].smart = 'Grill/Handoff 文档与原型同步更新';
      ko.targets[1].weight = '7';
      ko.targets[1].m = '维护 Handoff 与 Grill 决策记录';
    }
    return ko;
  }

  /** 旧数据：smart/attachRules 在关键目标上 → 归到考核目标 */
  function normalizeKeyObjective(ko) {
    if (!ko) return ko;
    if ((ko.smart || '').trim() && ko.targets && ko.targets.length) {
      ko.targets.forEach(function (t, i) {
        if (!(t.smart || '').trim() && i === 0) t.smart = ko.smart;
      });
    }
    if (ko.attachRules && ko.targets && ko.targets.length && !(ko.targets[0].attachRules || '').trim()) {
      ko.targets[0].attachRules = ko.attachRules;
    }
    delete ko.smart;
    delete ko.attachRules;
    return ko;
  }

  function migrateFlatList(flat, block) {
    if (!flat || !flat.length) return [emptyKeyObjective(block, false)];
    return flat.map(function (kr) {
      return {
        id: kr.id || genId('ko'),
        o: kr.o || '',
        targets: [{
          id: kr.id || genId('t'),
          block: block,
          smart: kr.smart || '',
          weight: kr.weight,
          attachRules: kr.attachRules || '',
          standardTiers: kr.standardTiers || defaultTiers(kr.weight),
          m: kr.m || '',
          selfScore: kr.selfScore != null ? kr.selfScore : '',
          challenge: kr.challenge,
        }],
      };
    });
  }

  /** 旧版填表多条扁平 KR → 合并为 1 个关键目标 + 多个考核目标 */
  function consolidateFlatList(flat, block) {
    if (!flat || !flat.length) return [emptyKeyObjective(block, false)];
    if (flat.length === 1) return migrateFlatList(flat, block);
    var ko = {
      id: genId('ko'),
      o: '',
      targets: flat.map(function (kr) {
        return {
          id: kr.id || genId('t'),
          block: block,
          smart: kr.smart || '',
          weight: kr.weight,
          attachRules: kr.attachRules || '',
          standardTiers: kr.standardTiers || defaultTiers(kr.weight),
          m: kr.m || '',
          selfScore: kr.selfScore != null ? kr.selfScore : '',
          challenge: kr.challenge,
        };
      }),
    };
    var firstO = flat.map(function (k) { return (k.o || '').trim(); }).find(Boolean);
    if (firstO) ko.o = firstO;
    return [ko];
  }

  function isKoOpen(state, openKey, idx) {
    if (!state.openKr) state.openKr = {};
    if (state.openKr[openKey] === idx) return true;
    if (state.openKr[openKey] === undefined && idx === 0) return true;
    return false;
  }

  /** 修复 localStorage 中「多条空关键目标」的遗留数据 */
  function repairWizardHierarchy(state) {
    ['coreKeyObjectives', 'regularKeyObjectives'].forEach(function (key) {
      var list = state[key];
      if (!list || list.length <= 1) return;
      var block = key === 'coreKeyObjectives' ? 'V' : 'X';
      var isGhost = function (ko) {
        return !(ko.o || '').trim() && !(ko.smart || '').trim() &&
          !(ko.targets || []).some(function (t) {
            return (t.m || '').trim() || t.weight || (t.selfScore != null && t.selfScore !== '');
          });
      };
      var filtered = list.filter(function (ko) { return !isGhost(ko); });
      if (filtered.length && filtered.length < list.length) {
        state[key] = filtered;
        list = filtered;
      }
      if (list.length <= 1) return;
      /* 仅移除幽灵项，不再强制合并为 1 个关键目标 */
    });
  }

  function sumKoTargets(ko) {
    var sum = 0;
    (ko && ko.targets || []).forEach(function (t) {
      sum += parseFloat(t.weight) || 0;
    });
    return Math.round(sum * 1000) / 1000;
  }

  function ensureKeyObjectiveList(state, listKey, block) {
    if (!state[listKey] || !state[listKey].length) {
      state[listKey] = [emptyKeyObjective(block, false)];
    }
    state[listKey].forEach(function (ko) {
      normalizeKeyObjective(ko);
      if (!ko.targets || !ko.targets.length) ko.targets = [emptyTarget(block)];
      ko.targets.forEach(function (t) {
        if (typeof ensureStandardTiers === 'function') ensureStandardTiers(t);
      });
    });
    return state[listKey];
  }

  function renderKoWeightSumBar(ko, koIdx, cap) {
    var sum = sumKoTargets(ko);
    var tol = 0.05;
    var over = cap != null && sum > cap + tol;
    var cls = 'ko-weight-sum' + (over ? ' ko-weight-sum--over' : '');
    var err = over
      ? ' <span class="ko-weight-sum__err">超出 ' + (sum - cap).toFixed(1) + '%（单关键目标上限 ' + cap + '%）</span>'
      : '';
    return '<div class="' + cls + '" data-ko-weight-sum="' + koIdx + '">' +
      '本关键目标下考核目标权重合计：<b>' + sum.toFixed(1) + '%</b>' + err + '</div>';
  }

  function ensureState(state) {
    if (!state.openKr) state.openKr = {};
    if (!state.coreKeyObjectives) {
      state.coreKeyObjectives = state.coreKrs && state.coreKrs.length
        ? consolidateFlatList(state.coreKrs, 'V')
        : [emptyKeyObjective('V', false)];
    }
    if (!state.regularKeyObjectives) {
      state.regularKeyObjectives = state.regularKrs && state.regularKrs.length
        ? consolidateFlatList(state.regularKrs, 'X')
        : [emptyKeyObjective('X', false)];
    }
    if (!state.nextMonthKeyObjectives) {
      state.nextMonthKeyObjectives = state.nextMonthKrs && state.nextMonthKrs.length
        ? consolidateFlatList(state.nextMonthKrs, 'next')
        : [emptyKeyObjective('next', false)];
    }
    if (!state.nextSeasonKeyObjectives && state.nextSeasonKrs) {
      state.nextSeasonKeyObjectives = consolidateFlatList(state.nextSeasonKrs, 'next');
    }
    repairWizardHierarchy(state);
    if (state.coreKeyObjectives) ensureKeyObjectiveList(state, 'coreKeyObjectives', 'V');
    if (state.regularKeyObjectives) ensureKeyObjectiveList(state, 'regularKeyObjectives', 'X');
    if (state.nextMonthKeyObjectives) ensureKeyObjectiveList(state, 'nextMonthKeyObjectives', 'next');
    if (state.nextSeasonKeyObjectives) ensureKeyObjectiveList(state, 'nextSeasonKeyObjectives', 'next');
    [state.coreKeyObjectives, state.regularKeyObjectives, state.nextMonthKeyObjectives, state.nextSeasonKeyObjectives].forEach(function (list) {
      if (!list) return;
      list.forEach(function (ko) {
        normalizeKeyObjective(ko);
        if (!ko.targets || !ko.targets.length) ko.targets = [emptyTarget('V')];
        ko.targets.forEach(function (t) {
          if (typeof ensureStandardTiers === 'function') ensureStandardTiers(t);
        });
      });
    });
    return state;
  }

  function sumTargets(list) {
    var sum = 0;
    (list || []).forEach(function (ko) {
      (ko.targets || []).forEach(function (t) {
        sum += parseFloat(t.weight) || 0;
      });
    });
    return Math.round(sum * 1000) / 1000;
  }

  function flattenTargets(keyObjectives, block) {
    var out = [];
    (keyObjectives || []).forEach(function (ko) {
      (ko.targets || []).forEach(function (t) {
        out.push({
          id: t.id,
          block: block || t.block,
          weight: t.weight,
          o: ko.o,
          smart: t.smart || '',
          attachRules: t.attachRules || '',
          keyObjectiveId: ko.id,
          keyObjective: ko,
          standardTiers: t.standardTiers,
          standard: t.standard,
          m: t.m,
          selfScore: t.selfScore,
          challenge: t.challenge,
        });
      });
    });
    return out;
  }

  function legacyFlat(state) {
    return {
      coreKrs: flattenTargets(state.coreKeyObjectives, 'V'),
      regularKrs: flattenTargets(state.regularKeyObjectives, 'X'),
      nextMonthKrs: flattenTargets(state.nextMonthKeyObjectives, 'next'),
    };
  }

  function enrichWeightStatus(ws) {
    if (!ws) return ws;
    var tol = 0.05;
    ws.over = ws.total > ws.target + tol;
    ws.under = ws.total < ws.target - tol;
    ws.overBy = ws.over ? Math.round((ws.total - ws.target) * 10) / 10 : 0;
    ws.underBy = ws.under ? Math.round((ws.target - ws.total) * 10) / 10 : 0;
    ws.ok = !ws.over && !ws.under;
    return ws;
  }

  function weightStatus(state, periodType) {
    periodType = periodType || 'month';
    var ws;
    if (periodType === 'next') {
      var list = state.nextMonthKeyObjectives || state.nextSeasonKeyObjectives || [];
      var total = sumTargets(list);
      var target = WEIGHT_TARGETS.next;
      ws = { core: 0, regular: 0, total: total, target: target, label: '下月/下季 KR 权重', periodType: 'next' };
    } else {
      var core = sumTargets(state.coreKeyObjectives);
      var regular = sumTargets(state.regularKeyObjectives);
      var total = core + regular;
      var target = periodType === 'quarter' ? WEIGHT_TARGETS.quarter : WEIGHT_TARGETS.month;
      ws = { core: core, regular: regular, total: total, target: target, label: '核心+常规 KR 权重', periodType: periodType };
    }
    return enrichWeightStatus(ws);
  }

  function renderWeightBar(status, extraClass) {
    status = enrichWeightStatus(Object.assign({}, status));
    var cls = 'weight-bar' + (extraClass || '');
    if (status.over) cls += ' weight-bar--over';
    else if (status.under) cls += ' weight-bar--under';
    else if (!status.ok) cls += ' weight-bar--error';
    var hint = '';
    if (status.over) {
      hint = '<span class="weight-bar__err">超出 ' + status.overBy.toFixed(1) + '%（须 = ' + status.target + '%）</span>';
    } else if (status.under) {
      hint = '<span class="weight-bar__warn">还差 ' + status.underBy.toFixed(1) + '%（须 = ' + status.target + '%）</span>';
    } else {
      hint = '<span class="weight-bar__ok">✓ 已达标</span>';
    }
    return '<div class="' + cls + '">' +
      (status.regular != null && status.periodType !== 'next'
        ? '<span>核心 V: <b>' + status.core.toFixed(1) + '%</b></span><span>常规 X: <b>' + status.regular.toFixed(1) + '%</b></span>'
        : '') +
      '<span>合计: <b>' + status.total.toFixed(1) + '%</b> / ' + status.target + '%</span>' +
      hint +
      '</div>';
  }

  function sIn(v) { return window.PerfScoreFormat ? PerfScoreFormat.inputVal(v) : (v == null ? '' : String(v)); }

  function levelBadge(level, text) {
    return '<span class="perf-level-badge perf-level-badge--' + level + '">' + text + '</span>';
  }

  function delBtn(className, label, attrs) {
    var data = Object.keys(attrs || {}).map(function (k) {
      return 'data-' + k + '="' + attrs[k] + '"';
    }).join(' ');
    return '<button type="button" class="perf-del-btn ' + (className || '') + '" ' + data + ' title="' + label + '">' +
      '<span class="perf-del-btn__icon" aria-hidden="true">×</span>' +
      '<span class="perf-del-btn__text">' + label + '</span></button>';
  }

  function renderTargetFields(t, ti, koIdx, opts) {
    opts = opts || {};
    var tiers = typeof renderStandardTiersHtml === 'function' ? renderStandardTiersHtml(t, true) : '';
    var weightChip = t.weight ? t.weight + '%' : '未填权重';
    var html = '<div class="kr-target-card" data-ko="' + koIdx + '" data-ti="' + ti + '">' +
      '<div class="kr-target-toolbar">' +
      levelBadge('l3', 'L3') +
      '<span class="kr-target-title">考核目标 ' + (ti + 1) + '</span>' +
      '<span class="kr-target-weight-chip">' + weightChip + '</span>' +
      (ti > 0 ? delBtn('remove-target', '删除考核目标', { ko: koIdx, ti: ti }) : '<span class="kr-target-toolbar-spacer"></span>') +
      '</div>' +
      '<div class="kr-target-body">' +
      '<div class="field"><label>考核目标 SMART</label><textarea rows="2" data-t="smart" placeholder="具体、可衡量、可达成、相关、有时限">' + (t.smart || '') + '</textarea></div>' +
      '<div class="field field--weight"><label>KR 权重 %</label><input type="number" min="0" max="100" data-t="weight" value="' + (t.weight || '') + '" />' +
      '<div class="weight-field-hint" data-weight-hint aria-live="polite"></div></div>' +
      tiers +
      '<div class="field"><label>关键成果 M</label><textarea rows="2" data-t="m">' + (t.m || '') + '</textarea></div>';
    if (!opts.planning) {
      html += '<div class="field"><label>自评分</label><input type="number" step="0.01" class="perf-score-input" data-perf-score data-t="selfScore" value="' + sIn(t.selfScore) + '" /></div>';
    } else if (opts.showChallenge) {
      html += '<div class="field"><label>存在挑战/需求资源</label><textarea rows="2" data-t="challenge">' + (t.challenge || '') + '</textarea></div>';
    }
    html += '</div></div>';
    return html;
  }

  function countTargets(list) {
    if (!list || !list.length) return 0;
    var n = 0;
    list.forEach(function (ko) { n += (ko.targets || []).length; });
    return n;
  }

  function refreshKoWeightSums(root, list, cap) {
    if (!root || !list) return;
    var tol = 0.05;
    list.forEach(function (ko, koIdx) {
      var sum = sumKoTargets(ko);
      var over = cap != null && sum > cap + tol;
      root.querySelectorAll('[data-ko-weight-sum="' + koIdx + '"]').forEach(function (el) {
        el.classList.toggle('ko-weight-sum--over', over);
        var err = over
          ? ' <span class="ko-weight-sum__err">超出 ' + (sum - cap).toFixed(1) + '%（单关键目标上限 ' + cap + '%）</span>'
          : '';
        el.innerHTML = '本关键目标下考核目标权重合计：<b>' + sum.toFixed(1) + '%</b>' + err;
      });
      var badge = root.querySelector('.ko-card[data-ko-idx="' + koIdx + '"] .ko-weight-sum-badge');
      if (badge) {
        badge.textContent = '权重 ' + sum.toFixed(1) + '%';
        badge.classList.toggle('ko-weight-sum-badge--over', over);
      }
    });
  }

  function applyWeightFieldHints(root, state, opts) {
    if (!root) return;
    var ws = weightStatus(state, opts.periodType || 'month');
    var sliceSum = opts.listKey ? sumTargets(state[opts.listKey] || []) : ws.total;
    var cap = ws.target;
    var tol = 0.05;
    var sliceOver = sliceSum > cap + tol;
    root.querySelectorAll('input[data-t="weight"]').forEach(function (inp) {
      var val = parseFloat(inp.value);
      var field = inp.closest('.field--weight') || inp.closest('.field');
      var hint = field && field.querySelector('[data-weight-hint]');
      inp.classList.remove('is-weight-over');
      if (!hint) return;
      hint.className = 'weight-field-hint';
      hint.textContent = '';
      if (!isNaN(val) && val > 100) {
        inp.classList.add('is-weight-over');
        hint.className = 'weight-field-hint weight-field-hint--over';
        hint.textContent = '单项权重不能超过 100%';
      } else if (ws.over) {
        inp.classList.add('is-weight-over');
        hint.className = 'weight-field-hint weight-field-hint--over';
        hint.textContent = '全区合计已超出 ' + ws.overBy.toFixed(1) + '%（须 = ' + cap + '%）';
      } else if (sliceOver && opts.listKey) {
        inp.classList.add('is-weight-over');
        hint.className = 'weight-field-hint weight-field-hint--over';
        hint.textContent = '当前区块合计 ' + sliceSum.toFixed(1) + '%，超出上限 ' + cap + '%';
      }
    });
    var blockHint = root.querySelector('[data-block-weight-hint]');
    if (blockHint && opts.listKey) {
      if (sliceOver) {
        blockHint.className = 'block-weight-hint block-weight-hint--over';
        blockHint.textContent = '当前区块权重合计 ' + sliceSum.toFixed(1) + '%，超出规则上限 ' + cap + '%，请调低 KR 权重';
        blockHint.style.display = '';
      } else {
        blockHint.className = 'block-weight-hint';
        blockHint.textContent = '';
        blockHint.style.display = 'none';
      }
    }
  }
  function renderKeyObjective(ko, koIdx, opts) {
    opts = opts || {};
    var open = opts.isOpen;
    var preview = (ko.o || '').trim().slice(0, 36) || '关键目标 ' + (koIdx + 1);
    var targets = (ko.targets || []).map(function (t, ti) {
      return renderTargetFields(t, ti, koIdx, opts);
    }).join('');
    var targetCount = (ko.targets || []).length;
    var koWeightSum = sumKoTargets(ko);
    var weightCap = opts.weightCap;
    var koDel = koIdx > 0 ? delBtn('remove-ko', '删除关键目标', { 'ko-idx': koIdx }) : '';
    var koOver = weightCap != null && koWeightSum > weightCap + 0.05;
    return '<div class="collapse-card ko-card ko-card--l2 ' + (open ? 'open' : '') + '" data-ko-idx="' + koIdx + '">' +
      '<div class="ko-card-rail" aria-hidden="true"></div>' +
      '<div class="ko-card-main">' +
      '<div class="ko-head-row">' +
      '<button type="button" class="collapse-head">' +
      levelBadge('l2', 'L2') +
      '<span class="collapse-title">关键目标 ' + (koIdx + 1) + '</span>' +
      '<span class="ko-target-count-badge">' + targetCount + ' 个考核目标</span>' +
      '<span class="ko-weight-sum-badge' + (koOver ? ' ko-weight-sum-badge--over' : '') + '">权重 ' + koWeightSum.toFixed(1) + '%</span>' +
      '<span class="collapse-preview">' + preview + '</span>' +
      '<span class="collapse-chevron">▼</span></button>' +
      koDel +
      '</div>' +
      '<div class="collapse-body">' +
      '<div class="ko-section ko-section--l2">' +
      '<div class="ko-section-head">' + levelBadge('l2', '二级') + '<span>关键目标</span><em>填写 O</em></div>' +
      '<div class="ko-section-fields">' +
      '<div class="field"><label>关键目标 O</label><textarea rows="2" data-ko="o" placeholder="描述该关键目标">' + (ko.o || '') + '</textarea></div>' +
      '</div></div>' +
      '<div class="ko-section ko-section--l3">' +
      '<div class="ko-section-head">' + levelBadge('l3', '三级') + '<span>考核目标</span><em>SMART · 权重 · 标准 · 附加规则 · M · 自评</em></div>' +
      '<div class="kr-target-list">' + targets + '</div>' +
      renderKoWeightSumBar(ko, koIdx, weightCap) +
      '<button type="button" class="btn btn-sm btn-add-target add-target-btn" data-ko-idx="' + koIdx + '">+ 增加考核目标</button>' +
      '</div></div></div></div>';
  }

  function renderWorkStep(state, listKey, block, opts) {
    opts = opts || {};
    var list = ensureKeyObjectiveList(state, listKey, block);
    var openKey = opts.openKey || listKey;
    var ws = weightStatus(state, opts.periodType || 'month');
    ws.periodType = opts.periodType;
    var cap = ws.target;
    return '<p class="section-desc">' + (opts.desc || '') + '</p>' +
      renderWeightBar(ws, opts.globalBar ? '' : '') +
      '<div class="block-weight-hint" data-block-weight-hint style="display:none"></div>' +
      (typeof collapseToolbar === 'function' ? collapseToolbar('ko-list') : '') +
      '<div id="ko-list" class="ko-list">' +
      list.map(function (ko, i) {
        return renderKeyObjective(ko, i, {
          isOpen: isKoOpen(state, openKey, i),
          planning: opts.planning,
          showChallenge: opts.showChallenge,
          weightCap: cap,
        });
      }).join('') +
      '</div>' +
      '<button type="button" class="btn btn-block" id="add-ko" style="margin-top:8px">+ 增加关键目标</button>';
  }

  function renderNextPeriodStep(state, listKey, opts) {
    opts = opts || {};
    var block = listKey === 'coreKeyObjectives' ? 'V' : (listKey === 'regularKeyObjectives' ? 'X' : 'next');
    var list = ensureKeyObjectiveList(state, listKey, block);
    var ws = weightStatus(state, 'next');
    var cap = ws.target;
    return '<p class="section-desc">' + (opts.desc || '下月/下季：可增多个关键目标；各关键目标下考核目标权重合计须使全区 = 100%。') + '</p>' +
      renderWeightBar(ws) +
      '<div class="block-weight-hint" data-block-weight-hint style="display:none"></div>' +
      (typeof collapseToolbar === 'function' ? collapseToolbar('ko-list') : '') +
      '<div id="ko-list" class="ko-list">' +
      list.map(function (ko, i) {
        return renderKeyObjective(ko, i, {
          isOpen: isKoOpen(state, 'next', i),
          planning: true,
          showChallenge: true,
          weightCap: cap,
        });
      }).join('') +
      '</div>' +
      '<button type="button" class="btn btn-block" id="add-ko">+ 增加关键目标</button>';
  }

  function bindKeyObjectiveList(root, state, listKey, openKey, block, onChange, periodType) {
    var list = ensureKeyObjectiveList(state, listKey, block);
    if (!periodType) {
      periodType = block === 'next' || listKey === 'nextMonthKeyObjectives' || listKey === 'nextSeasonKeyObjectives' ? 'next' : 'month';
    }
    var weightCap = weightStatus(state, periodType).target;
    root.querySelectorAll('.ko-card').forEach(function (card) {
      var koIdx = +card.dataset.koIdx;
      var ko = list[koIdx];
      if (!ko) return;
      card.querySelectorAll('.ko-section-fields [data-ko]').forEach(function (inp) {
        inp.addEventListener('input', function () {
          ko[inp.dataset.ko] = inp.value;
          var prev = card.querySelector('.collapse-preview');
          if (prev) prev.textContent = (ko.o || '').trim().slice(0, 36) || ('关键目标 ' + (koIdx + 1));
          onChange(false);
        });
      });
      card.querySelectorAll('.kr-target-card').forEach(function (tc) {
        var ti = +tc.dataset.ti;
        var t = ko.targets[ti];
        if (!t) return;
        tc.querySelectorAll('[data-t]').forEach(function (inp) {
          inp.addEventListener('input', function () {
            t[inp.dataset.t] = inp.value;
            if (inp.dataset.t === 'weight') {
              var chip = tc.querySelector('.kr-target-weight-chip');
              if (chip) chip.textContent = inp.value ? inp.value + '%' : '未填权重';
              if (typeof syncStandardTierScores === 'function') syncStandardTierScores(t);
              refreshKoWeightSums(root, list, weightCap);
              applyWeightFieldHints(root, state, { listKey: listKey, periodType: periodType });
            }
            onChange(false);
          });
        });
        if (typeof bindStandardTiers === 'function') bindStandardTiers(tc, t, onChange);
      });
      card.querySelector('.add-target-btn')?.addEventListener('click', function (e) {
        e.stopPropagation();
        ko.targets.push(emptyTarget(block));
        onChange(true);
      });
      card.querySelectorAll('.remove-target').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var ti = +btn.dataset.ti;
          if (ko.targets.length <= 1) return;
          if (!confirm('确定删除「考核目标 ' + (ti + 1) + '」？删除后不可恢复。')) return;
          ko.targets.splice(ti, 1);
          onChange(true);
        });
      });
      card.querySelectorAll('.remove-ko').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (list.length <= 1) return;
          if (!confirm('确定删除「关键目标 ' + (koIdx + 1) + '」？其下所有考核目标将一并移除。')) return;
          list.splice(koIdx, 1);
          state.openKr[openKey] = 0;
          onChange(true);
        });
      });
      card.querySelector('.collapse-head')?.addEventListener('click', function (e) {
        if (e.target.closest('.perf-del-btn')) return;
        var opening = !card.classList.contains('open');
        root.querySelectorAll('.ko-card.open').forEach(function (c) { c.classList.remove('open'); });
        if (opening) { card.classList.add('open'); state.openKr[openKey] = koIdx; }
      });
    });
    root.querySelector('#add-ko')?.addEventListener('click', function () {
      list.push(emptyKeyObjective(block, false));
      state.openKr[openKey] = list.length - 1;
      onChange(true);
    });
    if (typeof bindListToolbar === 'function') bindListToolbar(root, 'ko-list');
    applyWeightFieldHints(root, state, { listKey: listKey, periodType: periodType });
  }

  function markStepperWeightErrors(container, state, periodType, workSteps, nextStep) {
    if (!container) return;
    var ws = weightStatus(state, periodType);
    var nextWs = weightStatus(state, 'next');
    container.querySelectorAll('.step-dot').forEach(function (dot) {
      var step = +dot.dataset.step;
      dot.classList.remove('step-dot--error');
      if (workSteps.indexOf(step) >= 0 && !ws.ok) dot.classList.add('step-dot--error');
      if (step === nextStep && !nextWs.ok) dot.classList.add('step-dot--error');
    });
  }

  function validateSubmit(state, periodType, nextListKey) {
    var ws = weightStatus(state, periodType);
    if (!ws.ok) {
      if (ws.over) {
        alert(ws.label + '超出 ' + ws.overBy.toFixed(1) + '%，须 = ' + ws.target + '%，当前合计 ' + ws.total.toFixed(1) + '%');
      } else {
        alert(ws.label + '还差 ' + ws.underBy.toFixed(1) + '%，须 = ' + ws.target + '%，当前合计 ' + ws.total.toFixed(1) + '%');
      }
      return false;
    }
    if (nextListKey) {
      var list = state[nextListKey] || state.nextMonthKeyObjectives;
      var nsum = sumTargets(list);
      var nextTarget = WEIGHT_TARGETS.next;
      if (nsum > nextTarget + 0.05) {
        alert('下月/下季 KR 权重超出 ' + (nsum - nextTarget).toFixed(1) + '%，须 = 100%，当前 ' + nsum.toFixed(1) + '%');
        return false;
      }
      if (nsum < nextTarget - 0.05) {
        alert('下月/下季 KR 权重还差 ' + (nextTarget - nsum).toFixed(1) + '%，须 = 100%，当前 ' + nsum.toFixed(1) + '%');
        return false;
      }
    }
    return true;
  }

  function ensureSubmission(sub) {
    if (!sub) return sub;
    if (!sub.coreKeyObjectives) {
      sub.coreKeyObjectives = migrateFlatList(sub.coreKrs, 'V');
      sub.regularKeyObjectives = migrateFlatList(sub.regularKrs, 'X');
      if (sub.nextMonthKrs) sub.nextMonthKeyObjectives = migrateFlatList(sub.nextMonthKrs, 'next');
    }
    [sub.coreKeyObjectives, sub.regularKeyObjectives, sub.nextMonthKeyObjectives, sub.nextSeasonKeyObjectives].forEach(function (list) {
      if (!list) return;
      list.forEach(function (ko) { normalizeKeyObjective(ko); });
    });
    return sub;
  }

  function renderScoreHierarchy(sub, block, renderKrCardFn) {
    ensureSubmission(sub);
    var listKey = block === 'V' ? 'coreKeyObjectives' : 'regularKeyObjectives';
    var kos = sub[listKey] || [];
    var html = '';
    kos.forEach(function (ko, ki) {
      html += '<div class="score-ko-group score-ko-group--l2"><div class="score-ko-head">' +
        levelBadge('l2', 'L2') +
        '<span class="score-ko-label">关键目标 ' + (ki + 1) + '</span>' +
        '<div class="score-ko-o">' + (ko.o || '—') + '</div>' +
        '</div><div class="score-ko-targets">';
      (ko.targets || []).forEach(function (t) {
        html += renderKrCardFn(t, ko, block);
      });
      html += '</div></div>';
    });
    return html;
  }

  function patchFillStepUi(root, state, opts) {
    if (!root || !state || !opts) return;
    opts = opts || {};
    var periodType = opts.periodType || 'month';
    var ws = weightStatus(state, periodType);
    ws.periodType = periodType;
    var bar = root.querySelector('.weight-bar');
    if (bar) {
      var wrap = document.createElement('div');
      wrap.innerHTML = renderWeightBar(ws, opts.globalBar ? '' : '');
      if (wrap.firstChild) bar.replaceWith(wrap.firstChild);
    }
    if (opts.listKey && state[opts.listKey]) {
      refreshKoWeightSums(root, state[opts.listKey], ws.target);
      applyWeightFieldHints(root, state, { listKey: opts.listKey, periodType: periodType });
    }
    if (typeof markStepperWeightErrors === 'function' && opts.stepperEl && opts.workSteps) {
      markStepperWeightErrors(opts.stepperEl, state, periodType, opts.workSteps, opts.nextStep);
    }
  }

  window.PerfKrHierarchy = {
    WEIGHT_TARGETS: WEIGHT_TARGETS,
    genId: genId,
    emptyKeyObjective: emptyKeyObjective,
    emptyTarget: emptyTarget,
    ensureState: ensureState,
    ensureSubmission: ensureSubmission,
    sumTargets: sumTargets,
    flattenTargets: flattenTargets,
    legacyFlat: legacyFlat,
    weightStatus: weightStatus,
    renderWeightBar: renderWeightBar,
    renderWorkStep: renderWorkStep,
    renderNextPeriodStep: renderNextPeriodStep,
    bindKeyObjectiveList: bindKeyObjectiveList,
    markStepperWeightErrors: markStepperWeightErrors,
    validateSubmit: validateSubmit,
    renderScoreHierarchy: renderScoreHierarchy,
    migrateFlatList: migrateFlatList,
    levelBadge: levelBadge,
    ensureSingleKeyObjective: ensureKeyObjectiveList,
    ensureKeyObjectiveList: ensureKeyObjectiveList,
    sumKoTargets: sumKoTargets,
    countTargets: countTargets,
    refreshKoWeightSums: refreshKoWeightSums,
    applyWeightFieldHints: applyWeightFieldHints,
    patchFillStepUi: patchFillStepUi,
  };
})();
