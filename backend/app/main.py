"""NTU PathFinder 後端 API（FastAPI）。

啟動：
    cd backend
    .venv\\Scripts\\uvicorn app.main:app --reload --port 8000
API 文件：http://localhost:8000/docs
"""
from __future__ import annotations

import os
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models, schemas, seed_data, services
from .database import Base, SessionLocal, engine, get_db

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "ntu-admin")

app = FastAPI(title="NTU PathFinder API", version="0.1.0",
              description="台大學生個人化學習地圖：學習路徑推薦、課程資訊、個人化排課與路徑投稿。")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------- 啟動與種子資料
def seed(db: Session) -> None:
    """課程與路徑每次啟動都以種子資料為準（人工維護的資料庫）；評價 / 投稿只在第一次建立。"""
    for c in seed_data.COURSES:
        db.merge(models.Course(**c))
    for p in seed_data.PATHS:
        db.merge(models.Path(**p))
    if db.scalar(select(func.count()).select_from(models.Review)) == 0:
        for r in seed_data.SEED_REVIEWS:
            db.add(models.Review(**r))
    if db.scalar(select(func.count()).select_from(models.Submission)) == 0:
        for s in seed_data.SEED_SUBMISSIONS:
            db.add(models.Submission(**s))
    db.commit()


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed(db)


# ---------------------------------------------------------------- 工具
def course_dict(c: models.Course) -> dict:
    return {col.name: getattr(c, col.name) for col in models.Course.__table__.columns}


def path_dict(p: models.Path) -> dict:
    return {col.name: getattr(p, col.name) for col in models.Path.__table__.columns}


def review_dict(r: models.Review) -> dict:
    return {"id": r.id, "course_id": r.course_id, "author": r.author, "rating": r.rating,
            "workload": r.workload, "comment": r.comment, "semester": r.semester,
            "created_at": r.created_at.isoformat(timespec="minutes")}


def plan_dict(p: models.Plan) -> dict:
    return {"id": p.id, "owner": p.owner, "name": p.name, "path_id": p.path_id,
            "completed_course_ids": p.completed_course_ids, "semesters": p.semesters,
            "settings": p.settings, "created_at": p.created_at.isoformat(timespec="minutes"),
            "updated_at": p.updated_at.isoformat(timespec="minutes")}


def submission_dict(s: models.Submission) -> dict:
    return {"id": s.id, "author": s.author, "title": s.title, "goal": s.goal,
            "description": s.description, "course_ids": s.course_ids, "status": s.status,
            "likes": s.likes, "comments": s.comments,
            "created_at": s.created_at.isoformat(timespec="minutes")}


def all_courses(db: Session) -> dict[str, dict]:
    return {c.id: course_dict(c) for c in db.scalars(select(models.Course))}


def get_course_or_404(db: Session, course_id: str) -> models.Course:
    c = db.get(models.Course, course_id)
    if not c:
        raise HTTPException(404, "找不到課程")
    return c


def get_path_or_404(db: Session, path_id: str) -> models.Path:
    p = db.get(models.Path, path_id)
    if not p:
        raise HTTPException(404, "找不到學習路徑")
    return p


def course_stats(db: Session) -> dict[str, dict]:
    rows = db.execute(
        select(models.Review.course_id, func.count(), func.avg(models.Review.rating), func.avg(models.Review.workload))
        .group_by(models.Review.course_id)
    ).all()
    return {cid: {"review_count": n, "avg_rating": round(float(r), 1), "avg_workload": round(float(w), 1)}
            for cid, n, r, w in rows}


# ---------------------------------------------------------------- 課程
@app.get("/api/meta")
def meta():
    return {"name": "NTU PathFinder", "data_updated_at": seed_data.UPDATED,
            "data_source": seed_data.SOURCE, "data_source_url": seed_data.SOURCE_URL,
            "departments": sorted({c["department"] for c in seed_data.COURSES})}


@app.get("/api/courses")
def list_courses(q: str = "", department: str = "", level: str = "", term: str = "",
                 db: Session = Depends(get_db)):
    stats = course_stats(db)
    out = []
    ql = q.strip().lower()
    for c in db.scalars(select(models.Course).order_by(models.Course.suggested_year, models.Course.code)):
        if department and department not in c.department:
            continue
        if level and c.level != level:
            continue
        if term and term not in c.terms:
            continue
        if ql and not (ql in c.name.lower() or ql in c.name_en.lower() or ql in c.code.lower()
                       or ql in c.instructor.lower() or ql in c.description.lower()):
            continue
        d = course_dict(c)
        d["slot_text"] = services.slot_text(c.slots)
        d.update(stats.get(c.id, {"review_count": 0, "avg_rating": None, "avg_workload": None}))
        out.append(d)
    return out


