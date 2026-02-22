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
variable "RAPIDAPI_KEY" {
  description = "RAPIDAPI_KEY"
  type        = string
  sensitive   = true 
}