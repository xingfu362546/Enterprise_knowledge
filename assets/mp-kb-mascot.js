/**
 * 企业知识库 · 小程序首页卡通入口「小Q」
 * 展开展示气泡；闲置 8s 后缩至右边缘；点击进入智能助手
 */
(function () {
  var wrap = document.getElementById("mp-kb-mascot-wrap");
  var button = document.getElementById("mp-kb-mascot-btn");
  var bubble = document.getElementById("mp-kb-mascot-bubble");
  if (!wrap || !button) return;

  function openAssistant() {
    location.href = "assistant.html";
  }

  button.addEventListener("click", openAssistant);
  if (bubble) bubble.addEventListener("click", openAssistant);

  window.setTimeout(function () {
    wrap.classList.remove("is-expanded");
    wrap.classList.add("is-collapsed");
  }, 8000);
})();
