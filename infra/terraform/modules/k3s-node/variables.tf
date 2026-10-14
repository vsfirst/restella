variable "name" {
  description = "리소스 이름 접두사 (예: restella-demo)"
  type        = string
}

variable "vpc_id" {
  description = "노드를 둘 VPC ID"
  type        = string
}

variable "subnet_id" {
  description = "노드를 둘 서브넷 ID. 데이터 EBS도 이 서브넷의 가용영역에 만든다"
  type        = string
}

variable "instance_type" {
  description = "EC2 인스턴스 타입. AMI가 ARM(arm64)이므로 Graviton 계열이어야 한다"
  type        = string
  default     = "t4g.large"
}

variable "ami_ssm_parameter" {
  description = "AMI ID를 읽을 SSM 공개 파라미터. Amazon Linux 2023, 커널 6.18(최신 LTS), arm64"
  type        = string
  default     = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.18-arm64"
}

variable "use_spot" {
  description = "스팟 인스턴스로 띄운다. 회수되면 삭제 대신 중지되고, 용량이 생기면 다시 켜진다"
  type        = bool
  default     = false
}

variable "cpu_credits" {
  description = "T 계열 CPU 크레딧 모드. standard는 기준선을 넘는 사용에 추가 요금 대신 성능을 제한한다"
  type        = string
  default     = "standard"

  validation {
    condition     = contains(["standard", "unlimited"], var.cpu_credits)
    error_message = "cpu_credits는 standard 또는 unlimited여야 한다."
  }
}

variable "root_volume_size" {
  description = "루트 볼륨 크기(GiB): OS, k3s 바이너리, 컨테이너 이미지"
  type        = number
  default     = 20
}

variable "data_volume_size" {
  description = "데이터 볼륨 크기(GiB): PersistentVolume(MariaDB, Prometheus 등). 인스턴스를 교체해도 유지된다"
  type        = number
  default     = 10
}

variable "k3s_version" {
  description = "설치할 k3s 버전"
  type        = string
}

variable "associate_eip" {
  description = "고정 공인 IP(EIP)를 붙인다. 퍼블릭 서브넷에 두는 demo에서만 true"
  type        = bool
  default     = false
}

variable "ingress_rules" {
  description = "노드로 들어오는 트래픽 허용 규칙. cidr_ipv4와 source_security_group_id 중 하나를 지정한다"
  type = list(object({
    description              = string
    from_port                = number
    to_port                  = number
    cidr_ipv4                = optional(string)
    source_security_group_id = optional(string)
  }))
  default = []

  validation {
    condition = alltrue([
      for rule in var.ingress_rules : (rule.cidr_ipv4 == null) != (rule.source_security_group_id == null)
    ])
    error_message = "각 규칙은 cidr_ipv4와 source_security_group_id 중 정확히 하나만 지정해야 한다."
  }

  # AWS는 규칙 설명에 영문, 숫자, 공백과 ._-:/()#,@[]+=&;{}!$* 만 받는다. plan에서는 걸리지 않고 apply에서 실패하므로 미리 막는다
  validation {
    condition = alltrue([
      for rule in var.ingress_rules : can(regex("^[a-zA-Z0-9. _\\-:/()#,@\\[\\]+=&;{}!$*]{0,255}$", rule.description))
    ])
    error_message = "규칙 설명(description)은 영문, 숫자, 공백과 ._-:/()#,@[]+=&;{}!$* 만 쓸 수 있고 255자 이하여야 한다."
  }
}

variable "imds_hop_limit" {
  description = "IMDSv2 응답 홉 제한. 1이면 Pod가 인스턴스 역할 자격 증명에 접근할 수 없다. External Secrets Operator가 노드 역할을 쓰려면 2가 필요하다"
  type        = number
  default     = 1
}

variable "ecr_repository_arns" {
  description = "노드 역할이 이미지를 받을 수 있는 ECR 저장소 ARN 목록"
  type        = list(string)
  default     = []
}

variable "secret_arns" {
  description = "노드 역할이 읽을 수 있는 Secrets Manager 비밀값 ARN 목록"
  type        = list(string)
  default     = []
}

variable "enable_snapshots" {
  description = "데이터 볼륨을 매일 스냅샷할지. 끄면 정책을 만들지 않으며, 이미 만든 스냅샷은 지우지 않는다"
  type        = bool
  default     = true
}

variable "snapshot_retention_count" {
  description = "데이터 볼륨 일일 스냅샷 보관 개수"
  type        = number
  default     = 7
}
