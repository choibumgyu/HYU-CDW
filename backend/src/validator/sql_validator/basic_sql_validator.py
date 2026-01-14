from sqlglot import parse_one, exp
from typing import Dict, Set

from src.modules.omop.service import get_allowed_schema

class BasicSQLValidator:
    """
    BasicSQLValidator 클래스는 LLM이 변환한 SQL문 검증을 담당합니다.
    
    주요 검증 항목:
    1. 혀용되지 않은 테이블, 컬럼 사용
    2. 허용되지 않은 DML 명령어 사용
    3. 허용되지 않은 DDL 명령어 사용
    
    메서드:
    - __init__(self, sql: str): 초기화 메서드
    - validate(self): 검증 메서드를 호출하여 SQL문 검증
    """
    
    def __init__(self, sql: str):
        self.sql = sql
        self.allowed_schema = get_allowed_schema()  # 허용된 스키마 목록
        
    def validate(self):
        """
        LLM이 변환한 SQL문을 검증하는 메서드입니다.
        
        Raises:
            ValueError: SQL 문법 오류 또는 금지된 명령어가 포함된 경우 발생합니다.
        """
        try:
            self.ast = parse_one(self.sql, read="postgres")
        except Exception as e:
            raise ValueError(str(e))
        
        self._validate_allowed_tables()
        self._validate_allowed_columns()
        self._check_forbidden_dml()
        self._check_forbidden_ddl()
        # self._validate_allowed_keywords()
        
    def _validate_allowed_tables(self) -> None:
        """
        SQL에 사용된 테이블이 허용된 테이블 목록(ALLOWED_SCHEMA)에 있는지 확인하는 메서드입니다.

        Raises:
            ValueError: 허용되지 않은 테이블이 포함된 경우 발생합니다.
        """
        used_tables = {table.name for table in self.ast.find_all(exp.Table)}
        invalid_tables = used_tables - self.allowed_schema.keys()

        if invalid_tables:
            raise ValueError(f"허용되지 않은 테이블 사용: {', '.join(invalid_tables)}")
    
    def _validate_allowed_columns(self) -> None:
        """
        SQL에 사용된 컬럼이 허용된 테이블 내 컬럼인지 확인하는 메서드입니다.

        Raises:
            ValueError: 허용되지 않은 컬럼이 포함된 경우 발생합니다.
        """
        invalid_columns = set()

        for col in self.ast.find_all(exp.Column):
            table = col.table
            column = col.name

            if table:
                # table.column 형태
                if table not in self.allowed_schema or column not in self.allowed_schema[table]:
                    invalid_columns.add(f"{table}.{column}")
            else:
                # 컬럼 이름만 있는 경우 > 모든 테이블에 대해 검사
                found = any(column in cols for cols in self.allowed_schema.values())
                if not found:
                    invalid_columns.add(column)

        if invalid_columns:
            raise ValueError(f"허용되지 않은 컬럼 사용: {', '.join(invalid_columns)}")
    
    def _check_forbidden_dml(self) -> None:
        """
        SQL에 DML 명령어(INSERT, UPDATE, DELETE)가 포함되어 있는지 검사하는 메서드입니다.
        
        Raises:
            ValueError: DML 명령어가 포함되어 있으면 예외 발생합니다.
        """
        dml_expressions = (exp.Insert, exp.Update, exp.Delete)

        if isinstance(self.ast, dml_expressions):
            raise ValueError("허용되지 않은 DML 명령어(INSERT, UPDATE, DELETE)가 포함되어 있습니다.")

    
    def _check_forbidden_ddl(self) -> None:
        """
        SQL에 DDL 명령어(CREATE, DROP, ALTER, TRUNCATE)가 포함되어 있는지 검사하는 메서드입니다.
        
        Raises:
            ValueError: DDL 명령어가 포함되어 있으면 예외 발생합니다.
        """
        ddl_expressions = (exp.Create, exp.Drop, exp.Alter, exp.TruncateTable)

        if isinstance(self.ast, ddl_expressions):
            raise ValueError("허용되지 않은 DDL 명령어(CREATE, DROP, ALTER, TRUNCATE)가 포함되어 있습니다.")
    
    def _validate_allowed_keywords(self):
        """
        select * 또는 select into 와 같은 허용되지 않은 키워드를 검사합니다.
        
        Raises:
            ValueError : 허용되지 않은 select 형식 또는 키워드 사용 시 발생합니다.
        """
        for select in self.ast.find_all(exp.Select):
            # select * 차단
            if any(isinstance(projection, exp.Star) for projection in select.expressions):
                raise ValueError("select *는 허용되지 않습니다.")
            
            # select into 차단
            if select.args.get("into"):
                raise ValueError("select into 구문은 허용되지 않습니다.")