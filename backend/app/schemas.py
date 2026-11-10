"""Pydantic 請求 / 回應模型。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class SemesterIn(BaseModel):
    label: str = ""
    term: str | None = None  # "上" / "下"
    course_ids: list[str] = Field(default_factory=list)


class PlanCheckIn(BaseModel):
    completed_course_ids: list[str] = Field(default_factory=list)
    semesters: list[SemesterIn] = Field(default_factory=list)
    min_credits: int = 12
    max_credits: int = 25
    workload_limit: int = 18


class SuggestIn(BaseModel):
    path_id: str
    completed_course_ids: list[str] = Field(default_factory=list)
    start_label: str = "大二上"
    start_term: str = "上"
    num_semesters: int = 4
    max_credits: int = 18
    workload_limit: int = 16


class PlanIn(BaseModel):
    owner: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=128)
    path_id: str | None = None
    completed_course_ids: list[str] = Field(default_factory=list)
    semesters: list[SemesterIn] = Field(default_factory=list)
    settings: dict = Field(default_factory=dict)


class ReviewIn(BaseModel):
    author: str = "匿名"
    rating: int = Field(ge=1, le=5)
    workload: int = Field(ge=1, le=5)
    comment: str = ""
    semester: str = ""


class SubmissionIn(BaseModel):
    author: str = "匿名"
    title: str = Field(min_length=1, max_length=128)
    goal: str = ""
    description: str = ""
    course_ids: list[str] = Field(default_factory=list)


class CommentIn(BaseModel):
    author: str = "匿名"
    text: str = Field(min_length=1)


class FavoriteIn(BaseModel):
    owner: str
    target_type: str
    target_id: str
