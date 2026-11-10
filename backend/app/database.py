"""資料庫連線設定。

預設使用 SQLite（免安裝即可執行），正式部署時將環境變數 DATABASE_URL 改成
PostgreSQL 連線字串（例如 postgresql+psycopg://user:pw@localhost/pathfinder）
即可，資料模型不需修改。
"""
import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SQLITE = f"sqlite:///{(BASE_DIR / 'pathfinder.db').as_posix()}"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_SQLITE)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
