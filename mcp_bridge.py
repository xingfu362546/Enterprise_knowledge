"""本机门户到本体 MCP 的只读桥接。

页面只访问同源 /api/mcp。账号留在本体的 .env，不写进浏览器。
只转发 initialize、tools/list，以及会议室、请假和学员名单允许的调用。
"""
from __future__ import annotations

import hashlib
import json
import random
import re
import threading
import time
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ONTOLOGY_ENV = Path(r"D:\Cursor\ontology\.env")
ONTOLOGY_ORIGIN = "http://127.0.0.1:8001"
HOST = "127.0.0.1"
PORT = 8765
READ_TOOLS = {"ontology_object_find", "ontology_get_attr_mapping", "ontology_list_capabilities"}
RESERVE_ACTION_ID = "40b7d87c-4401-402e-9775-d28c92199b71"
LEAVE_ACTION_ID = "7c6b46bd-9c99-486b-a212-827c694f9c71"
STUDENT_QUERY_ACTION_ID = "3fe6df88-9fa6-4097-b0c1-4a2acd56a1c7"
STUDENT_EXPORT_ACTION_ID = "7accf195-dba6-4876-b1f5-3d41761f810d"
STUDENT_COLUMNS = [
    ("session_name", "会务期数"),
    ("session_start", "开课时间"),
    ("session_end", "结束时间"),
    ("product_name", "课程"),
    ("category_name", "分类"),
    ("serial_no", "学员编号"),
    ("member_name", "姓名"),
    ("real_name", "真实姓名"),
    ("mobile", "手机号"),
    ("training_identity", "复训身份"),
    ("sign_pay_price", "实付金额"),
    ("sign_count", "签到次数"),
]

STUDENT_SCENARIOS = {
    "profile": {
        "action": "8b471475-51fc-4d4e-91ce-25c537201825",
        "columns": [
            ("serial_no", "学员编号"), ("member_name", "姓名"), ("real_name", "真实姓名"),
            ("mobile", "手机号"), ("member_type", "会员类型"), ("is_angel", "是天使"),
            ("is_teacher", "是导师"), ("enrollment_count", "有效报读数"),
        ],
    },
    "history": {
        "action": "5d6731e9-1ca1-417e-931a-28557956fe32",
        "columns": [
            ("session_name", "会务期数"), ("session_start", "开课时间"), ("product_name", "课程"),
            ("category_name", "分类"), ("training_type", "新训或复训"), ("training_identity", "复训身份"),
            ("enroll_status", "报读状态"), ("sign_pay_price", "实付金额"), ("sign_count", "签到次数"),
        ],
    },
    "signins": {
        "action": "279149c1-7683-4b93-9e2f-fe9377b0bfa8",
        "columns": [
            ("session_name", "会务期数"), ("sign_date", "签到日"), ("punched_at", "打卡时间"),
            ("sign_status", "签到状态"), ("sign_method", "签到方式"),
        ],
    },
    "payments": {
        "action": "b510760c-3119-4e6b-9639-685fce22623b",
        "columns": [
            ("session_name", "会务期数"), ("product_name", "课程"), ("order_no", "订单号"),
            ("order_pay_price", "订单实付"), ("sign_pay_price", "报读实付"),
            ("coupon_price", "券面额"), ("policy_price", "政策减免"), ("used_coupon", "是否用券"),
        ],
    },
    "session": {
        "action": "00a85508-7441-498d-9bcc-b555ea92bcd3",
        "columns": [
            ("session_name", "会务期数"), ("session_start", "开课时间"), ("serial_no", "学员编号"),            ("member_name", "姓名"), ("mobile", "手机号"), ("training_type", "新训或复训"),
            ("training_identity", "复训身份"), ("sign_pay_price", "实付金额"), ("sign_count", "签到次数"),
        ],
    },
    "sessions": {
        "action": "9a87be72-49c9-4096-8a5b-a3bf846222e6",
        "columns": [
            ("session_name", "会务期数"), ("product_name", "课程"), ("session_start", "开课时间"),
            ("class_status", "上课状态"), ("new_sign_num", "已报新训"),
            ("repeat_sign_num", "已报复训"), ("enrolled_count", "有效报读"),
        ],
    },
}
MEETING_VERSION_ID = "04848db8-8421-4657-b54e-724003f84a65"
LEAVE_VERSION_ID = "4ef15b1c-1120-4964-bd05-d5ab00d36ded"
LEAVE_ONTOLOGY_ID = "555f3498-e792-4776-8f03-9a9b05cd1106"
LEAVE_ENTITY_ID = "09d2f2e5-b218-4609-89c2-292118c953e2"
LEAVE_TYPE_NAME = {
    1: "调休假", 2: "带薪年假", 3: "事假", 4: "病假", 5: "工伤假",
    6: "婚假", 7: "产检假", 8: "产假", 9: "哺乳假", 10: "丧假",
}
LEAVE_STATUS_NAME = {1: "审批中", 2: "审批通过", 3: "审批拒绝"}
ONTOLOGIES = {
    "meeting_room": {
        "MeetingRoomInfo",
        "MeetingRoomReservation",
        "MeetingRoomParticipants",
    },
    "equipment_ops": {"Equipment", "Sensor", "WorkOrder", "Staff"},
    "leave": {"LeaveApplication"},
}
_token = ""
_lock = threading.Lock()


