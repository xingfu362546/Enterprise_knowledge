/**
 * 绩效任务 · 工作流状态（v1.1.0）
 * 见 docs/GRILL_V1_ITERATION.md
 */
(function () {
  'use strict';

  var PHASES = [
    { key: 'filling', label: '填写中', short: '填写' },
    { key: 'pending_supervisor', label: '待上级评', short: '上级' },
    { key: 'pending_division', label: '待分管评', short: '分管' },
    { key: 'pending_confirm', label: '待确认', short: '确认' },
    { key: 'completed', label: '已完成', short: '完成' },
  ];

  function phaseIndex(key) {
    for (var i = 0; i < PHASES.length; i++) {
      if (PHASES[i].key === key) return i;
    }
    return 0;
  }

  function phaseLabel(key) {
    var p = PHASES.filter(function (x) { return x.key === key; })[0];
    return p ? p.label : key;
  }

  function canReturnToEmployee(task) {
    if (!task) return false;
    if (task.phase === 'completed' && task.employeeConfirmed && task.supervisorConfirmed) return false;
    return true;
  }

  function isSettledForBonus(task) {
    return task &&
      task.phase === 'completed' &&
      task.employeeConfirmed &&
      task.supervisorConfirmed &&
      task.supervisorDone &&
      task.divisionDone;
  }

  function renderPhaseSteps(currentKey, opts) {
    opts = opts || {};
    var cur = phaseIndex(currentKey);
    return '<div class="perf-phase-steps' + (opts.compact ? ' perf-phase-steps--compact' : '') + '">' +
      PHASES.map(function (p, i) {
        var cls = i < cur ? 'is-done' : i === cur ? 'is-current' : '';
        if (p.key === 'pending_confirm' && currentKey === 'pending_confirm') cls = 'is-current';
        return '<span class="perf-phase-step ' + cls + '"><em>' + (i + 1) + '</em>' + p.label + '</span>';
      }).join('<span class="perf-phase-arrow">→</span>') + '</div>';
  }

  function renderConfirmBadges(task) {
    if (!task || task.phase !== 'pending_confirm' && task.phase !== 'completed') return '';
    return '<span class="q-tag' + (task.employeeConfirmed ? ' q-tag-green' : ' q-tag-orange') + '">员工' + (task.employeeConfirmed ? '已确认' : '待确认') + '</span> ' +
      '<span class="q-tag' + (task.supervisorConfirmed ? ' q-tag-green' : ' q-tag-orange') + '">上级' + (task.supervisorConfirmed ? '已确认' : '待确认') + '</span>';
  }

  window.PerfWorkflow = {
    PHASES: PHASES,
    phaseLabel: phaseLabel,
    phaseIndex: phaseIndex,
    canReturnToEmployee: canReturnToEmployee,
    isSettledForBonus: isSettledForBonus,
    renderPhaseSteps: renderPhaseSteps,
    renderConfirmBadges: renderConfirmBadges,
  };
})();
