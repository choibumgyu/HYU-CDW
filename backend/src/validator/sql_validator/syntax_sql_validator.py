from sqlglot import parse_one, ParseError, exp

class SQLSyntaxStructureValidator:
    """
    SQLSyntaxStructureValidator 클래스는 SQL 쿼리의 문법 및 구조를 검증하는 클래스입니다.

    주요 검증 항목:
    1. SQL 문법 오류 검사 (sqlglot 파서 사용)
    2. 불완전한 쿼리 구조 감지 (예: SELECT만 있고 FROM 없음 등)

    메서드:
    - __init__(self, sql: str): SQL 문자열을 저장하고 파싱
    - validate(self): 전체 문법 및 구조 검증 실행
    - _check_required_clauses(self): SELECT, FROM, WHERE 구조 검사
    """

    def __init__(self, sql: str):
        self.sql = sql

        # 파싱 시 문법 오류 발생하면 예외 처리
        try:
            self.ast = parse_one(sql, read="postgres")
        except ParseError as e:
            raise ValueError(f"SQL 문법 오류: {str(e)}")

    def validate(self):
        """
        SQL 문법 및 쿼리 구조를 검증하는 메서드입니다.

        Raises:
            ValueError: 문법 오류 또는 필수 절 누락 시 발생합니다.
        """
        self._check_required_clauses()

    def _check_required_clauses(self):
        """
        SELECT 쿼리에서 필수 절(SELECT, FROM 등)이 존재하는지 확인합니다.

        Raises:
            ValueError: 구조가 불완전한 쿼리인 경우 예외 발생
        """
        if isinstance(self.ast, exp.Select):
            if not self.ast.expressions:  # SELECT 항목 없음
                raise ValueError("SELECT 절에 반환할 컬럼이 지정되지 않았습니다.")

            if not self.ast.args.get("from"):  # FROM 절 없음
                raise ValueError("FROM 절이 누락되었습니다.")
