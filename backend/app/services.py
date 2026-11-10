"""推薦、檢查與排課邏輯。

- search_paths: 以關鍵字將使用者輸入的目標對應到人工確認的學習路徑。
- check_plan: 衝堂、學分上下限、先修條件、開課學期、課業負擔檢查。
- suggest_schedule: 依路徑與已修課程，貪婪式地將課程安排到未來學期。
"""
from __future__ import annotations

from itertools import combinations

DAY_NAMES = {1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六", 7: "日"}


def slot_text(slots: list[dict]) -> str:
    if not slots:
        return "時間另訂"
    return "、".join(f"週{DAY_NAMES.get(s['day'], s['day'])} {'/'.join(str(p) for p in s['periods'])} 節" for s in slots)


# ---------------------------------------------------------------- 路徑搜尋
def search_paths(query: str, paths: list[dict]) -> list[dict]:
    q = (query or "").strip().lower()
    if not q:
        return [{"path": p, "score": 0, "matched": []} for p in paths]
    results = []
    for p in paths:
        score = 0
        matched = []
        if p["title"].lower() in q or q in p["title"].lower():
            score += 10
            matched.append(p["title"])
        for kw in p["keywords"]:
            k = kw.lower()
            if k in q:
                score += 3 if len(k) > 1 else 1
                matched.append(kw)
        if q in p["summary"].lower():
            score += 1
        if score:
            results.append({"path": p, "score": score, "matched": sorted(set(matched))})
    results.sort(key=lambda r: -r["score"])
    return results


# ---------------------------------------------------------------- 時間衝突
def slots_overlap(a: list[dict], b: list[dict]) -> list[str]:
    hits = []
    for sa in a:
        for sb in b:
            if sa["day"] == sb["day"]:
                common = sorted(set(sa["periods"]) & set(sb["periods"]))
                if common:
                    hits.append(f"週{DAY_NAMES.get(sa['day'])} 第 {'/'.join(map(str, common))} 節")
    return hits


# ---------------------------------------------------------------- 計畫檢查
def check_plan(courses: dict[str, dict], completed: list[str], semesters: list[dict],
               min_credits: int = 12, max_credits: int = 25, workload_limit: int = 18) -> dict:
    taken_before: set[str] = set(completed)
    unknown = [cid for cid in completed if cid not in courses]
    report_semesters = []
    total_issues = {"error": 0, "warning": 0, "info": 0}

    def issue(level, kind, message, course_ids=None):
        total_issues[level] += 1
        return {"level": level, "kind": kind, "message": message, "course_ids": course_ids or []}

    for sem in semesters:
        issues = []
        ids = [cid for cid in sem.get("course_ids", []) if cid in courses]
        cs = [courses[cid] for cid in ids]
        credits = sum(c["credits"] for c in cs)
        workload = sum(c["workload"] for c in cs)
        term = sem.get("term")

        # 學分上下限
        if ids and credits < min_credits:
            issues.append(issue("warning", "credits", f"本學期僅 {credits} 學分，低於下限 {min_credits} 學分。"))
        if credits > max_credits:
            issues.append(issue("error", "credits", f"本學期 {credits} 學分，超過上限 {max_credits} 學分。"))

        # 重複修課
        for cid in ids:
            if cid in taken_before:
                issues.append(issue("warning", "duplicate", f"「{courses[cid]['name']}」已修過或已排在先前學期。", [cid]))

        # 衝堂
        for a, b in combinations(cs, 2):
            hits = slots_overlap(a["slots"], b["slots"])
            if hits:
                issues.append(issue("error", "conflict",
                                    f"「{a['name']}」與「{b['name']}」衝堂：{'、'.join(hits)}。", [a["id"], b["id"]]))

        # 先修條件 / 開課學期
        for c in cs:
            for pre in c["prerequisites"]:
                pid = pre["course_id"]
                if pid in taken_before:
                    continue
                pname = courses[pid]["name"] if pid in courses else pid
                if pre["type"] == "hard":
                    extra = "（同學期修習不算先修）" if pid in ids else ""
                    issues.append(issue("error", "prerequisite",
                                        f"「{c['name']}」需先修「{pname}」{extra}。", [c["id"], pid]))
                else:
                    issues.append(issue("warning", "prerequisite",
                                        f"「{c['name']}」建議先修「{pname}」，未修過可能較吃力。", [c["id"], pid]))
            if term and c["terms"] and term not in c["terms"]:
                issues.append(issue("warning", "term",
                                    f"「{c['name']}」通常只在{'、'.join(c['terms'])}學期開課，本學期（{term}）可能不開。", [c["id"]]))

        # 課業負擔
        if workload > workload_limit:
            issues.append(issue("warning", "workload",
                                f"本學期預估負擔指數 {workload}（上限建議 {workload_limit}），作業與實驗可能過多。"))
        heavy = [c for c in cs if c["workload"] >= 5]
        if len(heavy) >= 2:
            issues.append(issue("info", "workload",
                                f"同時修 {len(heavy)} 門負擔極重的課：{'、'.join(c['name'] for c in heavy)}。",
                                [c["id"] for c in heavy]))

        report_semesters.append({
            "label": sem.get("label", ""),
            "term": term,
            "credits": credits,
            "workload": workload,
            "issues": issues,
        })
        taken_before |= set(ids)

    return {
        "ok": total_issues["error"] == 0,
        "summary": total_issues,
        "unknown_course_ids": unknown,
        "semesters": report_semesters,
    }


# ---------------------------------------------------------------- 自動排課
def next_term(term: str) -> str:
    return "下" if term == "上" else "上"


def suggest_schedule(courses: dict[str, dict], path: dict, completed: list[str],
                     start_label: str, start_term: str, num_semesters: int = 4,
                     max_credits: int = 18, workload_limit: int = 16) -> dict:
    """依路徑階段順序，以貪婪法把尚未修過的課程填入未來學期。

    規則：硬性先修必須在更早的學期完成；不與同學期課程衝堂；不超過學分與負擔上限；
    只排在有開課的學期。排不進去的課程會回傳在 unscheduled 中並附原因。
    """
    done = set(completed)
    ordered: list[str] = []
    for st in path["stages"]:
        for cid in st["course_ids"]:
            if cid in courses and cid not in done and cid not in ordered:
                ordered.append(cid)

    semesters = []
    term = start_term
    year_no, _ = _parse_label(start_label)
    label_year = year_no
    for i in range(num_semesters):
        if i > 0:
            if term == "下":
                label_year += 1
            term = next_term(term)
        semesters.append({"label": f"大{_cn(label_year)}{term}", "term": term, "year": label_year, "course_ids": []})

    remaining = list(ordered)
    reasons: dict[str, str] = {}
    for sem in semesters:
        credits = 0
        workload = 0
        placed_before = set(done)
        placed_here: list[dict] = []
        for cid in list(remaining):
            c = courses[cid]
            if c["terms"] and sem["term"] not in c["terms"]:
                reasons[cid] = f"{sem['term']}學期不開課"
                continue
            if c.get("suggested_year", 1) > sem["year"]:
                reasons[cid] = f"建議大{_cn(c['suggested_year'])}以後再修"
                continue
            missing = [p["course_id"] for p in c["prerequisites"]
                       if p["type"] == "hard" and p["course_id"] not in placed_before]
            if missing:
                reasons[cid] = "先修尚未完成：" + "、".join(courses[m]["name"] for m in missing if m in courses)
                continue
            if credits + c["credits"] > max_credits:
                reasons[cid] = "學分已達上限"
                continue
            if workload + c["workload"] > workload_limit:
                reasons[cid] = "課業負擔已達上限"
                continue
            if any(slots_overlap(c["slots"], o["slots"]) for o in placed_here):
                reasons[cid] = "與同學期課程衝堂"
                continue
            sem["course_ids"].append(cid)
            placed_here.append(c)
            credits += c["credits"]
            workload += c["workload"]
            remaining.remove(cid)
            reasons.pop(cid, None)
        done |= set(sem["course_ids"])

    for sem in semesters:
        sem.pop("year", None)
    return {
        "semesters": semesters,
        "unscheduled": [{"course_id": cid, "reason": reasons.get(cid, "超出規劃學期數")} for cid in remaining],
    }


def _cn(n: int) -> str:
    return {1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六"}.get(n, str(n))


def _parse_label(label: str) -> tuple[int, str]:
    mapping = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6}
    year = 1
    for ch, n in mapping.items():
        if f"大{ch}" in (label or ""):
            year = n
            break
    term = "上" if "上" in (label or "") else "下"
    return year, term