@app.get("/api/courses/{course_id}")
def get_course(course_id: str, db: Session = Depends(get_db)):
    c = get_course_or_404(db, course_id)
    courses = all_courses(db)
    d = course_dict(c)
    d["slot_text"] = services.slot_text(c.slots)
    d["prerequisite_courses"] = [
        {**pre, "name": courses[pre["course_id"]]["name"], "code": courses[pre["course_id"]]["code"]}
        for pre in c.prerequisites if pre["course_id"] in courses
    ]
    d["unlocks"] = [
        {"course_id": o["id"], "name": o["name"], "code": o["code"],
         "type": next(p["type"] for p in o["prerequisites"] if p["course_id"] == c.id)}
        for o in courses.values() if any(p["course_id"] == c.id for p in o["prerequisites"])
    ]
    d["in_paths"] = [
        {"path_id": p.id, "title": p.title}
        for p in db.scalars(select(models.Path))
        if any(c.id in st["course_ids"] for st in p.stages)
    ]
    reviews = db.scalars(select(models.Review).where(models.Review.course_id == c.id)
                         .order_by(models.Review.created_at.desc())).all()
    d["reviews"] = [review_dict(r) for r in reviews]
    d.update(course_stats(db).get(c.id, {"review_count": 0, "avg_rating": None, "avg_workload": None}))
    return d


