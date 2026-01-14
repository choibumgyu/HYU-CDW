# app/database.py 파일

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from typing import Generator

# SQLAlchemy 엔진 생성
# connect_args는 필요에 따라 추가 (예: SSL 설정)
_engine = create_engine(os.getenv("DATABASE_URL")) # .env에서 로드한 URL 사용

# 데이터베이스 세션 생성기
_SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
print("DB connected.")
# 모든 모델이 상속할 기본 클래스
# 이 Base 객체가 Alembic과 모델을 연결하는 핵심입니다.
Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    db = _SessionLocal()
    try:
        yield db
    except Exception as e:
        print(f"Error in database session: {e}")
        db.rollback()
        raise
    finally:
        db.close()

"""
    내부 service (LOG) 는 기본적으로 router 계층이 없어서
    fastapi 의존성 주입으로 작동하는 위의 코드 실행 불가로
    아래의 코드를 만듬
"""
def get_db_internal() -> Session:
    db = _SessionLocal()
    return db