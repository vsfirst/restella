locals {
  # 가용영역 → CIDR
  public_subnets  = { for idx, cidr in var.public_subnet_cidrs : var.availability_zones[idx] => cidr }
  private_subnets = { for idx, cidr in var.private_subnet_cidrs : var.availability_zones[idx] => cidr }

  # NAT Gateway는 프라이빗 서브넷이 있는 가용영역의 퍼블릭 서브넷에 둔다
  nat_azs = var.enable_nat_gateway ? keys(local.private_subnets) : []
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = var.name }
}

# 기본 보안 그룹은 규칙을 모두 비워 실수로 쓰이지 않게 한다
resource "aws_default_security_group" "this" {
  vpc_id = aws_vpc.this.id

  tags = { Name = "${var.name}-default-unused" }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = { Name = var.name }
}

# 퍼블릭 서브넷

resource "aws_subnet" "public" {
  for_each = local.public_subnets

  vpc_id            = aws_vpc.this.id
  availability_zone = each.key
  cidr_block        = each.value

  # 공인 IP는 필요한 리소스(EIP, ALB, NAT)에만 명시적으로 붙인다
  map_public_ip_on_launch = false

  tags = { Name = "${var.name}-public-${each.key}", Tier = "public" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  tags = { Name = "${var.name}-public" }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

# 프라이빗 서브넷 (prod)

resource "aws_subnet" "private" {
  for_each = local.private_subnets

  vpc_id            = aws_vpc.this.id
  availability_zone = each.key
  cidr_block        = each.value

  tags = { Name = "${var.name}-private-${each.key}", Tier = "private" }
}

resource "aws_eip" "nat" {
  for_each = toset(local.nat_azs)

  domain = "vpc"

  tags = { Name = "${var.name}-nat-${each.key}" }

  depends_on = [aws_internet_gateway.this]
}

# 가용영역 하나가 장애 나도 다른 가용영역의 아웃바운드가 유지되도록 가용영역마다 둔다
resource "aws_nat_gateway" "this" {
  for_each = toset(local.nat_azs)

  allocation_id = aws_eip.nat[each.key].id
  subnet_id     = aws_subnet.public[each.key].id

  tags = { Name = "${var.name}-${each.key}" }

  depends_on = [aws_internet_gateway.this]
}

resource "aws_route_table" "private" {
  for_each = local.private_subnets

  vpc_id = aws_vpc.this.id

  tags = { Name = "${var.name}-private-${each.key}" }
}

resource "aws_route" "private_nat" {
  for_each = aws_nat_gateway.this

  route_table_id         = aws_route_table.private[each.key].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = each.value.id
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private[each.key].id
}

# S3 게이트웨이 엔드포인트 (무료): S3 트래픽이 NAT를 거치지 않아 데이터 처리 요금을 줄인다

data "aws_region" "current" {}

resource "aws_vpc_endpoint" "s3" {
  count = var.enable_s3_gateway_endpoint ? 1 : 0

  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${data.aws_region.current.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = concat([aws_route_table.public.id], [for rt in aws_route_table.private : rt.id])

  tags = { Name = "${var.name}-s3" }
}
