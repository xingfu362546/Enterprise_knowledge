/**
 * 6Q 壳层渲染 · 对齐用户截图菜单层级
 */
(function () {
  'use strict';

  var OA_TOP_MODULES = [
    { key: 'admin', label: '行政管理', href: '#' },
    { key: 'home', label: '首页', href: 'index.html' },
    { key: 'flow', label: '流程中心', href: '#' },
    { key: 'personal', label: '个人中心', href: 'personal.html' },
    { key: 'app', label: '应用中心', href: '#' },
    { key: 'hr', label: '人力资源', href: 'hr-plan-list.html' },
    { key: 'attendance', label: '考勤与薪酬', href: '#' },
    { key: 'project', label: '项目管理', href: '#' },
    { key: 'salary', label: '薪酬结算', href: '#' },
    { key: 'report', label: '报表中心', href: '#' },
  ];

  var HR_SIDEBAR = [
    { id: 'emp', label: '员工管理', open: true, items: [
      { label: '员工花名册', href: '#', key: 'roster' },
    ]},
    { id: 'relation', label: '员工关系', open: false, items: [] },
    { id: 'train', label: '员工培训', open: false, items: [] },
    { id: 'recruit', label: '招聘管理', open: false, items: [] },
    { id: 'perf', label: '绩效管理', open: true, items: [
      { label: '计划管理', href: 'hr-plan-list.html', key: 'plan' },
      { label: '人员绩效结果', href: 'hr-perf-results-list.html', key: 'perf-results' },
      { label: '奖金规则', href: 'hr-bonus-rules-list.html', key: 'bonus' },
      { label: '员工月度绩效', href: '#', key: 'legacy-month', legacy: true },
      { label: '员工季度绩效', href: '#', key: 'legacy-quarter', legacy: true },
    ]},
    { id: 'pay', label: '薪酬管理', open: true, items: [
      { label: '绩效奖金结算', href: 'hr-bonus-settlement.html?plan=2026-05', key: 'bonus-settle' },
    ]},
  ];

  var PERSONAL_SIDEBAR = [
    { id: 'pinfo', label: '我的信息', open: false, items: [
      { label: '基本信息', href: '#', key: 'info' },
    ]},
    { id: 'pperf', label: '我的绩效', open: true, items: [
      { label: '绩效待办', href: 'personal-perf.html', key: 'perf-list' },
    ]},
  ];

  var MP_GRID = [
    { label: '考勤打卡', href: '#', color: '#52c41a', icon: 'calendar' },
    { label: '审批', href: '#', color: '#1890ff', icon: 'approve' },
    { label: '我的会议', href: '#', color: '#389e0d', icon: 'meeting' },
    { label: '工资条', href: '#', color: '#597ef7', icon: 'salary' },
    { label: '企业通讯录', href: '#', color: '#95de64', icon: 'contacts' },
    { label: '个人任务', href: '#', color: '#13c2c2', icon: 'task' },
    { label: '绩效', href: 'task-list.html', color: '#fa8c16', icon: 'perf', badge: 2 },
  ];

  var SVG = {
    calendar: '<svg viewBox="0 0 24 24"><path d="M7 2h2v2h6V2h2v2h3a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h3V2zm13 8H4v10h16V10z"/></svg>',
    approve: '<svg viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>',
    meeting: '<svg viewBox="0 0 24 24"><path d="M3 5h18v14H3V5zm2 2v10h14V7H5zm2 2h10v2H7V9zm0 4h6v2H7v-2z"/></svg>',
    salary: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
    contacts: '<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
    task: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>',
    perf: '<svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>',
    kb: '<svg viewBox="0 0 24 24"><path d="M18 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zM6 4h5v8l-2.5-1.5L6 12V4zm7 0h5v16h-5V4z"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path d="M12 3l9 8h-3v9H6v-9H3l9-8z"/></svg>',
    mine: '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  };

  function renderOaTopbar(activeModule) {
    var el = document.getElementById('q-oa-topbar');
    if (!el) return;
    el.innerHTML =
      '<div class="q-oa-brand">6Q-测试环境</div>' +
      '<nav class="q-oa-modules">' +
      OA_TOP_MODULES.map(function (m) {
        return '<a href="' + m.href + '" class="' + (m.key === activeModule ? 'is-active' : '') + '">' + m.label + '</a>';
      }).join('') +
      '</nav>' +
      '<div class="q-oa-topright"><span>🔔</span><span>⛶</span><span><span class="q-oa-avatar">张</span> 张明</span></div>';
  }

  function renderOaSidebar(groups, activeKey) {
    var el = document.getElementById('q-oa-sidenav');
    if (!el) return;
    el.innerHTML = groups.map(function (g) {
      if (!g.items || !g.items.length) {
        return '<details class="q-oa-nav-group"><summary>' + g.label + '</summary><div class="q-oa-nav-sub"></div></details>';
      }
      var items = g.items.map(function (it) {
        var cls = it.key === activeKey ? 'is-active' : '';
        if (it.legacy) cls += ' is-legacy';
        return '<a href="' + it.href + '" class="' + cls.trim() + '">' + it.label + '</a>';
      }).join('');
      return '<details class="q-oa-nav-group" ' + (g.open ? 'open' : '') + '><summary>' + g.label + '</summary><div class="q-oa-nav-sub">' + items + '</div></details>';
    }).join('');
  }

  function renderOaPageTabs(tabs, activeKey) {
    var el = document.getElementById('q-oa-pagetabs');
    if (!el || !tabs) return;
    el.innerHTML = tabs.map(function (t) {
      var cls = t.key === activeKey ? 'is-active' : '';
      var close = t.closable ? '<span class="tab-close">×</span>' : '';
      return '<a href="' + t.href + '" class="' + cls + '">' + t.label + close + '</a>';
    }).join('');
  }

  function initOaShell(cfg) {
    cfg = cfg || {};
    renderOaTopbar(cfg.topModule || 'personal');
    var groups = cfg.topModule === 'hr' ? JSON.parse(JSON.stringify(HR_SIDEBAR)) : PERSONAL_SIDEBAR;
    if (cfg.topModule === 'hr' && window.PerfPermissions) {
      groups.forEach(function (g) {
        if (g.id === 'perf') g.items = PerfPermissions.filterHrSidebarItems(g.items);
        if (g.id === 'pay') g.items = PerfPermissions.filterHrSidebarItems(g.items);
      });
    }
    renderOaSidebar(groups, cfg.sideActive || 'perf-list');
    if (cfg.pageTabs) renderOaPageTabs(cfg.pageTabs, cfg.activeTab);
    if (cfg.topModule === 'hr' && window.PerfPermissions) PerfPermissions.renderPermBanner();
  }

  function mpIcon(name, color, badge) {
    return '<span class="mp-icon" style="background:' + color + '">' + SVG[name] +
      (badge ? '<em class="mp-icon-badge">' + badge + '</em>' : '') + '</span>';
  }

  function renderMpGrid(container) {
    if (!container) return;
    container.innerHTML = MP_GRID.map(function (item) {
      var hl = item.highlight ? ' mp-grid-item--highlight' : '';
      return '<a class="mp-grid-item' + hl + '" href="' + item.href + '">' + mpIcon(item.icon, item.color, item.badge) +
        '<span class="mp-grid-label">' + item.label + '</span></a>';
    }).join('');
  }

  function renderMpTabbar(active) {
    var el = document.getElementById('mp-tabbar');
    if (!el) return;
    el.innerHTML =
      '<a href="home.html" class="' + (active === 'home' ? 'is-active' : '') + '">' + SVG.home + '<span>首页</span></a>' +
      '<a href="#" class="' + (active === 'mine' ? 'is-active' : '') + '">' + SVG.mine + '<span>我的</span></a>';
  }

  function initMpHome() {
    renderMpGrid(document.getElementById('mp-grid'));
    renderMpTabbar('home');
  }

  function bindCollapseCards(root, options) {
    options = options || {};
    var single = options.single !== false;
    (root || document).querySelectorAll('.collapse-card').forEach(function (card) {
      var head = card.querySelector('.collapse-head');
      if (!head || head.dataset.bound) return;
      head.dataset.bound = '1';
      head.addEventListener('click', function (e) {
        if (e.target.closest('.remove-btn')) return;
        var willOpen = !card.classList.contains('open');
        if (single && willOpen) {
          (root || document).querySelectorAll('.collapse-card.open').forEach(function (c) {
            if (c !== card) c.classList.remove('open');
          });
        }
        card.classList.toggle('open', willOpen);
      });
    });
  }

  function krPreview(kr, showScore) {
    if (showScore) {
      var m = (kr.m || '').trim();
      var scVal = kr.selfScore != null && kr.selfScore !== '' ? kr.selfScore : null;
      var sc = scVal != null
        ? '自评 ' + (window.PerfScoreFormat ? PerfScoreFormat.format(scVal) : scVal)
        : '';
      return m ? m.slice(0, 28) + (m.length > 28 ? '…' : '') + (sc ? ' · ' + sc : '') : '点击展开填写';
    }
    var o = (kr.o || '').trim();
    var w = kr.weight ? '权重 ' + kr.weight + '%' : '';
    var tiers = kr.standardTiers && kr.standardTiers.length ? ' · ' + kr.standardTiers.length + '档标准' : '';
    if (o) return o.slice(0, 30) + (o.length > 30 ? '…' : '') + (w ? ' · ' + w : '') + tiers;
    return '点击展开填写';
  }

  window.initOaShell = initOaShell;
  window.initMpHome = initMpHome;
  window.renderMpGrid = renderMpGrid;
  window.renderMpTabbar = renderMpTabbar;
  window.bindCollapseCards = bindCollapseCards;
  window.krPreview = krPreview;
})();
