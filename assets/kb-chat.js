/**
 * 企业知识库 · PC 端右侧抽屉聊天（模拟 RAG 问答与文档引用）
 */
(function () {
  'use strict';

  var WELCOME_HTML =
    '<p>您好！我是<strong>小Q</strong>，企业知识库智能助手，可帮您检索制度、SOP、岗位规则与流程说明。</p>' +
    '<div class="kb-chips" id="kb-chips">' +
      '<button type="button" class="kb-chip" data-q="信息部请假流程是什么？">信息部请假流程是什么？</button>' +
      '<button type="button" class="kb-chip" data-q="门户系统主管的岗位规则有哪些？">门户系统主管的岗位规则有哪些？</button>' +
      '<button type="button" class="kb-chip" data-q="报销需要准备哪些材料？">报销需要准备哪些材料？</button>' +
    '</div>';

  var MOCK_ANSWERS = {
    '信息部请假流程是什么？': {
      text: '根据《信息部考勤与请假管理办法》，请假须提前在 OA「考勤与假期」模块提交申请：\n\n· 事假、病假：提前 1 个工作日\n· 年假：提前 3 个工作日\n· 3 天以上假期：须部门主管审批\n\n审批通过后，系统自动同步考勤记录。',
      cites: [
        { title: '信息部考勤与请假管理办法 v3.2', section: '第三章 请假流程' },
        { title: '6Q 员工手册 · 考勤篇', section: '2.4 假期申请' },
      ],
    },
    '门户系统主管的岗位规则有哪些？': {
      text: '门户系统主管（信息部）主要职责包括：\n\n1. 维护 OA 门户首页栏目与待办展示规则\n2. 协调各业务部门门户内容更新\n3. 负责门户权限配置与发布审核\n4. 对接知识库内容上架与入口运营\n\n具体考核指标见岗位说明书附件。',
      cites: [
        { title: '信息部岗位说明书 · 门户系统主管', section: '职责与权限' },
        { title: 'OA 门户运营 SOP', section: '1.2 主管职责' },
      ],
    },
    '报销需要准备哪些材料？': {
      text: '一般费用报销需准备：\n\n· 正规发票原件（电子发票需 PDF + 查验截图）\n· OA 报销申请单（关联项目/部门预算）\n· 费用明细说明（超过 500 元须附清单）\n· 差旅报销另需行程单、住宿水单\n\n提交后由财务 3 个工作日内初审。',
      cites: [
        { title: '财务报销管理制度 2025 版', section: '第四章 材料要求' },
      ],
    },
  };

  var DEFAULT_ANSWER = {
    text: '已在企业知识库中检索相关内容。如需更精确答案，请补充部门、制度名称或具体场景关键词。',
    cites: [
      { title: '企业知识库检索说明', section: '使用指引' },
    ],
  };

  var overlay, drawer, chatBody, input, sendBtn, fab, fabWrap, fabHint;
  var isOpen = false;

  function el(id) { return document.getElementById(id); }

  function openDrawer() {
    isOpen = true;
    overlay.classList.add('is-open');
    drawer.classList.add('is-open');
    fabWrap.classList.add('is-drawer-open');
    document.body.style.overflow = 'hidden';
    input.focus();
  }

  function closeDrawer() {
    isOpen = false;
    overlay.classList.remove('is-open');
    drawer.classList.remove('is-open');
    fabWrap.classList.remove('is-drawer-open');
    document.body.style.overflow = '';
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatText(text) {
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function renderCites(cites) {
    if (!cites || !cites.length) return '';
    var links = cites.map(function (c) {
      return '<a href="#" onclick="return false" title="原型占位">' + escapeHtml(c.title) + '</a>' +
        (c.section ? ' · ' + escapeHtml(c.section) : '');
    }).join('<br>');
    return '<div class="kb-cite">参考来源：<br>' + links + '</div>';
  }

  function appendBotMessage(html) {
    var wrap = document.createElement('div');
    wrap.className = 'kb-msg';
    wrap.innerHTML =
      '<div class="kb-msg-avatar kb-msg-avatar--bot">KB</div>' +
      '<div class="kb-msg-bubble">' + html + '</div>';
    chatBody.appendChild(wrap);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function appendUserMessage(text) {
    var wrap = document.createElement('div');
    wrap.className = 'kb-msg kb-msg--user';
    wrap.innerHTML =
      '<div class="kb-msg-avatar kb-msg-avatar--user">余</div>' +
      '<div class="kb-msg-bubble">' + escapeHtml(text) + '</div>';
    chatBody.appendChild(wrap);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function showTyping() {
    var wrap = document.createElement('div');
    wrap.className = 'kb-msg';
    wrap.id = 'kb-typing-indicator';
    wrap.innerHTML =
      '<div class="kb-msg-avatar kb-msg-avatar--bot">KB</div>' +
      '<div class="kb-msg-bubble"><div class="kb-typing"><span></span><span></span><span></span></div></div>';
    chatBody.appendChild(wrap);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function hideTyping() {
    var t = el('kb-typing-indicator');
    if (t) t.remove();
  }

  function answerQuestion(q) {
    var chips = el('kb-chips');
    if (chips) chips.remove();

    appendUserMessage(q);
    input.value = '';
    sendBtn.disabled = true;
    showTyping();

    setTimeout(function () {
      hideTyping();
      var ans = MOCK_ANSWERS[q] || DEFAULT_ANSWER;
      appendBotMessage(
        '<p>' + formatText(ans.text) + '</p>' + renderCites(ans.cites)
      );
      sendBtn.disabled = false;
    }, 800 + Math.random() * 400);
  }

  function sendMessage() {
    var q = input.value.trim();
    if (!q) return;
    answerQuestion(q);
  }

  function bindChips() {
    document.querySelectorAll('.kb-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        answerQuestion(btn.getAttribute('data-q'));
      });
    });
  }

  function initWelcome() {
    appendBotMessage(WELCOME_HTML);
    bindChips();
  }

  function init() {
    overlay = el('kb-overlay');
    drawer = el('kb-drawer');
    chatBody = el('kb-chat-body');
    input = el('kb-input');
    sendBtn = el('kb-send-btn');
    fab = el('kb-fab');
    fabWrap = el('kb-fab-wrap');
    fabHint = el('kb-fab-hint');

    fab.addEventListener('click', openDrawer);
    el('kb-drawer-close').addEventListener('click', closeDrawer);
    overlay.addEventListener('click', closeDrawer);

    var hintClose = el('kb-fab-hint-close');
    if (hintClose) {
      hintClose.addEventListener('click', function (e) {
        e.stopPropagation();
        fabHint.classList.add('is-dismissed');
      });
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) closeDrawer();
    });

    initWelcome();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
