from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy import MetaData, Table, select, and_

from fastapi import Depends
from fastapi import HTTPException

from src.modules.log.dto import SqlGeneratorLogRequestModel
from src.config import settings
from src.database import get_db_internal

import traceback


def save_sql_generator_log (db_log : SqlGeneratorLogRequestModel):
    db = get_db_internal()
    
    try:    
        db.add(db_log)
        db.commit()
        db.refresh(db_log)
        return db_log
    
    except SQLAlchemyError as db_err:
        db.rollback()
        print(f"Database Error: {db_err}")
        traceback.print_exc()

    except Exception as e:
        db.rollback()
        print(f"Unexpected Error: {e}")
        traceback.print_exc()
    
    finally:
        db.close()

# LOG 용 query, sql 받아오는 함수    
def get_query_and_log(limit : int = 50) -> tuple[list[str], list[str]]:
    db = get_db_internal()
    
    query_list = []
    sql_list = []
    
    try:
        # Session의 bind(연결된 엔진)로부터 MetaData를 가져오거나 직접 정의
        # 여기서는 Session의 엔진을 사용하여 테이블 정보를 로드하는 방식 사용
        metadata = MetaData()
        # Session에 연결된 엔진을 사용하여 테이블 메타데이터를 반영
        sql_generator_log_table = Table(
            'sql_generator_log',
            metadata,
            autoload_with=db.bind, # Session에 바인딩된 엔진 사용
        )

        # select 문 작성
        stmt = select(
            sql_generator_log_table.c.user_input_text,
            sql_generator_log_table.c.generated_sql
        ).where(
            and_(
                # query 컬럼이 NULL이 아니고 빈 문자열이 아닌 경우
                sql_generator_log_table.c.user_input_text.isnot(None),
                sql_generator_log_table.c.user_input_text != '',
                # sql 컬럼이 NULL이 아니고 빈 문자열이 아닌 경우
                sql_generator_log_table.c.generated_sql.isnot(None),
                sql_generator_log_table.c.generated_sql != ''
            )
        ).limit(limit)

        # 주어진 Session을 사용하여 쿼리 실행
        result = db.execute(stmt)

        # 결과를 순회하며 각 리스트에 추가
        # result는 ScalarResult 또는 Result 객체일 수 있으며, fetchall()을 사용하거나 직접 순회
        for row in result:
             # 결과 row는 튜플처럼 접근하거나 컬럼 이름으로 속성 접근 가능
             # row는 Row 객체이며, 인덱스 또는 컬럼 키(이름)로 접근 가능
             query_list.append(row.user_input_text)
             sql_list.append(row.generated_sql)

        # Query list 가 빈 경우 예시 하나씩 넣어줌
        if not query_list or not sql_list:
            query_list = ["show person"]
            sql_list = ["select * from person"]
   
        
    except Exception as e:
        db.rollback()
        print(f"데이터베이스 오류 발생 (Session 사용): {e}")
        query_list = ["show person"]
        sql_list = ["select * from person"]
    
    finally:
        db.close()

    return query_list, sql_list
        