def admin_password() -> str:
    for line in ONTOLOGY_ENV.read_text(encoding="utf-8").splitlines():
        if line.startswith("ADMIN_INITIAL_PASSWORD="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("本体 .env 里没有管理员密码")


def login() -> str:
    payload = json.dumps({"username": "admin", "password": admin_password()}).encode("utf-8")
    request = urllib.request.Request(
        ONTOLOGY_ORIGIN + "/api/v1/auth/login",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError("本体登录失败：" + detail[:180]) from None
    token = body.get("token")
    if not token:
        raise RuntimeError("本体登录没有返回令牌")
    return token


def ontology_mcp(payload: dict, retry: bool = True) -> tuple[int, dict]:
    global _token
    with _lock:
        if not _token:
            _token = login()
        token = _token
    request = urllib.request.Request(
        ONTOLOGY_ORIGIN + "/api/v1/mcp",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + token},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code == 401 and retry:
            with _lock:
                _token = ""
            return ontology_mcp(payload, retry=False)
        detail = exc.read().decode("utf-8", errors="replace")
        return exc.code, {"jsonrpc": "2.0", "id": payload.get("id"), "error": {"code": -32001, "message": detail[:180]}}


def mcp_find(object_name: str, fields: list[str], filters: dict | None, limit: int, ontology: str = "meeting_room", version: str = MEETING_VERSION_ID) -> list[dict]:
    arguments = {
        "ontology_name": ontology,
        "version_id": version,
        "object_name": object_name,
        "user_id": "portal",
        "fields": fields,
        "limit": limit,
    }
    if filters:
        arguments["filters"] = filters
    status, body = ontology_mcp({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": "ontology_object_find", "arguments": arguments},
    })
    if status != 200 or body.get("error"):
        message = (body.get("error") or {}).get("message") or "会议室查询失败"
        raise RuntimeError(message)
    result = body.get("result") or {}
    content = result.get("content") or [{}]
    data = json.loads(content[0].get("text") or "{}")
    if result.get("isError") or data.get("error"):
        raise RuntimeError(data.get("error") or "会议室查询失败")
    columns = data.get("columns") or []
    return [dict(zip(columns, row)) for row in data.get("rows") or []]


def ontology_json(path: str, retry: bool = True):
    global _token
    with _lock:
        if not _token:
            _token = login()
        token = _token
    request = urllib.request.Request(
        ONTOLOGY_ORIGIN + path,
        headers={"Authorization": "Bearer " + token},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code == 401 and retry:
            with _lock:
                _token = ""
            return ontology_json(path, retry=False)
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(detail[:180]) from None


def instant(value: str) -> str:
    matched = re.match(r"(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?", str(value or "").replace(" ", "T"))
    if not matched:
        return ""
    return f"{matched.group(1)}T{matched.group(2)}:{matched.group(3) or '00'}"


def meeting_bounds(row: dict) -> tuple[str, str]:
    date = re.search(r"\d{4}-\d{2}-\d{2}", str(row.get("date") or ""))
    start = re.search(r"(\d{1,2}):(\d{2})(?::(\d{2}))?", str(row.get("start_time") or ""))
    end = re.search(r"(\d{1,2}):(\d{2})(?::(\d{2}))?", str(row.get("end_time") or ""))
    if not date or not start or not end:
        return "", ""

    def clock_part(matched: re.Match) -> str:
        return f"{int(matched.group(1)):02d}:{int(matched.group(2)):02d}:{int(matched.group(3) or 0):02d}"

    return date.group(0) + "T" + clock_part(start), date.group(0) + "T" + clock_part(end)


def related_rows(staff_id: str) -> tuple[list[dict], list[dict]]:
    relations = ontology_json("/api/v1/relations?ontology_id=" + LEAVE_ONTOLOGY_ID)
    if not isinstance(relations, list):
        raise RuntimeError("请假本体关系没有读到")
    leaves: list[dict] = []
    meetings: list[dict] = []
    linked_leave = False
    linked_meeting = False
    for relation in relations:
        if relation.get("from_entity_id") != LEAVE_ENTITY_ID or relation.get("source_field") != "staff_id":
            continue
        target = relation.get("target_field")
        if relation.get("to_entity_id") == LEAVE_ENTITY_ID and target == "staff_id":
            linked_leave = True
            leaves = mcp_find(
                "LeaveApplication",
                ["holiday_type", "start_time", "end_time", "approval_status", "staff_id"],
                {target: str(staff_id)},
                200,
                ontology="leave",
                version=LEAVE_VERSION_ID,
            )
        elif relation.get("to_entity_name") == "MeetingRoomReservation" and target:
            linked_meeting = True
            meetings = mcp_find(
                "MeetingRoomReservation",
                ["room_name", "name", "date", "start_time", "end_time", "status", "user_id", "user_name"],
                {target: str(staff_id)},
                200,
            )
    if not linked_leave or not linked_meeting:
        raise RuntimeError("请假本体还没有关联到会议预约")
    return leaves, meetings


def check_leave_window(staff_id: str, staff_name: str, start: str, end: str) -> dict:
    start_at, end_at = instant(start), instant(end)
    if not start_at or not end_at or end_at <= start_at:
        raise ValueError("开始和结束时间格式应为 YYYY-MM-DDTHH:MM:SS")
    leave_rows, meeting_rows = related_rows(staff_id)
    overlaps = []
    for row in leave_rows:
        if str(row.get("approval_status")) == "3" or str(row.get("staff_id") or "") != str(staff_id):
            continue
        row_start, row_end = instant(row.get("start_time")), instant(row.get("end_time"))
        if not row_start or not row_end or not (start_at < row_end and row_start < end_at):
            continue
        holiday = int(row.get("holiday_type") or 0)
        status = int(row.get("approval_status") or 0)
        overlaps.append({
            "typeName": LEAVE_TYPE_NAME.get(holiday, "请假"),
            "when": row_start.replace("T", " ") + " 至 " + row_end.replace("T", " "),
            "status": LEAVE_STATUS_NAME.get(status, "审批中"),
            "same": row_start == start_at and row_end == end_at,
        })
    meetings = []
    for row in meeting_rows:
        if str(row.get("status")) == "3":
            continue
        mine = str(row.get("user_id") or "") == str(staff_id) or (staff_name and str(row.get("user_name") or "") == staff_name)
        row_start, row_end = meeting_bounds(row)
        if not mine or not row_start or not (start_at < row_end and row_start < end_at):
            continue
        meetings.append({
            "room": row.get("room_name") or "会议室",
            "name": row.get("name") or "未命名会议",
            "when": row_start.replace("T", " ") + " 至 " + row_end.replace("T", " "),
        })
    return {"ok": True, "blocked": bool(overlaps), "overlaps": overlaps, "meetings": meetings}


def clock(value: str) -> str:
    matched = re.fullmatch(r"(\d{1,2}):(\d{2})(?::(\d{2}))?", value.strip())
    if not matched:
        raise ValueError("时间格式应为 HH:MM")
    hour, minute, second = int(matched.group(1)), int(matched.group(2)), int(matched.group(3) or 0)
    if hour > 23 or minute > 59 or second > 59:
        raise ValueError("时间不合法")
    return f"{hour:02d}:{minute:02d}:{second:02d}"


def reserve_meeting(data: dict) -> dict:
    required = ("meeting_name", "room_id", "room_name", "user_id", "user_name", "date", "start_time", "end_time", "duration", "headcount")
    missing = [key for key in required if data.get(key) in (None, "")]
    if missing:
        raise ValueError("缺少预约字段：" + "、".join(missing))
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(data["date"])):
        raise ValueError("日期格式应为 YYYY-MM-DD")
    start, end = clock(str(data["start_time"])), clock(str(data["end_time"]))
    if end <= start:
        raise ValueError("结束时间必须晚于开始时间")
    duration = int(data["duration"])
    headcount = int(data["headcount"])
    if duration <= 0 or headcount <= 0:
        raise ValueError("时长和人数必须大于 0")
    rooms = mcp_find("MeetingRoomInfo", ["id", "name", "headcount"], {"name": data["room_name"]}, 5)
    room = next((item for item in rooms if str(item.get("id")) == str(data["room_id"])), None)
    if not room:
        raise ValueError("会议室不存在，或会议室和编号对不上")
    capacity = int(room.get("headcount") or 0)
    if headcount > capacity:
        raise ValueError(f"{room.get('name')}可容纳 {capacity} 人，这次填写的是 {headcount} 人")
    booked = mcp_find("MeetingRoomReservation", ["date", "start_time", "end_time", "status", "name"], {"room_name": data["room_name"]}, 200)
    for item in booked:
        if not str(item.get("date") or "").startswith(str(data["date"])) or str(item.get("status")) == "3":
            continue
        if start < clock(str(item.get("end_time"))) and clock(str(item.get("start_time"))) < end:
            raise ValueError("这个时段该会议室已有预约：" + str(item.get("name") or "未命名会议"))
    reservation_id = str(int(time.time() * 1000)) + f"{random.randint(0, 999999):06d}"
    params = {
        "id": reservation_id,
        "room_id": str(data["room_id"]),
        "room_name": str(data["room_name"]),
        "user_id": str(data["user_id"]),
        "user_name": str(data["user_name"]),
        "date": str(data["date"]),
        "start_time": start,
        "end_time": end,
        "duration": duration,
        "meeting_name": str(data["meeting_name"]),
        "content": str(data.get("content") or ""),
    }
    raw = json.dumps({"params": params, "dry_run": False, "idempotency_key": reservation_id}).encode("utf-8")
    request = urllib.request.Request(
        ONTOLOGY_ORIGIN + "/api/v1/actions/" + RESERVE_ACTION_ID + "/execute",
        data=raw,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + login()},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(detail[:180]) from None
    if not result.get("success"):
        raise RuntimeError(result.get("message") or "预约写入失败")
    return {"ok": True, "id": reservation_id, "message": result.get("message") or "已写入预约"}


def period_text(value: str) -> str:
    matched = re.fullmatch(r"(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?", str(value or "").strip())
    if not matched:
        raise ValueError("日期格式应为 YYYY-MM-DD")
    clock_text = f"{matched.group(2) or '00'}:{matched.group(3) or '00'}:{matched.group(4) or '00'}"
    return matched.group(1) + " " + clock_text


def execute_ontology_action(action_id: str, params: dict, idempotency_key: str) -> dict:
    raw = json.dumps({"params": params, "dry_run": False, "idempotency_key": idempotency_key}).encode("utf-8")
    request = urllib.request.Request(
        ONTOLOGY_ORIGIN + "/api/v1/actions/" + action_id + "/execute",
        data=raw,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + login()},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(detail[:180]) from None
    if not result.get("success"):
        raise RuntimeError(result.get("message") or "学员名单查询失败")
    return result


def session_span(keyword: str) -> dict:
    """按期数关键字查场次，返回该场的 id、开课时间、结束时间和名称。

    同一时间开课的期可能不止一场，所以还要用 id 精确限定。
    """
    result = execute_ontology_action(
        STUDENT_SCENARIOS["sessions"]["action"],
        {"keyword": keyword},
        "students-span-" + str(int(time.time() * 1000)),
    )
    output = result.get("output") or {}
    columns = output.get("columns") or []
    tokens = [token for token in keyword.replace("　", " ").split(" ") if token]
    for raw_row in output.get("data") or []:
        item = dict(zip(columns, raw_row))
        name = str(item.get("session_name") or "")
        product = str(item.get("product_name") or "")
        if all(token in name or token in product for token in tokens):
            start = str(item.get("session_start") or "")
            end = str(item.get("session_end") or "")
            session_id = str(item.get("session_id") or "")
            if start and end and session_id:
                return {"period_start": start, "period_end": end,
                        "session_id": session_id, "label": name}
    raise ValueError("没有找到「" + keyword + "」对应的场次，请把课程一起带上，例如「第1366期 一阶」")


def student_filters(data: dict) -> dict:
    """日期区间优先；只给期数时，用该期的场次 id 加开课起止时间。"""
    raw_start = str(data.get("period_start") or "").strip()
    raw_end = str(data.get("period_end") or "").strip()
    keyword = str(data.get("session_keyword") or "").strip()
    if len(keyword) > 60:
        raise ValueError("期数关键字过长")
    if raw_start or raw_end:
        if not raw_start or not raw_end:
            raise ValueError("日期区间要同时给开始和结束")
        start = period_text(raw_start)
        end = period_text(raw_end)
        if end <= start:
            raise ValueError("结束时间必须晚于开始时间")
        return {"period_start": start, "period_end": end, "session_id": "",
                "label": start[:10] + " 到 " + end[:10]}
    if keyword:
        return session_span(keyword)
    raise ValueError("请提供日期区间，或告诉我第几期")


def action_key(prefix: str, params: dict) -> str:
    digest = hashlib.sha256(json.dumps(params, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()[:24]
    return prefix + "-" + digest + "-" + str(int(time.time() * 1000))


def roster_params(filters: dict) -> dict:
    return {
        "period_start": filters["period_start"],
        "period_end": filters["period_end"],
        "session_id": filters.get("session_id") or "",
    }


def query_students(data: dict) -> dict:
    filters = student_filters(data)
    params = roster_params(filters)
    result = execute_ontology_action(
        STUDENT_QUERY_ACTION_ID,
        params,
        action_key("students-query", params),
    )
    output = result.get("output") or {}
    columns = output.get("columns") or []
    rows = []
    for raw_row in (output.get("data") or [])[:20]:
        item = {columns[index]: raw_row[index] if index < len(raw_row) else "" for index in range(len(columns))}
        rows.append({key: item.get(key, "") for key, _label in STUDENT_COLUMNS})
    return {
        "ok": True,
        "total": output.get("rows_returned") or 0,
        "columns": [{"key": key, "label": label} for key, label in STUDENT_COLUMNS],
        "rows": rows,
        "label": filters["label"],
        "period_start": filters["period_start"],
        "period_end": filters["period_end"],
        "message": (result.get("message") or "").splitlines()[0],
    }


def query_student_scenario(data: dict) -> dict:
    key = str(data.get("scenario") or "").strip()
    spec = STUDENT_SCENARIOS.get(key)
    if not spec:
        raise ValueError("不支持的查询类型")
    keyword = str(data.get("keyword") or "").strip()
    if not keyword:
        raise ValueError("请提供学员编号、姓名或期数")
    if len(keyword) > 60:
        raise ValueError("关键字过长")
    result = execute_ontology_action(
        spec["action"],
        {"keyword": keyword},
        "students-" + key + "-" + str(int(time.time() * 1000)),
    )
    output = result.get("output") or {}
    columns = output.get("columns") or []
    rows = []
    for raw_row in (output.get("data") or [])[:20]:
        item = {columns[index]: raw_row[index] if index < len(raw_row) else "" for index in range(len(columns))}
        rows.append({col: item.get(col, "") for col, _label in spec["columns"]})
    return {
        "ok": True,
        "scenario": key,
        "total": output.get("rows_returned") or 0,
        "columns": [{"key": col, "label": label} for col, label in spec["columns"]],
        "rows": rows,
        "message": (result.get("message") or "").splitlines()[0],
    }


def export_students(data: dict) -> tuple[bytes, str]:
    filters = student_filters(data)
    params = roster_params(filters)
    result = execute_ontology_action(
        STUDENT_EXPORT_ACTION_ID,
        params,
        action_key("students-export", params),
    )
    file_id = str((result.get("output") or {}).get("file_id") or "")
    if not re.fullmatch(r"[0-9a-f]{32}", file_id):
        raise RuntimeError("导出没有返回文件")
    request = urllib.request.Request(
        ONTOLOGY_ORIGIN + "/api/v1/exports/" + file_id,
        headers={"Authorization": "Bearer " + login()},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(detail[:180]) from None
    if not payload.startswith(b"PK"):
        raise RuntimeError("导出的不是 Excel 文件")
    return payload, "复训有礼名单.xlsx"


def apply_leave(data: dict) -> dict:
    required = ("staff_id", "staff_name", "holiday_type", "start_time", "end_time", "apply_hour", "reason")
    missing = [key for key in required if data.get(key) in (None, "")]
    if missing:
        raise ValueError("缺少请假字段：" + "、".join(missing))
    holiday_type = int(data["holiday_type"])
    if holiday_type < 1 or holiday_type > 10:
        raise ValueError("请假类型必须是 1 到 10")
    start, end = str(data["start_time"]), str(data["end_time"])
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", start) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", end):
        raise ValueError("开始和结束时间格式应为 YYYY-MM-DDTHH:MM:SS")
    if end <= start:
        raise ValueError("结束时间必须晚于开始时间")
    hours = float(data["apply_hour"])
    if hours <= 0:
        raise ValueError("请假时长必须大于 0")
    checked = check_leave_window(str(data["staff_id"]), str(data.get("staff_name") or ""), start, end)
    if checked["blocked"]:
        detail = "；".join(
            item["typeName"] + " " + item["when"] + "（" + item["status"] + "）" + ("，时间相同" if item["same"] else "")
            for item in checked["overlaps"]
        )
        raise ValueError("这个时间已有请假，不能再提交：" + detail)
    params = {
        "staff_id": str(data["staff_id"]),
        "holiday_type": holiday_type,
        "start_time": start,
        "end_time": end,
        "apply_hour": hours,
        "reason": str(data["reason"]),
    }
    raw = json.dumps({"params": params, "dry_run": False, "idempotency_key": "leave-" + start + "-" + str(data["staff_id"])}).encode("utf-8")
    request = urllib.request.Request(
        ONTOLOGY_ORIGIN + "/api/v1/actions/" + LEAVE_ACTION_ID + "/execute",
        data=raw,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + login()},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(detail[:180]) from None
    if not result.get("success"):
        raise RuntimeError(result.get("message") or "请假写入失败")
    return {"ok": True, "message": result.get("message") or "已写入请假"}


def reject(message: str, msg_id) -> tuple[int, dict]:
    return 200, {"jsonrpc": "2.0", "id": msg_id, "error": {"code": -32602, "message": message}}


def guard(payload: dict) -> tuple[int, dict] | None:
    msg_id = payload.get("id")
    method = payload.get("method")
    if method in {"initialize", "tools/list", "notifications/initialized"}:
        return None
    if method != "tools/call":
        return reject("门户只转发 MCP 握手和只读查询", msg_id)
    params = payload.get("params") or {}
    name = params.get("name")
    arguments = params.get("arguments") or {}
    if name not in READ_TOOLS:
        return reject("门户不能调用这个 MCP 工具", msg_id)
    ontology = arguments.get("ontology_name")
    if ontology not in ONTOLOGIES:
        return reject("这个 MCP 服务器没有接到门户", msg_id)
    if name == "ontology_object_find" and arguments.get("object_name") not in ONTOLOGIES[ontology]:
        return reject("这个对象不在门户可查范围内", msg_id)
    return None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/meeting/reserve":
            self.reserve()
            return
        if path == "/api/leave/check":
            self.leave_check()
            return
        if path == "/api/leave/apply":
            self.leave_apply()
            return
        if path == "/api/students/query":
            self.student_query()
            return
        if path == "/api/students/scenario":
            self.student_scenario()
            return
        if path == "/api/students/export":
            self.student_export()
            return
        if path != "/api/mcp":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0 or length > 65536:
            self.send_error(400)
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeError, json.JSONDecodeError):
            self.send_error(400)
            return
        if not isinstance(payload, dict):
            self.send_error(400)
            return
        blocked = guard(payload)
        try:
            status, body = blocked or ontology_mcp(payload)
        except Exception as exc:
            status, body = 502, {
                "jsonrpc": "2.0",
                "id": payload.get("id"),
                "error": {"code": -32000, "message": str(exc)[:180]},
            }
        raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def leave_check(self):
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0 or length > 65536:
            self.send_error(400)
            return
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(data, dict):
                raise ValueError("请求格式不正确")
            body = check_leave_window(
                str(data.get("staff_id") or ""),
                str(data.get("staff_name") or ""),
                str(data.get("start_time") or ""),
                str(data.get("end_time") or ""),
            )
            status = 200
        except ValueError as exc:
            status, body = 422, {"ok": False, "message": str(exc)}
        except Exception as exc:
            status, body = 502, {"ok": False, "message": str(exc)[:180]}
        raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def leave_apply(self):
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0 or length > 65536:
            self.send_error(400)
            return
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            body = apply_leave(data if isinstance(data, dict) else {})
            status = 200
        except ValueError as exc:
            status, body = 422, {"ok": False, "message": str(exc)}
        except Exception as exc:
            status, body = 502, {"ok": False, "message": str(exc)[:180]}
        raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def student_query(self):
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0 or length > 65536:
            self.send_error(400)
            return
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            body = query_students(data if isinstance(data, dict) else {})
            status = 200
        except ValueError as exc:
            status, body = 422, {"ok": False, "message": str(exc)}
        except Exception as exc:
            status, body = 502, {"ok": False, "message": str(exc)[:180]}
        raw = json.dumps(body, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def student_scenario(self):
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0 or length > 65536:
            self.send_error(400)
            return
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            body = query_student_scenario(data if isinstance(data, dict) else {})
            status = 200
        except ValueError as exc:
            status, body = 422, {"ok": False, "message": str(exc)}
        except Exception as exc:
            status, body = 502, {"ok": False, "message": str(exc)[:180]}
        raw = json.dumps(body, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def student_export(self):
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0 or length > 65536:
            self.send_error(400)
            return
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            payload, filename = export_students(data if isinstance(data, dict) else {})
        except ValueError as exc:
            raw = json.dumps({"ok": False, "message": str(exc)}, ensure_ascii=False).encode("utf-8")
            self.send_response(422)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        except Exception as exc:
            raw = json.dumps({"ok": False, "message": str(exc)[:180]}, ensure_ascii=False).encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        self.send_header("Content-Disposition", 'attachment; filename="retrain-gift.xlsx"')
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def reserve(self):
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0 or length > 65536:
            self.send_error(400)
            return
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            body = reserve_meeting(data if isinstance(data, dict) else {})
            status = 200
        except ValueError as exc:
            status, body = 422, {"ok": False, "message": str(exc)}
        except Exception as exc:
            status, body = 502, {"ok": False, "message": str(exc)[:180]}
        raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, format, *args):
        print("[mcp-bridge] " + (format % args))


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"OA portal http://{HOST}:{PORT}/portal/index.html")
    server.serve_forever()
