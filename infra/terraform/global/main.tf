# global: 환경(demo, prod)이 함께 쓰는 계정 단위 리소스. Route 53 호스팅 영역, GitHub OIDC 공급자(github-oidc.tf).
# Route 53 호스팅 영역은 여기서만 만들고 지운다. 레코드는 각 환경이 자기 것만 관리한다 (envs/<환경>).

# 이미 콘솔에서 만든 영역이 있으면 새로 만들지 않고 가져온다.
# 영역을 새로 만들면 네임서버가 바뀌어 상위 도메인의 위임(NS)을 다시 등록해야 하기 때문이다.
import {
  for_each = var.existing_hosted_zone_id == null ? toset([]) : toset([var.existing_hosted_zone_id])

  to = aws_route53_zone.this
  id = each.value
}

resource "aws_route53_zone" "this" {
  name    = var.hosted_zone_name
  comment = "Restella. Records are managed per environment (infra/terraform/envs)"

  lifecycle {
    # 영역을 지우면 네임서버가 바뀌어 위임이 끊긴다. 환경을 정리할 때도 영역은 남긴다
    prevent_destroy = true
    # 가져온 영역의 기존 설명(위임 출처 등 운영 메모)을 덮어쓰지 않는다. 실제 도메인을 코드에 적지 않기 위해서이기도 하다
    ignore_changes = [comment]
  }
}
