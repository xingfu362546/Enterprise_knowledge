/**
 * 小程序 · 绩效任务列表共享（v1.1.0）
 */
(function () {
  'use strict';

  var TASK_DATA = {
    current: [
      {
        id: 'm202605', title: '2026年5月 · 月度绩效考核', type: 'month',
        phase: 'pending_confirm', progress: '待确认评分',
        deadline: '确认截止 06-15', tag: '待确认', tagCls: 'mp-tag-orange',
        href: 'score-confirm.html?role=employee',
        employeeConfirmed: false, supervisorConfirmed: false,
      },
      {
        id: 'm202605-q', title: '2026 Q2 · 季度绩效考核', type: 'quarter',
        phase: 'pending_supervisor', progress: '待上级评',
        deadline: '2026-07-10', tag: '评分中', tagCls: 'mp-tag-blue',
        href: 'task-progress.html?id=m202605-q',
      },
    ],
    overdue: [
      {
        id: 'm202604', title: '2026年4月 · 月度绩效考核', type: 'month',
        progress: '已逾期 · 未提交 · 2/8 步', deadline: '已过 05-05',
        tag: '待解锁', tagCls: 'mp-tag-gray', overdueState: 'locked',
        hint: '已过截止，待 HR 解锁后方可填写',
      },
      {
        id: 'm202503', title: '2026年3月 · 月度绩效考核', type: 'month',
        phase: 'filling', progress: '已解锁 · 填写中 5/8 步', deadline: '已过 04-05',
        tag: '已解锁', tagCls: 'mp-tag-blue', href: 'task-progress.html?id=m202503',
        overdueState: 'unlocked', hint: 'v1 小程序仅看进度；填表请用 OA',
      },
    ],
    past: [
      { id: 'm202603', title: '2026年3月 · 月度绩效考核', type: 'month', phase: 'completed', progress: '已于 03-28 提交并完成确认', deadline: '—', tag: '已完成', tagCls: 'mp-tag-green', href: 'task-past-view.html?id=m202603' },
    ],
  };

  var SEGMENT = [
    { key: 'current', label: '当前待办', href: 'task-list.html' },
    { key: 'overdue', label: '逾期', href: 'task-overdue.html' },
    { key: 'past', label: '过往提交', href: 'task-past.html' },
  ];

  var BANNERS = {
    current: { cls: 'mp-banner-blue', icon: '📊', text: 'v1 小程序：查看任务进度与评分确认；填表请使用 OA-PC。' },
    overdue: { cls: 'mp-banner-orange', icon: '⏰', text: '已过截止未提交的任务仍留本 Tab。「待解锁」不可点。' },
    past: { cls: 'mp-banner-green', icon: '🔒', text: '已完成确认的历史任务；可回看本人填写内容。' },
    leader: { cls: 'mp-banner-orange', icon: '📋', text: '待评与待确认在同一 Tab：评完后双方进入「待确认」，只读+确认按钮。' },
  };

  var LEADER_REVIEW_DATA = [
    { id: 'r-wf-202605', employee: '王芳', dept: '信息部', period: '2026年5月', type: 'month', status: 'pending_confirm', submittedAt: '2026-05-28 16:20', phase: 'pending_confirm' },
    { id: 'r-lm-202605', employee: '李明', dept: '信息部', period: '2026年5月', type: 'month', status: 'pending', submittedAt: '2026-05-27 18:05', phase: 'pending_supervisor' },
    { id: 'r-zs-2026q2', employee: '赵强', dept: '信息部', period: '2026 Q2', type: 'quarter', status: 'pending', submittedAt: '2026-06-01 10:00', mpDisabled: true },
  ];

  var LEADER_STATUS = {
    pending: { label: '待评', cls: 'mp-tag-orange' },
    scoring: { label: '评分中', cls: 'mp-tag-blue' },
    pending_confirm: { label: '待确认', cls: 'mp-tag-orange' },
    done: { label: '已完成', cls: 'mp-tag-green' },
  };

  function typeIcon(type) { return type === 'quarter' ? '季' : '月'; }

  function taskHref(t) {
    if (t.phase === 'pending_confirm') {
      return 'score-confirm.html?role=' + (t._leader ? 'leader' : 'employee') + '&id=' + encodeURIComponent(t.id || '');
    }
    if (t.href) return t.href;
    return 'task-progress.html?id=' + encodeURIComponent(t.id || '');
  }

  function renderSegment(activeKey) {
    var el = document.getElementById('mp-segment');
    if (!el) return;
    el.innerHTML = SEGMENT.map(function (s) {
      return '<a href="' + s.href + '" class="' + (s.key === activeKey ? 'is-active' : '') + '">' + s.label +
        (s.key === 'overdue' && TASK_DATA.overdue.length ? '<em class="mp-segment-badge">' + TASK_DATA.overdue.length + '</em>' : '') + '</a>';
    }).join('');
  }

  function renderBanner(key) {
    var el = document.getElementById('mp-banner');
    if (!el) return;
    var b = BANNERS[key];
    if (!b) { el.style.display = 'none'; return; }
    el.className = 'mp-banner ' + b.cls;
    el.innerHTML = '<span class="mp-banner-icon">' + b.icon + '</span><span>' + b.text + '</span>';
    el.style.display = '';
  }

  function renderTaskList(key) {
    var el = document.getElementById('mp-task-list');
    if (!el) return;
    var list = TASK_DATA[key] || [];
    if (!list.length) {
      el.innerHTML = '<div class="mp-empty"><div class="mp-empty-icon">📭</div><p>暂无记录</p></div>';
      return;
    }
    el.innerHTML = list.map(function (t) {
      var isLockedOverdue = key === 'overdue' && t.overdueState === 'locked';
      if (isLockedOverdue) {
        return '<div class="mp-task-card-row"><div class="mp-task-card mp-task-card--disabled mp-task-card--overdue-locked" role="presentation">' +
          '<div class="mp-task-icon mp-task-icon--' + t.type + ' mp-task-icon--muted">' + typeIcon(t.type) + '</div>' +
          '<div class="mp-task-body"><h4>' + t.title + '</h4><p class="mp-task-meta">' + t.progress + '</p>' +
          (t.hint ? '<span class="mp-task-hint">' + t.hint + '</span>' : '') + '</div>' +
          '<span class="mp-tag ' + t.tagCls + '">' + t.tag + '</span></div></div>';
      }
      var steps = t.phase && window.PerfWorkflow ? PerfWorkflow.renderPhaseSteps(t.phase, { compact: true }) : '';
      return '<div class="mp-task-card-row"><a class="mp-task-card" href="' + taskHref(t) + '">' +
        '<div class="mp-task-icon mp-task-icon--' + t.type + '">' + typeIcon(t.type) + '</div>' +
        '<div class="mp-task-body"><h4>' + t.title + '</h4><p class="mp-task-meta">' + t.progress + '</p>' +
        steps +
        (t.deadline && t.deadline !== '—' ? '<span class="mp-task-deadline">' + t.deadline + '</span>' : '') +
        (t.hint ? '<span class="mp-task-hint">' + t.hint + '</span>' : '') + '</div>' +
        '<span class="mp-tag ' + t.tagCls + '">' + t.tag + '</span>' +
        '<span class="mp-task-arrow">›</span></a></div>';
    }).join('');
  }

  function renderLeaderReviewList() {
    var el = document.getElementById('leader-task-list');
    if (!el) return;
    var pendingCount = LEADER_REVIEW_DATA.filter(function (t) { return t.status !== 'done' && !t.mpDisabled; }).length;
    var badgeEl = document.getElementById('leader-tab-badge');
    if (badgeEl) {
      badgeEl.textContent = pendingCount;
      badgeEl.style.display = pendingCount ? 'inline-block' : 'none';
    }
    el.innerHTML = LEADER_REVIEW_DATA.map(function (t) {
      var st = LEADER_STATUS[t.status] || LEADER_STATUS.pending;
      if (t.mpDisabled) {
        return '<div class="mp-task-card mp-task-card--disabled" data-disabled-tip="季度评分请使用 OA-PC">' +
          '<div class="mp-task-icon mp-task-icon--quarter">季</div>' +
          '<div class="mp-task-body"><h4>' + t.employee + ' · ' + t.period + '</h4><p class="mp-task-meta">季度评分请使用 OA</p></div>' +
          '<span class="mp-tag mp-tag-gray">OA</span></div>';
      }
      var href = t.status === 'pending_confirm'
        ? 'score-confirm.html?role=leader&id=' + encodeURIComponent(t.id)
        : 'leader-score-monthly.html?id=' + encodeURIComponent(t.id);
      var hint = t.status === 'pending_confirm' ? '待您确认评分' : (t.status === 'scoring' ? '有草稿' : '待您评分');
      return '<a class="mp-task-card" href="' + href + '"><div class="mp-task-icon mp-task-icon--month">月</div>' +
        '<div class="mp-task-body"><h4>' + t.employee + ' · ' + t.period + '</h4><p class="mp-task-meta">' + t.dept + ' · ' + hint + '</p>' +
        (t.phase && window.PerfWorkflow ? PerfWorkflow.renderPhaseSteps(t.phase, { compact: true }) : '') +
        '</div><span class="mp-tag ' + st.cls + '">' + st.label + '</span><span class="mp-task-arrow">›</span></a>';
    }).join('');
    el.querySelectorAll('.mp-task-card--disabled').forEach(function (card) {
      card.addEventListener('click', function () { alert(card.dataset.disabledTip || '请使用 OA'); });
    });
  }

  function initTaskProgressPage() {
    var params = new URLSearchParams(location.search);
    var id = params.get('id') || 'm202605';
    var task = null;
    ['current', 'overdue', 'past'].forEach(function (k) {
      (TASK_DATA[k] || []).forEach(function (t) { if (t.id === id) task = t; });
    });
    if (!task) task = { title: '考核任务', phase: 'filling', progress: '—', hint: 'v1 填表请使用 OA-PC' };
    document.getElementById('progress-title').textContent = task.title;
    document.getElementById('progress-steps').innerHTML = window.PerfWorkflow
      ? PerfWorkflow.renderPhaseSteps(task.phase || 'filling') : '';
    document.getElementById('progress-detail').innerHTML =
      '<p class="mp-task-meta">' + (task.progress || '') + '</p>' +
      (task.hint ? '<p class="hr-hint">' + task.hint + '</p>' : '') +
      '<p class="hr-hint">小程序 v1 不提供填表；请登录 OA 个人中心继续填写或查看详情。</p>';
    var actions = document.getElementById('progress-actions');
    if (task.phase === 'pending_confirm') {
      actions.innerHTML = '<a class="q-btn q-btn-primary mp-btn-block" href="score-confirm.html?role=employee">去确认评分</a>';
    }
  }

  function switchRoleTab(role) {
    document.querySelectorAll('#role-tabs button').forEach(function (t) {
      t.classList.toggle('is-active', t.dataset.role === role);
    });
    var emp = role === 'employee';
    var empPanel = document.getElementById('employee-panel');
    var leadPanel = document.getElementById('leader-panel');
    if (empPanel) empPanel.style.display = emp ? '' : 'none';
    if (leadPanel) leadPanel.style.display = emp ? 'none' : '';
    var subTitle = document.getElementById('mp-page-title');
    if (subTitle) subTitle.textContent = emp ? (window.__mpPageTitle || '绩效') : '待我审核';
  }

  function initMpTaskPage(activeKey, title) {
    window.__mpPageTitle = title || '绩效';
    renderMpTabbar('home');
    var subTitle = document.getElementById('mp-page-title');
    if (subTitle) subTitle.textContent = window.__mpPageTitle;
    renderSegment(activeKey);
    renderBanner(activeKey);
    renderTaskList(activeKey);
    renderLeaderBanner();
    renderLeaderReviewList();
    document.querySelectorAll('#role-tabs button').forEach(function (tab) {
      tab.addEventListener('click', function () { switchRoleTab(tab.dataset.role); });
    });
    if (new URLSearchParams(location.search).get('tab') === 'leader') switchRoleTab('leader');
  }

  function renderLeaderBanner() {
    var el = document.getElementById('leader-banner');
    if (!el) return;
    var b = BANNERS.leader;
    el.className = 'mp-banner ' + b.cls;
    el.innerHTML = '<span class="mp-banner-icon">' + b.icon + '</span><span>' + b.text + '</span>';
  }

  window.initMpTaskPage = initMpTaskPage;
  window.MP_TASK_DATA = TASK_DATA;
  window.MP_LEADER_REVIEW_DATA = LEADER_REVIEW_DATA;
  window.MpTasks = { initTaskProgressPage: initTaskProgressPage };
})();
