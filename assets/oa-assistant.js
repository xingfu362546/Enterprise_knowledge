(function () {
  var KEY = "oa-assistant-v2";
  var AGENTS = [
    { id: "policy", name: "企业助手", brief: "请假查询与发起", prompt: "查询本人请假，并发起审批中的请假。信息没齐就在请假单上标出，确认后才写入。", kind: "leave" },
    { id: "thinking", name: "6Q思维法", brief: "思维方法与练习", prompt: "只回答 6Q 思维法范围内的问题。课程正文还没接入，不能编造方法步骤。", kind: "guide" },
    { id: "meeting", name: "会议室查询", brief: "场地、容量、预约", prompt: "查询会议室位置、容量和预约。只根据会议室本体的返回回答，没有查到就说明没有。", kind: "meeting" },
    { id: "student", name: "学员数据查询", brief: "复训有礼名单", prompt: "按活动期查询符合补发条件的学员，并可以导出 Excel。", kind: "student" }
  ];
  var COLORS = { policy: "#12b76a", thinking: "#6941c6", meeting: "#2f6bff", student: "#b54708" };

  var root = document.getElementById("oa-assist");
  var body = document.getElementById("oa-assist-body");
  var launcher = document.getElementById("oa-assist-launcher");
  var backdrop = document.getElementById("oa-assist-backdrop");
  if (!root || !body) return;
  var layout = root.getAttribute("data-layout") || "portal";

  var state = load();

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved && saved.threads && saved.activeAgentId) {
        if (!saved.booking) saved.booking = { active: false };
        if (!saved.leave) saved.leave = { active: false };
        if (!saved.roster) saved.roster = null;
        saved.sending = false;
        if (layout === "portal") saved.open = false;
        return saved;
      }
    } catch (e) { /* 使用默认助手 */ }
    return {
      open: false,
      activeAgentId: "policy",
      draft: "",
      threads: { policy: [], thinking: [], meeting: [], student: [] },
      booking: { active: false },
      leave: { active: false },
      roster: null
    };
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function agent() {
    return AGENTS.filter(function (item) { return item.id === state.activeAgentId; })[0] || AGENTS[0];
  }

  function thread() {
    var id = agent().id;
    if (!state.threads[id]) state.threads[id] = [];
    return state.threads[id];
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function icon(path) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>';
  }

  var rpcSeq = 1;
  var toolNames = null;
  var CATALOG = {
    meeting: { ontology: "meeting_room", version: "04848db8-8421-4657-b54e-724003f84a65" },
    leave: { ontology: "leave", version: "4ef15b1c-1120-4964-bd05-d5ab00d36ded" },
    equipment: { ontology: "equipment_ops", version: "639d8755-a56e-498b-83a8-2bb0bdce4dbe" }
  };
  var LABELS = {
    name: "名称", location: "位置", headcount: "容量", status: "状态", room_name: "会议室",
    date: "日期", start_time: "开始", end_time: "结束", user_name: "发起人",
    equipment_id: "设备编号", title: "工单", metric: "测点", last_value: "读数", unit: "单位",
    sensor_id: "传感器", work_order_id: "工单编号"
  };
  var RESERVATION_STATUS = { "0": "待开始", "1": "进行中", "2": "已结束", "3": "已取消" };
  var PARTICIPANT_STATUS = { "0": "未反馈", "1": "参会", "2": "请假" };

  function mcpRpc(method, params) {
    return fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: rpcSeq++, method: method, params: params || {} })
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok || (body && body.error)) {
          var message = body && body.error && body.error.message ? body.error.message : "本体 MCP 没有连上";
          throw new Error(message);
        }
        return body.result;
      });
    });
  }

  function ensureTools() {
    if (toolNames) return Promise.resolve(toolNames);
    return mcpRpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "oa-portal", version: "1.0" }
    }).then(function () {
      return mcpRpc("tools/list", {});
    }).then(function (result) {
      toolNames = (result.tools || []).map(function (tool) { return tool.name; });
      if (toolNames.indexOf("ontology_object_find") < 0) throw new Error("本体 MCP 没有对象查询工具");
      return toolNames;
    });
  }

  function findObject(serverId, objectName, fields, filters, limit) {
    var spec = CATALOG[serverId];
    var args = {
      ontology_name: spec.ontology,
      version_id: spec.version,
      object_name: objectName,
      user_id: "portal",
      fields: fields,
      limit: limit || 8
    };
    if (filters && Object.keys(filters).length) args.filters = filters;
    return mcpRpc("tools/call", { name: "ontology_object_find", arguments: args }).then(function (result) {
      var raw = result && result.content && result.content[0] ? result.content[0].text : "{}";
      var data = JSON.parse(raw);
      if (result.isError || data.error) throw new Error(data.error || "MCP 查询失败");
      var columns = data.columns || [];
      return (data.rows || []).map(function (row) {
        var item = {};
        columns.forEach(function (column, index) { item[column] = row[index]; });
        return item;
      });
    });
  }

  function describe(row, fields, statusMap) {
    return fields.map(function (key) {
      if (row[key] == null || row[key] === "") return "";
      var value = statusMap && key === "status" && statusMap[String(row[key])] ? statusMap[String(row[key])] : row[key];
      return (LABELS[key] || key) + " " + value;
    }).filter(Boolean).join("，");
  }

  function namedRoom(text) {
    return findObject("meeting", "MeetingRoomInfo", ["name"], null, 20).then(function (rows) {
      var found = rows.filter(function (row) { return row.name && text.indexOf(String(row.name)) >= 0; });
      found.sort(function (a, b) { return String(b.name).length - String(a.name).length; });
      return found[0] ? String(found[0].name) : "";
    });
  }

  function isoDate(date) {
    var month = date.getMonth() + 1;
    var day = date.getDate();
    return date.getFullYear() + "-" + (month < 10 ? "0" : "") + month + "-" + (day < 10 ? "0" : "") + day;
  }

  function timeWindow(text) {
    var today = new Date();
    function dayOffset(days, label) {
      var date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
      var value = isoDate(date);
      return { start: value, end: value, label: label + " " + value };
    }
    if (/明天/.test(text)) return dayOffset(1, "明天");
    if (/今天/.test(text)) return dayOffset(0, "今天");
    if (/后天/.test(text)) return dayOffset(2, "后天");
    var numeric = text.match(/(\d{1,2})\s*月份?/);
    var chinese = text.match(/(十二|十一|十|[一二三四五六七八九])月份?/);
    var monthNames = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10, "十一": 11, "十二": 12 };
    var month = numeric ? Number(numeric[1]) : (chinese ? monthNames[chinese[1]] : 0);
    if (month >= 1 && month <= 12) return { month: month, label: month + "月" };
    var exact = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (exact) return { start: exact[1], end: exact[1], label: exact[1] };
    return null;
  }

  function reservationDate(row) {
    var matched = String(row.date || "").match(/\d{4}-\d{2}-\d{2}/);
    return matched ? matched[0] : "";
  }

  function reservationMatches(row, room, span) {
    if (room && String(row.room_name || "").indexOf(room) < 0) return false;
    if (!span) return true;
    var date = reservationDate(row);
    if (!date) return false;
    if (span.month) return Number(date.slice(5, 7)) === span.month;
    return date >= span.start && date <= span.end;
  }

  function queryMeeting(text) {
    var fields = ["name", "location", "headcount", "status"];
    var span = timeWindow(text);
    var reservationFields = ["id", "room_name", "name", "date", "start_time", "end_time", "status", "user_name"];
    return namedRoom(text).then(function (room) {
      var scope = [room, span && span.label].filter(Boolean).join("、");
      var wantsCard = /位置|容量|在哪|地址/.test(text) && !/预约|预定|预订|参会/.test(text) && !span;
      if (!wantsCard && (span || /预约|预定|预订|参会|数据|情况|安排/.test(text))) {
        return findObject("meeting", "MeetingRoomReservation", reservationFields, room ? { room_name: room } : null, 200).then(function (rows) {
          var matched = rows.filter(function (row) { return reservationMatches(row, room, span); });
          matched.sort(function (a, b) { return reservationDate(a).localeCompare(reservationDate(b)) || String(a.start_time || "").localeCompare(String(b.start_time || "")); });
          var title = scope ? "按" + scope + "筛选，共 " + matched.length + " 条。" : "共 " + matched.length + " 条预约。";
          if (!matched.length) return title + (room ? "没有「" + room + "」在这个范围里的预约。" : "这个范围里没有预约。");
          var shown = matched.slice(0, 20);
          var lines = shown.map(function (row) {
            return describe(row, ["room_name", "name", "date", "start_time", "end_time", "status", "user_name"], RESERVATION_STATUS);
          });
          if (/参会/.test(text)) {
            return Promise.all(shown.slice(0, 5).map(function (item) {
              return findObject("meeting", "MeetingRoomParticipants", ["name", "status"], { ref_id: String(item.id) }, 12).then(function (people) {
                var names = people.map(function (person) { return describe(person, ["name", "status"], PARTICIPANT_STATUS); });
                return describe(item, ["room_name", "name", "date", "start_time"]) + "\n参会人：" + (names.join("；") || "无");
              });
            })).then(function (blocks) { return title + "\n" + blocks.join("\n\n"); });
          }
          return title + "\n" + lines.join("\n") + (matched.length > shown.length ? "\n其余 " + (matched.length - shown.length) + " 条未展开。" : "");
        });
      }
      return findObject("meeting", "MeetingRoomInfo", fields, room ? { name: room } : null, 20).then(function (rows) {
        if (!rows.length) return room ? "会议室本体里没有「" + room + "」。" : "会议室本体没有返回记录。";
        return rows.map(function (row) { return describe(row, fields); }).join("\n");
      });
    });
  }

  var LEAVE_TYPES = [["产检假", 7], ["带薪年假", 2], ["年假", 2], ["调休假", 1], ["调休", 1], ["工伤假", 5], ["哺乳假", 9], ["事假", 3], ["病假", 4], ["婚假", 6], ["产假", 8], ["丧假", 10]];
  var LEAVE_TYPE_NAME = { 1: "调休假", 2: "带薪年假", 3: "事假", 4: "病假", 5: "工伤假", 6: "婚假", 7: "产检假", 8: "产假", 9: "哺乳假", 10: "丧假" };
  var LEAVE_STATUS = { 1: "审批中", 2: "审批通过", 3: "审批拒绝" };

  function leaveLines(latest) {
    var talk = thread();
    var start = 0;
    talk.forEach(function (item, index) {
      if (item.role === "bot" && /已写入请假/.test(item.text || "")) start = index + 1;
    });
    var lines = [];
    talk.slice(start).forEach(function (item) {
      if (item.role === "user" && item.text && item.text !== "确认请假" && !/不请了|取消这次请假/.test(item.text)) lines.push(item.text);
    });
    if (!lines.length || lines[lines.length - 1] !== latest) lines.push(latest);
    return lines;
  }

  function applyLeaveLine(draft, text) {
    LEAVE_TYPES.forEach(function (item) {
      if (text.indexOf(item[0]) >= 0) {
        draft.holidayType = item[1];
        draft.typeName = LEAVE_TYPE_NAME[item[1]];
      }
    });
    var reason = text.match(/原因\s*[是为:：]?\s*([^，,。；;\n]{1,80})/);
    if (reason) draft.reason = reason[1].trim();
    if (/我/.test(text) && !draft.staffId) {
      draft.staffId = "342";
      draft.staffName = "余炜烽";
    }
    var date = parseDate(text);
    var clockRange = parseClockRange(normalizeSpoken(text));
    if (date && /一天|全天/.test(text) && !clockRange) {
      draft.date = date;
      draft.start = date + "T09:00:00";
      draft.end = date + "T18:00:00";
      draft.hours = 8;
    } else if (date && clockRange && !clockRange.invalid) {
      draft.date = date;
      draft.start = date + "T" + clockRange.start;
      draft.end = date + "T" + clockRange.end;
      draft.hours = Math.round(clockRange.duration / 60 * 10) / 10;
    } else if (date) {
      draft.date = date;
    }
    if (clockRange && clockRange.invalid) draft.invalidTime = true;
  }

  function leaveFormHtml() {
    var draft = state.leave;
    if (agent().id !== "policy" || !draft || !draft.active) return "";
    function cell(value, missing) {
      if (value) return "<strong>" + escapeHtml(String(value)) + "</strong>";
      return '<strong class="' + (missing ? "is-empty" : "is-auto") + '">' + (missing ? "请填写" : "") + "</strong>";
    }
    var rows = [
      ["请假类型", draft.typeName, !draft.holidayType],
      ["开始时间", draft.start ? draft.start.replace("T", " ") : "", !draft.start],
      ["结束时间", draft.end ? draft.end.replace("T", " ") : "", !draft.end],
      ["时长", draft.hours ? draft.hours + " 小时" : "", !draft.hours],
      ["原因", draft.reason, !draft.reason],
      ["员工", draft.staffId ? draft.staffName + "（工号 " + draft.staffId + "）" : "", !draft.staffId],
      ["审批状态", "审批中", false]
    ];
    var missing = rows.filter(function (row) { return row[2]; }).map(function (row) { return row[0]; });
    var conflict = (draft.meetings || []).map(function (item) {
      return item.room + "「" + item.name + "」" + item.when;
    }).join("；");
    var overlap = (draft.overlaps || []).map(function (item) {
      return item.typeName + " " + item.when + "（" + item.status + "）" + (item.same ? "，时间相同" : "");
    }).join("；");
    var banner = "";
    if (overlap) banner += '<p class="oa-book__need">已有请假：' + escapeHtml(overlap) + "</p>";
    else if (conflict) banner += '<p class="oa-book__need">已有会议：' + escapeHtml(conflict) + "</p>";
    if (missing.length) banner += '<p class="oa-book__need">还要填：' + escapeHtml(missing.join("、")) + "</p>";
    else if (!overlap && conflict) banner += '<p class="oa-book__need is-ready">仍可点确认请假。</p>';
    else if (!overlap) banner += '<p class="oa-book__need is-ready">点确认请假后才会写入。</p>';
    return '<form class="oa-book"><h3>' + (draft.confirming ? "请假确认" : "请假单") + "</h3>" + banner + rows.map(function (row) {
      return '<label class="' + (row[2] ? "is-missing" : "") + '"><span>' + escapeHtml(row[0]) + "</span>" + cell(row[1], row[2]) + "</label>";
    }).join("") + '<div class="oa-book__actions"><button type="button" data-act="cancel-leave">取消</button><button type="button" class="is-primary" data-act="confirm-leave"' + (draft.confirming ? "" : " disabled") + ">确认请假</button></div></form>";
  }

  function submitLeave(draft) {
    return fetch("/api/leave/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staff_id: draft.staffId,
        staff_name: draft.staffName,
        holiday_type: draft.holidayType,
        start_time: draft.start,
        end_time: draft.end,
        apply_hour: draft.hours,
        reason: draft.reason
      })
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok || !body.ok) throw new Error(body.message || "请假写入失败");
        state.leave = { active: false };
        save();
        return { text: "已写入请假，状态为审批中。\n类型 " + draft.typeName + "\n时间 " + draft.start.replace("T", " ") + " 至 " + draft.end.replace("T", " ") + "\n时长 " + draft.hours + " 小时\n原因 " + draft.reason + "\n员工 " + draft.staffName + "（工号 " + draft.staffId + "）", ask: "还要再请一次吗？不需要可以说不用了。", note: "已写入 leave_data" };
      });
    });
  }

  function queryMyLeave() {
    return findObject("leave", "LeaveApplication", ["holiday_type", "start_time", "end_time", "apply_hour", "reason", "approval_status", "staff_id"], { staff_id: "342" }, 20).then(function (rows) {
      rows.sort(function (a, b) { return String(b.start_time || "").localeCompare(String(a.start_time || "")); });
      var shown = rows.slice(0, 8);
      return {
        text: shown.length ? "余炜烽最近有 " + rows.length + " 条请假，下面是最近 8 条。" : "没有查到余炜烽的请假记录。",
        table: {
          caption: "余炜烽的请假",
          headers: ["类型", "开始", "结束", "时长", "状态"],
          rows: shown.map(function (row) {
            return [
              LEAVE_TYPE_NAME[Number(row.holiday_type)] || String(row.holiday_type || ""),
              String(row.start_time || "").replace("T", " "),
              String(row.end_time || "").replace("T", " "),
              (row.apply_hour || "") + " 小时",
              LEAVE_STATUS[Number(row.approval_status)] || String(row.approval_status || "")
            ];
          })
        },
        ask: "要发起新的请假吗？告诉我类型、时间和原因。",
        note: "请假本体"
      };
    });
  }

  function collectLeave(text) {
    var lines = leaveLines(text);
    var draft = { active: true };
    lines.forEach(function (line) { applyLeaveLine(draft, line); });
    if (draft.invalidTime) {
      state.leave = draft;
      save();
      return Promise.resolve({ text: "结束时间要晚于开始时间。", note: "请假信息未齐" });
    }
    var labels = { holidayType: "请假类型", start: "开始和结束时间", hours: "时长", reason: "原因", staffId: "员工" };
    var missing = Object.keys(labels).filter(function (key) { return !draft[key]; });
    return ensureTools().then(function () {
      if (!draft.staffId || (!draft.start && !draft.date)) {
        draft.meetings = [];
        draft.overlaps = [];
        return finishLeave(draft, missing);
      }
      var span = leaveSpan(draft);
      return fetch("/api/leave/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: draft.staffId,
          staff_name: draft.staffName || "",
          start_time: span.start,
          end_time: span.end
        })
      }).then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok || !body.ok) throw new Error(body.message || "请假冲突检查失败");
          draft.overlaps = body.overlaps || [];
          draft.meetings = body.meetings || [];
          return finishLeave(draft, missing);
        });
      });
    });
  }

  function leaveSpan(draft) {
    if (draft.start && draft.end) return { start: draft.start, end: draft.end };
    if (draft.date) return { start: draft.date + "T00:00:00", end: draft.date + "T23:59:59" };
    return null;
  }

  function finishLeave(draft, missing) {
    var overlap = (draft.overlaps || []).map(function (item) {
      return item.typeName + " " + item.when + "（" + item.status + "）" + (item.same ? "，时间相同" : "");
    }).join("；");
    var conflict = (draft.meetings || []).map(function (item) {
      return item.room + "「" + item.name + "」" + item.when;
    }).join("；");
    draft.confirming = missing.length === 0 && !overlap;
    state.leave = draft;
    save();
    if (overlap) return { text: "这个时间已经请过，不能再提交。", ask: "换一个时间，或点取消。", note: "请假冲突" };
    if (missing.length) return { text: "请看请假单，标红的还要填。", note: "请假信息未齐" };
    if (conflict) return { text: "可以请假。这段时间有会议，仍可以请。", ask: "要写入就点确认请假。", note: "会议提醒" };
    return { text: "可以请假。", ask: "点确认请假才会写入。", note: "待确认" };
  }

  function previousBot() {
    var talk = thread();
    var lastUser = -1;
    for (var i = talk.length - 1; i >= 0; i--) {
      if (talk[i].role === "user") {
        lastUser = i;
        break;
      }
    }
    for (var j = lastUser - 1; j >= 0; j--) {
      if (talk[j].role === "bot") return (talk[j].ask || "") + "\n" + (talk[j].text || "");
    }
    return "";
  }

  function startingLeave(text) {
    if (/记录|查一下|我的请假|请了哪|请假情况/.test(text) && !/再请|帮我请|我要请|现在请假/.test(text)) return false;
    if (/帮我请|我要请|发起请假|请一天|请半天|再请一次|再请|继续请|现在请假/.test(text)) return true;
    var named = LEAVE_TYPES.some(function (item) { return text.indexOf(item[0]) >= 0; });
    var timed = !!(parseDate(text) || parseClockRange(normalizeSpoken(text)));
    if (named && timed) return true;
    var offered = /还要再请一次|要发起新的请假|还是现在请假/.test(previousBot());
    if (!offered || /不用|不请|取消|记录/.test(text)) return false;
    return /^(要|好|好的|可以|嗯|请|再来)[吧啊呀。！!\s]*$/.test(text.trim()) || named || timed || /明天|今天|后天|上午|下午|早上|晚上/.test(text);
  }

  function askLeave(text) {
    if (/不用了|先这样|不请了|先不请/.test(text) && !startingLeave(text)) {
      state.leave = { active: false };
      save();
      return Promise.resolve({ text: "好，这次就到这里。", note: "" });
    }
    if (state.leave && state.leave.active && /取消这次请假|不请了/.test(text)) {
      state.leave = { active: false };
      save();
      return Promise.resolve({ text: "这次请假已取消，还没有写入。", note: "请假未提交" });
    }
    var creating = startingLeave(text) || (state.leave && state.leave.active && !/记录|查一下|我的请假|请了哪/.test(text));
    var job = creating ? collectLeave(text) : (/记录|我的请假|请了哪|请假情况/.test(text) ? queryMyLeave() : Promise.resolve({
      text: "可以查你的请假，也可以发起一条审批中的请假。",
      ask: "要看最近的请假记录，还是现在请假？",
      note: ""
    }));
    return Promise.resolve(job).then(function (reply) { return reply; }).catch(function (error) {
      return { text: String(error && error.message || error), note: "请假未提交" };
    });
  }

  function guideReply(current) {
    if (current.id === "policy") {
      return {
        text: "企业助手负责请假。可以说「我的请假」，或「帮我请明天的事假」。",
        note: "制度正文未接入"
      };
    }
    return {
      text: "6Q思维法的课程正文还没有接入，我不能编造方法步骤。你可以先告诉我要了解的主题；课程接上后，按课程内容回答。",
      note: "课程正文未接入"
    };
  }

  function padTime(value) {
    return value < 10 ? "0" + value : String(value);
  }

  function parseClockRange(text) {
    var afternoon = /下午|晚上/.test(text) && !/上午|早上/.test(text);
    var matched = text.match(/(\d{1,2})\s*[:：点]\s*(\d{1,2})?\s*(?:分)?\s*(?:到|至|-|—)\s*(\d{1,2})\s*[:：点]\s*(\d{1,2})?/);
    if (!matched) return null;
    function hour(raw) {
      var value = Number(raw);
      if (afternoon && value < 12) value += 12;
      return value;
    }
    var start = hour(matched[1]) * 60 + Number(matched[2] || 0);
    var end = hour(matched[3]) * 60 + Number(matched[4] || 0);
    if (end <= start) return { invalid: true };
    return {
      start: padTime(Math.floor(start / 60)) + ":" + padTime(start % 60) + ":00",
      end: padTime(Math.floor(end / 60)) + ":" + padTime(end % 60) + ":00",
      duration: end - start
    };
  }

  function parseDate(text) {
    var span = timeWindow(text);
    if (span && span.start && span.start === span.end) return span.start;
    var matched = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/);
    if (!matched) return "";
    return new Date().getFullYear() + "-" + padTime(Number(matched[1])) + "-" + padTime(Number(matched[2]));
  }

  function wantsBooking(text) {
    return /帮我预约|我要预约|发起预约|预约一个|预约一间|帮我订|订一间|帮我预定|帮我预订|会议名称|预约人/.test(text);
  }

  function wantsQuery(text) {
    return /在哪|有没有|哪些|查询|容量|位置|预约情况/.test(text) && !wantsBooking(text);
  }

  function spokenNumber(token) {
    var map = { "零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };
    if (/^\d+$/.test(token)) return Number(token);
    if (token === "十") return 10;
    if (token.charAt(0) === "十") return 10 + (map[token.charAt(1)] || 0);
    var ten = token.indexOf("十");
    if (ten > 0) return (map[token.charAt(0)] || 0) * 10 + (map[token.charAt(ten + 1)] || 0);
    return map[token];
  }

  function normalizeSpoken(text) {
    var num = "(?:[0-9]{1,2}|十[一二两三四五六七八九]?|[一二两三四五六七八九]十[一二三四五六七八九]?|[零一二两三四五六七八九])";
    return String(text)
      .replace(new RegExp("(" + num + ")\\s*点半", "g"), function (_, token) { return spokenNumber(String(token)) + ":30"; })
      .replace(new RegExp("(" + num + ")\\s*点\\s*(" + num + ")\\s*分", "g"), function (_, hour, minute) { return spokenNumber(String(hour)) + ":" + padTime(spokenNumber(String(minute))); })
      .replace(new RegExp("(" + num + ")\\s*点", "g"), function (_, token) { return spokenNumber(String(token)) + ":00"; })
      .replace(new RegExp("人数\\s*[是为:：]?\\s*(" + num + ")\\s*(?:人|个)?", "g"), function (_, token) { return spokenNumber(String(token)) + "人"; })
      .replace(/(\d+)\s*个人/g, "$1人");
  }

  function bookingLines(latest) {
    var talk = thread();
    var start = 0;
    talk.forEach(function (item, index) {
      if (item.role === "bot" && /已写入预约/.test(item.text || "")) start = index + 1;
    });
    var lines = [];
    talk.slice(start).forEach(function (item) {
      if (item.role === "user" && item.text && item.text !== "确认预约" && !/先不约|不用订|取消这次预约/.test(item.text)) lines.push(item.text);
    });
    if (!lines.length || lines[lines.length - 1] !== latest) lines.push(latest);
    return lines;
  }

  function applyUtterance(draft, text) {
    var title = text.match(/会议名称\s*[是为:：]?\s*([^，,。；;\n]{1,40})/) || text.match(/主题\s*[是为:：]?\s*([^，,。；;\n]{1,40})/);
    if (title) draft.name = title[1].trim();
    var people = text.match(/(\d+)\s*人/);
    if (people) draft.headcount = Number(people[1]);
    var staff = text.match(/工号\s*[:：]?\s*(\d+)/);
    if (staff) {
      draft.userId = staff[1];
      draft.userName = draft.userName && draft.userName.indexOf("工号") !== 0 ? draft.userName : ("工号" + staff[1]);
    } else if (/我/.test(text) && !draft.userId) {
      draft.userId = "342";
      draft.userName = "余炜烽";
    }
    var date = parseDate(text);
    if (date) draft.date = date;
    var clockRange = parseClockRange(text);
    if (clockRange && clockRange.invalid) draft.invalidTime = true;
    else if (clockRange) {
      draft.invalidTime = false;
      draft.start = clockRange.start;
      draft.end = clockRange.end;
      draft.duration = clockRange.duration;
    }
  }

  function collectBooking(text) {
    var lines = bookingLines(text);
    var draft = { active: true };
    lines.forEach(function (line) { applyUtterance(draft, normalizeSpoken(line)); });
    if (draft.invalidTime) {
      state.booking = draft;
      save();
      return Promise.resolve({ text: "结束时间要晚于开始时间。请重新告诉我开始和结束时间，例如下午两点到四点。", note: "预约信息未齐" });
    }
    return findObject("meeting", "MeetingRoomInfo", ["id", "name", "headcount", "location"], null, 20).then(function (rooms) {
      lines.forEach(function (line) {
        var found = rooms.filter(function (room) { return room.name && line.indexOf(String(room.name)) >= 0; });
        found.sort(function (a, b) { return String(b.name).length - String(a.name).length; });
        if (found[0]) {
          draft.room = String(found[0].name);
          draft.roomId = String(found[0].id);
          draft.capacity = Number(found[0].headcount || 0);
        }
      });
      if (!draft.room && state.focusRoom) {
        draft.room = state.focusRoom.name;
        draft.roomId = state.focusRoom.id;
        draft.capacity = state.focusRoom.capacity;
      }
      var labels = { name: "会议名称", room: "会议室", headcount: "人数", date: "日期", start: "开始和结束时间", userId: "预约人工号" };
      var missing = Object.keys(labels).filter(function (key) { return !draft[key]; });
      draft.confirming = false;
      state.booking = draft;
      save();
      if (missing.length) {
        draft.missing = missing.map(function (key) { return labels[key]; });
        state.booking = draft;
        save();
        return withRoomWeek(draft.room, { text: "请看下面的预约单，标红的还要填。", note: "预约信息未齐" });
      }
      if (draft.headcount > draft.capacity) {
        return { text: draft.room + "可容纳 " + draft.capacity + " 人，这次是 " + draft.headcount + " 人，装不下。请换会议室或减少人数。", note: "预约信息未齐" };
      }
      return findObject("meeting", "MeetingRoomReservation", ["room_name", "name", "date", "start_time", "end_time", "status"], { room_name: draft.room }, 200).then(function (rows) {
        function normalizeClock(value) {
          var matched = String(value || "").match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
          if (!matched) return "";
          return padTime(Number(matched[1])) + ":" + padTime(Number(matched[2])) + ":" + padTime(Number(matched[3] || 0));
        }
        var conflict = rows.filter(function (row) {
          var start = normalizeClock(row.start_time);
          var end = normalizeClock(row.end_time);
          return reservationDate(row) === draft.date && String(row.status) !== "3" && start && end && draft.start < end && start < draft.end;
        })[0];
        if (conflict) {
          state.next = "need-time";
          save();
          return withRoomWeek(draft.room, { text: "这个时段" + draft.room + "已有预约：" + (conflict.name || "未命名会议") + "。", ask: "要换一个时间，还是换一间会议室？", note: "预约信息未齐" });
        }
        draft.confirming = true;
        state.booking = draft;
        state.next = "confirm";
        save();
        return withRoomWeek(draft.room, { text: "预约信息已经齐了。", ask: "核对下面的预约单。要改直接说，不改就点确认预约。", note: "待确认" });
      });
    }).catch(function (error) {
      return { text: String(error && error.message || error), note: "预约未提交" };
    });
  }

  function submitBooking(draft) {
    return fetch("/api/meeting/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meeting_name: draft.name,
        room_id: draft.roomId,
        room_name: draft.room,
        user_id: draft.userId,
        user_name: draft.userName,
        date: draft.date,
        start_time: draft.start,
        end_time: draft.end,
        duration: draft.duration,
        headcount: draft.headcount,
        content: ""
      })
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok || !body.ok) throw new Error(body.message || "预约写入失败");
        state.booking = { active: false };
        state.next = "again";
        save();
        return { text: "已写入预约，状态为待开始。\n会议名称 " + draft.name + "\n会议室 " + draft.room + "\n人数 " + draft.headcount + "（容量 " + draft.capacity + "）\n时间 " + draft.date + " " + draft.start + " 至 " + draft.end + "\n预约人 " + draft.userName + "（工号 " + draft.userId + "）", ask: "还要再约一间吗？不需要可以说不用了。", note: "已写入 meeting_room_reservation" };
      });
    });
  }

  function bookingFormHtml() {
    var draft = state.booking;
    if (agent().id !== "meeting" || !draft || !draft.active) return "";
    function cell(value, missing) {
      if (value) return "<strong>" + escapeHtml(String(value)) + "</strong>";
      if (!missing) return '<strong class="is-auto">填写时间后自动计算</strong>';
      return '<strong class="is-empty">请填写</strong>';
    }
    var rows = [
      ["会议名称", draft.name, !draft.name],
      ["会议室", draft.room, !draft.room],
      ["人数", draft.headcount ? draft.headcount + " 人" + (draft.capacity ? "（容量 " + draft.capacity + "）" : "") : "", !draft.headcount],
      ["日期", draft.date, !draft.date],
      ["开始时间", draft.start, !draft.start],
      ["结束时间", draft.end, !draft.end],
      ["时长", draft.duration ? draft.duration + " 分钟" : "", false],
      ["预约人", draft.userId ? draft.userName + "（工号 " + draft.userId + "）" : "", !draft.userId],
      ["状态", "待开始", false]
    ];
    var missing = rows.filter(function (row) { return row[2]; }).map(function (row) { return row[0]; });
    if (missing.indexOf("开始时间") >= 0 && missing.indexOf("结束时间") >= 0) {
      missing = missing.filter(function (item) { return item !== "开始时间" && item !== "结束时间"; });
      missing.push("开始和结束时间");
    }
    var banner = draft.confirming
      ? '<p class="oa-book__need is-ready">信息已齐，点确认预约后才会写入。</p>'
      : '<p class="oa-book__need">还要填：' + escapeHtml(missing.join("、")) + "</p>";
    return '<form class="oa-book"><h3>' + (draft.confirming ? "预约确认" : "预约单") + "</h3>" + banner + rows.map(function (row) {
      return '<label class="' + (row[2] ? "is-missing" : "") + '"><span>' + escapeHtml(row[0]) + "</span>" + cell(row[1], row[2]) + "</label>";
    }).join("") + '<div class="oa-book__actions"><button type="button" data-act="cancel-booking">取消</button><button type="button" class="is-primary" data-act="confirm-booking"' + (draft.confirming ? "" : " disabled") + ">确认预约</button></div></form>";
  }

  function nextBookingQuestion(draft) {
    if (!draft.room) return "想约哪一间会议室？";
    if (!draft.name) return "这场会议叫什么名称？";
    if (!draft.headcount) return draft.room + "这次几个人？人数用来核对容量。";
    if (!draft.date) return "哪一天？可以说明天，或说具体日期。";
    if (!draft.start) return "从几点到几点？例如下午两点到四点。";
    if (!draft.userId) return "预约人工号是多少？说「我」就按余炜烽，工号 342。";
    return "还缺什么？";
  }

  function weekBounds() {
    var now = new Date();
    var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
    return { start: isoDate(now), end: isoDate(end), nowMinutes: now.getHours() * 60 + now.getMinutes() };
  }

  function clockMinutes(value) {
    var matched = String(value || "").match(/(\d{1,2}):(\d{2})/);
    return matched ? Number(matched[1]) * 60 + Number(matched[2]) : 0;
  }

  function inComingWeek(row, bounds) {
    var date = reservationDate(row);
    if (!date || date < bounds.start || date > bounds.end || String(row.status) === "3") return false;
    if (date === bounds.start && clockMinutes(row.end_time) <= bounds.nowMinutes) return false;
    return true;
  }

  function withRoomWeek(room, reply) {
    if (!room) return Promise.resolve(reply);
    return roomWeek(room).then(function (week) {
      reply.table = week.table;
      return reply;
    });
  }

  function roomWeek(roomName) {
    var bounds = weekBounds();
    return Promise.all([
      findObject("meeting", "MeetingRoomInfo", ["id", "name", "location", "headcount"], { name: roomName }, 5),
      findObject("meeting", "MeetingRoomReservation", ["name", "date", "start_time", "end_time", "status"], { room_name: roomName }, 200)
    ]).then(function (parts) {
      var info = parts[0][0] || { name: roomName };
      var rows = parts[1].filter(function (row) { return inComingWeek(row, bounds); });
      rows.sort(function (a, b) { return reservationDate(a).localeCompare(reservationDate(b)) || String(a.start_time).localeCompare(String(b.start_time)); });
      state.focusRoom = {
        name: String(info.name || roomName),
        id: info.id ? String(info.id) : "",
        capacity: Number(info.headcount || 0),
        location: info.location || ""
      };
      return {
        info: info,
        count: rows.length,
        table: {
          caption: (info.name || roomName) + " · " + bounds.start + " 至 " + bounds.end,
          headers: ["日期", "开始", "结束", "会议", "状态"],
          rows: rows.map(function (row) {
            return [reservationDate(row), String(row.start_time || ""), String(row.end_time || ""), row.name || "未命名", RESERVATION_STATUS[String(row.status)] || String(row.status || "")];
          })
        }
      };
    });
  }

  function affirms(text) {
    return /^(要|好|好的|可以|嗯|约|预约|帮我约|就这间|约这间)[吧啊呀。！!\s]*$/.test(String(text).trim()) || /要预约|帮我约|约一下|就约这间/.test(text);
  }

  function asksMeetingPlan(text) {
    return /会议/.test(text) && /有什么|有没有|未来|以后|接下来|安排|吗/.test(text) && !/帮我预约|我要预约|发起预约/.test(text);
  }

  function asksLeaveChance(text) {
    return /是否可以请|能不能请|能否请|可不可以请|可以请假|能请假|是否能请/.test(text);
  }

  function hearsJoint(text) {
    return (asksMeetingPlan(text) || asksLeaveChance(text)) && !/帮我请|我要请|发起请假|再请|帮我预约|我要预约|发起预约/.test(text);
  }

  function morningSpan(text) {
    var date = parseDate(text);
    if (!date) return null;
    var clock = parseClockRange(normalizeSpoken(text));
    if (clock && !clock.invalid) {
      return { start: date + "T" + clock.start, end: date + "T" + clock.end, label: date + " " + clock.start.slice(0, 5) + "–" + clock.end.slice(0, 5) };
    }
    if (/早上|上午/.test(text)) return { start: date + "T09:00:00", end: date + "T12:00:00", label: date + " 早上 09:00–12:00" };
    if (/下午/.test(text)) return { start: date + "T14:00:00", end: date + "T18:00:00", label: date + " 下午 14:00–18:00" };
    if (/晚上/.test(text)) return { start: date + "T18:00:00", end: date + "T21:00:00", label: date + " 晚上 18:00–21:00" };
    return { start: date + "T09:00:00", end: date + "T18:00:00", label: date + " 09:00–18:00" };
  }

  function myUpcomingMeetings() {
    var bounds = weekBounds();
    return findObject("meeting", "MeetingRoomReservation", ["room_name", "name", "date", "start_time", "end_time", "status", "user_id", "user_name"], { user_id: "342" }, 200).then(function (rows) {
      return rows.filter(function (row) {
        if (String(row.status) === "3") return false;
        var mine = String(row.user_id || "") === "342" || String(row.user_name || "") === "余炜烽";
        var date = reservationDate(row);
        if (!mine || !date || date < bounds.start) return false;
        if (date === bounds.start && clockMinutes(row.end_time) <= bounds.nowMinutes) return false;
        return true;
      }).sort(function (a, b) {
        return reservationDate(a).localeCompare(reservationDate(b)) || String(a.start_time || "").localeCompare(String(b.start_time || ""));
      });
    });
  }

  function answerJoint(text) {
    var wantMeetings = asksMeetingPlan(text);
    var wantLeave = asksLeaveChance(text);
    var span = wantLeave ? morningSpan(text) : null;
    var heard = [];
    if (wantMeetings) heard.push("你以后还有哪些会议");
    if (wantLeave) heard.push((span ? span.label : "这段时间") + "能不能请假");
    state.leave = { active: false };
    state.booking = { active: false };
    save();
    return ensureTools().then(function () {
      var meetingJob = wantMeetings ? myUpcomingMeetings() : Promise.resolve(null);
      var leaveJob = span ? fetch("/api/leave/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: "342", staff_name: "余炜烽", start_time: span.start, end_time: span.end })
      }).then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok || !body.ok) throw new Error(body.message || "请假条件没有核对上");
          return body;
        });
      }) : Promise.resolve(null);
      return Promise.all([meetingJob, leaveJob]).then(function (result) {
        var meetings = result[0] || [];
        var checked = result[1];
        var parts = [];
        var table = null;
        if (wantMeetings) {
          parts.push(meetings.length ? "从现在起还有 " + meetings.length + " 场会议。" : "从现在起没有未取消的会议。");
          if (meetings.length) {
            table = {
              caption: "以后的会议",
              headers: ["日期", "开始", "结束", "会议室", "会议", "状态"],
              rows: meetings.slice(0, 12).map(function (row) {
                return [reservationDate(row), String(row.start_time || ""), String(row.end_time || ""), row.room_name || "", row.name || "未命名", RESERVATION_STATUS[String(row.status)] || String(row.status || "")];
              })
            };
          }
        }
        var ask = "";
        if (checked) {
          var overlap = (checked.overlaps || []).map(function (item) {
            return item.typeName + " " + item.when + "（" + item.status + "）";
          }).join("；");
          var conflict = (checked.meetings || []).map(function (item) {
            return item.room + "「" + item.name + "」" + item.when;
          }).join("；");
          if (checked.blocked) {
            parts.push(span.label + "不能请假，已有：" + overlap + "。");
            ask = "换一个时间再说。";
          } else if (conflict) {
            parts.push(span.label + "可以请假，这段时间有会议：" + conflict + "。");
            ask = "要请的话告诉我类型和原因。";
          } else {
            parts.push(span.label + "可以请假。");
            ask = "要请的话告诉我类型和原因。";
          }
        }
        return { text: parts.join("\n"), table: table, ask: ask, note: "先理解再回答" };
      });
    }).catch(function (error) {
      return { text: "这句话我接到了：" + heard.join("，") + "。核对时没有成功：" + String(error && error.message || error), note: "先理解再回答" };
    });
  }

  function pad2(value) {
    return (value < 10 ? "0" : "") + value;
  }

  function rosterPeriod(text) {
    var iso = text.match(/20\d{2}-\d{2}-\d{2}/g) || [];
    if (iso.length >= 2) return { period_start: iso[0] + " 00:00:00", period_end: iso[1] + " 00:00:00" };
    var spoken = text.match(/(?:(20\d{2})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?[\s\S]{0,10}?(?:到|至|~|—|\s-\s)[\s\S]{0,14}?(?:(20\d{2})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/);
    if (!spoken) return null;
    var today = new Date();
    var startYear = spoken[1] || String(today.getFullYear());
    var endYear = spoken[4] || startYear;
    var startMonth = Number(spoken[2]);
    var endMonth = Number(spoken[5]);
    if (!spoken[1] && !spoken[4] && endMonth < startMonth) endYear = String(Number(startYear) + 1);
    var start = startYear + "-" + pad2(startMonth) + "-" + pad2(Number(spoken[3])) + " 00:00:00";
    var end = endYear + "-" + pad2(endMonth) + "-" + pad2(Number(spoken[6])) + " 00:00:00";
    return { period_start: start, period_end: end };
  }

  function rosterKeyword(text) {
    var period = text.match(/第\s*\d+\s*期/);
    if (!period) return "";
    var key = period[0].replace(/\s+/g, "");
    var course = text.match(/(高EQ智慧父母|高EQ亲密关系|亲密关系工作坊|亲密关系分享会|亲密关系|导师课程|一阶|二阶)/);
    return course ? key + " " + course[0] : key;
  }

  function rosterLabel(filters) {
    var parts = [];
    if (filters.session_keyword) parts.push("期数「" + filters.session_keyword + "」");
    if (filters.period_start && filters.period_end) {
      parts.push(filters.period_start.slice(0, 10) + " 到 " + filters.period_end.slice(0, 10));
    }
    return parts.join("、");
  }

  function wantsRosterExport(text) {
    return /导出|下载|excel|表格/i.test(text);
  }

  function studentTable(body) {
    var columns = body.columns || [];
    return {
      caption: "符合条件的学员，共 " + (body.total || 0) + " 人",
      headers: columns.map(function (column) { return column.label; }),
      rows: (body.rows || []).map(function (row) {
        return columns.map(function (column) { return row[column.key] == null ? "" : String(row[column.key]); });
      })
    };
  }

  function studentIntent(text) {
    if (/档案|资料|是谁|什么身份|会员信息|手机号|手机是多少/.test(text)) return { scenario: "profile", key: "学员档案" };
    if (/参与|上过|报读记录|报过|哪些期|期数/.test(text)) return { scenario: "history", key: "参与期数" };
    if (/签到|打卡|到课|出勤/.test(text)) return { scenario: "signins", key: "签到明细" };
    if (/支付|金额|付款|费用|用券|优惠|减免/.test(text)) return { scenario: "payments", key: "支付明细" };
    if (/名单|有哪些人|谁参加|学员列表/.test(text)) return { scenario: "session", key: "场次名单" };
    if (/有哪些期|排期|开课|场次|计划/.test(text)) return { scenario: "sessions", key: "课程场次" };
    return null;
  }

  function studentKeyword(text) {
    var period = text.match(/第\s*\d+\s*期/);
    if (period) return period[0].replace(/\s+/g, "");
    var serial = text.match(/\b[A-Z0-9]{5,8}\b/);
    if (serial) return serial[0];
    var quoted = text.match(/[「"“']([^」"”']{1,20})[」"”']/);
    if (quoted) return quoted[1];
    var course = text.match(/(高EQ智慧父母|高EQ亲密关系|亲密关系工作坊|亲密关系分享会|亲密关系|一阶|二阶|分享会|工作坊|导师课程|亲子营)/);
    if (course) return course[0];
    var cleaned = text
      .replace(/第\s*\d+\s*期/g, " ")
      .replace(/学员|会员|参与|上过|哪些|期数|报读|记录|签到|打卡|支付|金额|付款|费用|用券|优惠|减免|名单|有哪些人|是谁|档案|资料|身份|手机号|手机|的|了|吗|呢|请|帮我|查|查询|一下|信息|该|这个|多少|是什么/g, " ");
    var name = cleaned.match(/[\u4e00-\u9fa5]{2,5}/);
    return name ? name[0] : "";
  }

  function askStudentScenario(text, intent) {
    var keyword = studentKeyword(text);
    if (!keyword) {
      return Promise.resolve({
        text: "要查哪一条？",
        ask: intent.scenario === "session" || intent.scenario === "sessions"
          ? "告诉我期数或课程，例如第1367期 一阶。"
          : "告诉我学员编号、姓名或手机号。",
        note: "学员数据"
      });
    }
    return fetch("/api/students/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: intent.scenario, keyword: keyword })
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok || !body.ok) throw new Error(body.message || "学员数据没有查到");
        var shown = (body.rows || []).length;
        if (!shown) {
          return { text: "没有查到「" + keyword + "」的" + intent.key + "。", note: "学员数据" };
        }
        var serial = intent.scenario === "profile" ? (body.rows[0] || {}).serial_no : "";
        return {
          text: "「" + keyword + "」的" + intent.key + "，共 " + (body.total || 0) + " 条" +
            (shown < (body.total || 0) ? "，先显示 " + shown + " 条。" : "。"),
          table: studentTable(body),
          ask: serial ? "还可以问「" + serial + " 参与过哪些期数」或「" + serial + " 的签到明细」。" : "",
          note: "学员数据"
        };
      });
    });
  }

  function askStudents(text) {
    var hasPeriod = rosterPeriod(text);
    var keyword = rosterKeyword(text);
    var wantsRoster = /复训有礼|符合条件|补发/.test(text) || (hasPeriod && /名单|导出|下载|excel/i.test(text));
    if (!wantsRoster) {
      var intent = studentIntent(text);
      if (intent) return askStudentScenario(text, intent);
    }
    var filters = {};
    if (hasPeriod) {
      filters.period_start = hasPeriod.period_start;
      filters.period_end = hasPeriod.period_end;
    }
    if (keyword) filters.session_keyword = keyword;
    if (!filters.period_start && !filters.session_keyword) {
      if (state.roster && /导出|下载|刚才|上面/.test(text)) {
        filters = state.roster;
      } else {
        return Promise.resolve({
          text: "要查哪一段，或哪一期？",
          ask: "可以说 2026-05-01 到 2026-11-01，也可以说第1367期 一阶。",
          note: "学员数据"
        });
      }
    }
    if (wantsRosterExport(text)) {
      return fetch("/api/students/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters)
      }).then(function (response) {
        if (!response.ok) {
          return response.json().then(function (body) { throw new Error(body.message || "导出失败"); });
        }
        return response.blob();
      }).then(function (blob) {
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = "复训有礼名单.xlsx";
        link.click();
        URL.revokeObjectURL(url);
        state.roster = filters;
        save();
        return {
          text: "已开始下载：" + rosterLabel(filters) + "。",
          note: "复训有礼导出",
          ask: "文件名是复训有礼名单.xlsx。"
        };
      });
    }
    return fetch("/api/students/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(filters)
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok || !body.ok) throw new Error(body.message || "学员名单没有查到");
        state.roster = filters;
        save();
        var shown = (body.rows || []).length;
        return {
          text: (body.label || rosterLabel(filters)) + " 共 " + (body.total || 0) + " 人符合条件" +
            (shown < (body.total || 0) ? "，这里先显示 " + shown + " 人。" : "。"),
          table: studentTable(body),
          ask: "要完整名单可以说「导出 Excel」。",
          note: "复训有礼名单"
        };
      });
    });
  }

  function ask(text) {
    if (hearsJoint(text)) return answerJoint(text);
    if (agent().kind === "student") {
      return askStudents(text).catch(function (error) {
        var reason = String(error && error.message || error);
        if (/Failed to fetch|NetworkError|Load failed/i.test(reason)) {
          reason = "没有连上本机门户。请用 http://127.0.0.1:8765/portal/index.html 打开，并确认本体服务在 8001 端口。";
        }
        return { text: reason, note: "学员查询失败" };
      });
    }
    if (agent().kind === "leave") return askLeave(text);
    if (agent().kind !== "meeting") return Promise.resolve(guideReply(agent()));
    if (/不用了|先这样|不用约|不约了|先不用/.test(text)) {
      state.booking = { active: false };
      state.next = "";
      save();
      return Promise.resolve({ text: "好，这次就到这里。", note: "" });
    }
    if (state.booking && state.booking.active && /先不约|不用订|取消这次预约/.test(text)) {
      state.booking = { active: false };
      state.next = "";
      save();
      return Promise.resolve({ text: "这次预约已取消，还没有写入。", note: "预约未提交" });
    }
    if (state.next === "again" && affirms(text)) {
      state.focusRoom = null;
      state.next = "which-room";
      save();
      return Promise.resolve({ text: "好。", ask: "下一间想看哪间会议室？", note: "" });
    }
    if ((state.next === "offer-book" || state.next === "which-room") && affirms(text) && state.focusRoom && !wantsBooking(text)) {
      text = "帮我预约" + state.focusRoom.name;
    }
    var booking = wantsBooking(text) || (state.booking && state.booking.active && !wantsQuery(text)) || (state.next === "offer-book" && affirms(text));
    var job = booking ? collectBooking(text) : ensureTools().then(function () { return namedRoom(text); }).then(function (room) {
      if (!room) {
        return queryMeeting(text).then(function (answer) {
          state.next = "which-room";
          save();
          return { text: answer, ask: "想看哪一间从现在到未来一周的预约？直接说会议室名称。", note: "会议室本体" };
        });
      }
      return roomWeek(room).then(function (week) {
        state.next = "offer-book";
        save();
        var place = week.info.location ? week.info.name + "在" + week.info.location + "，可容纳 " + (week.info.headcount || "未知") + " 人。" : "";
        return {
          text: place + (week.count ? "从现在到未来一周有 " + week.count + " 场还没结束的预约。" : "从现在到未来一周还没有预约。"),
          table: week.table,
          ask: "要不要预约「" + (week.info.name || room) + "」？要的话告诉我会议名称、人数和时间。",
          note: "会议室本体"
        };
      });
    });
    return job.catch(function (error) {
      var reason = String(error && error.message || error);
      if (/Failed to fetch|NetworkError|Load failed/i.test(reason)) {
        reason = "没有连上本机 MCP 桥接。请用 http://127.0.0.1:8765/portal/index.html 打开页面，并确认本体服务在 8001 端口。";
      }
      return { text: reason, note: booking ? "预约写入失败" : "会议室查询失败" };
    });
  }

  var SUGGEST = {
    policy: ["我的请假", "帮我请明天的事假"],
    thinking: ["6Q思维法是什么", "一阶先练什么"],
    meeting: ["国和厅在哪里", "明天国和厅有预约吗"],
    student: ["查 2026-01-01 到 2026-11-13 的复训有礼名单", "第1367期有哪些学员", "CTGTW6 参与过哪些期数", "CTGTW6 的签到明细"]
  };
  var GREET = {
    policy: "要查请假，还是发起请假？",
    thinking: "想了解 6Q 思维法？",
    meeting: "想查会议室？",
    student: "要查学员档案、参与期数、签到、支付、场次，还是复训有礼名单？"
  };
  var drawerOpen = false;

  function messagesHtml(items) {
    if (!items.length) {
      if (layout === "mini") return miniEmpty();
      return '<div class="oa-msg oa-msg--bot">' + escapeHtml(agent().prompt) + "</div>";
    }
    return items.map(function (item) {
      var note = layout === "portal" && item.note ? "<em>" + escapeHtml(item.note) + "</em>" : "";
      var table = item.table ? scheduleHtml(item.table) : "";
      var ask = item.ask ? '<p class="oa-ask">' + escapeHtml(item.ask) + "</p>" : "";
      var download = item.download ? '<p class="oa-ask"><button type="button" data-act="export-roster">下载 Excel</button></p>' : "";
      return '<div class="oa-msg oa-msg--' + item.role + '">' + escapeHtml(item.text) + table + ask + download + note + "</div>";
    }).join("");
  }

  function scheduleHtml(table) {
    var head = "<tr>" + table.headers.map(function (item) { return "<th>" + escapeHtml(item) + "</th>"; }).join("") + "</tr>";
    var body = table.rows.length
      ? table.rows.map(function (row) { return "<tr>" + row.map(function (cell) { return "<td>" + escapeHtml(cell) + "</td>"; }).join("") + "</tr>"; }).join("")
      : '<tr><td colspan="' + table.headers.length + '">这一周还没有预约</td></tr>';
    return '<div class="oa-schedule"><p>' + escapeHtml(table.caption) + "</p><table>" + head + body + "</table></div>";
  }

  function miniEmpty() {
    var current = agent();
    var asks = (SUGGEST[current.id] || []).map(function (text) {
      return '<button type="button" data-act="suggest" data-text="' + escapeHtml(text) + '">' + escapeHtml(text) + "</button>";
    }).join("");
    return '<div class="mp-hello"><h2>' + escapeHtml(GREET[current.id] || current.name) + '</h2><div class="mp-hello__asks">' + asks + "</div></div>";
  }

  function skillCards() {
    return AGENTS.map(function (item) {
      var on = item.id === agent().id;
      return '<button type="button" class="mp-skill' + (on ? " is-on" : "") + '" data-act="agent" data-id="' + item.id + '">' +
        '<span class="mp-skill__icon mp-skill__icon--' + item.id + '"></span>' +
        '<span class="mp-skill__text"><strong>' + escapeHtml(item.name) + "</strong><small>" + escapeHtml(item.brief) + "</small></span>" +
        (on ? '<em>使用中</em>' : "") +
        "</button>";
    }).join("");
  }

  function miniDrawer() {
    return '<div class="mp-drawer' + (drawerOpen ? " is-open" : "") + '">' +
      '<button type="button" class="mp-drawer__mask" data-act="close-drawer" aria-label="关闭技能"></button>' +
      '<div class="mp-drawer__panel"><p>技能</p>' + skillCards() + "</div></div>";
  }

  function agentButtons(className) {
    return AGENTS.map(function (item) {
      var on = item.id === agent().id ? " is-on" : "";
      if (className === "oa-pick") {
        return '<button type="button" class="oa-pick' + on + '" data-act="agent" data-id="' + item.id + '">' + escapeHtml(item.name) + "</button>";
      }
      return '<button type="button" class="' + className + on + '" data-act="agent" data-id="' + item.id + '"><span class="oa-avatar" style="background:' + COLORS[item.id] + '">' + escapeHtml(item.name.slice(0, 1)) + '</span><span><b>' + escapeHtml(item.name) + "</b><small>" + escapeHtml(item.brief) + "</small></span></button>";
    }).join("");
  }

  function composer() {
    var placeholder = layout === "mini" ? "发消息" : "输入消息，按 Enter 发送";
    return '<form class="oa-composer">' +
      '<textarea rows="1" placeholder="' + placeholder + '"></textarea>' +
      '<div class="oa-composer__tools">' +
        '<button type="submit" class="oa-send" aria-label="发送">' + icon("M2.01 21L23 12 2.01 3 2 10l15 2-15 2z") + "</button>" +
      "</div></form>";
  }

  function render() {
    var current = agent();
    if (layout === "portal") {
      root.hidden = !state.open;
      if (backdrop) backdrop.hidden = !state.open;
      if (launcher) launcher.hidden = state.open;
      if (!state.open) return;
    }
    var messages = messagesHtml(thread()) + bookingFormHtml() + leaveFormHtml();
    body.innerHTML = layout === "mini"
      ? '<div class="oa-mini"><div class="oa-msgs">' + messages + "</div>" + composer() + miniDrawer() + "</div>"
      : '<div class="oa-ws"><section class="oa-side"><div class="oa-side__title">智能体</div><div class="oa-list">' +
        agentButtons("oa-item") + "</div></section>" +
        '<section class="oa-chat"><div class="oa-msgs">' + messages + "</div>" + composer() + "</section></div>";
    var sub = document.getElementById("oa-assist-sub");
    if (sub) sub.textContent = current.name + " · " + current.brief;
    var name = document.getElementById("mp-assist-name");
    if (name) name.textContent = current.name;
    var box = body.querySelector(".oa-msgs");
    if (box) box.scrollTop = box.scrollHeight;
    var input = body.querySelector("textarea");
    if (input) input.value = state.draft;
    if (input && layout === "portal") input.focus();
  }

  body.addEventListener("click", function (event) {
    var target = event.target.closest("[data-act]");
    if (!target || !body.contains(target)) return;
    var act = target.getAttribute("data-act");
    if (act === "agent") {
      state.activeAgentId = target.getAttribute("data-id");
      drawerOpen = false;
      save();
      render();
    }
    if (act === "suggest") {
      var input = body.querySelector("textarea");
      if (!input) return;
      input.value = target.getAttribute("data-text") || "";
      state.draft = input.value;
      input.closest("form").requestSubmit();
    }
    if (act === "close-drawer") {
      drawerOpen = false;
      render();
    }
    if (act === "export-roster") {
      if (!state.roster || state.sending) return;
      var exportTalk = thread();
      exportTalk.push({ role: "user", text: "导出 Excel" });
      exportTalk.push({ role: "bot", text: "正在导出名单…", note: "" });
      state.sending = true;
      save();
      render();
      askStudents("导出 Excel").then(function (reply) {
        var last = exportTalk[exportTalk.length - 1];
        last.text = reply.text;
        last.note = reply.note;
        last.ask = reply.ask || "";
        state.sending = false;
        save();
        render();
      }).catch(function (error) {
        var last = exportTalk[exportTalk.length - 1];
        last.text = String(error && error.message || error);
        last.note = "导出失败";
        state.sending = false;
        save();
        render();
      });
    }
    if (act === "cancel-booking") {
      state.booking = { active: false };
      thread().push({ role: "bot", text: "已取消，这次预约没有写入。", note: "预约未提交" });
      save();
      render();
    }
    if (act === "cancel-leave") {
      state.leave = { active: false };
      thread().push({ role: "bot", text: "已取消，这次请假没有写入。", note: "请假未提交" });
      save();
      render();
    }
    if (act === "confirm-leave") {
      var leaveDraft = state.leave;
      if (!leaveDraft || !leaveDraft.confirming || state.sending) return;
      var leaveTalk = thread();
      leaveTalk.push({ role: "user", text: "确认请假" });
      leaveTalk.push({ role: "bot", text: "正在写入请假…", note: "" });
      state.sending = true;
      save();
      render();
      submitLeave(leaveDraft).then(function (reply) {
        var last = leaveTalk[leaveTalk.length - 1];
        last.text = reply.text;
        last.note = reply.note;
        last.ask = reply.ask || "";
        state.sending = false;
        save();
        render();
      }).catch(function (error) {
        var last = leaveTalk[leaveTalk.length - 1];
        last.text = String(error && error.message || error);
        last.note = "请假写入失败";
        state.sending = false;
        save();
        render();
      });
    }
    if (act === "confirm-booking") {
      var draft = state.booking;
      if (!draft || !draft.confirming || state.sending) return;
      var talk = thread();
      talk.push({ role: "user", text: "确认预约" });
      talk.push({ role: "bot", text: "正在写入预约…", note: "" });
      state.sending = true;
      save();
      render();
      submitBooking(draft).then(function (reply) {
        var last = talk[talk.length - 1];
        last.text = reply.text;
        last.note = reply.note;
        last.ask = reply.ask || "";
        last.table = reply.table || null;
        state.sending = false;
        save();
        render();
      }).catch(function (error) {
        var last = talk[talk.length - 1];
        last.text = String(error && error.message || error);
        last.note = "预约写入失败";
        state.sending = false;
        save();
        render();
      });
    }
  });

  var menu = document.getElementById("mp-assist-menu");
  if (menu) {
    menu.addEventListener("click", function () {
      drawerOpen = !drawerOpen;
      render();
    });
  }

  body.addEventListener("input", function (event) {
    if (event.target.tagName === "TEXTAREA" && event.target.closest(".oa-composer")) {
      state.draft = event.target.value;
    }
  });

  body.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form.classList.contains("oa-composer")) return;
    event.preventDefault();
    var text = (form.querySelector("textarea").value || state.draft).trim();
    if (!text || state.sending) return;
    var talk = thread();
    talk.push({ role: "user", text: text });
    var checking = agent().kind === "meeting" && (wantsBooking(text) || (state.booking && state.booking.active && !wantsQuery(text)));
    var waiting = agent().kind === "student" ? "正在查询学员名单…" : (agent().kind === "leave" ? "正在核对请假…" : (checking ? "正在核对预约信息…" : (agent().kind === "meeting" ? "正在查询会议室…" : "正在回答…")));
    talk.push({ role: "bot", text: waiting, note: "" });
    state.draft = "";
    state.sending = true;
    save();
    render();
    ask(text).then(function (reply) {
      var last = talk[talk.length - 1];
      last.text = reply.text;
      last.note = reply.note;
      last.ask = reply.ask || "";
      last.table = reply.table || null;
      state.sending = false;
      save();
      render();
    });
  });

  body.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey && event.target.tagName === "TEXTAREA" && event.target.closest(".oa-composer")) {
      event.preventDefault();
      event.target.closest("form").requestSubmit();
    }
  });

  var collapse = document.getElementById("oa-assist-collapse");
  if (collapse) {
    collapse.addEventListener("click", function () {
      state.open = false;
      save();
      render();
    });
  }
  function closeAssist() {
    if (!state.open) return;
    state.open = false;
    save();
    render();
  }
  if (backdrop) backdrop.addEventListener("click", closeAssist);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && layout === "portal" && state.open) closeAssist();
  });
  if (launcher) {
    launcher.addEventListener("click", function () {
      state.open = true;
      save();
      render();
    });
  }

  render();
})();
