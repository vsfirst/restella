output "hosted_zone_id" {
  description = "호스팅 영역 ID"
  value       = aws_route53_zone.this.zone_id
}

output "name_servers" {
  description = "이 영역의 네임서버. 상위 도메인(등록 기관 또는 상위 영역)의 NS 레코드와 같아야 위임이 된다"
  value       = aws_route53_zone.this.name_servers
}

output "github_actions_oidc_provider_arn" {
  description = "GitHub Actions OIDC 공급자 ARN. 환경 스택은 URL로 조회한다"
  value       = aws_iam_openid_connect_provider.github_actions.arn
}
