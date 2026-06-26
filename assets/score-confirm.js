/**
 * 评分结果确认（v1.3.0）· 模块表格 + 折算汇总
 */
(function () {
  'use strict';

  var MOCK = {
    title: '2026年5月 · 月度绩效考核',
    confirmDeadline: '2026-06-15 18:00',
    divisionAdjusted: true,
    finalTotal: 84.1,
    employeeConfirmed: false,
    supervisorConfirmed: false,
  };

  function renderBody(el, opts) {
    var role = opts.role || 'employee';
    var isMini = opts.platform === 'miniapp';
    var confirmed = role === 'employee' ? MOCK.employeeConfirmed : MOCK.supervisorConfirmed;
    var S = window.PerfScoreSummary;

    el.innerHTML =
      (isMini ? '' : '<div class="perf-tip perf-tip-blue" style="margin-bottom:12px">上级评分已完成，分管已核定总分。请核对下表各模块自评与上级评，及底部<strong>折算汇总</strong>后确认。</div>') +
      '<h3 style="margin:0 0 8px">' + MOCK.title + '</h3>' +
      (window.PerfWorkflow ? PerfWorkflow.renderPhaseSteps('pending_confirm') : '') +
      '<dl class="proto-kv" style="margin:12px 0"><dt>确认截止</dt><dd>' + MOCK.confirmDeadline + '</dd></dl>' +
      (S ? S.renderConfirmPage({ full: false, divisionAdjusted: MOCK.divisionAdjusted, finalTotal: MOCK.finalTotal }) : '') +
      (confirmed
        ? '<p class="hr-hint" style="margin-top:16px"><span class="q-tag q-tag-green">您已确认</span> 等待' + (role === 'employee' ? '上级' : '员工') + '确认。</p>'
        : '<button type="button" class="q-btn q-btn-primary' + (isMini ? ' mp-btn-block' : '') + '" id="btn-confirm-score" style="margin-top:16px">确认评分结果</button>');
  }

  function initPage(opts) {
    var el = document.getElementById('confirm-body');
    if (!el) return;
    renderBody(el, opts);
    var btn = document.getElementById('btn-confirm-score');
    if (btn) {
      btn.addEventListener('click', function () {
        if (opts.role === 'employee') MOCK.employeeConfirmed = true;
        else MOCK.supervisorConfirmed = true;
        alert('已确认（原型）');
        if (opts.platform === 'miniapp') {
          location.href = opts.role === 'leader' ? 'task-list.html?tab=leader' : 'task-list.html';
        } else {
          location.href = opts.role === 'employee' ? 'personal-perf.html' : 'supervisor-review-list.html';
        }
      });
    }
  }

  window.ScoreConfirm = { initPage: initPage, MOCK: MOCK };
})();
