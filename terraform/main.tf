terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ===========================================================================
# 1. Users 테이블 
# ===========================================================================
resource "aws_dynamodb_table" "users" {
  name         = "Recipick-Users"
  billing_mode = "PAY_PER_REQUEST"

  hash_key = "user_id"

  attribute {
    name = "user_id"
    type = "S"
  }

}

# ===========================================================================
# 2. Recipes 테이블 (레시피 원본 + 댓글/좋아요 등 통합)
# ===========================================================================
resource "aws_dynamodb_table" "recipes" {
  name         = "Recipick-Recipes"
  billing_mode = "PAY_PER_REQUEST"

  # 레시피 상세 화면 진입 시, 레시피 정보(INFO)와 댓글(COMMENT)을 
  # 한 번에 긁어오기 위해 PK/SK 복합키 구조를 그대로 유지합니다.
  hash_key  = "PK" # 들어갈 값 예시: VIDEO#123
  range_key = "SK" # 들어갈 값 예시: INFO, COMMENT#456, LIKE#user_id

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }

  # GSI 1 용도
  attribute {
    name = "category"
    type = "S"
  }

  # GSI 2 용도
  attribute {
    name = "user_id"
    type = "S"
  }

  # GSI 1, 2 공통 정렬 키
  attribute {
    name = "created_at"
    type = "S"
  }

  # ---------------------------------------------------------------------------
  # GSI 1: CategoryIndex (앱 홈 화면/카테고리 탭 용)
  # ---------------------------------------------------------------------------
  global_secondary_index {
    name      = "CategoryIndex"
    hash_key  = "category"
    range_key = "created_at"

    projection_type = "ALL"
  }

  # ---------------------------------------------------------------------------
  # GSI 2: UserActivityIndex (마이페이지 - 내가 쓴 댓글, 좋아요 용)
  # ---------------------------------------------------------------------------
  global_secondary_index {
    name      = "UserActivityIndex"
    hash_key  = "user_id"
    range_key = "created_at"

    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl_expire_at"
    enabled        = true
  }
}

resource "aws_s3_bucket" "static" {
  bucket = "recipick-static-bucket"
}

resource "aws_sqs_queue" "recipe_queue" {
  name = "recipick-processing-queue"
  # 워커 람다의 타임아웃(15분)과 같거나 길어야 함
  visibility_timeout_seconds = 900
}

# -----------------------------------------------------------------------------
# 2. IAM Roles & Policies (보안 및 권한 분리)
# -----------------------------------------------------------------------------

