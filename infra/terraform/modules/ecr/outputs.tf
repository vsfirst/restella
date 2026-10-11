output "repository_urls" {
  description = "앱 → 저장소 URL"
  value       = { for app, repo in aws_ecr_repository.app : app => repo.repository_url }
}

output "repository_arns" {
  description = "앱 → 저장소 ARN"
  value       = { for app, repo in aws_ecr_repository.app : app => repo.arn }
}
