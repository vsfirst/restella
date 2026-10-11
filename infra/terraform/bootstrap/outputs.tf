output "state_bucket" {
  description = "state 버킷 이름. 각 환경의 backend.hcl(커밋 금지)에 넣는다"
  value       = aws_s3_bucket.tfstate.bucket
}

output "backend_hcl" {
  description = "envs/<환경>/backend.hcl에 그대로 붙여 넣을 내용"
  value       = <<-EOT
    bucket       = "${aws_s3_bucket.tfstate.bucket}"
    region       = "${var.region}"
    encrypt      = true
    use_lockfile = true
  EOT
}
