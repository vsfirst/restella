# demo: 퍼블릭 서브넷의 EC2 1대에 k3s를 올린다. HTTPS는 클러스터 안의 cert-manager + Let's Encrypt가 맡는다.
# 구성 근거: docs/adr/0001-network-topology.md

locals {
  name = "restella-demo"
}

module "network" {
  source = "../../modules/network"

  name                = local.name
  vpc_cidr            = "10.0.0.0/16"
  availability_zones  = [var.availability_zone]
  public_subnet_cidrs = ["10.0.1.0/24"]
}

module "k3s_node" {
  source = "../../modules/k3s-node"

  name          = local.name
  vpc_id        = module.network.vpc_id
  subnet_id     = module.network.public_subnet_ids[var.availability_zone]
  instance_type = "t4g.large"
  use_spot      = var.use_spot
  k3s_version   = var.k3s_version
  associate_eip = true

  # External Secrets Operator(Pod)가 노드 역할로 Secrets Manager와 ECR 토큰에 접근하려면 홉 2가 필요하다.
  # 다른 Pod의 메타데이터 접근은 NetworkPolicy로 막는다 (infra/gitops에서 구성).
  imds_hop_limit      = 2
  ecr_repository_arns = values(module.ecr.repository_arns)
  secret_arns         = [aws_secretsmanager_secret.app.arn]

  # 들어오는 트래픽은 웹(80, 443)만 허용한다. SSH(22)와 Kubernetes API(6443)는 열지 않는다
  ingress_rules = [
    {
      description = "HTTP: Let's Encrypt HTTP-01 인증, HTTPS로 리다이렉트"
      from_port   = 80
      to_port     = 80
      cidr_ipv4   = "0.0.0.0/0"
    },
    {
      description = "HTTPS"
      from_port   = 443
      to_port     = 443
      cidr_ipv4   = "0.0.0.0/0"
    },
  ]
}

# DNS: 호스팅 영역 이름과 그 하위 이름 전체(*.)를 노드의 고정 IP로 보낸다
# (서비스, Argo CD, Grafana 등을 하위 이름으로 나눠 Traefik이 받는다)
# 영역은 global 스택이 만들고 지킨다. demo는 이름으로 찾아 자기 레코드만 관리한다 (global을 먼저 적용)

data "aws_route53_zone" "this" {
  name         = var.hosted_zone_name
  private_zone = false
}

resource "aws_route53_record" "node" {
  for_each = toset([var.hosted_zone_name, "*.${var.hosted_zone_name}"])

  zone_id = data.aws_route53_zone.this.zone_id
  name    = each.value
  type    = "A"
  ttl     = 300
  records = [module.k3s_node.public_ip]
}
