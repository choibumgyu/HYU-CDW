from sqlglot import parse_one, exp
import re

# 금지된 연산자 목록
FORBIDDEN_OPERATORS = {"||", "!=", "<>", "not in", "not between"}
# 금지된 함수 목록
FORBIDDEN_FUNCTIONS = {"now", "concat", "regexp"}
# 금지된 키워드 및 공격 패턴
FORBIDDEN_KEYWORDS = {"--", "/*", "*/", ";", "sleep", "benchmark", "exec"}

class SQLOperatorFunctionValidator:
    """
    SQLOperatorFunctionValidator 클래스는 SQL 쿼리 내 연산자, 함수, 키워드 사용을 검증합니다.

    주요 검증 항목:
    1. 허용되지 않은 연산자 사용 차단
    2. 금지된 함수 사용 차단
    3. SQL 키워드 및 공격 패턴 차단

    메서드:
    - __init__(self, sql: str): 초기화 메서드
    - validate(self): 검증 메서드를 호출하여 SQL을 검사
    - _validate_forbidden_keywords(self): SQL 텍스트 내 금지 키워드 검증
    - _validate_forbidden_functions(self): AST 기반 함수 검증
    - _validate_only_allowed_operators(self): AST 기반 연산자 검증
    """

    def __init__(self, sql: str):
        self.sql = sql
        self.ast = parse_one(sql, read="postgres")

    def validate(self):
        """
        SQL 쿼리의 연산자, 함수, 키워드 사용을 검증하는 메서드입니다.

        Raises:
            ValueError: 허용되지 않은 키워드, 함수, 연산자가 사용된 경우 발생합니다.
        """
        self._check_forbidden_keywords()
        self._check_forbidden_functions()
        self._check_only_allowed_operators()

    def _validate_forbidden_keywords(self):
        """
        SQL 쿼리 문자열에 포함된 금지된 키워드 및 공격 패턴을 검사합니다.

        예: '--', '/*', 'sleep', 'benchmark', 'exec' 등

        Raises:
            ValueError: 금지된 키워드 또는 공격 패턴이 포함된 경우
        """
        lowered_sql = self.sql.lower()
        for kw in FORBIDDEN_KEYWORDS:
            if kw in lowered_sql:
                raise ValueError(f"금지된 키워드 또는 공격 패턴 사용: '{kw}'")

    def _validate_forbidden_functions(self):
        """
        SQL AST 내 금지된 함수 호출이 있는지 검사합니다.

        예: NOW(), CONCAT(), REGEXP 등

        Raises:
            ValueError: 금지된 함수가 사용된 경우
        """
        for func in self.ast.find_all(exp.Func):
            func_name = func.name.lower()
            if func_name in FORBIDDEN_FUNCTIONS:
                raise ValueError(f"금지된 함수 사용: '{func_name}()'")

    def _validate_only_allowed_operators(self):
        """
        SQL AST 내 연산자가 허용된 목록(ALLOWED_OPERATORS)에 있는지 검사합니다.

        Raises:
            ValueError: 허용되지 않은 연산자가 사용된 경우
        """
        lowered_sql = self.sql.lower()
        for op in FORBIDDEN_OPERATORS:
            if op in lowered_sql:
                raise ValueError(f"허용되지 않은 연산자 사용: '{op}'")
