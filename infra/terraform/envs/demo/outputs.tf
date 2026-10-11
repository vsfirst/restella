output "instance_id" {
  description = "k3s 노드 인스턴스 ID"
  value       = module.k3s_node.instance_id
}

output "public_ip" {
  description = "노드의 고정 공인 IP"
  value       = module.k3s_node.public_ip
}

output "ecr_repository_urls" {
  description = "앱 → ECR 저장소 URL"
  value       = module.ecr.repository_urls
}

output "github_actions_role_arn" {
  description = "GitHub Actions가 맡을 IAM 역할 ARN (워크플로의 role-to-assume)"
  value       = aws_iam_role.github_actions.arn
}

output "app_secret_name" {
  description = "앱 비밀값 이름 (Secrets Manager)"
  value       = aws_secretsmanager_secret.app.name
}

output "ssm_session_command" {
  description = "노드에 접속하는 명령 (SSH 대신 SSM)"
  value       = "aws ssm start-session --region ${var.region} --target ${module.k3s_node.instance_id}"
}
