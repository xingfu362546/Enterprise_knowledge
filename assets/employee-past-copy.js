/**

 * 员工填表 · 快速带入

 * ① 复制往期：KR 结构（O/SMART/权重/考核标准/附加规则）

 * ② 从上期下月/下季目标带入：上一连续周期 Step5 → 本期核心 V（等比缩放权重）

 */

(function () {

  'use strict';



  var WEIGHT_SCALE = { month: 0.85, quarter: 0.9 };



  /** 当前填表周期 → 上一连续已提交周期 */

  var PREV_PERIOD_CHAIN = {

    m202604: 'm202603',

    m202605: 'm202604',

    m202606: 'm202605',

    q2026q2: 'q2026q1',

  };



  var DEFAULT_PERIOD_ID = { month: 'm202604', quarter: 'q2026q2' };



  function tierBlock(w) {

    var n = Number(w) || 25;

    return [

      { label: '业绩达成率 ≥ 100%', score: n },

      { label: '100% > 业绩达成率 ≥ 90%', score: Math.round(n * 0.8) },

      { label: '90% > 业绩达成率 ≥ 80%', score: Math.round(n * 0.6) },

      { label: '80% > 业绩达成率 ≥ 70%', score: Math.round(n * 0.4) },

      { label: '业绩达成率 < 70%', score: 0 },

    ];

  }



  var PAST_FORM_SNAPSHOTS = {

    m202603: {

      id: 'm202603',

      periodLabel: '2026年3月',

      submittedAt: '2026-03-28 17:32',

      formType: 'month',

      form: {

        coreKrs: [

          {

            block: 'V',

            o: '推动绩效系统需求评审与方案落地，确保 HR、信息部对考核模板与双端填表链路形成一致认知。',

            smart: '6/30 前完成 PRD 评审；覆盖月度/季度模板；组织至少 2 轮跨部门评审。',

            weight: '25',

            standardTiers: tierBlock(25),

          },

          {

            block: 'V',

            o: '输出可评审的 HTML 交互原型，支撑业务方走查员工填表—上级评分主链路。',

            smart: '3/31 前交付 prototype 入口；员工端含月度向导；走查反馈 24h 内登记。',

            weight: '22',

            standardTiers: tierBlock(22),

          },

        ],

        regularKrs: [

          {

            block: 'X',

            o: '跨部门需求响应与会议协同',

            smart: '工作日内 24h 响应；重要会议提前 1 天准备材料。',

            weight: '8',

            standardTiers: tierBlock(8),

          },

        ],

      },

      nextMonthKeyObjectives: [

        {

          id: 'ko-mar-n1',

          o: 'HTML 原型走查与迭代闭环',

          targets: [

            {

              id: 't-mar-n1', block: 'next', weight: '30',

              smart: '4/15 前完成 HR 走查反馈闭环；走查问题 48h 内登记',

              attachRules: '延期登记每次 -0.5 分',

              standardTiers: tierBlock(30),

            },

            {

              id: 't-mar-n2', block: 'next', weight: '25',

              smart: '输出员工填表—上级评分开关对照表；与 FEATURE_LIST 可映射',

              attachRules: '',

              standardTiers: tierBlock(25),

            },

          ],

        },

        {

          id: 'ko-mar-n2',

          o: '模板字段与职级差异确认',

          targets: [

            {

              id: 't-mar-n3', block: 'next', weight: '25',

              smart: '4/20 前 HR 确认总监/经理/主管/职员月表差异清单',

              attachRules: '',

              standardTiers: tierBlock(25),

            },

            {

              id: 't-mar-n4', block: 'next', weight: '20',

              smart: '小程序与 OA 双 Tab 心智对齐；输出 MINIAPP_ENTRY_IA 终稿',

              attachRules: '',

              standardTiers: tierBlock(20),

            },

          ],

        },

      ],

    },

    m202602: {

      id: 'm202602',

      periodLabel: '2026年2月',

      submittedAt: '2026-02-26 18:10',

      formType: 'month',

      form: {

        coreKrs: [

          {

            block: 'V',

            o: '完成绩效模块需求调研与竞品对标，输出调研报告。',

            smart: '2/28 前完成；覆盖 3 家以上对标产品；含流程图与字段清单。',

            weight: '30',

            standardTiers: tierBlock(30),

          },

          {

            block: 'V',

            o: '协同 HR 梳理月度/季度模板字段差异，建立对照表。',

            smart: '2/25 前输出 Excel 对照；识别 ≥5 处职级差异。',

            weight: '20',

            standardTiers: tierBlock(20),

          },

        ],

        regularKrs: [

          {

            block: 'X',

            o: '部门周会组织与纪要沉淀',

            smart: '每周例会准时；纪要 24h 内归档。',

            weight: '10',

            standardTiers: tierBlock(10),

          },

        ],

      },

    },

    m202605: {

      id: 'm202605',

      periodLabel: '2026年5月',

      submittedAt: '2026-05-28 16:20',

      formType: 'month',

      form: { coreKrs: [], regularKrs: [] },

      nextMonthKeyObjectives: [

        {

          id: 'ko-may-n1',

          o: '季度评分与制度闭环',

          targets: [

            {

              id: 't-may-n1', block: 'next', weight: '28',

              smart: '6/20 前可演示；同人合并规则可配置演示；分管默认 OA。',

              attachRules: '',

              standardTiers: tierBlock(28),

            },

            {

              id: 't-may-n2', block: 'next', weight: '25',

              smart: '6/15 前 HR 签字确认或明确兜底策略。',

              attachRules: '',

              standardTiers: tierBlock(25),

            },

          ],

        },

        {

          id: 'ko-may-n2',

          o: '校验规则与全链路 UAT',

          targets: [

            {

              id: 't-may-n3', block: 'next', weight: '22',

              smart: 'R1/R2 规则在 PRD 与原型一致；员工端提交前自查。',

              attachRules: '',

              standardTiers: tierBlock(22),

            },

            {

              id: 't-may-n4', block: 'next', weight: '25',

              smart: '6/25 前完成；问题 48h 内登记。',

              attachRules: '',

              standardTiers: tierBlock(25),

            },

          ],

        },

      ],

    },

    q2026q1: {

      id: 'q2026q1',

      periodLabel: '2026 Q1',

      submittedAt: '2026-03-31 18:00',

      formType: 'quarter',

      form: { coreKrs: [], regularKrs: [] },

      nextSeasonKeyObjectives: [

        {

          id: 'ko-q1-n1',

          o: 'Q2 绩效信息化 MVP 交付',

          targets: [

            {

              id: 't-q1-n1', block: 'next', weight: '35',

              smart: '6/30 前双端主链路可评审；含月/季填表与上级评分',

              attachRules: '',

              standardTiers: tierBlock(35),

            },

            {

              id: 't-q1-n2', block: 'next', weight: '30',

              smart: '输出 Grill 决策库与 Handoff 文档，版本可追溯',

              attachRules: '',

              standardTiers: tierBlock(30),

            },

          ],

        },

        {

          id: 'ko-q1-n2',

          o: '制度与数据口径对齐',

          targets: [

            {

              id: 't-q1-n3', block: 'next', weight: '20',

              smart: 'HR 确认模板匹配规则或明确演示兜底方案',

              attachRules: '',

              standardTiers: tierBlock(20),

            },

            {

              id: 't-q1-n4', block: 'next', weight: '15',

              smart: '组织 1 次跨部门 UAT，覆盖员工/领导/HR 三类角色',

              attachRules: '',

              standardTiers: tierBlock(15),

            },

          ],

        },

      ],

    },

  };



  function genId(prefix) {

    return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 9);

  }



  function roundW(n) {

    return Math.round(n * 10) / 10;

  }



  function esc(s) {

    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  }



  function goalsListKey(formType) {

    return formType === 'quarter' ? 'nextSeasonKeyObjectives' : 'nextMonthKeyObjectives';

  }



  function scaleLabel(formType) {

    return formType === 'quarter' ? '100% → 90%' : '100% → 85%';

  }



  function cloneKr(kr) {

    return {

      block: kr.block || 'V',

      o: kr.o || '',

      smart: kr.smart || '',

      weight: kr.weight != null ? String(kr.weight) : '',

      attachRules: kr.attachRules || '',

      standardTiers: (kr.standardTiers || []).map(function (t) {

        return { label: t.label, score: t.score };

      }),

      m: '',

      selfScore: '',

    };

  }



  function cloneTargetForImport(t, block, ratio) {

    var w = roundW((parseFloat(t.weight) || 0) * ratio);

    var nt = {

      id: genId('t'),

      block: block,

      smart: t.smart || '',

      weight: String(w),

      attachRules: t.attachRules || '',

      standardTiers: (t.standardTiers || []).map(function (tier) {

        return {

          label: tier.label,

          score: roundW((parseFloat(tier.score) || 0) * ratio),

        };

      }),

      m: '',

      selfScore: '',

      challenge: '',

    };

    if (typeof syncStandardTierScores === 'function') {

      if (!nt.standardTiers.length) syncStandardTierScores(nt);

    }

    return nt;

  }



  function cloneKeyObjectiveForImport(ko, block, ratio) {

    return {

      id: genId('ko'),

      o: ko.o || '',

      targets: (ko.targets || []).map(function (t) {

        return cloneTargetForImport(t, block, ratio);

      }),

    };

  }



  function countTargets(list) {

    var n = 0;

    (list || []).forEach(function (ko) { n += (ko.targets || []).length; });

    return n;

  }



  function hasFilledNextGoals(snapshot, formType) {

    if (!snapshot) return false;

    var list = snapshot[goalsListKey(formType)];

    if (!list || !list.length) return false;

    return list.some(function (ko) {

      if ((ko.o || '').trim()) return true;

      return (ko.targets || []).some(function (t) {

        return (t.smart || '').trim() || (parseFloat(t.weight) || 0) > 0;

      });

    });

  }



  function listPastSnapshots(formType) {

    return Object.keys(PAST_FORM_SNAPSHOTS)

      .map(function (k) { return PAST_FORM_SNAPSHOTS[k]; })

      .filter(function (s) {

        if (formType && s.formType !== formType) return false;

        return s.form && ((s.form.coreKrs || []).length || (s.form.regularKrs || []).length);

      })

      .sort(function (a, b) { return b.submittedAt.localeCompare(a.submittedAt); });

  }



  function getSnapshot(id) {

    return PAST_FORM_SNAPSHOTS[id] || null;

  }



  function resolveCurrentPeriodId(opts) {

    if (opts && opts.currentPeriodId) return opts.currentPeriodId;

    var formType = (opts && opts.formType) || 'month';

    return DEFAULT_PERIOD_ID[formType] || 'm202604';

  }



  function getPrevGoalsAvailability(currentPeriodId, formType) {

    var prevId = PREV_PERIOD_CHAIN[currentPeriodId];

    if (!prevId) {

      return { ok: false, reason: '暂无上一连续周期提交记录（演示链未配置）' };

    }

    var snap = getSnapshot(prevId);

    if (!snap) {

      return { ok: false, reason: '上一周期「' + prevId + '」提交数据不可用' };

    }

    if (formType && snap.formType !== formType) {

      return { ok: false, reason: '上一周期考核类型与当前不一致' };

    }

    if (!hasFilledNextGoals(snap, formType || snap.formType)) {

      return {

        ok: false,

        reason: '上期未填写下' + (formType === 'quarter' ? '季' : '月') + '目标或尚未提交',

        snapshot: snap,

        prevId: prevId,

      };

    }

    return {

      ok: true,

      snapshot: snap,

      prevId: prevId,

      goals: snap[goalsListKey(formType || snap.formType)],

    };

  }



  function hasCoreContent(state) {

    if (!state) return false;

    if (window.PerfKrHierarchy && state.coreKeyObjectives) {

      return state.coreKeyObjectives.some(function (ko) {

        if ((ko.o || '').trim()) return true;

        return (ko.targets || []).some(function (t) {

          return (t.smart || '').trim() || (String(t.weight || '').trim());

        });

      });

    }

    return (state.coreKrs || []).some(function (kr) {

      return (kr.o || '').trim() || (kr.smart || '').trim();

    });

  }



  function applyFlatToHierarchyState(state, src) {

    if (window.PerfKrHierarchy) {

      state.coreKeyObjectives = (src.coreKrs || []).length

        ? PerfKrHierarchy.consolidateFlatList(src.coreKrs, 'V').map(function (ko) {

          return cloneKeyObjectiveForImport(ko, 'V', 1);

        })

        : [PerfKrHierarchy.emptyKeyObjective('V', false)];

      state.regularKeyObjectives = (src.regularKrs && src.regularKrs.length)

        ? PerfKrHierarchy.consolidateFlatList(src.regularKrs, 'X').map(function (ko) {

          return cloneKeyObjectiveForImport(ko, 'X', 1);

        })

        : [PerfKrHierarchy.emptyKeyObjective('X', false)];

      return;

    }

    state.coreKrs = (src.coreKrs || []).map(cloneKr);

    state.regularKrs = (src.regularKrs && src.regularKrs.length)

      ? src.regularKrs.map(cloneKr)

      : [{ block: 'X', o: '', smart: '', weight: '', standardTiers: [], m: '', selfScore: '' }];

  }



  function resetSelfReviewFields(state) {

    if (typeof BEHAVIOR_ITEMS !== 'undefined') {

      state.behaviorEvents = BEHAVIOR_ITEMS.map(function () { return ''; });

      state.behaviorSelfScores = BEHAVIOR_ITEMS.map(function () { return ''; });

    }

    state.plusRows = [{ type: '加分', desc: '', score: '' }];

    state.minusRows = [{ type: '减分', desc: '', score: '' }];

    state.selfSummary = '';

    if (typeof defaultStandardTiers === 'function') {

      state.nextMonthKrs = [

        { o: '', smart: '', weight: '', standardTiers: defaultStandardTiers(25), challenge: '' },

        { o: '', smart: '', weight: '', standardTiers: defaultStandardTiers(25), challenge: '' },

      ];

    }

  }



  /** 将往期 KR 结构合并进 draft（保留 step、openKr；清空自评相关） */

  function applySnapshotToMonthlyState(state, snapshotId) {

    var snap = getSnapshot(snapshotId);

    if (!snap || !snap.form) return null;



    applyFlatToHierarchyState(state, snap.form);



    if (!window.PerfKrHierarchy) {

      if (typeof defaultStandardTiers === 'function') {

        (state.coreKrs || []).forEach(function (kr) {

          if (!kr.standardTiers || !kr.standardTiers.length) kr.standardTiers = defaultStandardTiers(kr.weight || 25);

        });

        (state.regularKrs || []).forEach(function (kr) {

          if (!kr.standardTiers || !kr.standardTiers.length) kr.standardTiers = defaultStandardTiers(kr.weight || 25);

        });

      }

    }



    resetSelfReviewFields(state);

    state.copiedFrom = { id: snap.id, periodLabel: snap.periodLabel, mode: 'copyPast', at: new Date().toISOString() };

    state.step = 1;

    state.openKr = {};



    if (typeof normalizeState === 'function') normalizeState(state);

    return state;

  }



  /** 从上期 Step5 下月/下季目标 → 本期核心 V（整段覆盖，等比缩放） */

  function applyPrevNextGoalsToState(state, snapshot, formType) {

    formType = formType || 'month';

    if (!snapshot) return null;

    var list = snapshot[goalsListKey(formType)] || [];

    var ratio = WEIGHT_SCALE[formType] || 0.85;



    state.coreKeyObjectives = list.length

      ? list.map(function (ko) { return cloneKeyObjectiveForImport(ko, 'V', ratio); })

      : (window.PerfKrHierarchy ? [PerfKrHierarchy.emptyKeyObjective('V', false)] : []);



    state.copiedFrom = {

      id: snapshot.id,

      periodLabel: snapshot.periodLabel,

      mode: 'prevNextGoals',

      scale: scaleLabel(formType),

      at: new Date().toISOString(),

    };

    state.step = 1;

    state.openKr = {};



    if (typeof normalizeState === 'function') normalizeState(state);

    if (window.PerfKrHierarchy) PerfKrHierarchy.ensureState(state);

    return state;

  }



  function showToast(msg) {

    var el = document.createElement('div');

    el.className = 'perf-toast';

    el.setAttribute('role', 'status');

    el.textContent = msg;

    document.body.appendChild(el);

    requestAnimationFrame(function () { el.classList.add('is-show'); });

    setTimeout(function () {

      el.classList.remove('is-show');

      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);

    }, 2800);

  }



  function isMiniappContext() {

    return !!document.querySelector('.mp-screen');

  }



  function getModalMount() {

    return document.querySelector('.mp-screen') || document.body;

  }



  function useSheetLayout() {

    return isMiniappContext() || (typeof window !== 'undefined' && window.innerWidth <= 480);

  }



  function syncModalLayout(mask) {

    if (!mask) return;

    var sheet = useSheetLayout();

    mask.classList.toggle('past-copy-modal-mask--in-mp', isMiniappContext());

    mask.classList.toggle('past-copy-modal-mask--sheet', sheet);

  }



  function setScrollLock(on) {

    var screen = document.querySelector('.mp-screen');

    if (screen) screen.classList.toggle('mp-scroll-lock', on);

    document.documentElement.classList.toggle('past-copy-scroll-lock', on);

  }



  function ensureModal() {

    var mount = getModalMount();

    var mask = document.getElementById('past-copy-modal-mask');

    if (mask && mask.parentElement !== mount) mount.appendChild(mask);



    if (!mask) {

      mask = document.createElement('div');

      mask.id = 'past-copy-modal-mask';

      mask.className = 'past-copy-modal-mask';

      mask.innerHTML =

        '<div class="past-copy-modal past-copy-modal--quick" role="dialog" aria-labelledby="past-copy-modal-title">' +

        '<div class="past-copy-modal__handle" aria-hidden="true"></div>' +

        '<div class="past-copy-modal__head">' +

        '<h3 id="past-copy-modal-title">快速带入</h3>' +

        '<button type="button" class="past-copy-modal__close" aria-label="关闭">×</button></div>' +

        '<div class="quick-import-modes" id="quick-import-modes"></div>' +

        '<p class="past-copy-modal__hint" id="past-copy-modal-hint"></p>' +

        '<div class="quick-import-panel" id="quick-import-panel"></div>' +

        '<div class="past-copy-modal__foot">' +

        '<button type="button" class="past-copy-modal__cancel">取消</button></div></div>';

      mount.appendChild(mask);



      mask.addEventListener('click', function (e) {

        if (e.target === mask) closeModal();

      });

      mask.querySelector('.past-copy-modal__close').addEventListener('click', closeModal);

      mask.querySelector('.past-copy-modal__cancel').addEventListener('click', closeModal);

    }



    syncModalLayout(mask);

    return mask;

  }



  var modalOpts = null;

  var modalMode = 'copyPast';



  function closeModal() {

    var mask = document.getElementById('past-copy-modal-mask');

    if (mask) mask.classList.remove('is-open');

    setScrollLock(false);

    modalOpts = null;

    modalMode = 'copyPast';

  }



  function applyWithStorage(opts, applyFn, toastMsg) {

    if (opts.storageKey && typeof loadState === 'function' && typeof saveState === 'function') {

      var state = loadState(opts.storageKey);

      applyFn(state);

      saveState(opts.storageKey, state);

      closeModal();

      showToast(toastMsg || '已带入，请在本期核心 V 核对权重');

      if (typeof opts.onApplied === 'function') opts.onApplied(state);

      return true;

    }

    return false;

  }



  function confirmOverwrite(hasContent, msg) {

    if (!hasContent) return true;

    return confirm(msg || '当前核心 V 已有内容，带入将整段覆盖。确定继续？');

  }



  function renderCopyPastPanel(opts, panel) {

    var list = listPastSnapshots(opts.formType || 'month');

    var compact = useSheetLayout();

    if (!list.length) {

      panel.innerHTML = '<div class="past-copy-modal__empty">暂无可复制的往期提交</div>';

      return;

    }

    panel.innerHTML = '<ul class="past-copy-modal__list">' + list.map(function (s) {

      var nCore = (s.form.coreKrs || []).length;

      var nReg = (s.form.regularKrs || []).length;

      var meta = compact

        ? ('提交 ' + esc(s.submittedAt.slice(5, 10)) + ' · 核心' + nCore + ' · 常规' + nReg)

        : ('提交于 ' + esc(s.submittedAt) + ' · 核心 ' + nCore + ' 项 · 常规 ' + nReg + ' 项');

      var typeLabel = s.formType === 'quarter' ? '季度' : '月度';

      return '<li><button type="button" class="past-copy-modal__item" data-snap-id="' + esc(s.id) + '">' +

        '<span class="past-copy-modal__item-title">' + esc(s.periodLabel) + ' · ' + typeLabel + '</span>' +

        '<span class="past-copy-modal__item-meta">' + meta + '</span></button></li>';

    }).join('') + '</ul>';



    panel.querySelectorAll('[data-snap-id]').forEach(function (btn) {

      btn.addEventListener('click', function () {

        var id = btn.dataset.snapId;

        var snap = getSnapshot(id);

        if (!snap) return;



        var needsConfirm = opts.storageKey && typeof loadState === 'function' && hasCoreContent(loadState(opts.storageKey));

        if (!confirmOverwrite(needsConfirm, '确定从「' + snap.periodLabel + '」复制 KR 结构？\n\n将覆盖当前草稿中的目标与考核标准，自评内容不会复制。')) return;



        if (applyWithStorage(opts, function (state) {

          applySnapshotToMonthlyState(state, id);

        }, '已从往期复制 KR 结构')) return;



        if (typeof opts.onApplied === 'function') {

          closeModal();

          opts.onApplied(id, snap);

        }

      });

    });

  }



  function renderPrevGoalsPanel(opts, panel, avail) {

    var formType = opts.formType || 'month';

    var nextLabel = formType === 'quarter' ? '下季' : '下月';



    if (!avail.ok) {

      panel.innerHTML =

        '<div class="quick-import-prev quick-import-prev--disabled">' +

        '<div class="quick-import-prev__title">从上期' + nextLabel + '目标带入</div>' +

        '<p class="quick-import-prev__reason">' + esc(avail.reason) + '</p>' +

        '<p class="quick-import-prev__meta">仅支持<strong>上一连续周期</strong>已提交 Step5 的' + nextLabel + '目标；落入本期<strong>核心 V</strong>，常规 X 不变。</p>' +

        '</div>';

      return;

    }



    var snap = avail.snapshot;

    var goals = avail.goals || [];

    var nKo = goals.length;

    var nT = countTargets(goals);

    var compact = useSheetLayout();



    panel.innerHTML =

      '<div class="quick-import-prev">' +

      '<div class="quick-import-prev__title">' + esc(snap.periodLabel) + ' · ' + nextLabel + '目标</div>' +

      '<p class="quick-import-prev__meta">' +

      (compact

        ? (nKo + ' 个关键目标 · ' + nT + ' 个考核目标 · 权重 ' + scaleLabel(formType))

        : ('共 ' + nKo + ' 个关键目标、' + nT + ' 个考核目标 · 权重等比缩放 ' + scaleLabel(formType))) +

      '</p>' +

      '<p class="quick-import-prev__fields">带入：O · SMART · 权重 · 考核标准 · 附加规则 · 不含挑战/成果/自评</p>' +

      '<button type="button" class="btn-copy-past quick-import-prev__apply" id="btn-apply-prev-goals">带入本期核心 V</button>' +

      '</div>';



    panel.querySelector('#btn-apply-prev-goals').addEventListener('click', function () {

      var needsConfirm = opts.storageKey && typeof loadState === 'function' && hasCoreContent(loadState(opts.storageKey));

      if (!confirmOverwrite(needsConfirm, '将用「' + snap.periodLabel + '」的' + nextLabel + '目标覆盖本期核心 V（权重 ' + scaleLabel(formType) + '）。\n\n常规 X 与其他步骤不变。确定继续？')) return;



      if (applyWithStorage(opts, function (state) {

        applyPrevNextGoalsToState(state, snap, formType);

      }, '已从「' + snap.periodLabel + '」' + nextLabel + '目标带入核心 V')) return;



      if (typeof opts.onApplied === 'function') {

        closeModal();

        opts.onApplied(snap, avail);

      }

    });

  }



  function renderModalBody() {

    if (!modalOpts) return;

    var mask = ensureModal();

    var modesEl = mask.querySelector('#quick-import-modes');

    var hintEl = mask.querySelector('#past-copy-modal-hint');

    var panel = mask.querySelector('#quick-import-panel');

    var formType = modalOpts.formType || 'month';

    var nextLabel = formType === 'quarter' ? '下季' : '下月';

    var periodId = resolveCurrentPeriodId(modalOpts);

    var prevAvail = getPrevGoalsAvailability(periodId, formType);



    modesEl.innerHTML =

      '<button type="button" class="quick-import-mode' + (modalMode === 'copyPast' ? ' is-active' : '') + '" data-mode="copyPast">' +

      '<span class="quick-import-mode__label">① 复制往期</span>' +

      '<span class="quick-import-mode__desc">复制历史 KR 结构（含常规 X）</span></button>' +

      '<button type="button" class="quick-import-mode' + (modalMode === 'prevGoals' ? ' is-active' : '') +

      (!prevAvail.ok ? ' is-disabled' : '') + '" data-mode="prevGoals"' +

      (!prevAvail.ok ? ' disabled aria-disabled="true"' : '') + '>' +

      '<span class="quick-import-mode__label">② 从上期' + nextLabel + '目标</span>' +

      '<span class="quick-import-mode__desc">' +

      (prevAvail.ok ? ('「' + esc(prevAvail.snapshot.periodLabel) + '」→ 本期核心 V') : esc(prevAvail.reason)) +

      '</span></button>';



    modesEl.querySelectorAll('.quick-import-mode').forEach(function (btn) {

      btn.addEventListener('click', function () {

        if (btn.disabled || btn.classList.contains('is-disabled')) return;

        modalMode = btn.dataset.mode;

        renderModalBody();

      });

    });



    if (modalMode === 'prevGoals') {

      hintEl.textContent = '将上一周期 Step5 的' + nextLabel + '目标整段落入本期 Step1 核心 V，权重 ' + scaleLabel(formType) + '。';

      renderPrevGoalsPanel(modalOpts, panel, prevAvail);

    } else {

      hintEl.textContent = useSheetLayout()

        ? '复制 O · SMART · 权重 · 标准 · 附加规则，不含成果与自评。将覆盖当前草稿。'

        : '复制 O · SMART · 权重 · 考核标准 · 附加规则，不含关键成果、自评与加减分。当前草稿将被覆盖。';

      renderCopyPastPanel(modalOpts, panel);

    }

  }



  function openQuickImportModal(opts) {

    opts = opts || {};

    modalOpts = opts;

    modalMode = opts.initialMode === 'prevGoals' ? 'prevGoals' : 'copyPast';

    var periodId = resolveCurrentPeriodId(opts);

    var prevAvail = getPrevGoalsAvailability(periodId, opts.formType || 'month');

    if (modalMode === 'prevGoals' && !prevAvail.ok) modalMode = 'copyPast';



    ensureModal();

    renderModalBody();

    setScrollLock(true);

    document.getElementById('past-copy-modal-mask').classList.add('is-open');

  }



  function openModal(opts) {

    openQuickImportModal(opts);

  }



  function bindCopyButtons(root, opts) {

    opts = opts || {};

    var sel = '[data-quick-import], [data-copy-past]';

    (root || document).querySelectorAll(sel).forEach(function (btn) {

      if (btn.dataset.copyBound) return;

      btn.dataset.copyBound = '1';

      btn.addEventListener('click', function (e) {

        e.preventDefault();

        e.stopPropagation();

        openQuickImportModal({

          formType: btn.dataset.quickImport || btn.dataset.copyPast || 'month',

          storageKey: btn.dataset.storageKey || opts.storageKey,

          wizardHref: btn.dataset.wizardHref || opts.wizardHref,

          currentPeriodId: btn.dataset.periodId || opts.currentPeriodId,

          onApplied: function (stateOrId) {

            if (typeof opts.onApplied === 'function') {

              opts.onApplied(stateOrId);

              return;

            }

            var href = btn.dataset.wizardHref || opts.wizardHref;

            if (href) location.href = href;

            else showToast('已带入 KR 结构，请进入填表页查看');

          },

        });

      });

    });

  }



  window.EmployeePastCopy = {

    PAST_FORM_SNAPSHOTS: PAST_FORM_SNAPSHOTS,

    PREV_PERIOD_CHAIN: PREV_PERIOD_CHAIN,

    listPastSnapshots: listPastSnapshots,

    getSnapshot: getSnapshot,

    getPrevGoalsAvailability: getPrevGoalsAvailability,

    applySnapshotToMonthlyState: applySnapshotToMonthlyState,

    applyPrevNextGoalsToState: applyPrevNextGoalsToState,

    openQuickImportModal: openQuickImportModal,

    openModal: openModal,

    bindCopyButtons: bindCopyButtons,

    showToast: showToast,

  };

})();


