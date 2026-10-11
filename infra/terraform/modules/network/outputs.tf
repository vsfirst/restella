output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.this.id
}

output "vpc_cidr" {
  description = "VPC 대역"
  value       = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  description = "가용영역 → 퍼블릭 서브넷 ID"
  value       = { for az, subnet in aws_subnet.public : az => subnet.id }
}

output "private_subnet_ids" {
  description = "가용영역 → 프라이빗 서브넷 ID"
  value       = { for az, subnet in aws_subnet.private : az => subnet.id }
}

output "nat_gateway_ids" {
  description = "가용영역 → NAT Gateway ID"
  value       = { for az, nat in aws_nat_gateway.this : az => nat.id }
}
