"""後端 API 煙霧測試（不需額外套件，直接呼叫 FastAPI app 的 ASGI 介面）。

執行：
    cd backend
    .venv\\Scripts\\python -m tests.test_api
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
TEST_DB = ROOT / "tests" / "test.db"
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ.setdefault("DATABASE_URL", f"sqlite:///{TEST_DB.as_posix()}")

from app.main import app, on_startup  # noqa: E402


async def call(method: str, path: str, body: dict | None = None) -> tuple[int, object]:
    raw = json.dumps(body).encode() if body is not None else b""
    if "?" in path:
        p, q = path.split("?", 1)
    else:
        p, q = path, ""
    scope = {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": method,
        "scheme": "http", "path": p, "raw_path": p.encode(), "query_string": q.encode(),
        "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(raw)).encode())],
        "client": ("test", 0), "server": ("test", 80),
    }
    sent = False
    status = 0
    chunks: list[bytes] = []

    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.disconnect"}
        sent = True
        return {"type": "http.request", "body": raw, "more_body": False}

    async def send(msg):
        nonlocal status
        if msg["type"] == "http.response.start":
            status = msg["status"]
        elif msg["type"] == "http.response.body":
            chunks.append(msg.get("body", b""))

    await app(scope, receive, send)
    data = b"".join(chunks)
    return status, (json.loads(data) if data else None)


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        raise SystemExit(1)


async def main():
    on_startup()

    s, paths = await call("GET", "/api/paths?q=%E6%88%91%E6%83%B3%E6%88%90%E7%82%BA%E9%A1%9E%E6%AF%94%20IC%20%E8%A8%AD%E8%A8%88%E5%B7%A5%E7%A8%8B%E5%B8%AB")
    check(s == 200 and paths[0]["id"] == "analog-ic", f"目標搜尋：第一名 {paths[0]['title']} (score {paths[0]['score']})")

    s, p = await call("GET", "/api/paths/analog-ic")
    check(s == 200 and len(p["courses"]) > 10 and p["edges"], f"路徑詳情：{len(p['courses'])} 門課、{len(p['edges'])} 條先修邊、{p['total_credits']} 學分")

    s, cs = await call("GET", "/api/courses?q=%E9%9B%BB%E5%AD%90")
    check(s == 200 and len(cs) >= 3, f"課程搜尋「電子」：{len(cs)} 筆")

    s, c = await call("GET", "/api/courses/elec1")
    check(s == 200 and c["avg_rating"] and any(u["course_id"] == "elec2" for u in c["unlocks"]),
          f"課程詳情：評價 {c['review_count']} 則、可解鎖 {[u['name'] for u in c['unlocks']]}")

    s, r = await call("POST", "/api/plans/check", {
        "completed_course_ids": ["circuit"],
        "semesters": [{"label": "大二上", "term": "上", "course_ids": ["elec1", "em1", "analogic", "phys1"]}],
    })
    kinds = {i["kind"] for i in r["semesters"][0]["issues"]}
    check(s == 200 and {"conflict", "prerequisite", "term"} <= kinds, f"計畫檢查：{r['summary']} {sorted(kinds)}")
    for i in r["semesters"][0]["issues"]:
        print("   -", i["level"], i["message"])

    s, r = await call("POST", "/api/plans/suggest", {
        "path_id": "analog-ic", "completed_course_ids": ["calc1", "phys1", "circuit", "calc2", "phys2", "linalg"],
        "start_label": "大二上", "start_term": "上", "num_semesters": 4,
    })
    check(s == 200 and r["semesters"][0]["course_ids"], "自動排課：" + " | ".join(f"{x['label']}:{x['course_ids']}" for x in r["semesters"]))
    print("   未排入：", r["unscheduled"])

    s, r = await call("GET", "/api/paths/analog-ic/compare/digital-ic")
    check(s == 200 and r["common"], f"路徑比較：共同 {len(r['common'])}、僅類比 {len(r['only_a'])}、僅數位 {len(r['only_b'])}")

    s, r = await call("POST", "/api/plans", {"owner": "tester", "name": "我的計畫",
                                            "semesters": [{"label": "大二上", "term": "上", "course_ids": ["elec1"]}]})
    check(s == 201, f"儲存計畫 id={r['id']}")
    s, r = await call("GET", "/api/plans?owner=tester")
    check(s == 200 and len(r) == 1, "讀取計畫")

    s, subs = await call("GET", "/api/submissions")
    check(s == 200 and all(x["status"] == "approved" for x in subs), f"公開投稿 {len(subs)} 篇")
    s, r = await call("POST", "/api/submissions", {"author": "t", "title": "測試投稿", "course_ids": ["prog", "dsa"]})
    check(s == 201 and r["status"] == "pending", "新投稿為待審核")
    s, r = await call("POST", f"/api/submissions/{r['id']}/review?action=approve&token=ntu-admin")
    check(s == 200 and r["status"] == "approved", "管理員審核通過")
    s, r = await call("POST", f"/api/submissions/{r['id']}/like")
    check(s == 200 and r["likes"] == 1, "按讚")
    s, r = await call("POST", "/api/courses/elec1/reviews", {"author": "t", "rating": 5, "workload": 4, "comment": "讚"})
    check(s == 201, "新增課程評價")
    print("ALL PASS")


if __name__ == "__main__":
    asyncio.run(main())
