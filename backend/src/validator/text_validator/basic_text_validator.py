import re

class BasicTextValidator:
    """
    BasicTextValidator 클래스는 입력 텍스트의 기본 검증을 담당합니다.
    
    주요 검증 항목:
    1. 입력 텍스트의 타입
    2. 입력 텍스트의 길이
    3. 허용된 문자
    
    메서드:
    - __init__(self, value: str): 초기화 메서드
    - validate(self): 검증 메서드를 호출하여 텍스트를 검증
    """
    
    def __init__(self, value):
        self.value = value
        
    def validate(self):
        """
        입력 텍스트를 검증하는 메서드입니다.
        
        이 메서드는 입력 텍스트의 타입, 길이, 허용된 문자 등을 검증합니다.
        
        Raises:
            ValueError: 입력 텍스트가 검증에 실패한 경우 발생합니다.
        """
        
        self._validate_input_type()
        self._validate_input_length()
        self._validate_allowed_chars()

    def _validate_input_type(self):
        """
        입력 텍스트의 타입을 검증하는 메서드입니다.
        
        Args:
            value (str): 검증할 텍스트
            
        Raises:
            ValueError: 입력 텍스트가 문자열이 아닌 경우 발생합니다.
        """
        
        if not isinstance(self.value, str):
            raise ValueError("Input text must be a string")

    def _validate_input_length(self):
        """입력 텍스트의 길이를 검증하는 메서드입니다.
        
        Args:
            value (str): 검증할 텍스트  
            min_len (int): 최소 길이  
            max_len (int): 최대 길이  

        Raises:
            ValueError: 입력 텍스트의 길이가 min_len과 max_len 사이가 아닌 경우 발생합니다.
        """
        
        MIN_LEN = 5
        MAX_LEN = 500
        
        if not MIN_LEN <= len(self.value) <= MAX_LEN:
            raise ValueError("Input text must be between 5 and 500 characters")

    def _validate_allowed_chars(self):
        """
        입력 텍스트의 허용된 문자를 검증하는 메서드입니다.
        
        Args:
            value (str): 검증할 텍스트
            
        Raises:
            ValueError: 입력 텍스트에 허용되지 않은 문자가 포함된 경우 발생합니다.
        """
        
        def raise_if_control_chars(s):
            if re.search(r"[\x00-\x1F\x7F]", s):
                raise ValueError("Input text contains control characters")
        
        def raise_if_emoji(s):
            if re.search(r"[\U00010000-\U0010FFFF]", s):
                raise ValueError("Input text contains emoji")
        
        def raise_if_invalid_symbols(s):
            if re.search(r"[^A-Za-z0-9가-힣\s.,!?%~()\-]", s):
                raise ValueError("Input text contains invalid symbols")
            
        def raise_if_repeated_symbols(s: str) -> bool:
            if re.search(r"(.)\1{2,}", s):
                raise ValueError("Input text contains repeated symbols")
            
        raise_if_control_chars(self.value)
        raise_if_emoji(self.value)
        raise_if_invalid_symbols(self.value)
        raise_if_repeated_symbols(self.value)
        