@app.post("/api/courses/{course_id}/reviews", status_code=201)
def add_review(course_id: str, body: schemas.ReviewIn, db: Session = Depends(get_db)):
    get_course_or_404(db, course_id)
    r = models.Review(course_id=course_id, **body.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return review_dict(r)


# ---------------------------------------------------------------- 學習路徑
@app.get("/api/paths")
def list_paths(q: str = "", db: Session = Depends(get_db)):
    paths = [path_dict(p) for p in db.scalars(select(models.Path))]
    results = services.search_paths(q, paths)
    courses = all_courses(db)
    out = []
    for r in results:
        p = r["path"]
        ids = {cid for st in p["stages"] for cid in st["course_ids"]}
        out.append({
            "id": p["id"], "title": p["title"], "category": p["category"], "summary": p["summary"],
            "keywords": p["keywords"], "course_count": len(ids),
            "total_credits": sum(courses[c]["credits"] for c in ids if c in courses),
            "skill_count": len(p["skills"]), "score": r["score"], "matched": r["matched"],
            "updated_at": p["updated_at"], "verified_by": p["verified_by"],
        })
    return out


@app.get("/api/paths/{path_id}")
def get_path(path_id: str, db: Session = Depends(get_db)):
    p = get_path_or_404(db, path_id)
    courses = all_courses(db)
    stats = course_stats(db)
    d = path_dict(p)
    ids = []
    for st in p.stages:
        for cid in st["course_ids"]:
            if cid in courses and cid not in ids:
                ids.append(cid)
    for sk in p.skills:
        for cid in sk["course_ids"]:
            if cid in courses and cid not in ids:
                ids.append(cid)
    d["courses"] = []
    for cid in ids:
        c = dict(courses[cid])
        c["slot_text"] = services.slot_text(c["slots"])
        c.update(stats.get(cid, {"review_count": 0, "avg_rating": None, "avg_workload": None}))
        d["courses"].append(c)
    id_set = set(ids)
    d["edges"] = [
        {"source": pre["course_id"], "target": cid, "type": pre["type"]}
        for cid in ids for pre in courses[cid]["prerequisites"] if pre["course_id"] in id_set
    ]
    d["total_credits"] = sum(courses[c]["credits"] for c in ids)
    d["related_paths"] = [{"id": rp.id, "title": rp.title}
                          for rid in p.related_path_ids if (rp := db.get(models.Path, rid))]
    d["favorite_count"] = db.scalar(
        select(func.count()).select_from(models.Favorite)
        .where(models.Favorite.target_type == "path", models.Favorite.target_id == p.id)) or 0
    return d


@app.get("/api/paths/{path_id}/compare/{other_id}")
def compare_paths(path_id: str, other_id: str, db: Session = Depends(get_db)):
    a = get_path_or_404(db, path_id)
    b = get_path_or_404(db, other_id)
    courses = all_courses(db)

    def ids_of(p):
        return [cid for st in p.stages for cid in st["course_ids"] if cid in courses]

    ia, ib = ids_of(a), ids_of(b)
    common = [c for c in ia if c in ib]
    only_a = [c for c in ia if c not in ib]
    only_b = [c for c in ib if c not in ia]

    def info(cids):
        return [{"id": c, "name": courses[c]["name"], "code": courses[c]["code"], "credits": courses[c]["credits"],
                 "level": courses[c]["level"], "workload": courses[c]["workload"]} for c in cids]

    return {
        "a": {"id": a.id, "title": a.title, "total_credits": sum(courses[c]["credits"] for c in ia),
              "skills": [s["name"] for s in a.skills]},
        "b": {"id": b.id, "title": b.title, "total_credits": sum(courses[c]["credits"] for c in ib),
              "skills": [s["name"] for s in b.skills]},
        "common": info(common), "only_a": info(only_a), "only_b": info(only_b),
    }


# ---------------------------------------------------------------- 排課
@app.post("/api/plans/check")
def check_plan(body: schemas.PlanCheckIn, db: Session = Depends(get_db)):
    return services.check_plan(all_courses(db), body.completed_course_ids,
                               [s.model_dump() for s in body.semesters],
                               body.min_credits, body.max_credits, body.workload_limit)


@app.post("/api/plans/suggest")
def suggest(body: schemas.SuggestIn, db: Session = Depends(get_db)):
    p = get_path_or_404(db, body.path_id)
    return services.suggest_schedule(all_courses(db), path_dict(p), body.completed_course_ids,
                                     body.start_label, body.start_term, body.num_semesters,
                                     body.max_credits, body.workload_limit)


@app.get("/api/plans")
def list_plans(owner: str = Query(min_length=1), db: Session = Depends(get_db)):
    rows = db.scalars(select(models.Plan).where(models.Plan.owner == owner)
                      .order_by(models.Plan.updated_at.desc())).all()
    return [plan_dict(p) for p in rows]


@app.post("/api/plans", status_code=201)
def create_plan(body: schemas.PlanIn, db: Session = Depends(get_db)):
    p = models.Plan(**body.model_dump())
    p.semesters = [s.model_dump() for s in body.semesters]
    db.add(p)
    db.commit()
    db.refresh(p)
    return plan_dict(p)


@app.put("/api/plans/{plan_id}")
def update_plan(plan_id: int, body: schemas.PlanIn, db: Session = Depends(get_db)):
    p = db.get(models.Plan, plan_id)
    if not p or p.owner != body.owner:
        raise HTTPException(404, "找不到計畫")
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    p.semesters = [s.model_dump() for s in body.semesters]
    p.updated_at = datetime.now()
    db.commit()
    db.refresh(p)
    return plan_dict(p)


@app.delete("/api/plans/{plan_id}", status_code=204)
def delete_plan(plan_id: int, owner: str, db: Session = Depends(get_db)):
    p = db.get(models.Plan, plan_id)
    if not p or p.owner != owner:
        raise HTTPException(404, "找不到計畫")
    db.delete(p)
    db.commit()


# ---------------------------------------------------------------- 投稿與評價
@app.get("/api/submissions")
def list_submissions(status: str = "approved", token: str = "", db: Session = Depends(get_db)):
    if status != "approved" and token != ADMIN_TOKEN:
        raise HTTPException(403, "需要管理員權限")
    q = select(models.Submission).order_by(models.Submission.likes.desc(), models.Submission.created_at.desc())
    if status != "all":
        q = q.where(models.Submission.status == status)
    courses = all_courses(db)
    out = []
    for s in db.scalars(q):
        d = submission_dict(s)
        d["courses"] = [{"id": c, "name": courses[c]["name"], "code": courses[c]["code"]}
                        for c in s.course_ids if c in courses]
        out.append(d)
    return out


@app.post("/api/submissions", status_code=201)
def create_submission(body: schemas.SubmissionIn, db: Session = Depends(get_db)):
    courses = all_courses(db)
    bad = [c for c in body.course_ids if c not in courses]
    if bad:
        raise HTTPException(400, f"課程不存在：{', '.join(bad)}")
    s = models.Submission(**body.model_dump(), status="pending")
    db.add(s)
    db.commit()
    db.refresh(s)
    return submission_dict(s)


@app.post("/api/submissions/{sid}/like")
def like_submission(sid: int, db: Session = Depends(get_db)):
    s = db.get(models.Submission, sid)
    if not s or s.status != "approved":
        raise HTTPException(404, "找不到投稿")
    s.likes += 1
    db.commit()
    return {"id": s.id, "likes": s.likes}


@app.post("/api/submissions/{sid}/comments", status_code=201)
def comment_submission(sid: int, body: schemas.CommentIn, db: Session = Depends(get_db)):
    s = db.get(models.Submission, sid)
    if not s or s.status != "approved":
        raise HTTPException(404, "找不到投稿")
    s.comments = [*s.comments, {"author": body.author, "text": body.text,
                                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M")}]
    db.commit()
    return submission_dict(s)


@app.post("/api/submissions/{sid}/review")
def review_submission(sid: int, action: str, token: str, db: Session = Depends(get_db)):
    if token != ADMIN_TOKEN:
        raise HTTPException(403, "管理員密碼錯誤")
    s = db.get(models.Submission, sid)
    if not s:
        raise HTTPException(404, "找不到投稿")
    if action not in ("approve", "reject"):
        raise HTTPException(400, "action 必須是 approve 或 reject")
    s.status = "approved" if action == "approve" else "rejected"
    db.commit()
    return submission_dict(s)


# ---------------------------------------------------------------- 收藏
@app.get("/api/favorites")
def list_favorites(owner: str, db: Session = Depends(get_db)):
    rows = db.scalars(select(models.Favorite).where(models.Favorite.owner == owner)).all()
    return [{"target_type": f.target_type, "target_id": f.target_id} for f in rows]


@app.post("/api/favorites")
def toggle_favorite(body: schemas.FavoriteIn, db: Session = Depends(get_db)):
    f = db.scalar(select(models.Favorite).where(
        models.Favorite.owner == body.owner, models.Favorite.target_type == body.target_type,
        models.Favorite.target_id == body.target_id))
    if f:
        db.delete(f)
        db.commit()
        return {"favorited": False}
    db.add(models.Favorite(**body.model_dump()))
    db.commit()
    return {"favorited": True}
