output "instance_id" {
  description = "EC2 인스턴스 ID (SSM 접속 대상)"
  value       = aws_instance.node.id
}

output "private_ip" {
  description = "노드의 프라이빗 IP"
  value       = aws_instance.node.private_ip
}

output "public_ip" {
  description = "고정 공인 IP. associate_eip가 false면 null"
  value       = try(aws_eip.node[0].public_ip, null)
}

output "security_group_id" {
  description = "노드 보안 그룹 ID"
  value       = aws_security_group.node.id
}

output "data_volume_id" {
  description = "데이터 EBS 볼륨 ID"
  value       = aws_ebs_volume.data.id
}
