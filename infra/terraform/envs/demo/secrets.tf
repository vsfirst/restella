# 앱 비밀값 묶음. 클러스터 안의 External Secrets Operator가 읽어 Kubernetes Secret으로 만든다.
# Terraform은 비밀값의 "그릇"만 만든다. 값을 Terraform으로 넣으면 state 파일에 평문으로 남으므로,
# 값은 사람이 AWS CLI나 콘솔로 직접 넣는다 (docs/2-design/security.md).

resource "aws_secretsmanager_secret" "app" {
  name                    = local.name # restella-demo
  description             = "Restella demo application secrets (JSON)"
  recovery_window_in_days = 7
}
