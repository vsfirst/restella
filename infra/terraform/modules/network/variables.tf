variable "name" {
  description = "리소스 이름 접두사 (예: restella-demo)"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC 대역"
  type        = string
}

variable "availability_zones" {
  description = "서브넷을 만들 가용영역. public/private 서브넷 CIDR 목록과 순서대로 짝지어진다"
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "퍼블릭 서브넷 대역. availability_zones의 앞에서부터 하나씩 배치한다"
  type        = list(string)

  validation {
    condition     = length(var.public_subnet_cidrs) >= 1 && length(var.public_subnet_cidrs) <= length(var.availability_zones)
    error_message = "퍼블릭 서브넷은 1개 이상, 가용영역 수 이하여야 한다."
  }
}

variable "private_subnet_cidrs" {
  description = "프라이빗 서브넷 대역. 비워 두면 프라이빗 서브넷을 만들지 않는다 (demo)"
  type        = list(string)
  default     = []

  validation {
    condition     = length(var.private_subnet_cidrs) <= length(var.public_subnet_cidrs)
    error_message = "프라이빗 서브넷마다 같은 가용영역에 퍼블릭 서브넷(NAT Gateway 자리)이 있어야 한다."
  }
}

variable "enable_nat_gateway" {
  description = "프라이빗 서브넷의 아웃바운드용 NAT Gateway를 가용영역마다 하나씩 만든다"
  type        = bool
  default     = false

  validation {
    condition     = !var.enable_nat_gateway || length(var.private_subnet_cidrs) > 0
    error_message = "NAT Gateway는 프라이빗 서브넷이 있을 때만 의미가 있다."
  }
}

variable "enable_s3_gateway_endpoint" {
  description = "S3 게이트웨이 엔드포인트(무료)를 만들어 S3 트래픽이 NAT를 거치지 않게 한다"
  type        = bool
  default     = false
}