# --- A. 메인 API용 권한 (가벼운 권한) ---
resource "aws_iam_role" "main_api_role" {
  name = "recipick-main-api-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}
resource "aws_iam_role_policy_attachment" "main_api_logs" {
  role       = aws_iam_role.main_api_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "main_api_policy" {
  name = "recipick-main-api-policy"
  role = aws_iam_role.main_api_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = [
          "dynamodb:GetItem", 
          "dynamodb:PutItem", 
          "dynamodb:Query", 
          "dynamodb:UpdateItem", 
          "dynamodb:DeleteItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:BatchGetItem"
        ]
        Resource = [
          aws_dynamodb_table.recipes.arn,
          "${aws_dynamodb_table.recipes.arn}/index/*",
          aws_dynamodb_table.users.arn
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.recipe_queue.arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.static.arn}/*"
      },
      {
        Effect = "Allow"
        Action = ["s3:ListBucket"]
        Resource = aws_s3_bucket.static.arn
        Condition = {
          StringLike = {
            "s3:prefix" = ["profiles/*"]
          }
        }
      }
    ]
  })
}

# --- B. LLM 워커용 권한 (무거운 권한) ---
resource "aws_iam_role" "llm_worker_role" {
  name = "recipick-llm-worker-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy_attachment" "llm_worker_logs" {
  role       = aws_iam_role.llm_worker_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "llm_worker_policy" {
  name = "recipick-llm-worker-policy"
  role = aws_iam_role.llm_worker_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:UpdateItem", "dynamodb:GetItem", "dynamodb:PutItem"] # 상태 업데이트 권한 필수
        Resource = aws_dynamodb_table.recipes.arn
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"] # SQS 소비 권한 필수
        Resource = aws_sqs_queue.recipe_queue.arn
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# 3. Lambda Functions (Main api, LLM api)
# -----------------------------------------------------------------------------

resource "aws_ecr_repository" "backend" {
  name                 = var.ecr_repository_name
  image_tag_mutability = "MUTABLE"
}

# --- A. 메인 API 람다 ---
resource "aws_lambda_function" "main_api" {
  function_name = "recipick-main-api"
  role          = aws_iam_role.main_api_role.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.backend.repository_url}:api-${var.lambda_image_tag}"

  # Dockerfile에서 CMD를 덮어씌워 API 핸들러를 실행하게 만듭니다.
  image_config {
    command = ["app.main_api.main.handler"]
  }

  timeout     = 29 # API Gateway 최대 타임아웃에 맞춤
  memory_size = 512

  kms_key_arn = aws_kms_key.firebase_kms.arn

  environment {
    variables = {
      USER_TABLE_NAME   = aws_dynamodb_table.users.name
      RECIPE_TABLE_NAME = aws_dynamodb_table.recipes.name
      SQS_QUEUE_URL       = aws_sqs_queue.recipe_queue.url
      S3_BUCKET_NAME      = aws_s3_bucket.static.bucket
      FIREBASE_SERVICE_ACCOUNT = var.firebase_json
      GEMINI_API_KEY      = var.gemini_api_key
      GEMINI_CHAT_MODEL   = var.gemini_chat_model
      AI_DAILY_LIMIT      = tostring(var.ai_daily_limit)
    }
  }
}

# --- B. LLM 비동기 워커 람다 ---
resource "aws_lambda_function" "llm_worker" {
  function_name = "recipick-llm-worker"
  role          = aws_iam_role.llm_worker_role.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.backend.repository_url}:worker-${var.lambda_image_tag}"

  # Dockerfile에서 CMD를 덮어씌워 SQS 핸들러를 실행하게 만듭니다.
  image_config {
    command = ["app.llm_worker.worker.sqs_handler"]
  }

  # 무거운 작업을 빨리 끝내기 위해 스팩업
  timeout     = 900  # 15분 (Lambda 최대치)
  memory_size = 1024 # 영상 다운로드 메모리 

  # /tmp 디렉토리 용량 확장 (기본 512MB -> 2GB)
  ephemeral_storage {
    size = 2048
  }

  environment {
    variables = {
      USER_TABLE_NAME   = aws_dynamodb_table.users.name
      RECIPE_TABLE_NAME = aws_dynamodb_table.recipes.name
      SQS_QUEUE_URL       = aws_sqs_queue.recipe_queue.url
      S3_BUCKET_NAME      = aws_s3_bucket.static.bucket
      GEMINI_API_KEY      = var.gemini_api_key
    }
  }
}

# SQS 큐와 워커 람다를 연결하는 트리거
resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = aws_sqs_queue.recipe_queue.arn
  function_name    = aws_lambda_function.llm_worker.arn
  batch_size       = 1 # 한 번에 영상 하나씩만 처리 (OOM 방지)
}

# -----------------------------------------------------------------------------
# 4. API Gateway (메인 API와만 연결)
# -----------------------------------------------------------------------------

resource "aws_apigatewayv2_api" "http_api" {
  name          = "recipick-http-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.main_api.invoke_arn # 워커가 아닌 메인 API 연결
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "root" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "allow_apigw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.main_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# -----------------------------------------------------------------------------
# 5. KMS (로그인 Firebase 용)
# -----------------------------------------------------------------------------
# 1. KMS 키 생성 (비밀번호를 암호화/복호화할 열쇠)
resource "aws_kms_key" "firebase_kms" {
  description             = "KMS key for Firebase Service Account JSON"
  deletion_window_in_days = 7
}

resource "aws_kms_alias" "firebase_kms_alias" {
  name          = "alias/recipick-firebase-key"
  target_key_id = aws_kms_key.firebase_kms.key_id
}

# 2. 메인 API 람다 역할에 KMS 복호화 권한 추가
resource "aws_iam_role_policy" "main_api_kms_policy" {
  name = "recipick-main-api-kms-policy"
  role = aws_iam_role.main_api_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = aws_kms_key.firebase_kms.arn
      }
    ]
  })
}
