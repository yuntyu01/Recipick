output "api_gateway_invoke_url" {
  description = "Invoke URL for the HTTP API Gateway"
  value       = aws_apigatewayv2_api.http_api.api_endpoint
}

output "ecr_repository_url" {
  description = "URL of the ECR repository for backend images"
  value       = aws_ecr_repository.backend.repository_url
}
