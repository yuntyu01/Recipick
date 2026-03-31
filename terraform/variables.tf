variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "ap-northeast-2"
}

variable "ecr_repository_name" {
  description = "Name of the ECR repository for the backend image"
  type        = string
  default     = "recipick"
}

variable "lambda_function_name" {
  description = "Name of the Lambda function"
  type        = string
  default     = "recipick"
}

variable "lambda_image_tag" {
  description = "Container image tag to deploy from ECR"
  type        = string
  default     = "latest"
}
variable "gemini_api_key" {
  description = "GeminiAPI key"
  type        = string
  sensitive   = true 
}
variable "gemini_chat_model" {
  description = "Gemini chat model name"
  type        = string
  default     = "gemini-3-flash-preview"
}
variable "ai_daily_limit" {
  description = "Daily AI ask limit per user"
  type        = number
  default     = 5
}
variable "firebase_json" {
  description = "로그인 용 파이어베이스 json"
  type        = string
  sensitive   = true
}

variable "allowed_origins" {
  description = "S3 CORS 허용 도메인 목록 (운영 시 프론트엔드 도메인으로 교체)"
  type        = list(string)
  default     = ["*"]
}
