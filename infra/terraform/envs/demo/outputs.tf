output "instance_id" {
  description = "k3s 노드 인스턴스 ID"
  value       = module.k3s_node.instance_id
}

output "public_ip" {
  description = "노드의 고정 공인 IP"
  value       = module.k3s_node.public_ip
}

output "ecr_repository_urls" {
  description = "앱 → ECR 저장소 URL. 계정 ID가 들어 있어 apply 출력에 보이지 않게 한다"
  value       = module.ecr.repository_urls
  sensitive   = true
}

output "ecr_registry" {
  description = "ECR 레지스트리 주소(<계정 ID>.dkr.ecr.<리전>.amazonaws.com). 부트스트랩이 클러스터 Secret annotation으로 넣는다"
  value       = split("/", values(module.ecr.repository_urls)[0])[0]
  sensitive   = true
}

output "domain" {
  description = "서비스 도메인(호스팅 영역 이름). 부트스트랩이 클러스터 Secret annotation으로 넣는다. 공개 저장소에 두지 않는다"
  value       = var.hosted_zone_name
  sensitive   = true
}

output "github_actions_role_arn" {
  description = "GitHub Actions가 맡을 IAM 역할 ARN (워크플로의 role-to-assume). 계정 ID가 들어 있다"
  value       = aws_iam_role.github_actions.arn
  sensitive   = true
}

output "app_secret_name" {
  description = "앱 비밀값 이름 (Secrets Manager)"
  value       = aws_secretsmanager_secret.app.name
}

output "ssm_session_command" {
  description = "노드에 접속하는 명령 (SSH 대신 SSM)"
  value       = "aws ssm start-session --region ${var.region} --target ${module.k3s_node.instance_id}"
}
