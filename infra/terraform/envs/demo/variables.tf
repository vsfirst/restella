variable "region" {
  description = "AWS 리전"
  type        = string
  default     = "ap-northeast-2"
}

variable "availability_zone" {
  description = "노드를 둘 가용영역. 스팟 가격과 회수 빈도를 보고 고른다 (바꾸면 노드와 데이터 볼륨이 새로 만들어진다)"
  type        = string
  default     = "ap-northeast-2d"
}

variable "hosted_zone_name" {
  description = "Route 53 호스팅 영역 이름. 공개 저장소이므로 terraform.tfvars(커밋 금지)에 넣는다"
  type        = string
}

variable "github_oidc_subject_prefix" {
  description = <<-EOT
    GitHub Actions OIDC 토큰 sub의 저장소 부분. 이 저장소의 main 브랜치만 ECR 푸시 역할을 맡을 수 있다.
    저장소가 "변경 불가 subject"를 쓰면 소유자·저장소 ID가 붙는다: repo:<owner>@<owner_id>/<name>@<repo_id>.
    값은 gh api repos/<owner>/<name>/actions/oidc/customization/sub 의 sub_claim_prefix 그대로다
  EOT
  type        = string

  validation {
    condition     = can(regex("^repo:[A-Za-z0-9_.-]+(@[0-9]+)?/[A-Za-z0-9_.-]+(@[0-9]+)?$", var.github_oidc_subject_prefix))
    error_message = "github_oidc_subject_prefix는 repo:<owner>/<name> 또는 repo:<owner>@<id>/<name>@<id> 형식이어야 한다."
  }
}

variable "use_spot" {
  description = "스팟 인스턴스 사용 여부. 심사 당일처럼 꺼지면 안 되는 기간에는 false로 바꿔 온디맨드로 운영한다"
  type        = bool
  default     = true
}

variable "k3s_version" {
  description = "k3s 버전 (Argo CD 3.5가 테스트한 Kubernetes 1.36 라인)"
  type        = string
  default     = "v1.36.5+k3s1"
}
