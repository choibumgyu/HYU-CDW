import re
import urllib.parse
from html_sanitizer import Sanitizer


class SecureTextValidator:
    """
    SecureTextValidator 클래스는 입력 텍스트의 보안 검증을 담당합니다.
    
    주요 검증 항목:
    1. SQL 인젝션 패턴
    2. XSS 공격 패턴
    3. 인코딩된 공격 패턴
    
    메서드:
    - __init__(self, value: str): 초기화 메서드
    - validate(self): 검증 메서드를 호출하여 텍스트를 검증
    """
    def __init__(self, value: str):
        self.value = value
        self.sanitizer = Sanitizer()

    
    def validate(self):
        """
        입력 텍스트를 검증하는 메서드입니다.
        
        이 메서드는 입력 텍스트의 SQL 인젝션 패턴, XSS 공격 패턴, 인코딩된 공격 패턴 등을 검증합니다.
        
        Raises:
            ValueError: 입력 텍스트가 검증에 실패한 경우 발생합니다.
        """
        self._validate_sql_injection()
        self._validate_xss_attack()
        self._validate_encoded_attack_patterns()

    def _validate_sql_injection(self):
        """
        입력 텍스트의 SQL 인젝션 패턴을 검증하는 메서드입니다.
        
        이 메서드는 입력 텍스트에 SQL 인젝션 공격 패턴이 포함되어 있는지 확인합니다.
        
        Raises:
            ValueError: 입력 텍스트에 SQL 인젝션 패턴이 포함된 경우 발생합니다.
        """
        patterns = [
            r"(?i)\b(INSERT|UPDATE|DELETE|DROP|UNION|EXEC|ALTER|TRUNCATE|REPLACE)\b",
            r"--",            
            r";",            
            r"' OR '1'='1",   
            r'" OR "1"="1',
            r"(?i)\bOR\b\s+\d+=\d+",
        ]
        for pattern in patterns:
            if re.search(pattern, self.value):
                raise ValueError("Input text contains SQL injection patterns")

    def _validate_xss_attack(self):
        """
        입력 텍스트의 XSS 공격 패턴을 검증하는 메서드입니다.
        
        이 메서드는 입력 텍스트에 XSS 공격 패턴이 포함되어 있는지 확인합니다.
        
        Raises:
            ValueError: 입력 텍스트에 XSS 공격 패턴이 포함된 경우 발생합니다.
        """
        cleaned = self.sanitizer.sanitize(self.value)
        if cleaned != self.value:
            raise ValueError("Input text contains XSS attack patterns")

    def _validate_encoded_attack_patterns(self):
        """
        입력 텍스트의 인코딩된 공격 패턴을 검증하는 메서드입니다.
        
        이 메서드는 입력 텍스트에 인코딩된 공격 패턴이 포함되어 있는지 확인합니다.
        
        Raises:
            ValueError: 입력 텍스트에 인코딩된 공격 패턴이 포함된 경우 발생합니다.
        """
        MAX_DECODE_DEPTH = 15
        current = self.value
        for _ in range(MAX_DECODE_DEPTH):
            decoded = urllib.parse.unquote(self.value)
            if decoded == current:
                return
            current = decoded
        
        raise ValueError("Input text contains encoded attack patterns")
