variable "namespace" {
  description = "저장소 이름 접두사. 저장소 이름은 <namespace>/<app>이 된다 (예: restella-demo/back-end)"
  type        = string
}

variable "apps" {
  description = "이미지를 올릴 앱 목록"
  type        = list(string)
}

variable "keep_image_count" {
  description = "앱마다 보관할 최근 이미지 개수. 오래된 이미지는 자동 삭제한다"
  type        = number
  default     = 30
}

variable "force_delete" {
  description = "이미지가 남아 있어도 저장소 삭제를 허용한다 (demo 정리용)"
  type        = bool
  default     = false
}
