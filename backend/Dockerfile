# ==========================================
# Stage 1: Base (AWS 공식 람다 파이썬 이미지)
# ==========================================
FROM public.ecr.aws/lambda/python:3.12 AS base

ENV POETRY_VERSION=1.7.1 \
    POETRY_VIRTUALENVS_CREATE=false

# Poetry 설치 (람다는 ${LAMBDA_TASK_ROOT} 경로를 씁니다)
RUN pip install "poetry==$POETRY_VERSION"
COPY pyproject.toml poetry.lock* ${LAMBDA_TASK_ROOT}/
RUN poetry install --no-interaction --no-ansi --no-root

# 소스 코드 복사
COPY ./app ${LAMBDA_TASK_ROOT}/app


# ==========================================
# Stage 2: API (프론트엔드 통신용)
# ==========================================
FROM base AS api
# Uvicorn 대신 Mangum 핸들러를 실행 파일로 지정합니다.
CMD ["app.main_api.main.handler"]

# ==========================================
# Stage 3: Worker (SQS 트리거용)
# ==========================================
FROM base AS worker

# SQS 이벤트 발생 시 실행될 핸들러 지정
CMD ["app.llm_worker.worker.sqs_handler"]