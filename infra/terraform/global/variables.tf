variable "region" {
  description = "AWS 리전. Route 53은 리전과 무관한 서비스지만 provider에 필요하다"
  type        = string
  default     = "ap-northeast-2"
}

variable "hosted_zone_name" {
  description = "Route 53 호스팅 영역 이름. 공개 저장소이므로 terraform.tfvars(커밋 금지)에 넣는다"
  type        = string
}

variable "existing_hosted_zone_id" {
  description = "이미 있는 호스팅 영역을 Terraform 관리로 가져올 때 그 영역 ID. 새로 만들면 null로 둔다"
  type        = string
  default     = null
}
