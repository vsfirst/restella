variable "region" {
  description = "state 버킷을 만들 AWS 리전"
  type        = string
  default     = "ap-northeast-2"
}

variable "bucket_prefix" {
  description = "state 버킷 이름 접두사. 실제 이름은 <접두사>-<계정 ID>-<리전>으로 만들어 전역에서 겹치지 않게 한다"
  type        = string
  default     = "restella-tfstate"
}

variable "noncurrent_version_retention_days" {
  description = "이전 버전 state 파일을 보관할 일수"
  type        = number
  default     = 90
}
