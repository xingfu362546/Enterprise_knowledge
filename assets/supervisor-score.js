/**
 * 上级评分 · 共享逻辑（v1.0.0）
 * 刻度：加权分 0 ~ 权重；R1/R2/R3 校验；离开弹窗存草稿
 */
(function () {
  'use strict';

  function sf() { return window.PerfScoreFormat; }
  function sOut(v) { return sf() ? sf().format(v) : v; }
  function sIn(v) { return sf() ? sf().inputVal(v) : (v == null || v === '' ? '' : String(v)); }

  var ADJUST_LIMITS = { plus: 5, minus: 5, plusTotal: 10, minusTotal: 10 };

  /** 月度表 · 区块上级分上限（核心85 + 常规15 + 行为15 = 100） */
  var BLOCK_LIMITS = { V: 85, X: 15, B: 15, WORK: 100 };
  /** 季度表 · 核心+常规 KR 权重合计 90%，无行为步 */
  var QUARTER_BLOCK_LIMITS = { V: 90, X: 90, B: 0, WORK: 90, VX: 90 };

  var REVIEW_LIST = [
    { id: 'r-wf-202605', employee: '王芳', empNo: 'E10035', dept: '信息部', role: '产品专员', period: '2026年5月', type: 'month', status: 'done', submittedAt: '2026-05-28 16:20' },
    { id: 'r-lm-202605', employee: '李明', empNo: 'E10022', dept: '信息部', role: '开发工程师', period: '2026年5月', type: 'month', status: 'scoring', submittedAt: '2026-05-27 18:05', mergedReview: true },
    { id: 'r-zs-2026q2', employee: '赵强', empNo: 'E10036', dept: '信息部', role: '后端工程师', period: '2026 Q2', planId: '2026-Q2', type: 'quarter', status: 'pending', phase: 'pending_supervisor', submittedAt: '2026-06-28 14:00', mergedReview: false },
    { id: 'r-lm-2026q2', employee: '李明', empNo: 'E10022', dept: '信息部', role: '开发工程师', period: '2026 Q2', planId: '2026-Q2', type: 'quarter', status: 'pending', phase: 'pending_supervisor', submittedAt: '2026-06-28 16:10', mergedReview: true },
    { id: 'r-wf-2026q2', employee: '王芳', empNo: 'E10035', dept: '信息部', role: '产品专员', period: '2026 Q2', planId: '2026-Q2', type: 'quarter', status: 'scoring', phase: 'pending_division', submittedAt: '2026-06-27 17:40', mergedReview: false, supervisorDone: true },
    { id: 'r-hm-2026q2', employee: '韩梅', empNo: 'E10056', dept: '信息部', role: '测试工程师', period: '2026 Q2', planId: '2026-Q2', type: 'quarter', status: 'done', phase: 'pending_confirm', submittedAt: '2026-06-27 11:00', mergedReview: false, supervisorDone: true, divisionDone: true },
  ];

  /** 当前登录领导 · 原型演示为张明（兼直接上级 + 信息部分管） */
  var LEADER_CONTEXT = {
    name: '张明',
    empNo: 'E10021',
    isDivisionLeader: true,
    divisionDepts: ['信息部'],
  };

  /** 分管领导 · 本部门全员绩效进度（与 REVIEW_LIST 按工号/姓名关联） */
  var DEPT_ROSTER = [
    { no: 'E10035', name: '王芳', dept: '信息部', role: '产品专员', period: '2026年5月', selfTotal: 86.2, phase: 'pending_confirm', supervisorDone: true, systemTotal: 84.7, finalTotal: 84.1, adjusted: true, taskId: 'r-wf-202605', taskType: 'month' },
    { no: 'E10022', name: '李明', dept: '信息部', role: '开发工程师', period: '2026年5月', selfTotal: 82.5, phase: 'pending_supervisor', supervisorDone: false, systemTotal: null, finalTotal: null, taskId: 'r-lm-202605', taskType: 'month', mergedReview: true },
    { no: 'E10008', name: '李强', dept: '信息部', role: '技术总监', period: '2026年5月', selfTotal: 92.0, phase: 'pending_supervisor', supervisorDone: false, systemTotal: null, finalTotal: null },
    { no: 'E10021', name: '张明', dept: '信息部', role: '产品经理', period: '2026年5月', selfTotal: 88.5, phase: 'pending_division', supervisorDone: true, systemTotal: 87.2, finalTotal: null },
    { no: 'E10044', name: '肖洋', dept: '信息部', role: '后端工程师', period: '2026年5月', selfTotal: null, phase: 'filling', supervisorDone: false, systemTotal: null, finalTotal: null },
    { no: 'E10036', name: '赵强', dept: '信息部', role: '后端工程师', period: '2026 Q2', selfTotal: 84.5, phase: 'pending_supervisor', supervisorDone: false, systemTotal: null, finalTotal: null, taskId: 'r-zs-2026q2', taskType: 'quarter' },
    { no: 'E10022', name: '李明', dept: '信息部', role: '开发工程师', period: '2026 Q2', selfTotal: 81.0, phase: 'pending_supervisor', supervisorDone: false, systemTotal: null, finalTotal: null, taskId: 'r-lm-2026q2', taskType: 'quarter', mergedReview: true },
    { no: 'E10035', name: '王芳', dept: '信息部', role: '产品专员', period: '2026 Q2', selfTotal: 85.8, phase: 'pending_division', supervisorDone: true, systemTotal: 87.8, finalTotal: null, taskId: 'r-wf-2026q2', taskType: 'quarter' },
    { no: 'E10056', name: '韩梅', dept: '信息部', role: '测试工程师', period: '2026 Q2', selfTotal: 83.2, phase: 'pending_confirm', supervisorDone: true, systemTotal: 86.8, finalTotal: 86.1, adjusted: true, taskId: 'r-hm-2026q2', taskType: 'quarter' },
  ];

  var SUBMISSIONS = {
    'r-wf-202605': {
      header: { employee: '王芳', dept: '信息部', role: '产品专员', period: '2026年5月', submittedAt: '2026-05-28 16:20', mergedReview: false },
      coreKeyObjectives: [
        {
          id: 'ko-v-mvp', o: '绩效信息化 MVP 可评审交付',
          targets: [
            {
              id: 'v1', block: 'V', weight: 25,
              smart: '5 月 31 日前完成 PRD 评审与双端原型主链路，支撑 HR 走查',
              standardTiers: [
                { label: '业绩达成率 ≥ 100%', score: 25 },
                { label: '100% > 业绩达成率 ≥ 90%', score: 20 },
                { label: '90% > 业绩达成率 ≥ 80%', score: 15 },
                { label: '80% > 业绩达成率 ≥ 70%', score: 10 },
                { label: '业绩达成率 < 70%', score: 0 },
              ],
              attachRules: '每失误一次 -1分',
              m: '已完成 PRD v1.0（共 52 页），5/15、5/22 组织两轮评审。第一轮收集意见 23 条，第二轮收敛至 6 条待 HR 决策项。输出《绩效模板字段对照表》与《Grill 决策记录》附录。',
              selfScore: 23,
            },
            {
              id: 'v2', block: 'V', weight: 22,
              smart: '5 月 28 日前交付 prototype 入口；员工端 8 步向导 + 领导端待我审核可演示',
              standardTiers: [
                { label: '业绩达成率 ≥ 100%', score: 22 },
                { label: '100% > 业绩达成率 ≥ 90%', score: 18 },
                { label: '90% > 业绩达成率 ≥ 80%', score: 13 },
                { label: '80% > 业绩达成率 ≥ 70%', score: 9 },
                { label: '业绩达成率 < 70%', score: 0 },
              ],
              m: '交付 prototype/index.html 及 20+ 页面，完成 1 次 HR 走查、2 次信息部内部评审。走查问题 12 条已关闭 10 条。',
              selfScore: 21,
            },
          ],
        },
        {
          id: 'ko-v-ia', o: '制度协同与个人中心信息架构',
          targets: [
            {
              id: 'v3', block: 'V', weight: 20,
              smart: '输出模板匹配规则草案；6/5 前 HR 确认前提供演示数据方案',
              standard: '文档含人群×职级×模板对照；暂缓项明确标注；与 FEATURE_LIST 条目可映射。',
              m: '完成《GRILL_TEMPLATE_AUDIENCE.md》初稿，梳理总监经理/主管职员月表差异。匹配规则确认暂缓，新建计划第 4 步采用演示数据并已在 PRD 标注风险与兜底。',
              selfScore: 18,
            },
            {
              id: 'v4', block: 'V', weight: 18,
              smart: '双 Tab 区分员工待办与领导待我审核；与小程序心智一致',
              standard: '评审通过 IA 文档；原型实现双 Tab；员工端不可见上级分。',
              m: '更新 OA_PERSONAL_CENTER_PERF.md、MINIAPP_ENTRY_IA.md，原型落地 personal-perf 与 task-list 双 Tab。HR 反馈「角色一眼可辨」达成。',
              selfScore: 17,
            },
          ],
        },
      ],
      regularKeyObjectives: [
        {
          id: 'ko-x-collab', o: '跨部门协同与知识沉淀',
          targets: [
            {
              id: 'x1', block: 'X', weight: 8,
              smart: '工作日内 24h 响应；重要会议提前 1 天准备材料；月度无有效投诉',
              standard: '响应时效；材料质量；协同满意度。',
              m: '本月参与 HR、考勤、培训跨部门会议 11 次，均提前提交材料。协助考勤组梳理绩效与请假数据关联问题 1 次。无未响应记录。',
              selfScore: 7.5,
            },
            {
              id: 'x2', block: 'X', weight: 7,
              smart: 'Grill 决策、Handoff、spec 文档随原型同步更新；版本号可追溯',
              standard: '文档与原型一致；Handoff 含端×模块清单。',
              m: '维护 DESIGN_SESSION、HANDOFF-v1.0.0.md，Grill 上级评分 10 条决策入库。文档与原型索引一致。',
              selfScore: 6.8,
            },
          ],
        },
      ],
      behavior: [
        {
          id: 'b1', name: '团队建设与人才培养', weight: 4, selfScore: 3.8,
          standard: '1.根据团队现状，规划并推动人才培养计划；\n2.及时给予反馈与辅导；\n3.差异化分配任务；\n4.建立经验分享机制。',
          event: '带教实习生小林完成「绩效任务列表页」交互说明，协助其理解 Axure/HTML 原型差异；组织 1 次组内原型走查分享，整理《产品走查 checklist》供新人复用。',
        },
        {
          id: 'b2', name: '跨部门协同', weight: 4, selfScore: 4,
          standard: '1.主动建立跨部门信息共享；\n2.积极响应协同需求；\n3.尊重协同方节奏；\n4.协作问题及时复盘。',
          event: '在 HR 排期紧张情况下，主动拆分 MVP 范围（模板匹配后移、先交填表与评分原型），每周同步进度；与开发对齐 taskId 同源数据方案，减少后期返工。',
        },
        {
          id: 'b3', name: '压力应对与问题解决', weight: 4, selfScore: 3.6,
          standard: '1.面对压力情绪稳定；\n2.多路径尝试；\n3.分析问题根因；\n4.资源不足时主动协调。',
          event: '5 月中下旬需求变更频繁（逾期独立页、领导评分 Grill），通过优先级矩阵与 HR 确认「先交主链路」，避免团队无效加班；对区块上限校验等争议点用原型演示快速达成共识。',
        },
        {
          id: 'b4', name: '目标承接与责任承担', weight: 3, selfScore: 3.5,
          standard: '1.快速理解上级目标并转化；\n2.资源不足主动协调；\n3.主动跟进；\n4.对交付负责。',
          event: '承接部门绩效信息化专项，未将模板匹配暂缓归因于 HR，而是输出演示方案与风险清单，保证 5 月评审节点不受影响。',
        },
      ],
      adjust: {
        plus: [{
          desc: '临时支援「6Q 夏季招生」活动信息化支持',
          detail: '5/18-5/20 连续 3 天支援活动组，完成报名页字段核对、异常订单排查 2 起，保障活动如期上线。已获活动组书面感谢。',
          selfScore: 2, approved: 2,
        }],
        minus: [{
          desc: '考勤异常：5/12 上午 09:04 打卡定位异常',
          detail: '因地铁故障导致迟到，已按制度提交说明并附交通截图。人才部抽查记录 1 次。',
          selfScore: -1, approved: -1,
        }],
      },
      selfSummary: '5 月工作围绕「绩效信息化 MVP 可评审交付」展开，整体进展符合预期。\n\n**主要成果：**\n1. PRD v1.0 完成并通过 2 轮跨部门评审，核心争议项收敛至 6 条；\n2. 双端 HTML 原型主链路可演示，覆盖员工填表、领导评分、HR 计划管理；\n3. 与 HR 完成 Grill 对齐，明确员工保密、区块上限校验、领导轻量评分等规则。\n\n**不足与改进：**\n- 模板匹配规则仍依赖 HR 确认，6 月需推动专项评审；\n- 季度评分与批量评仅占位，需排期迭代。\n\n**下月重点：** 见下月目标区（已按模板填写 4 项 KR 权重合计 100%）。',
      nextMonthKrs: [
        {
          o: '完成季度绩效评分页（上级 + 分管）原型，含 6Q3J 只读与面谈区块',
          smart: '6/20 前可演示；同人合并规则可配置演示；分管默认 OA。',
          weight: 28, standard: '通过 HR + 上级代表走查；文档更新 HANDOFF。',
          challenge: '季度表列多，需设计 OA 宽表与小程序折叠两种布局；依赖 HR 提供 6Q3J 演示数据。',
        },
        {
          o: '推动模板匹配规则评审闭环',
          smart: '6/15 前 HR 签字确认或明确兜底策略。',
          weight: 25, standard: '输出终版规则表；新建计划第 4 步可演示真实匹配。',
          challenge: '涉及办事处与全职两类人群、多职级，需 HR 与部门负责人联合评审。',
        },
        {
          o: '员工填表提交校验与上级评分校验规则统一',
          smart: 'R1/R2 规则在 PRD 与原型一致；员工端提交前自查。',
          weight: 22, standard: '校验文案清晰；与 Excel 模板公式一致。',
          challenge: '需开发评估前后端校验分工，产品先完成规则说明书。',
        },
        {
          o: '组织 1 次全链路 UAT（员工+领导+HR 角色剧本）',
          smart: '6/25 前完成；问题 48h 内登记。',
          weight: 25, standard: '剧本覆盖月表 happy path + 退回 + 逾期解锁。',
          challenge: '需协调三类角色时间，可能分批次走查。',
        },
      ],
    },
    'r-lm-202605': {
      header: { employee: '李明', dept: '信息部', role: '开发工程师', period: '2026年5月', submittedAt: '2026-05-27 18:05', mergedReview: true },
      coreKrs: [
        {
          id: 'v1', block: 'V', weight: 30,
          o: '完成绩效模块后端接口设计与核心 API 开发（任务、草稿、提交、上级评分）。',
          smart: '5/31 前完成 8 个核心接口；Swagger 文档齐全；与产品 taskId 方案一致。',
          standard: '接口评审通过；单测覆盖核心逻辑；联调无 P0 阻塞。',
          m: '完成 task/list、task/detail、draft/save、submit、supervisor/score 等 9 个接口。Swagger 已发布。与产品对齐区块上限服务端校验方案（待 6 月实现）。',
          selfScore: 27,
        },
        {
          id: 'v2', block: 'V', weight: 25,
          o: '绩效相关数据库表结构设计（计划、任务、评分、审计日志）。',
          smart: '5/25 前 ER 评审；支持月/季两种任务类型扩展。',
          standard: '符合公司 DB 规范；索引合理；可审计。',
          m: '输出 perf_plan、perf_task、perf_score、perf_audit 四表 ER，评审通过。补充草稿 JSON 存储与版本号字段，支持断点续填。',
          selfScore: 23,
        },
        {
          id: 'v3', block: 'V', weight: 20,
          o: '与前端（小程序/OA）联调绩效主链路 Mock 切换方案。',
          smart: '5/28 前联调通过原型演示路径；错误码统一。',
          standard: '联调记录完整；CORS/鉴权配置正确。',
          m: '当前原型仍用 localStorage，已输出《前后端联调清单》与 Postman 集合，6 月接入真实 API。完成鉴权中间件对领导评分权限校验 POC。',
          selfScore: 18,
        },
      ],
      regularKrs: [
        {
          id: 'x1', block: 'X', weight: 10,
          o: '代码评审与单元测试维护',
          smart: '月度 CR 响应 <24h；核心模块测试不下降。',
          standard: 'CR 意见闭环；测试报告归档。',
          m: '参与 CR 18 次，平均响应 6 小时。补充 perf 模块单测 12  case。',
          selfScore: 9,
        },
        {
          id: 'x2', block: 'X', weight: 5,
          o: '生产问题值班与故障复盘',
          smart: '值班 2 次；P1 30min 响应。',
          standard: '复盘文档 48h 内输出。',
          m: '值班 2 次，处理告警 3 起（均为非绩效模块）。协助复盘 1 起缓存穿透问题。',
          selfScore: 4.5,
        },
      ],
      behavior: [
        { id: 'b1', name: '团队建设与人才培养', weight: 4, selfScore: 3.8, standard: '规划培养计划；反馈辅导；经验分享。', event: '为实习生讲解 Git 分支策略与 PR 规范，整理《信息部开发 onboarding》1 篇。' },
        { id: 'b2', name: '跨部门协同', weight: 4, selfScore: 3.5, standard: '积极响应协同；尊重节奏；及时复盘。', event: '配合产品参加 HR 评审 2 次，现场评估「员工不可见上级分」的技术实现（字段级权限 + API 过滤）。' },
        { id: 'b3', name: '压力应对与问题解决', weight: 4, selfScore: 4, standard: '稳定应对；多路径尝试；根因分析。', event: '5/20 联调环境故障，4 小时内切换备用环境并完成验证，未阻塞产品走查。' },
        { id: 'b4', name: '目标承接与责任承担', weight: 3, selfScore: 3, standard: '理解转化目标；主动跟进；对交付负责。', event: '主动承担绩效 API 主 R，周报同步风险 3 项并给出缓解方案。' },
      ],
      adjust: {
        plus: [{ desc: '周末紧急修复考勤同步异常', detail: '5/25 加班 4h 修复第三方接口超时导致的数据延迟，恢复时间 02:30。', selfScore: 1.5, approved: 1.5 }],
        minus: [],
      },
      selfSummary: '本月聚焦绩效模块后端奠基：接口、表结构、权限 POC 均按时交付。原型阶段以前端 localStorage 为主，已准备好联调资产。6 月重点是接口上线与区块校验服务端落地。',
      nextMonthKrs: [
        { o: '绩效 API 接入前端原型并替换 localStorage', smart: '6/15 前主链路打通', weight: 35, standard: '提交/草稿/评分可端到端', challenge: '需前端配合改造 supervisor-score.js' },
        { o: '服务端实现 R1/R2/R3 校验', smart: '与产品规则一致', weight: 30, standard: '单元测试覆盖边界', challenge: '加减分规则需 HR 事项库数据' },
        { o: '性能测试：计划明细 5000 人筛选', smart: '6/30 前报告', weight: 35, standard: 'P95 < 500ms', challenge: '需 DBA 协助索引优化' },
      ],
    },
    'r-zs-2026q2': {
      header: { employee: '赵强', dept: '信息部', role: '后端工程师', period: '2026 Q2', submittedAt: '2026-06-28 14:00', mergedReview: false },
      coreKeyObjectives: [{
        id: 'ko-q-zs1', o: '绩效 API 与数据库落地',
        targets: [
          { id: 'q-zs-v1', block: 'V', weight: 30, smart: 'Q2 末完成 8 个核心接口与四表 ER 评审', standardTiers: [{ label: '业绩达成率 ≥ 100%', score: 30 }, { label: '100% > 业绩达成率 ≥ 90%', score: 24 }, { label: '90% > 业绩达成率 ≥ 80%', score: 18 }, { label: '80% > 业绩达成率 ≥ 70%', score: 12 }, { label: '业绩达成率 < 70%', score: 0 }], attachRules: '', m: 'Swagger 已发布；perf_task/perf_score 表评审通过。', selfScore: 27 },
          { id: 'q-zs-v2', block: 'V', weight: 28, smart: '6/30 前联调清单与 Postman 集合交付', standardTiers: [{ label: '业绩达成率 ≥ 100%', score: 28 }, { label: '100% > 业绩达成率 ≥ 90%', score: 22 }, { label: '90% > 业绩达成率 ≥ 80%', score: 17 }, { label: '80% > 业绩达成率 ≥ 70%', score: 11 }, { label: '业绩达成率 < 70%', score: 0 }], attachRules: '', m: '联调清单覆盖月/季填表与上级评主链路。', selfScore: 25 },
        ],
      }],
      regularKeyObjectives: [{
        id: 'ko-q-zs-x', o: '代码质量与值班',
        targets: [
          { id: 'q-zs-x1', block: 'X', weight: 18, smart: 'CR 响应 <24h；值班无 P1 超时', standardTiers: [{ label: '业绩达成率 ≥ 100%', score: 18 }, { label: '100% > 业绩达成率 ≥ 90%', score: 14 }, { label: '90% > 业绩达成率 ≥ 80%', score: 11 }, { label: '80% > 业绩达成率 ≥ 70%', score: 7 }, { label: '业绩达成率 < 70%', score: 0 }], attachRules: '', m: 'CR 平均 5h；值班 2 次。', selfScore: 16 },
          { id: 'q-zs-x2', block: 'X', weight: 14, smart: '单测覆盖 perf 核心模块', standardTiers: [{ label: '业绩达成率 ≥ 100%', score: 14 }, { label: '100% > 业绩达成率 ≥ 90%', score: 11 }, { label: '90% > 业绩达成率 ≥ 80%', score: 8 }, { label: '80% > 业绩达成率 ≥ 70%', score: 6 }, { label: '业绩达成率 < 70%', score: 0 }], attachRules: '', m: '补充单测 12 case。', selfScore: 12.5 },
        ],
      }],
      adjust: { plus: [], minus: [] },
      selfSummary: 'Q2 聚焦绩效后端奠基，接口与表结构按时交付。',
      nextSeasonKeyObjectives: [{ id: 'ko-q-zs-n', o: 'Q3 API 上线', targets: [{ id: 'q-zs-n1', block: 'next', weight: 50, smart: '替换 localStorage', standardTiers: [{ label: '≥100%', score: 50 }], attachRules: '' }, { id: 'q-zs-n2', block: 'next', weight: 50, smart: '区块校验服务端落地', standardTiers: [{ label: '≥100%', score: 50 }], attachRules: '' }] }],
      interview: { highlight: '接口设计文档完整', improve: '联调环境稳定性', plan: '7 月接入真实 API', support: '需 DBA Review 索引' },
    },
    'r-lm-2026q2': {
      header: { employee: '李明', dept: '信息部', role: '开发工程师', period: '2026 Q2', submittedAt: '2026-06-28 16:10', mergedReview: true },
      coreKeyObjectives: [{
        id: 'ko-q-lm1', o: '绩效模块后端开发',
        targets: [
          { id: 'q-lm-v1', block: 'V', weight: 32, smart: 'Q2 完成核心 API 8 个', standardTiers: [{ label: '≥100%', score: 32 }, { label: '≥90%', score: 26 }, { label: '≥80%', score: 19 }, { label: '≥70%', score: 13 }, { label: '<70%', score: 0 }], m: '9 个接口已交付。', selfScore: 29 },
          { id: 'q-lm-v2', block: 'V', weight: 26, smart: 'ER 评审与审计字段', standardTiers: [{ label: '≥100%', score: 26 }, { label: '≥90%', score: 21 }, { label: '≥80%', score: 16 }, { label: '≥70%', score: 10 }, { label: '<70%', score: 0 }], m: '四表 ER 通过。', selfScore: 24 },
        ],
      }],
      regularKeyObjectives: [{
        id: 'ko-q-lm-x', o: '协同与质量',
        targets: [
          { id: 'q-lm-x1', block: 'X', weight: 18, smart: 'CR 与单测', standardTiers: [{ label: '≥100%', score: 18 }, { label: '≥90%', score: 14 }, { label: '≥80%', score: 11 }, { label: '≥70%', score: 7 }, { label: '<70%', score: 0 }], m: 'CR 18 次。', selfScore: 16 },
          { id: 'q-lm-x2', block: 'X', weight: 14, smart: '值班响应', standardTiers: [{ label: '≥100%', score: 14 }, { label: '≥90%', score: 11 }, { label: '≥80%', score: 8 }, { label: '≥70%', score: 6 }, { label: '<70%', score: 0 }], m: '值班 2 次无延误。', selfScore: 12 },
        ],
      }],
      adjust: { plus: [{ desc: '周末紧急修复', detail: '考勤同步异常', selfScore: 1, approved: 1 }], minus: [] },
      selfSummary: 'Q2 后端主 R，API 与表结构按期交付。',
      nextSeasonKeyObjectives: [{ id: 'ko-q-lm-n', o: 'Q3 联调', targets: [{ id: 'q-lm-n1', block: 'next', weight: 100, smart: '端到端替换 Mock', standardTiers: [{ label: '≥100%', score: 100 }], attachRules: '' }] }],
      interview: { highlight: '主动承担主 R', improve: '文档同步', plan: '7 月联调', support: '—' },
    },
    'r-wf-2026q2': {
      header: { employee: '王芳', dept: '信息部', role: '产品专员', period: '2026 Q2', submittedAt: '2026-06-27 17:40', mergedReview: false },
      coreKeyObjectives: [{
        id: 'ko-q-wf1', o: '绩效信息化 MVP 可评审交付',
        targets: [
          { id: 'q-wf-v1', block: 'V', weight: 28, smart: 'Q2 末 PRD+双端原型主链路可演示', standardTiers: [{ label: '≥100%', score: 28 }, { label: '≥90%', score: 22 }, { label: '≥80%', score: 17 }, { label: '≥70%', score: 11 }, { label: '<70%', score: 0 }], attachRules: '每失误一次 -1分', m: 'PRD v1.0 两轮评审完成。', selfScore: 26 },
          { id: 'q-wf-v2', block: 'V', weight: 26, smart: 'Grill 决策与 Handoff 同步', standardTiers: [{ label: '≥100%', score: 26 }, { label: '≥90%', score: 21 }, { label: '≥80%', score: 16 }, { label: '≥70%', score: 10 }, { label: '<70%', score: 0 }], m: '20+ 页面原型交付。', selfScore: 24 },
        ],
      }, {
        id: 'ko-q-wf2', o: '制度与 IA 协同',
        targets: [
          { id: 'q-wf-v3', block: 'V', weight: 20, smart: '模板匹配规则草案', standardTiers: [{ label: '≥100%', score: 20 }, { label: '≥90%', score: 16 }, { label: '≥80%', score: 12 }, { label: '≥70%', score: 8 }, { label: '<70%', score: 0 }], m: 'GRILL_TEMPLATE 初稿完成。', selfScore: 18 },
        ],
      }],
      regularKeyObjectives: [{
        id: 'ko-q-wf-x', o: '跨部门协同',
        targets: [
          { id: 'q-wf-x1', block: 'X', weight: 10, smart: '24h 响应', standardTiers: [{ label: '≥100%', score: 10 }, { label: '≥90%', score: 8 }, { label: '≥80%', score: 6 }, { label: '≥70%', score: 4 }, { label: '<70%', score: 0 }], m: '会议 11 次。', selfScore: 9 },
          { id: 'q-wf-x2', block: 'X', weight: 6, smart: '文档沉淀', standardTiers: [{ label: '≥100%', score: 6 }, { label: '≥90%', score: 5 }, { label: '≥80%', score: 4 }, { label: '≥70%', score: 3 }, { label: '<70%', score: 0 }], m: 'Handoff 维护。', selfScore: 5.8 },
        ],
      }],
      adjust: { plus: [{ desc: '支援夏季招生信息化', detail: '3 天支援', selfScore: 2, approved: 2 }], minus: [{ desc: '考勤异常 1 次', detail: '已说明', selfScore: -1, approved: -1 }] },
      selfSummary: 'Q2 围绕 MVP 交付，原型与 PRD 符合预期。',
      nextSeasonKeyObjectives: [{ id: 'ko-q-wf-n', o: 'Q3 季度评分页', targets: [{ id: 'q-wf-n1', block: 'next', weight: 50, smart: '上级+分管分列', standardTiers: [{ label: '≥100%', score: 50 }] }, { id: 'q-wf-n2', block: 'next', weight: 50, smart: 'UAT 剧本', standardTiers: [{ label: '≥100%', score: 50 }] }] }],
      interview: { highlight: '跨部门评审组织到位', improve: '模板规则推进', plan: 'Q3 闭环匹配规则', support: '需 HR 联合评审' },
    },
    'r-hm-2026q2': {
      header: { employee: '韩梅', dept: '信息部', role: '测试工程师', period: '2026 Q2', submittedAt: '2026-06-27 11:00', mergedReview: false },
      coreKeyObjectives: [{
        id: 'ko-q-hm1', o: '绩效模块测试保障',
        targets: [
          { id: 'q-hm-v1', block: 'V', weight: 30, smart: 'Q2 完成绩效主链路测试用例 80+', standardTiers: [{ label: '≥100%', score: 30 }, { label: '≥90%', score: 24 }, { label: '≥80%', score: 18 }, { label: '≥70%', score: 12 }, { label: '<70%', score: 0 }], m: '用例 86 条，覆盖月/季填表。', selfScore: 28 },
          { id: 'q-hm-v2', block: 'V', weight: 28, smart: '自动化回归脚本 20 条', standardTiers: [{ label: '≥100%', score: 28 }, { label: '≥90%', score: 22 }, { label: '≥80%', score: 17 }, { label: '≥70%', score: 11 }, { label: '<70%', score: 0 }], m: 'Playwright 脚本 22 条。', selfScore: 26 },
        ],
      }],
      regularKeyObjectives: [{
        id: 'ko-q-hm-x', o: '缺陷与协同',
        targets: [
          { id: 'q-hm-x1', block: 'X', weight: 18, smart: 'P1 缺陷 24h 验证', standardTiers: [{ label: '≥100%', score: 18 }, { label: '≥90%', score: 14 }, { label: '≥80%', score: 11 }, { label: '≥70%', score: 7 }, { label: '<70%', score: 0 }], m: '验证 15 个 P1。', selfScore: 17 },
          { id: 'q-hm-x2', block: 'X', weight: 14, smart: '测试报告归档', standardTiers: [{ label: '≥100%', score: 14 }, { label: '≥90%', score: 11 }, { label: '≥80%', score: 8 }, { label: '≥70%', score: 6 }, { label: '<70%', score: 0 }], m: '4 份迭代报告。', selfScore: 12.2 },
        ],
      }],
      adjust: { plus: [], minus: [] },
      selfSummary: 'Q2 测试覆盖达标，支撑原型多轮走查。',
      nextSeasonKeyObjectives: [{ id: 'ko-q-hm-n', o: 'Q3 UAT', targets: [{ id: 'q-hm-n1', block: 'next', weight: 100, smart: '全链路 UAT 剧本', standardTiers: [{ label: '≥100%', score: 100 }] }] }],
      interview: { highlight: '走查问题闭环及时', improve: '自动化占比', plan: 'Q3 扩大自动化', support: '—' },
    },
  };

  function maxScore(weight) { return Number(weight) || 0; }

  function blockLabel(block) {
    if (block === 'V') return '核心V';
    if (block === 'X') return '常规X';
    return '行为';
  }

  function blockClass(block) {
    if (block === 'X') return 'block-tag--x';
    if (block === 'B') return 'block-tag--b';
    return '';
  }

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  var STD_TIER_LABELS = [
    '业绩达成率 ≥ 100%',
    '100% > 业绩达成率 ≥ 90%',
    '90% > 业绩达成率 ≥ 80%',
    '80% > 业绩达成率 ≥ 70%',
    '业绩达成率 < 70%',
  ];
  var STD_TIER_NUMS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

  function defaultStandardTiers(maxScore) {
    maxScore = parseFloat(maxScore) || 25;
    return STD_TIER_LABELS.map(function (label, i) {
      return { label: label, score: Math.round(maxScore * [1, 0.8, 0.6, 0.4, 0][i]) };
    });
  }

  function ensureKrStandardTiers(kr) {
    if (!kr) return;
    if (kr.standardTiers && kr.standardTiers.length) return;
    kr.standardTiers = defaultStandardTiers(kr.weight || 25);
  }

  function renderBehaviorStandardReadonly(standardText) {
    var lines = String(standardText || '').split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) return '<span class="score-empty">—</span>';
    var rows = lines.map(function (line, i) {
      var text = line.replace(/^\d+\.\s*/, '');
      return '<li class="std-tier-row std-tier-row--behavior">' +
        '<span class="std-tier-num">' + (STD_TIER_NUMS[i] || String(i + 1)) + '</span>' +
        '<span class="std-tier-label">' + esc(text) + '</span></li>';
    }).join('');
    return '<ul class="std-tier-list std-tier-list--readonly std-tier-list--behavior">' + rows + '</ul>';
  }

  function normalizeSubmission(sub) {
    if (!sub) return;
    (sub.coreKrs || []).forEach(ensureKrStandardTiers);
    (sub.regularKrs || []).forEach(ensureKrStandardTiers);
    (sub.nextMonthKrs || []).forEach(ensureKrStandardTiers);
  }

  Object.keys(SUBMISSIONS).forEach(function (k) { normalizeSubmission(SUBMISSIONS[k]); });

  /** 已提交的上级/分管分数（演示：上级已评完的任务） */
  var PRESET_SCORES = {
    'r-wf-2026q2': {
      scores: { 'q-wf-v1': 25, 'q-wf-v2': 23, 'q-wf-v3': 17, 'q-wf-x1': 8.5, 'q-wf-x2': 5.5 },
      adjustPlus: [2],
      adjustMinus: [-1],
      supervisorSubmitted: true,
    },
    'r-hm-2026q2': {
      scores: { 'q-hm-v1': 27, 'q-hm-v2': 25, 'q-hm-x1': 16, 'q-hm-x2': 11 },
      divisionScores: { 'q-hm-v1': 26, 'q-hm-v2': 24, 'q-hm-x1': 15.5, 'q-hm-x2': 10.5 },
      adjustPlus: [],
      adjustMinus: [],
      divisionAdjustPlus: [],
      divisionAdjustMinus: [],
      divisionFinalOverride: 86.1,
      supervisorSubmitted: true,
      divisionSubmitted: true,
    },
  };

  function getReviewTask(taskId) {
    return REVIEW_LIST.filter(function (t) { return t.id === taskId; })[0] || null;
  }

  function longTextHtml(text, clampChars) {
    if (!text) return '<span class="score-empty">—</span>';
    var safe = esc(text).replace(/\n/g, '<br>');
    if (!clampChars || text.length <= clampChars) {
      return '<div class="score-longtext">' + safe + '</div>';
    }
    var uid = 'lt-' + Math.random().toString(36).slice(2, 9);
    return '<div class="score-longtext-wrap">' +
      '<div class="score-longtext score-longtext--clamp" id="' + uid + '">' + safe + '</div>' +
      '<button type="button" class="score-longtext-toggle" data-target="' + uid + '">展开全文（' + text.length + ' 字）</button></div>';
  }

  function bindLongTextToggles(root) {
    (root || document).querySelectorAll('.score-longtext-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var el = document.getElementById(btn.dataset.target);
        if (!el) return;
        var open = el.classList.toggle('score-longtext--open');
        el.classList.toggle('score-longtext--clamp', !open);
        btn.textContent = open ? '收起' : '展开全文（' + el.textContent.length + ' 字）';
      });
    });
  }

  function renderStandardTiersReadonly(kr) {
    ensureKrStandardTiers(kr);
    var attach = renderAttachRulesReadonly(kr);
    if (kr.standardTiers && kr.standardTiers.length) {
      return '<div class="score-readonly-field score-readonly-field--std"><label>考核标准</label><ul class="std-tier-list std-tier-list--readonly">' +
        kr.standardTiers.map(function (t, i) {
          return '<li class="std-tier-row"><span class="std-tier-num">' + (['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'][i] || String(i + 1)) + '</span>' +
            '<span class="std-tier-label">' + t.label + '</span><span class="std-tier-colon">：</span>' +
            '<strong class="std-tier-score-read">' + t.score + '</strong><span class="std-tier-unit">分</span></li>';
        }).join('') + '</ul>' + attach + '</div>';
    }
    if (kr.standard) {
      return '<div class="score-readonly-field score-readonly-field--std"><label>考核标准</label>' + longTextHtml(kr.standard, 160) + attach + '</div>';
    }
    return attach ? '<div class="score-readonly-field score-readonly-field--std">' + attach + '</div>' : '';
  }

  function renderAttachRulesReadonly(kr) {
    var text = (kr.attachRules || '').trim();
    if (!text) return '';
    return '<div class="attach-rules-block attach-rules-block--readonly">' +
      '<span class="attach-rules-label">附加规则</span>' +
      '<span class="attach-rules-read">' + text + '</span></div>';
  }

  function renderKrReadonly(kr, isBehavior, opts) {
    opts = opts || {};
    if (isBehavior) {
      return '<div class="score-employee-readonly">' +
        '<div class="score-readonly-field"><label>考核标准 <span class="std-tier-hint">模板固定</span></label>' +
        renderBehaviorStandardReadonly(kr.standard) + '</div>' +
        '<div class="score-readonly-field"><label>关键事件 / 说明</label>' + longTextHtml(kr.event || kr.m, 180) + '</div></div>';
    }
    if (opts.l3Only) {
      return '<div class="score-employee-readonly">' +
        '<div class="score-readonly-field"><label>考核目标 SMART</label>' + longTextHtml(kr.smart, 160) + '</div>' +
        renderStandardTiersReadonly(kr) +
        '<div class="score-readonly-field"><label>关键成果 M</label>' + longTextHtml(kr.m, 200) + '</div></div>';
    }
    return '<div class="score-employee-readonly">' +
      '<div class="score-readonly-field"><label>关键目标 O</label>' + longTextHtml(kr.o, 120) + '</div>' +
      '<div class="score-readonly-field"><label>考核目标 SMART</label>' + longTextHtml(kr.smart, 160) + '</div>' +
      renderStandardTiersReadonly(kr) +
      '<div class="score-readonly-field"><label>关键成果 M</label>' + longTextHtml(kr.m, 200) + '</div></div>';
  }

  function resolveNextMonthGoals(sub) {
    if (sub.nextMonthKeyObjectives && sub.nextMonthKeyObjectives.length && window.PerfKrHierarchy) {
      return PerfKrHierarchy.flattenTargets(sub.nextMonthKeyObjectives, 'next');
    }
    return sub.nextMonthKrs || [];
  }

  function renderNextMonthGoalsHtml(krs) {
    if (!krs || !krs.length) return '<p class="score-empty">员工未填写下月目标</p>';
    return krs.map(function (g, i) {
      ensureKrStandardTiers(g);
      return '<div class="goal-item">' +
        '<div class="goal-item-head">目标 ' + (i + 1) + ' · KR 权重 ' + g.weight + '%</div>' +
        '<div class="score-readonly-field"><label>O · 关键目标</label>' + longTextHtml(g.o, 0) + '</div>' +
        '<div class="score-readonly-field"><label>SMART · 考核目标</label>' + longTextHtml(g.smart, 0) + '</div>' +
        renderStandardTiersReadonly(g) +
        (g.challenge ? '<div class="score-readonly-field"><label>存在挑战 / 需求资源</label>' + longTextHtml(g.challenge, 0) + '</div>' : '') +
        '</div>';
    }).join('');
  }

  function renderBehaviorRefHtml(sub) {
    return sub.behavior.map(function (b, i) {
      return '<div class="score-ref-kr-item"><div class="score-ref-kr-title">' + b.name + ' · 权重 ' + b.weight + '% · 自评 ' + sOut(b.selfScore) + ' 分</div>' +
        renderKrReadonly(Object.assign({}, b, { m: b.event }), true) + '</div>';
    }).join('');
  }

  function renderAdjustRefHtml(sub) {
    var html = '';
    if (sub.adjust.plus.length) {
      html += '<h4>加分申报</h4>' + sub.adjust.plus.map(function (r) {
        return '<div class="score-ref-kr-item"><div class="score-readonly-field"><label>事项</label>' + longTextHtml(r.desc, 0) + '</div>' +
          (r.detail ? '<div class="score-readonly-field"><label>说明</label>' + longTextHtml(r.detail, 0) + '</div>' : '') +
          '<div class="score-readonly-field"><label>自评加分</label>' + sOut(r.selfScore) + ' 分</div></div>';
      }).join('');
    }
    if (sub.adjust.minus.length) {
      html += '<h4>减分申报</h4>' + sub.adjust.minus.map(function (r) {
        return '<div class="score-ref-kr-item"><div class="score-readonly-field"><label>事项</label>' + longTextHtml(r.desc, 0) + '</div>' +
          (r.detail ? '<div class="score-readonly-field"><label>说明</label>' + longTextHtml(r.detail, 0) + '</div>' : '') +
          '<div class="score-readonly-field"><label>自评减分</label>' + sOut(r.selfScore) + ' 分</div></div>';
      }).join('');
    }
    if (!html) html = '<p class="score-empty">无加减分申报</p>';
    return html;
  }

  function renderMpReadonlyPanels(sub) {
    var empEl = document.getElementById('mp-employee-readonly');
    var nextEl = document.getElementById('mp-next-month-readonly');
    if (empEl) {
      empEl.innerHTML =
        '<details class="mp-readonly-fold" open><summary>自评总结</summary><div class="mp-readonly-body">' + longTextHtml(sub.selfSummary, 0) + '</div></details>' +
        '<details class="mp-readonly-fold"><summary>行为态度（4 项）</summary><div class="mp-readonly-body">' + renderBehaviorRefHtml(sub) + '</div></details>' +
        '<details class="mp-readonly-fold"><summary>加减分申报</summary><div class="mp-readonly-body">' + renderAdjustRefHtml(sub) + '</div></details>';
      bindLongTextToggles(empEl);
    }
    if (nextEl) {
      nextEl.innerHTML = '<div class="mp-readonly-tip">仅查看，无需确认或打分</div>' + renderNextMonthGoalsHtml(resolveNextMonthGoals(sub));
      bindLongTextToggles(nextEl);
    }
  }

  function renderMonthlyNextMonthRef(sub) {
    var el = document.getElementById('score-next-month-ref');
    if (!el) return;
    el.innerHTML = renderNextMonthGoalsHtml(resolveNextMonthGoals(sub));
    bindLongTextToggles(el);
  }

  function getDraftKey(taskId) { return 'oa-supervisor-draft-' + taskId; }

  function loadDraft(taskId) {
    try {
      var raw = localStorage.getItem(getDraftKey(taskId));
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveDraft(taskId, data) {
    localStorage.setItem(getDraftKey(taskId), JSON.stringify(data));
  }

  function clearDraft(taskId) {
    localStorage.removeItem(getDraftKey(taskId));
  }

  function defaultSupervisorState(sub) {
    var scores = {};
    var divisionScores = {};
    sub.coreKrs.concat(sub.regularKrs).forEach(function (kr) { scores[kr.id] = ''; divisionScores[kr.id] = ''; });
    (sub.behavior || []).forEach(function (b) { scores[b.id] = ''; divisionScores[b.id] = ''; });
    return {
      scores: scores,
      divisionScores: divisionScores,
      adjustPlus: sub.adjust.plus.map(function (r) { return r.approved != null ? r.approved : r.selfScore; }),
      adjustMinus: sub.adjust.minus.map(function (r) { return r.approved != null ? r.approved : r.selfScore; }),
      divisionAdjustPlus: sub.adjust.plus.map(function (r) { return r.approved != null ? r.approved : r.selfScore; }),
      divisionAdjustMinus: sub.adjust.minus.map(function (r) { return r.approved != null ? r.approved : r.selfScore; }),
      divisionFinalOverride: '',
      comment: '',
      dirty: false,
    };
  }

  function mergePresetIntoState(state, preset) {
    if (!preset) return state;
    Object.keys(preset.scores || {}).forEach(function (k) { state.scores[k] = preset.scores[k]; });
    Object.keys(preset.divisionScores || {}).forEach(function (k) { state.divisionScores[k] = preset.divisionScores[k]; });
    if (preset.adjustPlus) state.adjustPlus = preset.adjustPlus.slice();
    if (preset.adjustMinus) state.adjustMinus = preset.adjustMinus.slice();
    if (preset.divisionAdjustPlus) state.divisionAdjustPlus = preset.divisionAdjustPlus.slice();
    if (preset.divisionAdjustMinus) state.divisionAdjustMinus = preset.divisionAdjustMinus.slice();
    if (preset.divisionFinalOverride != null && preset.divisionFinalOverride !== '') {
      state.divisionFinalOverride = preset.divisionFinalOverride;
    }
    state.supervisorSubmitted = !!preset.supervisorSubmitted;
    state.divisionSubmitted = !!preset.divisionSubmitted;
    return state;
  }

  function getSupervisorState(taskId) {
    var sub = SUBMISSIONS[taskId];
    if (!sub) return null;
    var draft = loadDraft(taskId);
    if (draft) return draft;
    var state = defaultSupervisorState(sub);
    mergePresetIntoState(state, PRESET_SCORES[taskId]);
    return state;
  }

  function sumBlockScores(items, state, scoreField) {
    scoreField = scoreField || 'scores';
    var sum = 0;
    items.forEach(function (kr) {
      var v = parseFloat(state[scoreField][kr.id]);
      if (!isNaN(v)) sum += v;
    });
    return Math.round(sum * 10) / 10;
  }

  function calcTotals(sub, state, opts) {
    opts = opts || {};
    var scoreField = opts.scoreField || 'scores';
    var limits = opts.limits || BLOCK_LIMITS;
    var adjPlusKey = opts.adjustPlusKey || (scoreField === 'divisionScores' ? 'divisionAdjustPlus' : 'adjustPlus');
    var adjMinusKey = opts.adjustMinusKey || (scoreField === 'divisionScores' ? 'divisionAdjustMinus' : 'adjustMinus');
    var adjPlusArr = state[adjPlusKey] || state.adjustPlus;
    var adjMinusArr = state[adjMinusKey] || state.adjustMinus;
    var errors = { items: {}, coreOver: false, regularOver: false, behaviorOver: false, vxOver: false, workOver: false, adjust: {} };

    sub.coreKrs.forEach(function (kr) {
      var v = parseFloat(state[scoreField][kr.id]);
      if (isNaN(v)) return;
      var max = maxScore(kr.weight);
      if (v > max || v < 0) errors.items[kr.id] = true;
    });
    sub.regularKrs.forEach(function (kr) {
      var v = parseFloat(state[scoreField][kr.id]);
      if (isNaN(v)) return;
      var max = maxScore(kr.weight);
      if (v > max || v < 0) errors.items[kr.id] = true;
    });
    (sub.behavior || []).forEach(function (b) {
      var v = parseFloat(state[scoreField][b.id]);
      if (isNaN(v)) return;
      var max = maxScore(b.weight);
      if (v > max || v < 0) errors.items[b.id] = true;
    });

    var coreSum = sumBlockScores(sub.coreKrs, state, scoreField);
    var regularSum = sumBlockScores(sub.regularKrs, state, scoreField);
    var behaviorSum = (sub.behavior && sub.behavior.length) ? sumBlockScores(sub.behavior, state, scoreField) : 0;
    var vxSum = Math.round((coreSum + regularSum) * 10) / 10;
    var workSum = Math.round((coreSum + regularSum + behaviorSum) * 10) / 10;

    if (limits.V && coreSum > limits.V) errors.coreOver = true;
    if (limits.X && regularSum > limits.X) errors.regularOver = true;
    if (limits.B && behaviorSum > limits.B) errors.behaviorOver = true;
    var vxCap = limits.VX != null ? limits.VX : (limits.V + limits.X);
    if (vxSum > vxCap) errors.vxOver = true;
    if (workSum > limits.WORK) errors.workOver = true;

    var plusSum = 0, minusSum = 0;
    (adjPlusArr || []).forEach(function (v, i) {
      var n = parseFloat(v);
      if (isNaN(n)) return;
      if (n > ADJUST_LIMITS.plus || n < 0) errors.adjust['p' + i] = true;
      plusSum += n;
    });
    (adjMinusArr || []).forEach(function (v, i) {
      var n = parseFloat(v);
      if (isNaN(n)) return;
      if (n > 0) n = -n;
      if (Math.abs(n) > ADJUST_LIMITS.minus) errors.adjust['m' + i] = true;
      minusSum += n;
    });
    if (plusSum > ADJUST_LIMITS.plusTotal) errors.adjust.plusTotal = true;
    if (Math.abs(minusSum) > ADJUST_LIMITS.minusTotal) errors.adjust.minusTotal = true;

    var hasBlockError = errors.coreOver || errors.regularOver || errors.behaviorOver || errors.vxOver || errors.workOver;

    return {
      coreSum: coreSum,
      regularSum: regularSum,
      behaviorSum: behaviorSum,
      vxSum: vxSum,
      workSum: workSum,
      plusSum: plusSum,
      minusSum: minusSum,
      finalScore: Math.round((workSum + plusSum + minusSum) * 10) / 10,
      errors: errors,
      valid: !Object.keys(errors.items).length && !hasBlockError && !Object.keys(errors.adjust).length,
    };
  }

  function blockCapHtml(label, sum, limit, overKey, errors) {
    var over = errors[overKey];
    return '<div class="score-block-cap' + (over ? ' is-error' : '') + '" data-cap="' + overKey + '">' +
      label + '：<b>' + sOut(sum) + '</b> / ' + limit +
      (over ? '<span class="score-cap-warn">已超过上限 ' + limit + ' 分</span>' : '') +
      '</div>';
  }

  function renderSummaryHtml(totals, roleLabel, limits) {
    roleLabel = roleLabel || '上级';
    limits = limits || BLOCK_LIMITS;
    var e = totals.errors;
    var html = blockCapHtml('核心绩效' + roleLabel + '分', totals.coreSum, limits.V, 'coreOver', e) +
      blockCapHtml('常规绩效' + roleLabel + '分', totals.regularSum, limits.X, 'regularOver', e);
    if (limits.B) {
      html += blockCapHtml('行为态度' + roleLabel + '分', totals.behaviorSum, limits.B, 'behaviorOver', e);
    }
    var vxCap = limits.VX != null ? limits.VX : (limits.V + limits.X);
    html += '<div class="score-block-cap' + (e.vxOver ? ' is-error' : '') + '">核心+常规：<b>' + sOut(totals.vxSum) + '</b> / ' + vxCap +
      (e.vxOver ? '<span class="score-cap-warn">核心与常规合计超过上限</span>' : '') + '</div>' +
      '<div class="score-block-cap' + (e.workOver ? ' is-error' : '') + '">工作块合计：<b>' + sOut(totals.workSum) + '</b> / ' + limits.WORK +
      (e.workOver ? '<span class="score-cap-warn">工作块合计超过上限</span>' : '') + '</div>' +
      '<div class="score-summary-item">加减分：<b>' + (totals.plusSum >= 0 ? '+' : '') + sOut(totals.plusSum) + ' / ' + sOut(totals.minusSum) + '</b></div>' +
      '<div class="score-summary-item">核定总分：<b>' + sOut(totals.finalScore) + '</b></div>';
    return html;
  }

  /** 季度页 · 上级/分管并列小计（无行为块，上限 90） */
  function renderQuarterSummaryPanel(totals, roleLabel) {
    return '<div class="score-quarter-panel">' +
      '<div class="score-quarter-panel__title">' + roleLabel + ' · 区块小计</div>' +
      renderSummaryHtml(totals, roleLabel, QUARTER_BLOCK_LIMITS) +
      '</div>';
  }

  function calcSelfTotal(sub) {
    if (!sub) return null;
    var sum = 0;
    (sub.coreKrs || []).forEach(function (kr) { sum += parseFloat(kr.selfScore) || 0; });
    (sub.regularKrs || []).forEach(function (kr) { sum += parseFloat(kr.selfScore) || 0; });
    (sub.behavior || []).forEach(function (b) { sum += parseFloat(b.selfScore) || 0; });
    if (sub.adjust) {
      (sub.adjust.plus || []).forEach(function (r) { sum += parseFloat(r.selfScore) || 0; });
      (sub.adjust.minus || []).forEach(function (r) { sum += parseFloat(r.selfScore) || 0; });
    }
    return Math.round(sum * 100) / 100;
  }

  var reviewListSortDir = 'desc';

  function phaseLabel(p) {
    var map = {
      filling: ['填写中', 'q-tag'],
      pending_supervisor: ['待上级评', 'q-tag-orange'],
      pending_division: ['待分管核定', 'q-tag-orange'],
      pending_confirm: ['待确认', 'q-tag-blue'],
      completed: ['已完成', 'q-tag-green'],
    };
    return map[p] || [p, 'q-tag'];
  }

  function canEditDivisionTotal(row) {
    return LEADER_CONTEXT.isDivisionLeader && row.supervisorDone && row.phase === 'pending_division';
  }

  function getDeptRoster() {
    if (!LEADER_CONTEXT.isDivisionLeader) return [];
    return DEPT_ROSTER.filter(function (r) {
      return LEADER_CONTEXT.divisionDepts.indexOf(r.dept) >= 0;
    });
  }

  function findReviewTask(row) {
    if (row.taskId) {
      return REVIEW_LIST.filter(function (t) { return t.id === row.taskId; })[0] || null;
    }
    return REVIEW_LIST.filter(function (t) {
      return t.empNo === row.no || t.employee === row.name;
    })[0] || null;
  }

  function scoreHrefForTask(t, role) {
    if (!t) return '#';
    var href = t.type === 'month'
      ? 'supervisor-score-monthly.html?id=' + encodeURIComponent(t.id)
      : 'supervisor-score-quarterly.html?id=' + encodeURIComponent(t.id) +
        '&plan=' + encodeURIComponent(t.planId || '2026-Q2') +
        '&no=' + encodeURIComponent(t.empNo || '');
    if (role) href += '&role=' + encodeURIComponent(role);
    return href;
  }

  function isQuarterPendingDivision(r, t) {
    return t && t.type === 'quarter' && r && r.phase === 'pending_division' && r.supervisorDone;
  }

  function canDivisionAdjustTotal(r, t) {
    if (!LEADER_CONTEXT.isDivisionLeader || !r) return false;
    if (t && t.type === 'quarter') {
      return r.phase === 'pending_division' || (r.phase === 'pending_confirm' && r.adjusted);
    }
    return canEditDivisionTotal(r);
  }

  function buildUnifiedReviewRows() {
    if (!LEADER_CONTEXT.isDivisionLeader) {
      return REVIEW_LIST.map(function (t) {
        return { roster: null, reviewTask: t, selfTotal: t.selfTotal != null ? t.selfTotal : calcSelfTotal(SUBMISSIONS[t.id]) };
      });
    }
    var rows = getDeptRoster().map(function (r) {
      var reviewTask = findReviewTask(r);
      var selfTotal = r.selfTotal != null ? r.selfTotal : (reviewTask ? calcSelfTotal(SUBMISSIONS[reviewTask.id]) : null);
      return { roster: r, reviewTask: reviewTask, selfTotal: selfTotal };
    });
    var keyed = {};
    rows.forEach(function (item) {
      keyed[item.roster.no + '|' + item.roster.period] = item;
    });
    REVIEW_LIST.forEach(function (t) {
      if (LEADER_CONTEXT.divisionDepts.indexOf(t.dept) < 0) return;
      var exists = rows.some(function (item) {
        return item.reviewTask && item.reviewTask.id === t.id;
      });
      if (exists) return;
      var selfTotal = t.selfTotal != null ? t.selfTotal : calcSelfTotal(SUBMISSIONS[t.id]);
      rows.push({
        roster: {
          no: t.empNo || t.id,
          name: t.employee,
          dept: t.dept,
          role: t.role,
          period: t.period,
          phase: t.status === 'done' ? 'completed' : 'pending_supervisor',
          selfTotal: selfTotal,
          supervisorDone: false,
          systemTotal: null,
          finalTotal: null,
          taskId: t.id,
          taskType: t.type,
        },
        reviewTask: t,
        selfTotal: selfTotal,
      });
    });
    return rows;
  }

  function countLeaderPending() {
    if (!LEADER_CONTEXT.isDivisionLeader) {
      return REVIEW_LIST.filter(function (t) { return t.status !== 'done'; }).length;
    }
    var n = 0;
    buildUnifiedReviewRows().forEach(function (item) {
      if (item.reviewTask && item.reviewTask.status !== 'done') n++;
      if (item.roster && canEditDivisionTotal(item.roster)) n++;
    });
    return n;
  }

  function closeDivisionAdjustModal() {
    var m = document.getElementById('div-adjust-mask');
    if (m) m.classList.remove('is-open');
  }

  function openDivisionAdjustModal(row, onSaved) {
    var mask = document.getElementById('div-adjust-mask');
    if (!mask) {
      mask = document.createElement('div');
      mask.id = 'div-adjust-mask';
      mask.className = 'hr-transfer-modal-mask';
      document.body.appendChild(mask);
    }
    mask.innerHTML =
      '<div class="hr-transfer-modal" style="max-width:440px"><div class="hr-transfer-modal__head"><h3>分管核定总分 · ' + row.name + '</h3>' +
      '<button type="button" class="hr-transfer-modal__close" id="div-adj-close">×</button></div>' +
      '<div class="hr-transfer-modal__body">' +
      '<p class="hr-hint">不逐项评分；在系统汇总基础上直接改<strong>核定总得分</strong>。</p>' +
      '<dl class="proto-kv"><dt>系统汇总分</dt><dd><b>' + sOut(row.systemTotal) + '</b></dd></dl>' +
      '<div class="field"><label>分管核定总分</label><input type="number" step="0.01" id="div-adj-input" class="perf-score-input" value="' + (row.systemTotal || '') + '" /></div>' +
      '<p class="hr-hint">保存后将标记「分管已调整」，员工任务进入待确认。</p></div>' +
      '<div class="hr-transfer-modal__foot"><button type="button" class="q-btn" id="div-adj-cancel">取消</button>' +
      '<button type="button" class="q-btn q-btn-primary" id="div-adj-save">保存并完结待办</button></div></div>';
    mask.classList.add('is-open');
    mask.querySelector('#div-adj-close').onclick = closeDivisionAdjustModal;
    mask.querySelector('#div-adj-cancel').onclick = closeDivisionAdjustModal;
    mask.querySelector('#div-adj-save').onclick = function () {
      row.finalTotal = parseFloat(document.getElementById('div-adj-input').value);
      row.adjusted = true;
      row.phase = 'pending_confirm';
      alert('已核定 ' + sOut(row.finalTotal) + '（原型）· 员工进入待确认');
      closeDivisionAdjustModal();
      if (typeof onSaved === 'function') onSaved();
    };
    mask.onclick = function (e) { if (e.target === mask) closeDivisionAdjustModal(); };
    if (sf()) sf().bindAll(mask);
  }

  function renderReviewActions(item) {
    var r = item.roster;
    var t = item.reviewTask;
    var parts = [];
    var merged = (t && t.mergedReview) || (r && r.mergedReview) || (t && SUBMISSIONS[t.id] && SUBMISSIONS[t.id].header && SUBMISSIONS[t.id].header.mergedReview);

    if (t && t.type === 'quarter') {
      if (t.phase === 'pending_supervisor' || (t.status !== 'done' && t.phase !== 'pending_division' && t.phase !== 'pending_confirm')) {
        parts.push('<a class="q-btn q-btn-primary" style="padding:2px 10px;font-size:12px" href="' + scoreHrefForTask(t, 'supervisor') + '">' +
          (t.status === 'scoring' ? '继续评分' : '去评分') + '</a>');
      }
      if (isQuarterPendingDivision(r, t)) {
        parts.push('<a class="q-btn q-btn-primary" style="padding:2px 10px;font-size:12px" href="' + scoreHrefForTask(t, 'division') + '">分管逐项评</a>');
      }
      if (r && canDivisionAdjustTotal(r, t) && r.phase === 'pending_division') {
        parts.push('<button type="button" class="q-btn btn-div-adjust" data-no="' + r.no + '" style="padding:2px 10px;font-size:12px">改总分</button>');
      }
      if (t.phase === 'pending_confirm' || (r && r.phase === 'pending_confirm')) {
        parts.push('<a href="score-confirm.html?role=leader">查看确认</a>');
      }
    } else if (t && t.status !== 'done' && (r.phase === 'pending_supervisor' || !LEADER_CONTEXT.isDivisionLeader)) {
      var label = t.status === 'scoring' ? '继续评分' : '去评分';
      parts.push('<a class="q-btn q-btn-primary" style="padding:2px 10px;font-size:12px" href="' + scoreHrefForTask(t) + '">' + label + '</a>');
    }

    if (r && canEditDivisionTotal(r) && (!t || t.type === 'month')) {
      parts.push('<button type="button" class="q-btn q-btn-primary btn-div-adjust" data-no="' + r.no + '" style="padding:2px 10px;font-size:12px">改总分</button>');
    }
    if (r && r.phase === 'pending_confirm' && (!t || t.type === 'month')) {
      parts.push('<a href="score-confirm.html?role=leader">查看确认</a>');
    }
    if (r && r.no) {
      parts.push('<a href="hr-task-detail.html?no=' + r.no + '&from=results&mode=view">详情</a>');
    } else if (t) {
      parts.push('<a href="' + scoreHrefForTask(t, merged ? 'supervisor' : null) + '">详情</a>');
    }
    return parts.length ? parts.join(' · ') : '<span class="muted">—</span>';
  }

  function updateReviewListChrome(opts) {
    opts = opts || {};
    var isDiv = LEADER_CONTEXT.isDivisionLeader;
    var tip = document.getElementById('review-list-tip');
    if (tip && !opts.preview) {
      tip.className = isDiv ? 'perf-tip perf-tip-blue' : 'perf-tip perf-tip-orange';
      tip.innerHTML = isDiv
        ? '📋 作为<strong>分管领导</strong>：月度上级评完后<strong>改核定总分</strong>；季度可<strong>逐项评</strong>或<strong>改总分</strong>。兼任直接上级时「去评分」一次（合并评）。'
        : '📋 下属已提交的考核任务在此评分。列表 → 评分页 → 提交后返回列表。';
    }
    var thead = document.getElementById('review-list-thead');
    if (thead && !opts.preview) {
      var mode = isDiv ? 'division' : 'supervisor';
      if (thead.dataset.mode !== mode) {
        thead.dataset.mode = mode;
        thead.innerHTML = isDiv
          ? '<tr><th>员工</th><th>考核期</th><th id="review-th-self-sort" class="num" style="cursor:pointer;user-select:none" title="点击切换排序">自评总分 ↓</th><th>状态</th><th class="num">核定总分</th><th>操作</th></tr>'
          : '<tr><th>下属</th><th>考核期</th><th>提交时间</th><th id="review-th-self-sort" style="cursor:pointer;user-select:none" title="点击切换排序">自评总分 ↓</th><th>状态</th><th>操作</th></tr>';
      }
    }
    var badge = document.getElementById('lead-tab-badge');
    if (badge) {
      var n = countLeaderPending();
      badge.textContent = String(n);
      badge.style.display = n > 0 ? '' : 'none';
    }
  }

  function renderReviewList(container, opts) {
    opts = opts || {};
    var el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;
    updateReviewListChrome(opts);
    var statusMap = { pending: ['待评', 'q-tag-orange'], scoring: ['评分中', 'q-tag-blue'], done: ['已评', 'q-tag-green'] };
    var rows = buildUnifiedReviewRows().sort(function (a, b) {
      var av = a.selfTotal == null ? -1 : a.selfTotal;
      var bv = b.selfTotal == null ? -1 : b.selfTotal;
      return reviewListSortDir === 'desc' ? bv - av : av - bv;
    });
    if (opts.preview) rows = rows.slice(0, 5);

    if (LEADER_CONTEXT.isDivisionLeader) {
      el.innerHTML = rows.map(function (item) {
        var r = item.roster;
        var st = phaseLabel(r.phase);
        var selfCell = item.selfTotal != null ? '<b>' + sOut(item.selfTotal) + '</b>' : '—';
        var totalCell = r.finalTotal != null
          ? '<b>' + sOut(r.finalTotal) + '</b>' + (r.adjusted ? ' <span class="q-tag q-tag-orange">已调整</span>' : '')
          : (r.systemTotal != null ? '<span class="muted">' + sOut(r.systemTotal) + '（待核定）</span>' : '—');
        var periodLabel = r.period + (r.taskType === 'quarter' ? ' 季度' : (r.taskType === 'month' ? ' 月度' : ''));
        return '<tr><td><b>' + r.name + '</b><br><small class="muted">' + r.no + ' · ' + r.role + '</small></td>' +
          '<td>' + periodLabel + '</td>' +
          '<td class="num">' + selfCell + '</td>' +
          '<td><span class="q-tag ' + st[1] + '">' + st[0] + '</span></td>' +
          '<td class="num">' + totalCell + '</td>' +
          '<td>' + renderReviewActions(item) + '</td></tr>';
      }).join('');
    } else {
      el.innerHTML = rows.map(function (item) {
        var t = item.reviewTask;
        var st = statusMap[t.status] || ['待评', 'q-tag'];
        var selfTotal = item.selfTotal;
        var selfCell = selfTotal != null ? '<b>' + sOut(selfTotal) + '</b>' : '—';
        return '<tr>' +
          '<td><div class="perf-task-cell"><span class="perf-task-icon perf-task-icon--' + (t.type === 'quarter' ? 'quarter' : 'month') + '">' + (t.type === 'quarter' ? '季' : '月') + '</span>' +
          '<div><b>' + t.employee + ' · ' + t.dept + '</b><small>' + t.role + '</small></div></div></td>' +
          '<td>' + t.period + ' ' + (t.type === 'quarter' ? '季度' : '月度') + '</td>' +
          '<td>' + (t.submittedAt || '—') + '</td>' +
          '<td style="text-align:center">' + selfCell + '</td>' +
          '<td><span class="q-tag ' + st[1] + '">' + st[0] + '</span></td>' +
          '<td><a class="q-btn q-btn-primary" style="padding:2px 12px;font-size:12px" href="' + scoreHrefForTask(t) + '">' + (t.status === 'done' ? '查看' : '去评分') + '</a></td></tr>';
      }).join('');
    }

    el.querySelectorAll('.btn-div-adjust').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = DEPT_ROSTER.filter(function (x) { return x.no === btn.dataset.no; })[0];
        if (row) openDivisionAdjustModal(row, function () { renderReviewList(el, opts); });
      });
    });

    var sortHost = document.getElementById('review-list-sort-host');
    if (sortHost && !sortHost.dataset.bound) {
      sortHost.dataset.bound = '1';
      sortHost.addEventListener('click', function (e) {
        var th = e.target.closest('#review-th-self-sort');
        if (!th) return;
        reviewListSortDir = reviewListSortDir === 'desc' ? 'asc' : 'desc';
        th.textContent = '自评总分 ' + (reviewListSortDir === 'desc' ? '↓' : '↑');
        renderReviewList(el, opts);
      });
    }
  }

  function initOaMonthlyScorePage() {
    var params = new URLSearchParams(location.search);
    var taskId = params.get('id') || 'r-wf-202605';
    var sub = SUBMISSIONS[taskId];
    if (!sub) { document.body.innerHTML = '<p style="padding:24px">任务不存在</p>'; return; }
    if (window.PerfKrHierarchy) {
      PerfKrHierarchy.ensureSubmission(sub);
      sub.coreKrs = PerfKrHierarchy.flattenTargets(sub.coreKeyObjectives, 'V');
      sub.regularKrs = PerfKrHierarchy.flattenTargets(sub.regularKeyObjectives, 'X');
    }

    var state = getSupervisorState(taskId);
    var listEl = document.getElementById('score-kr-list');
    var summaryEl = document.getElementById('score-summary');
    var formDirty = false;

    function markDirty() {
      formDirty = true;
      state.dirty = true;
    }

    function singleKrCard(kr, sec, isBehavior, l3Only) {
      var smartPreview = (kr.smart || '').length > 28 ? (kr.smart || '').slice(0, 28) + '…' : (kr.smart || '考核目标');
      return '<div class="score-kr-card" data-id="' + kr.id + '" data-block="' + sec.key + '">' +
        '<button type="button" class="score-kr-head">' +
        '<span class="block-tag ' + blockClass(kr.block || sec.key) + '">' + blockLabel(kr.block || sec.key) + '</span>' +
        '<span class="title">考核目标 · 权重' + kr.weight + '% · 自评' + sOut(kr.selfScore) + '</span>' +
        '<span class="chevron">▼</span></button>' +
        '<div class="score-kr-body">' +
        renderKrReadonly(kr, isBehavior, { l3Only: !!l3Only }) +
        '<div class="score-score-row-title">上级评分（三级）</div>' +
        '<div class="score-row">' +
        '<div><label>员工自评</label><div class="readonly">' + sOut(kr.selfScore) + ' 分</div></div>' +
        '<div><label>上级分 ★</label><input type="number" step="0.01" class="perf-score-input" data-perf-score min="0" data-score-id="' + kr.id + '" data-block="' + sec.key + '" data-max="' + kr.weight + '" value="' + sIn(state.scores[kr.id]) + '" placeholder="0~' + kr.weight + '" />' +
        '<div class="max-hint">单项上限 ' + kr.weight + ' 分</div></div>' +
        '<div><label>综合分预览</label><div class="readonly composite-' + kr.id + '">—</div></div>' +
        '</div></div></div>';
    }

    function buildKrCards() {
      var sections = [
        { key: 'V', title: '核心绩效 V%', cap: BLOCK_LIMITS.V, koKey: 'coreKeyObjectives', items: sub.coreKrs.map(function (k) { return Object.assign({}, k, { block: 'V' }); }) },
        { key: 'X', title: '常规绩效 X%', cap: BLOCK_LIMITS.X, koKey: 'regularKeyObjectives', items: sub.regularKrs.map(function (k) { return Object.assign({}, k, { block: 'X' }); }) },
        { key: 'B', title: '行为态度 15%', cap: BLOCK_LIMITS.B, items: sub.behavior.map(function (b) { return { id: b.id, block: 'B', o: b.name, weight: b.weight, m: b.event, selfScore: b.selfScore, standard: b.standard, event: b.event }; }) },
      ];
      listEl.innerHTML = sections.map(function (sec) {
        var isBehavior = sec.key === 'B';
        var cards;
        if (!isBehavior && window.PerfKrHierarchy && sub[sec.koKey] && sub[sec.koKey].length) {
          var badge = PerfKrHierarchy.levelBadge;
          cards = sub[sec.koKey].map(function (ko, ki) {
            var koHead = '<div class="score-ko-group score-ko-group--l2"><div class="score-ko-head">' +
              (badge ? badge('l2', 'L2') : '') +
              '<span class="score-ko-label">关键目标 ' + (ki + 1) + '</span>' +
              '<span class="ko-weight-sum-badge">权重 ' + (window.PerfKrHierarchy ? PerfKrHierarchy.sumKoTargets(ko).toFixed(1) : '0') + '%</span>' +
              '<div class="score-ko-o">' + (ko.o || '—') + '</div>' +
              '</div><div class="score-ko-targets">';
            var targetCards = (ko.targets || []).map(function (t) {
              return singleKrCard(Object.assign({}, t, { block: sec.key }), sec, false, true);
            }).join('');
            return koHead + targetCards + '</div></div>';
          }).join('');
        } else {
          cards = sec.items.map(function (kr) { return singleKrCard(kr, sec, isBehavior); }).join('');
        }
        return '<div class="score-block-group" data-block-group="' + sec.key + '">' +
          '<div class="score-block-head">' + sec.title + ' <span class="score-block-limit">区块上限 ' + sec.cap + ' 分</span></div>' +
          '<div class="score-block-cap-line" data-block-cap-line="' + sec.key + '"></div>' +
          cards + '</div>';
      }).join('');

      var firstCard = listEl.querySelector('.score-kr-card');
      if (firstCard) firstCard.classList.add('is-open');

      listEl.querySelectorAll('.score-kr-head').forEach(function (btn) {
        btn.addEventListener('click', function () {
          btn.closest('.score-kr-card').classList.toggle('is-open');
        });
      });
      listEl.querySelectorAll('input[data-score-id]').forEach(function (inp) {
        inp.addEventListener('input', function () { markDirty(); refresh(); });
      });
      bindLongTextToggles(listEl);
    }

    function updateSubmitButton(supTotals) {
      var btn = document.getElementById('btn-submit');
      if (!btn) return;
      btn.disabled = !supTotals.valid;
    }

    function updateBlockCapLines(totals) {
      var e = totals.errors;
      var map = { V: { sum: totals.coreSum, limit: BLOCK_LIMITS.V, over: e.coreOver }, X: { sum: totals.regularSum, limit: BLOCK_LIMITS.X, over: e.regularOver }, B: { sum: totals.behaviorSum, limit: BLOCK_LIMITS.B, over: e.behaviorOver } };
      Object.keys(map).forEach(function (key) {
        var line = listEl.querySelector('[data-block-cap-line="' + key + '"]');
        if (!line) return;
        var m = map[key];
        line.className = 'score-block-cap-line' + (m.over ? ' is-error' : '');
        line.innerHTML = '本区块上级分合计：<b>' + sOut(m.sum) + '</b> / ' + m.limit +
          (m.over ? ' <span class="score-cap-warn">已超过上限 ' + m.limit + ' 分</span>' : '');
      });
      listEl.querySelectorAll('.score-block-group').forEach(function (g) {
        var key = g.dataset.blockGroup;
        var over = key === 'V' ? e.coreOver : key === 'X' ? e.regularOver : e.behaviorOver;
        g.classList.toggle('is-error', !!over);
      });
    }

    function refresh() {
      listEl.querySelectorAll('input[data-score-id]').forEach(function (inp) {
        state.scores[inp.dataset.scoreId] = inp.value;
      });
      var totals = calcTotals(sub, state);
      listEl.querySelectorAll('input[data-score-id]').forEach(function (inp) {
        var id = inp.dataset.scoreId;
        var v = parseFloat(inp.value);
        var err = totals.errors.items[id];
        inp.classList.toggle('is-error', !!err);
        inp.closest('.score-kr-card').classList.toggle('is-error', !!err);
        var comp = inp.closest('.score-kr-body').querySelector('.composite-' + id);
        if (comp && !isNaN(v)) {
          var self = 0;
          sub.behavior.forEach(function (b) { if (b.id === id) self = parseFloat(b.selfScore) || 0; });
          sub.coreKrs.concat(sub.regularKrs).forEach(function (k) { if (k.id === id) self = parseFloat(k.selfScore) || 0; });
          comp.textContent = sOut(self * 0.2 + v * 0.8);
        }
      });
      updateBlockCapLines(totals);
      var hasBlockErr = totals.errors.coreOver || totals.errors.regularOver || totals.errors.behaviorOver || totals.errors.vxOver || totals.errors.workOver;
      summaryEl.classList.toggle('is-error', hasBlockErr);
      summaryEl.innerHTML = renderSummaryHtml(totals, '上级');
      updateSubmitButton(totals);
    }

    buildKrCards();

    var adjPlusEl = document.getElementById('adjust-plus-body');
    var adjMinusEl = document.getElementById('adjust-minus-body');
    adjPlusEl.innerHTML = sub.adjust.plus.length ? sub.adjust.plus.map(function (r, i) {
      return '<tr><td><div class="score-adjust-desc">' + longTextHtml(r.desc, 80) + (r.detail ? '<div class="score-adjust-detail">' + longTextHtml(r.detail, 120) + '</div>' : '') + '</div></td><td>' + sOut(r.selfScore) + '</td><td><input type="number" step="0.01" class="perf-score-input" data-perf-score data-adj="plus" data-idx="' + i + '" value="' + sIn(state.adjustPlus[i]) + '" /></td></tr>';
    }).join('') : '<tr><td colspan="3" class="score-empty">无加分申报</td></tr>';
    adjMinusEl.innerHTML = sub.adjust.minus.length ? sub.adjust.minus.map(function (r, i) {
      return '<tr><td><div class="score-adjust-desc">' + longTextHtml(r.desc, 80) + (r.detail ? '<div class="score-adjust-detail">' + longTextHtml(r.detail, 120) + '</div>' : '') + '</div></td><td>' + sOut(r.selfScore) + '</td><td><input type="number" step="0.01" class="perf-score-input" data-perf-score data-adj="minus" data-idx="' + i + '" value="' + sIn(state.adjustMinus[i]) + '" /></td></tr>';
    }).join('') : '<tr><td colspan="3" class="score-empty">无减分申报</td></tr>';
    bindLongTextToggles(document.querySelector('.q-card-panel'));
    document.querySelectorAll('[data-adj]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var idx = parseInt(inp.dataset.idx, 10);
        if (inp.dataset.adj === 'plus') state.adjustPlus[idx] = inp.value;
        else state.adjustMinus[idx] = inp.value;
        markDirty();
        refresh();
      });
    });

    var commentEl = document.getElementById('score-comment');
    if (commentEl) {
      commentEl.value = state.comment || '';
      commentEl.addEventListener('input', function (e) {
        state.comment = e.target.value;
        markDirty();
      });
    }

    renderMonthlyNextMonthRef(sub);

    document.getElementById('score-header-info').innerHTML =
      '<h2>' + sub.header.employee + ' · ' + sub.header.period + ' 月度绩效考核</h2>' +
      '<div class="score-header-meta">' +
      '<span>部门：' + sub.header.dept + '</span><span>岗位：' + sub.header.role + '</span>' +
      '<span>员工提交：' + sub.header.submittedAt + '</span></div>';

    refresh();

    if (sf()) sf().bindAll(document.querySelector('.q-card-panel') || document.body);

    document.getElementById('btn-back').addEventListener('click', function (e) {
      if (!formDirty) return;
      e.preventDefault();
      document.getElementById('leave-modal').classList.add('is-open');
    });

    document.getElementById('leave-save').addEventListener('click', function () {
      saveDraft(taskId, state);
      REVIEW_LIST.forEach(function (t) { if (t.id === taskId) t.status = 'scoring'; });
      location.href = 'supervisor-review-list.html';
    });
    document.getElementById('leave-discard').addEventListener('click', function () {
      location.href = 'supervisor-review-list.html';
    });
    document.getElementById('leave-cancel').addEventListener('click', function () {
      document.getElementById('leave-modal').classList.remove('is-open');
    });

    document.getElementById('btn-return-all').addEventListener('click', function () {
      var reason = prompt('请输入退回原因（退回至员工填表）：');
      if (reason) { alert('已退回至员工（原型演示）'); location.href = 'supervisor-review-list.html'; }
    });

    document.getElementById('btn-submit').addEventListener('click', function () {
      var totals = calcTotals(sub, state);
      if (!totals.valid) { alert('请修正上级评分明细标红项后再提交'); return; }
      clearDraft(taskId);
      REVIEW_LIST.forEach(function (t) { if (t.id === taskId) t.status = 'done'; });
      alert('上级评分已提交。分管领导可在「待我审核」核定总分；员工与直接上级将进入「待确认」阶段。');
      location.href = 'supervisor-review-list.html';
    });
  }

  function initMpMonthlyScorePage() {
    var params = new URLSearchParams(location.search);
    var taskId = params.get('id') || 'r-wf-202605';
    var sub = SUBMISSIONS[taskId];
    if (!sub) {
      document.body.innerHTML = '<p style="padding:24px">任务不存在</p>';
      return;
    }
    var state = getSupervisorState(taskId);
    var listEl = document.getElementById('mp-score-list');
    if (!listEl) return;

    var titleEl = document.querySelector('.mp-subnav .title');
    if (titleEl) titleEl.textContent = sub.header.employee + ' · ' + sub.header.period + ' · 评分';

    var sections = [
      { key: 'V', title: '核心 V · 上限' + BLOCK_LIMITS.V, items: sub.coreKrs.map(function (k) { return Object.assign({}, k, { block: 'V' }); }) },
      { key: 'X', title: '常规 X · 上限' + BLOCK_LIMITS.X, items: sub.regularKrs.map(function (k) { return Object.assign({}, k, { block: 'X' }); }) },
      { key: 'B', title: '行为 · 上限' + BLOCK_LIMITS.B, items: sub.behavior.map(function (b) { return { id: b.id, o: b.name, weight: b.weight, selfScore: b.selfScore, block: 'B', standard: b.standard, event: b.event, m: b.event }; }) },
    ];

    listEl.innerHTML = sections.map(function (sec) {
      var isBehavior = sec.key === 'B';
      return '<div class="mp-score-section" data-mp-block="' + sec.key + '">' +
        '<div class="mp-score-section-title">' + sec.title + '</div>' +
        '<div class="mp-score-section-cap" data-mp-cap="' + sec.key + '"></div>' +
        sec.items.map(function (kr) {
          var titleShort = kr.o.length > 16 ? kr.o.slice(0, 16) + '…' : kr.o;
          return '<div class="mp-score-kr" data-id="' + kr.id + '">' +
            '<button type="button" class="mp-score-kr-head">' +
            '<span>' + blockLabel(kr.block || 'V') + ' · ' + titleShort + '</span>' +
            '<span style="margin-left:auto;color:#999">≤' + kr.weight + '</span></button>' +
            '<div class="mp-score-kr-body">' +
            renderKrReadonly(kr, isBehavior) +
            '<div class="mp-score-input-label">员工自评 ' + sOut(kr.selfScore) + ' · 上级分</div>' +
            '<input class="mp-score-input perf-score-input" type="number" step="0.01" data-perf-score data-score-id="' + kr.id + '" data-max="' + kr.weight + '" value="' + sIn(state.scores[kr.id]) + '" placeholder="0~' + kr.weight + '" />' +
            '</div></div>';
        }).join('') + '</div>';
    }).join('');

    bindLongTextToggles(listEl);
    renderMpReadonlyPanels(sub);

    listEl.querySelectorAll('.mp-score-kr-head').forEach(function (btn) {
      btn.addEventListener('click', function () { btn.closest('.mp-score-kr').classList.toggle('is-open'); });
    });

    function refresh() {
      listEl.querySelectorAll('.mp-score-input').forEach(function (inp) {
        state.scores[inp.dataset.scoreId] = inp.value;
      });
      var totals = calcTotals(sub, state);
      var e = totals.errors;
      var capMap = { V: { sum: totals.coreSum, limit: BLOCK_LIMITS.V, over: e.coreOver }, X: { sum: totals.regularSum, limit: BLOCK_LIMITS.X, over: e.regularOver }, B: { sum: totals.behaviorSum, limit: BLOCK_LIMITS.B, over: e.behaviorOver } };
      Object.keys(capMap).forEach(function (key) {
        var capEl = listEl.querySelector('[data-mp-cap="' + key + '"]');
        if (!capEl) return;
        var m = capMap[key];
        capEl.className = 'mp-score-section-cap' + (m.over ? ' is-error' : '');
        capEl.textContent = '区块合计 ' + sOut(m.sum) + '/' + m.limit + (m.over ? ' · 已超过上限！' : '');
      });
      var bar = document.getElementById('mp-score-bar');
      var hasErr = e.coreOver || e.regularOver || e.behaviorOver || e.workOver;
      bar.classList.toggle('is-error', hasErr);
      bar.innerHTML = '核心 <b>' + sOut(totals.coreSum) + '</b>/' + BLOCK_LIMITS.V +
        ' · 常规 <b>' + sOut(totals.regularSum) + '</b>/' + BLOCK_LIMITS.X +
        ' · 合计 <b>' + sOut(totals.workSum) + '</b>/100' +
        (e.coreOver ? ' <span style="color:#ff4d4f">核心超限</span>' : '') +
        (e.regularOver ? ' <span style="color:#ff4d4f">常规超限</span>' : '');
      listEl.querySelectorAll('.mp-score-input').forEach(function (inp) {
        var err = totals.errors.items[inp.dataset.scoreId];
        inp.classList.toggle('is-error', !!err);
        inp.closest('.mp-score-kr').classList.toggle('is-error', !!err);
      });
    }
    listEl.querySelectorAll('.mp-score-input').forEach(function (inp) {
      inp.addEventListener('input', refresh);
    });
    refresh();
    if (sf()) sf().bindAll(listEl);

    document.getElementById('mp-btn-submit').addEventListener('click', function () {
      var totals = calcTotals(sub, state);
      if (!totals.valid) { alert('请修正标红项（含区块上限）'); return; }
      alert('已提交，返回列表');
      location.href = 'task-list.html?tab=leader';
    });
  }

  function calcQuarterComposite(sub, supFinal, divFinal) {
    var selfT = calcSelfTotal(sub) || 0;
    return Math.round((selfT * 0.2 + supFinal * 0.4 + divFinal * 0.4) * 100) / 100;
  }

  function initOaQuarterlyScorePage() {
    var params = new URLSearchParams(location.search);
    var taskId = params.get('id') || 'r-zs-2026q2';
    var planId = params.get('plan') || '2026-Q2';
    var empNo = params.get('no') || 'E10036';
    var role = params.get('role') || 'supervisor';
    var task = getReviewTask(taskId);
    var sub = SUBMISSIONS[taskId];
    if (!sub) { document.body.innerHTML = '<p style="padding:24px">任务不存在</p>'; return; }
    if (task) {
      if (task.empNo) empNo = task.empNo;
      if (task.planId) planId = task.planId;
    }
    if (window.PerfKrHierarchy) {
      PerfKrHierarchy.ensureSubmission(sub);
      sub.coreKrs = PerfKrHierarchy.flattenTargets(sub.coreKeyObjectives, 'V');
      sub.regularKrs = PerfKrHierarchy.flattenTargets(sub.regularKeyObjectives, 'X');
    }

    var mergedReview = !!(task && task.mergedReview) || !!sub.header.mergedReview;
    var phase = (task && task.phase) || 'pending_supervisor';
    var readonly = phase === 'pending_confirm' || (task && task.status === 'done' && phase !== 'pending_division');
    var supervisorDone = !!(task && task.supervisorDone) || !!(PRESET_SCORES[taskId] && PRESET_SCORES[taskId].supervisorSubmitted);

    if (role === 'division' && !supervisorDone && !mergedReview) {
      role = 'division';
    }

    var canEditSup = !readonly && role === 'supervisor' && (phase === 'pending_supervisor' || mergedReview);
    var canEditDiv = !readonly && role === 'division' && supervisorDone && phase === 'pending_division';
    var canEditMerged = !readonly && mergedReview && role === 'supervisor' && phase === 'pending_supervisor';
    var canEditDivCol = canEditDiv || canEditMerged;
    var canEditSupCol = canEditSup || canEditMerged;

    if (role === 'division' && !supervisorDone && !readonly) {
      canEditDivCol = false;
    }

    var state = getSupervisorState(taskId);
    var listEl = document.getElementById('score-kr-list');
    var summaryEl = document.getElementById('score-summary');
    var formDirty = false;

    function markDirty() {
      formDirty = true;
      state.dirty = true;
    }

    function scoreInputHtml(kr, col, editable, mirror) {
      var field = col === 'div' ? 'divisionScores' : 'scores';
      var val = state[field][kr.id];
      var dis = editable ? '' : ' disabled readonly';
      var cls = 'perf-score-input' + (col === 'div' ? ' score-input-div' : ' score-input-sup');
      var mirrorAttr = mirror ? ' data-mirror-score="1"' : '';
      return '<input type="number" step="0.01" class="' + cls + '" data-perf-score data-score-id="' + kr.id + '" data-score-col="' + col + '" data-max="' + kr.weight + '" value="' + sIn(val) + '" placeholder="0~' + kr.weight + '"' + dis + mirrorAttr + ' />';
    }

    function singleQuarterKrCard(kr, sec, isBehavior, l3Only) {
      var smartPreview = (kr.smart || kr.o || '').length > 28 ? (kr.smart || kr.o || '').slice(0, 28) + '…' : (kr.smart || kr.o || '考核目标');
      var divCell = mergedReview
        ? scoreInputHtml(kr, 'sup', canEditMerged, true)
        : (canEditDivCol
          ? scoreInputHtml(kr, 'div', true, false)
          : '<div class="readonly score-readonly-val">' + (state.divisionScores[kr.id] !== '' ? sOut(state.divisionScores[kr.id]) : '—') + '</div>');
      var supCell = canEditSupCol
        ? scoreInputHtml(kr, 'sup', true, mergedReview)
        : '<div class="readonly score-readonly-val">' + (state.scores[kr.id] !== '' ? sOut(state.scores[kr.id]) : '—') + '</div>';

      return '<div class="score-kr-card" data-id="' + kr.id + '" data-block="' + sec.key + '">' +
        '<button type="button" class="score-kr-head">' +
        '<span class="block-tag ' + blockClass(kr.block || sec.key) + '">' + blockLabel(kr.block || sec.key) + '</span>' +
        '<span class="title">考核目标 · 权重' + kr.weight + '% · 自评' + sOut(kr.selfScore) + '</span>' +
        '<span class="chevron">▼</span></button>' +
        '<div class="score-kr-body">' +
        renderKrReadonly(kr, isBehavior, { l3Only: !!l3Only }) +
        '<div class="score-score-row-title">评分（三级）· 自评 / 上级 / 分管</div>' +
        '<div class="score-row score-row--quarter">' +
        '<div><label>员工自评</label><div class="readonly">' + sOut(kr.selfScore) + ' 分</div></div>' +
        '<div class="score-col-sup"><label>上级分 ★</label>' + supCell +
        '<div class="max-hint">上限 ' + kr.weight + '</div></div>' +
        '<div class="score-col-div"><label>分管分 ★</label>' + divCell +
        (mergedReview ? '<div class="max-hint">合并评 · 联动</div>' : '<div class="max-hint">上限 ' + kr.weight + '</div>') + '</div>' +
        '</div></div></div>';
    }

    function buildKrCards() {
      if (!listEl) return;
      var sections = [
        { key: 'V', title: '核心绩效 V%', cap: QUARTER_BLOCK_LIMITS.V, koKey: 'coreKeyObjectives', items: sub.coreKrs.map(function (k) { return Object.assign({}, k, { block: 'V' }); }) },
        { key: 'X', title: '常规绩效 X%', cap: QUARTER_BLOCK_LIMITS.X, koKey: 'regularKeyObjectives', items: sub.regularKrs.map(function (k) { return Object.assign({}, k, { block: 'X' }); }) },
      ];
      listEl.innerHTML = sections.map(function (sec) {
        var cards;
        if (window.PerfKrHierarchy && sub[sec.koKey] && sub[sec.koKey].length) {
          cards = sub[sec.koKey].map(function (ko, ki) {
            var koHead = '<div class="score-ko-group score-ko-group--l2"><div class="score-ko-head">' +
              (PerfKrHierarchy.levelBadge ? PerfKrHierarchy.levelBadge('l2', 'L2') : '') +
              '<span class="score-ko-label">关键目标 ' + (ki + 1) + '</span>' +
              '<span class="ko-weight-sum-badge">权重 ' + PerfKrHierarchy.sumKoTargets(ko).toFixed(1) + '%</span>' +
              '<div class="score-ko-o">' + (ko.o || '—') + '</div></div><div class="score-ko-targets">';
            return koHead + (ko.targets || []).map(function (t) {
              return singleQuarterKrCard(Object.assign({}, t, { block: sec.key }), sec, false, true);
            }).join('') + '</div></div>';
          }).join('');
        } else {
          cards = sec.items.map(function (kr) { return singleQuarterKrCard(kr, sec, false); }).join('');
        }
        return '<div class="score-block-group" data-block-group="' + sec.key + '">' +
          '<div class="score-block-head">' + sec.title + ' <span class="score-block-limit">KR 权重合计 90% · 区块工作分上限 ' + QUARTER_BLOCK_LIMITS.WORK + '</span></div>' +
          '<div class="score-block-cap-line" data-block-cap-line="' + sec.key + '"></div>' + cards + '</div>';
      }).join('');

      var first = listEl.querySelector('.score-kr-card');
      if (first) first.classList.add('is-open');
      listEl.querySelectorAll('.score-kr-head').forEach(function (btn) {
        btn.addEventListener('click', function () { btn.closest('.score-kr-card').classList.toggle('is-open'); });
      });
      bindScoreInputs();
      bindLongTextToggles(listEl);
    }

    function bindScoreInputs() {
      listEl.querySelectorAll('input[data-score-id]').forEach(function (inp) {
        inp.addEventListener('input', function () {
          var id = inp.dataset.scoreId;
          var col = inp.dataset.scoreCol;
          if (col === 'div') state.divisionScores[id] = inp.value;
          else state.scores[id] = inp.value;
          if (mergedReview && inp.dataset.mirrorScore) {
            state.divisionScores[id] = inp.value;
            listEl.querySelectorAll('input[data-score-id="' + id + '"][data-score-col="div"]').forEach(function (d) {
              if (d !== inp) d.value = inp.value;
            });
          }
          markDirty();
          refresh();
        });
      });
    }

    function renderQuarterSummaries(supTotals, divTotals) {
      if (!summaryEl) return;
      var selfT = calcSelfTotal(sub);
      var divFinal = state.divisionFinalOverride !== '' && !isNaN(parseFloat(state.divisionFinalOverride))
        ? parseFloat(state.divisionFinalOverride) : divTotals.finalScore;
      var composite = calcQuarterComposite(sub, supTotals.finalScore, divFinal);
      var emptyHint = (!supTotals.finalScore && !divTotals.finalScore)
        ? '<p class="score-hint score-hint--inline">上方逐项打分后，此处实时汇总；未打分时显示 0.00 属正常。</p>'
        : '';
      summaryEl.innerHTML =
        '<div class="score-section-title score-section-title--sub">折算汇总 · 区块小计</div>' +
        emptyHint +
        '<div class="score-summary-grid score-summary-grid--quarter">' +
        renderQuarterSummaryPanel(supTotals, '上级') +
        renderQuarterSummaryPanel(divTotals, '分管') +
        '</div>' +
        '<div class="score-quarter-formula">' +
        '<div class="score-section-title score-section-title--sub">加权综合分</div>' +
        '<div class="score-summary-item">员工自评合计：<b>' + sOut(selfT) + '</b></div>' +
        '<div class="score-summary-item">上级核定：<b>' + sOut(supTotals.finalScore) + '</b></div>' +
        '<div class="score-summary-item">分管核定：<b>' + sOut(divFinal) + '</b>' +
        (state.divisionFinalOverride !== '' ? ' <span class="q-tag q-tag-orange">已改总分</span>' : '') + '</div>' +
        '<div class="score-summary-item score-summary-item--emph">综合 = 自评×20% + 上级×40% + 分管×40% = <b>' + sOut(composite) + '</b></div>' +
        '</div>';
    }

    function refresh() {
      listEl.querySelectorAll('input[data-score-id]').forEach(function (inp) {
        var col = inp.dataset.scoreCol;
        var id = inp.dataset.scoreId;
        if (col === 'div') state.divisionScores[id] = inp.value;
        else state.scores[id] = inp.value;
      });
      var qOpts = { limits: QUARTER_BLOCK_LIMITS };
      var supTotals = calcTotals(sub, state, Object.assign({ scoreField: 'scores' }, qOpts));
      var divTotals = calcTotals(sub, state, {
        scoreField: 'divisionScores',
        adjustPlusKey: 'divisionAdjustPlus',
        adjustMinusKey: 'divisionAdjustMinus',
        limits: QUARTER_BLOCK_LIMITS,
      });

      ['scores', 'divisionScores'].forEach(function (field, idx) {
        var totals = idx === 0 ? supTotals : divTotals;
        listEl.querySelectorAll('input[data-score-col="' + (idx === 0 ? 'sup' : 'div') + '"]').forEach(function (inp) {
          var err = totals.errors.items[inp.dataset.scoreId];
          inp.classList.toggle('is-error', !!err);
          inp.closest('.score-kr-card').classList.toggle('is-error', !!err);
        });
      });

      var e = supTotals.errors;
      var vxOver = supTotals.vxSum > QUARTER_BLOCK_LIMITS.VX;
      listEl.querySelectorAll('[data-block-cap-line]').forEach(function (line) {
        var key = line.dataset.blockCapLine;
        var sum = key === 'V' ? supTotals.coreSum : supTotals.regularSum;
        var over = key === 'V' ? e.coreOver : e.regularOver;
        line.className = 'score-block-cap-line' + (over ? ' is-error' : '');
        line.innerHTML = '本区块上级分合计：<b>' + sOut(sum) + '</b>' + (over ? ' <span class="score-cap-warn">超限</span>' : '');
      });

      summaryEl.classList.toggle('is-error', vxOver || e.workOver);
      renderQuarterSummaries(supTotals, divTotals);

      var btn = document.getElementById('btn-submit');
      if (btn) {
        if (readonly) btn.disabled = true;
        else if (canEditMerged || canEditSupCol) btn.disabled = !supTotals.valid;
        else if (canEditDivCol) btn.disabled = !divTotals.valid;
        else btn.disabled = true;
      }
    }

    buildKrCards();

    var adjPlusEl = document.getElementById('adjust-plus-body');
    var adjMinusEl = document.getElementById('adjust-minus-body');
    if (adjPlusEl) {
      adjPlusEl.innerHTML = sub.adjust.plus.length ? sub.adjust.plus.map(function (r, i) {
        var supInp = canEditSupCol ? '<input type="number" step="0.01" class="perf-score-input" data-perf-score data-adj="plus" data-adj-col="sup" data-idx="' + i + '" value="' + sIn(state.adjustPlus[i]) + '" />' : sOut(state.adjustPlus[i]);
        var divInp = mergedReview
          ? (canEditMerged ? '<input type="number" step="0.01" class="perf-score-input" data-adj="plus" data-adj-col="sup" data-adj-mirror="1" data-idx="' + i + '" value="' + sIn(state.divisionAdjustPlus[i]) + '" />' : sOut(state.divisionAdjustPlus[i]))
          : (canEditDivCol ? '<input type="number" step="0.01" class="perf-score-input" data-adj="plus" data-adj-col="div" data-idx="' + i + '" value="' + sIn(state.divisionAdjustPlus[i]) + '" />' : sOut(state.divisionAdjustPlus[i]));
        return '<tr><td>' + longTextHtml(r.desc, 80) + '</td><td>' + sOut(r.selfScore) + '</td><td>' + supInp + '</td><td>' + divInp + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="score-empty">无加分申报</td></tr>';
    }
    if (adjMinusEl) {
      adjMinusEl.innerHTML = sub.adjust.minus.length ? sub.adjust.minus.map(function (r, i) {
        var supInp = canEditSupCol ? '<input type="number" step="0.01" class="perf-score-input" data-perf-score data-adj="minus" data-adj-col="sup" data-idx="' + i + '" value="' + sIn(state.adjustMinus[i]) + '" />' : sOut(state.adjustMinus[i]);
        var divInp = mergedReview
          ? (canEditMerged ? '<input type="number" step="0.01" class="perf-score-input" data-adj="minus" data-adj-col="sup" data-adj-mirror="1" data-idx="' + i + '" value="' + sIn(state.divisionAdjustMinus[i]) + '" />' : sOut(state.divisionAdjustMinus[i]))
          : (canEditDivCol ? '<input type="number" step="0.01" class="perf-score-input" data-adj="minus" data-adj-col="div" data-idx="' + i + '" value="' + sIn(state.divisionAdjustMinus[i]) + '" />' : sOut(state.divisionAdjustMinus[i]));
        return '<tr><td>' + longTextHtml(r.desc, 80) + '</td><td>' + sOut(r.selfScore) + '</td><td>' + supInp + '</td><td>' + divInp + '</td></tr>';
      }).join('') : '<tr><td colspan="4" class="score-empty">无减分申报</td></tr>';
    }

    document.querySelectorAll('[data-adj]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var idx = parseInt(inp.dataset.idx, 10);
        var col = inp.dataset.adjCol;
        if (inp.dataset.adj === 'plus') {
          if (col === 'div') state.divisionAdjustPlus[idx] = inp.value;
          else {
            state.adjustPlus[idx] = inp.value;
            if (inp.dataset.adjMirror) state.divisionAdjustPlus[idx] = inp.value;
          }
        } else {
          if (col === 'div') state.divisionAdjustMinus[idx] = inp.value;
          else {
            state.adjustMinus[idx] = inp.value;
            if (inp.dataset.adjMirror) state.divisionAdjustMinus[idx] = inp.value;
          }
        }
        markDirty();
        refresh();
      });
    });

    var roleBanner = document.getElementById('score-role-banner');
    if (roleBanner) {
      var roleText = role === 'division' ? '当前身份：分管领导 · 逐项评分' : '当前身份：直接上级 · 逐项评分';
      if (mergedReview) roleText = '合并评 · 一次录入计入上级 40% + 分管 40%（两列联动）';
      else if (role === 'division' && !supervisorDone) roleText = '待上级评完 · 分管列暂不可编辑';
      else if (readonly) roleText = '只读 · 已进入待确认';
      roleBanner.innerHTML = roleText;
      roleBanner.className = 'perf-tip perf-tip-blue score-role-banner' + (role === 'division' && !supervisorDone ? ' score-role-banner--warn' : '');
    }

    var divOverrideEl = document.getElementById('division-final-override');
    if (divOverrideEl) {
      if (canEditDivCol || (readonly && state.divisionFinalOverride !== '')) {
        divOverrideEl.style.display = '';
        divOverrideEl.innerHTML =
          '<div class="score-section-title">分管核定总分（可选 · 覆盖逐项汇总）</div>' +
          '<p class="score-hint">在逐项汇总基础上直接改<strong>全表综合总得分</strong>；保存后标记「已调整」。</p>' +
          '<div class="score-override-row">' +
          '<label>分管核定总分</label>' +
          '<input type="number" step="0.01" id="div-final-input" class="perf-score-input" ' +
          (canEditDivCol ? '' : 'disabled readonly ') +
          'value="' + sIn(state.divisionFinalOverride || '') + '" placeholder="留空则按逐项汇总" /></div>';
        var finInp = document.getElementById('div-final-input');
        if (finInp && canEditDivCol) {
          finInp.addEventListener('input', function () {
            state.divisionFinalOverride = finInp.value;
            markDirty();
            refresh();
          });
        }
      } else {
        divOverrideEl.style.display = 'none';
      }
    }

    var interviewEl = document.getElementById('score-interview-readonly');
    if (interviewEl && sub.interview) {
      interviewEl.innerHTML = '<div class="score-section-title">面谈记录（只读）</div>' +
        '<dl class="proto-kv">' +
        '<dt>本期亮点</dt><dd>' + esc(sub.interview.highlight) + '</dd>' +
        '<dt>待改进</dt><dd>' + esc(sub.interview.improve) + '</dd>' +
        '<dt>下期计划</dt><dd>' + esc(sub.interview.plan) + '</dd>' +
        '<dt>所需支持</dt><dd>' + esc(sub.interview.support) + '</dd></dl>';
    }

    document.getElementById('score-header-info').innerHTML =
      '<h2>' + sub.header.employee + ' · ' + sub.header.period + ' 季度绩效考核</h2>' +
      '<div class="score-header-meta">' +
      '<span>部门：' + sub.header.dept + '</span><span>岗位：' + sub.header.role + '</span>' +
      '<span>员工提交：' + sub.header.submittedAt + '</span>' +
      (mergedReview ? '<span class="q-tag q-tag-blue">合并评</span>' : '') +
      '</div>';

    function renderSixQ() {
      var el = document.getElementById('score-sixq3j');
      if (el && window.PerfSixQ3J) el.innerHTML = PerfSixQ3J.renderReadonlyPanel(planId, empNo);
    }
    renderSixQ();
    window.addEventListener('perf-sixq3j-updated', function (e) { if (!e.detail || e.detail.planId === planId) renderSixQ(); });
    window.addEventListener('storage', function (e) { if (e.key === 'perf-sixq3j-' + planId) renderSixQ(); });

    refresh();
    if (sf()) sf().bindAll(document.querySelector('.q-card-panel') || document.body);

    var btnSubmit = document.getElementById('btn-submit');
    if (btnSubmit && !readonly) {
      btnSubmit.textContent = canEditDivCol && !canEditSupCol ? '提交分管评分' : '提交上级评分';
      btnSubmit.addEventListener('click', function () {
        var supTotals = calcTotals(sub, state, { limits: QUARTER_BLOCK_LIMITS });
        var divTotals = calcTotals(sub, state, { scoreField: 'divisionScores', adjustPlusKey: 'divisionAdjustPlus', adjustMinusKey: 'divisionAdjustMinus', limits: QUARTER_BLOCK_LIMITS });
        if (canEditSupCol && !supTotals.valid) { alert('请修正上级评分明细标红项'); return; }
        if (canEditDivCol && !canEditSupCol && !divTotals.valid) { alert('请修正分管评分明细标红项'); return; }
        saveDraft(taskId, state);
        if (task) {
          if (canEditSupCol) { task.supervisorDone = true; task.phase = mergedReview ? 'pending_confirm' : 'pending_division'; task.status = mergedReview ? 'done' : 'scoring'; }
          if (canEditDivCol && !canEditSupCol) { task.phase = 'pending_confirm'; task.status = 'done'; task.divisionDone = true; }
        }
        DEPT_ROSTER.forEach(function (r) {
          if (r.taskId !== taskId) return;
          if (canEditSupCol) { r.supervisorDone = true; r.systemTotal = supTotals.finalScore; r.phase = mergedReview ? 'pending_confirm' : 'pending_division'; }
          if (canEditDivCol && !canEditSupCol) {
            r.phase = 'pending_confirm';
            r.finalTotal = state.divisionFinalOverride !== '' ? parseFloat(state.divisionFinalOverride) : divTotals.finalScore;
            r.adjusted = state.divisionFinalOverride !== '';
          }
        });
        clearDraft(taskId);
        alert(canEditDivCol && !canEditSupCol ? '分管评分已提交，员工进入待确认。' : '上级评分已提交，流转至分管评。');
        location.href = 'supervisor-review-list.html';
      });
    }

    var back = document.getElementById('btn-back');
    if (back) back.href = 'supervisor-review-list.html';
  }

  window.SupervisorScore = {
    REVIEW_LIST: REVIEW_LIST,
    SUBMISSIONS: SUBMISSIONS,
    LEADER_CONTEXT: LEADER_CONTEXT,
    DEPT_ROSTER: DEPT_ROSTER,
    renderReviewList: renderReviewList,
    countLeaderPending: countLeaderPending,
    openDivisionAdjustModal: openDivisionAdjustModal,
    initOaMonthlyScorePage: initOaMonthlyScorePage,
    initOaQuarterlyScorePage: initOaQuarterlyScorePage,
    initMpMonthlyScorePage: initMpMonthlyScorePage,
    calcTotals: calcTotals,
    calcSelfTotal: calcSelfTotal,
    ADJUST_LIMITS: ADJUST_LIMITS,
    BLOCK_LIMITS: BLOCK_LIMITS,
  };
})();
