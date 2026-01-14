# Stage 1: Build with dependencies
FROM python:3.11.11-slim AS builder

WORKDIR /app

# 빌드 도구 설치
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc \
    libblas-dev liblapack-dev python3-dev \
    # postgresql-client는 최종 스테이지에서 설치할 수도 있음 (pg_isready용)
    # 하지만 빌드 시점에 필요할 수도 있으므로 여기에 포함 가능
    && rm -rf /var/lib/apt/lists/*

# pip 업그레이드
RUN pip install --upgrade pip

# requirements.txt 복사 및 설치
COPY requirements.txt .
# --prefix=/install 대신 /usr/local/ 에 직접 설치하는 것이 관리 용이성 면에서 더 나을 수 있음
# 하지만 기존 방식을 유지합니다.
RUN pip install --no-cache-dir --prefer-binary --prefix=/install -r requirements.txt

# 애플리케이션 코드 복사 (requirements 설치 후 복사 권장)
COPY . .

# Stage 2: Final runtime image
FROM python:3.11.11-slim

WORKDIR /app

# Python 환경 변수 설정
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# 시스템 의존성 설치 (pg_isready 용)
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# 빌드 결과 복사
COPY --from=builder /install /usr/local
COPY --from=builder /app .

# Entrypoint 스크립트 복사 및 실행 권한 부여
COPY ./entrypoint.sh /app/entrypoint.sh
RUN chmod 777 /app/entrypoint.sh

EXPOSE 8000

# ENTRYPOINT로 변경하여 entrypoint.sh를 실행
ENTRYPOINT ["/app/entrypoint.sh"]

# 기본 CMD 설정 (entrypoint.sh의 exec "$@" 를 통해 실행됨)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]