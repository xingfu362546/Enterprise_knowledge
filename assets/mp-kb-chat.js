/**
 * 企业知识库 · 小程序聊天页（模拟问答，对接知识库检索）
 */
(function () {
  'use strict';

  var MOCK = {
    '信息部请假流程是什么？': {
      text: '根据《信息部考勤与请假管理办法》：事假、病假须提前 1 个工作日申请；年假提前 3 个工作日；3 天以上须部门主管审批。',
      cites: [{ title: '信息部考勤与请假管理办法 v3.2', section: '第三章' }],
    },
    '报销需要准备哪些材料？': {
      text: '需准备：正规发票、OA 报销申请单、费用明细（超 500 元附清单）；差旅另需行程单与住宿凭证。',
      cites: [{ title: '财务报销管理制度 2025 版', section: '第四章' }],
    },
    '6Q 企业文化核心是什么？': {
      text: '6Q 企业文化强调「三生六感合一」：以生命成长为核心，融合学习感、责任感、归属感等六感，推动员工与组织共同发展。',
      cites: [{ title: '6Q 企业文化手册', section: '核心理念' }],
    },
  };

  var WELCOME =
    '<p>嗨～我是<strong>小Q</strong>！制度、SOP、岗位规则都可以问我，试试下面快捷问题吧～</p>' +
    '<div class="mp-kb-chips" id="mp-kb-chips">' +
      '<button type="button" class="mp-kb-chip" data-q="信息部请假流程是什么？">信息部请假流程是什么？</button>' +
      '<button type="button" class="mp-kb-chip" data-q="报销需要准备哪些材料？">报销需要准备哪些材料？</button>' +
      '<button type="button" class="mp-kb-chip" data-q="6Q 企业文化核心是什么？">6Q 企业文化核心是什么？</button>' +
    '</div>';

  var body, input, sendBtn;

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fmt(t) { return esc(t).replace(/\n/g, '<br>'); }

  function cites(list) {
    if (!list || !list.length) return '';
    return '<div class="mp-kb-cite">参考来源：<br>' +
      list.map(function (c) {
        return '<a href="#" onclick="return false">' + esc(c.title) + '</a>' +
          (c.section ? ' · ' + esc(c.section) : '');
      }).join('<br>') + '</div>';
  }

  function scrollBottom() {
    body.scrollTop = body.scrollHeight;
  }

  function bot(html) {
    var el = document.createElement('div');
    el.className = 'mp-kb-msg';
    el.innerHTML =
      '<div class="mp-kb-msg-avatar mp-kb-msg-avatar--bot">Q</div>' +
      '<div class="mp-kb-msg-bubble">' + html + '</div>';
    body.appendChild(el);
    scrollBottom();
  }

  function user(text) {
    var el = document.createElement('div');
    el.className = 'mp-kb-msg mp-kb-msg--user';
    el.innerHTML =
      '<div class="mp-kb-msg-avatar mp-kb-msg-avatar--user">张</div>' +
      '<div class="mp-kb-msg-bubble">' + esc(text) + '</div>';
    body.appendChild(el);
    scrollBottom();
  }

  function typing() {
    var el = document.createElement('div');
    el.className = 'mp-kb-msg';
    el.id = 'mp-kb-typing';
    el.innerHTML =
      '<div class="mp-kb-msg-avatar mp-kb-msg-avatar--bot">Q</div>' +
      '<div class="mp-kb-msg-bubble mp-kb-typing"><span></span><span></span><span></span></div>';
    body.appendChild(el);
    scrollBottom();
  }

  function answer(q) {
    var chips = document.getElementById('mp-kb-chips');
    if (chips) chips.remove();
    user(q);
    input.value = '';
    sendBtn.disabled = true;
    typing();
    setTimeout(function () {
      var t = document.getElementById('mp-kb-typing');
      if (t) t.remove();
      var ans = MOCK[q] || {
        text: '已在知识库检索，请补充更具体的关键词（部门、制度名等）以获得准确结果。',
        cites: [{ title: '企业知识库使用指引', section: '检索技巧' }],
      };
      bot('<p>' + fmt(ans.text) + '</p>' + cites(ans.cites));
      sendBtn.disabled = false;
    }, 700);
  }

  function bindChips() {
    document.querySelectorAll('.mp-kb-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        answer(btn.getAttribute('data-q'));
      });
    });
  }

  window.initMpKbChat = function () {
    body = document.getElementById('mp-kb-chat-body');
    input = document.getElementById('mp-kb-input');
    sendBtn = document.getElementById('mp-kb-send');
    bot(WELCOME);
    bindChips();
    sendBtn.addEventListener('click', function () {
      var q = input.value.trim();
      if (q) answer(q);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        var q = input.value.trim();
        if (q) answer(q);
      }
    });
  };
})();
