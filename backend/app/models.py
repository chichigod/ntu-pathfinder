"""SQLAlchemy 資料模型。"""
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def now() -> datetime:
    return datetime.now()


class Course(Base):
    """臺大課程（第一階段：電機、資工相關）。"""

    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    code: Mapped[str] = mapped_column(String(32), index=True)
    name: Mapped[str] = mapped_column(String(128), index=True)
    name_en: Mapped[str] = mapped_column(String(128), default="")
    department: Mapped[str] = mapped_column(String(32), index=True)
    credits: Mapped[int] = mapped_column(Integer)
    level: Mapped[str] = mapped_column(String(16), default="基礎")  # 基礎 / 核心 / 進階
    suggested_year: Mapped[int] = mapped_column(Integer, default=1)
    terms: Mapped[list] = mapped_column(JSON, default=list)  # ["上", "下"]
    instructor: Mapped[str] = mapped_column(String(64), default="")
    slots: Mapped[list] = mapped_column(JSON, default=list)  # [{"day":1,"periods":[2,3,4]}]
    prerequisites: Mapped[list] = mapped_column(JSON, default=list)  # [{"course_id":"..","type":"hard|suggested"}]
    workload: Mapped[int] = mapped_column(Integer, default=3)  # 1~5
    workload_note: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str] = mapped_column(Text, default="")
    resources: Mapped[list] = mapped_column(JSON, default=list)  # [{"title","url","type"}]
    source: Mapped[str] = mapped_column(String(256), default="")
    source_url: Mapped[str] = mapped_column(String(256), default="")
    updated_at: Mapped[str] = mapped_column(String(16), default="")


class Path(Base):
    """經人工確認的職涯學習路徑。"""

    __tablename__ = "paths"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    title: Mapped[str] = mapped_column(String(128))
    category: Mapped[str] = mapped_column(String(32), default="")
    keywords: Mapped[list] = mapped_column(JSON, default=list)
    summary: Mapped[str] = mapped_column(Text, default="")
    job_description: Mapped[str] = mapped_column(Text, default="")
    skills: Mapped[list] = mapped_column(JSON, default=list)  # [{"name","description","course_ids":[],"reason"}]
    stages: Mapped[list] = mapped_column(JSON, default=list)  # [{"label","year","term","course_ids":[]}]
    related_path_ids: Mapped[list] = mapped_column(JSON, default=list)
    verified_by: Mapped[str] = mapped_column(String(64), default="")
    sources: Mapped[list] = mapped_column(JSON, default=list)
    updated_at: Mapped[str] = mapped_column(String(16), default="")


class Review(Base):
    """學生課程評價。"""

    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    course_id: Mapped[str] = mapped_column(String(32), index=True)
    author: Mapped[str] = mapped_column(String(64), default="匿名")
    rating: Mapped[int] = mapped_column(Integer, default=4)  # 1~5 推薦度
    workload: Mapped[int] = mapped_column(Integer, default=3)  # 1~5 課業負擔
    comment: Mapped[str] = mapped_column(Text, default="")
    semester: Mapped[str] = mapped_column(String(16), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Plan(Base):
    """使用者儲存的個人學習計畫。"""

    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(128))
    path_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    completed_course_ids: Mapped[list] = mapped_column(JSON, default=list)
    semesters: Mapped[list] = mapped_column(JSON, default=list)  # [{"label","term","course_ids":[]}]
    settings: Mapped[dict] = mapped_column(JSON, default=dict)  # {"min_credits","max_credits"}
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)


class Submission(Base):
    """學生投稿的學習路徑（需管理員審核後公開）。"""

    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    author: Mapped[str] = mapped_column(String(64), default="匿名")
    title: Mapped[str] = mapped_column(String(128))
    goal: Mapped[str] = mapped_column(String(128), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    course_ids: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending / approved / rejected
    likes: Mapped[int] = mapped_column(Integer, default=0)
    comments: Mapped[list] = mapped_column(JSON, default=list)  # [{"author","text","created_at"}]
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Favorite(Base):
    """使用者收藏（學習路徑或投稿）。"""

    __tablename__ = "favorites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner: Mapped[str] = mapped_column(String(64), index=True)
    target_type: Mapped[str] = mapped_column(String(16))  # path / submission
    target_id: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
