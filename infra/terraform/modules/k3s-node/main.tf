data "aws_ssm_parameter" "ami" {
  name = var.ami_ssm_parameter
}

data "aws_subnet" "this" {
  id = var.subnet_id
}

# 보안 그룹

resource "aws_security_group" "node" {
  name        = "${var.name}-node"
  description = "k3s node"
  vpc_id      = var.vpc_id

  tags = { Name = "${var.name}-node" }
}

resource "aws_vpc_security_group_ingress_rule" "node" {
  for_each = { for idx, rule in var.ingress_rules : tostring(idx) => rule }

  security_group_id            = aws_security_group.node.id
  description                  = each.value.description
  ip_protocol                  = "tcp"
  from_port                    = each.value.from_port
  to_port                      = each.value.to_port
  cidr_ipv4                    = each.value.cidr_ipv4
  referenced_security_group_id = each.value.source_security_group_id
}

# 이미지 받기(GHCR 등), GitHub(Argo CD), 패키지 업데이트, SSM 통신
resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.node.id
  description       = "all outbound"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# 데이터 볼륨: 인스턴스와 수명을 분리해 인스턴스를 교체해도 데이터가 남는다

resource "aws_ebs_volume" "data" {
  availability_zone = data.aws_subnet.this.availability_zone
  type              = "gp3"
  size              = var.data_volume_size
  encrypted         = true

  tags = {
    Name     = "${var.name}-data"
    Snapshot = "${var.name}-data" # DLM 스냅샷 정책의 대상 표시
  }
}

resource "aws_instance" "node" {
  ami                    = data.aws_ssm_parameter.ami.insecure_value
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [aws_security_group.node.id]
  iam_instance_profile   = aws_iam_instance_profile.node.name

  user_data = templatefile("${path.module}/templates/user-data.sh.tftpl", {
    data_volume_serial = replace(aws_ebs_volume.data.id, "-", "")
    node_name          = var.name
    k3s_version        = var.k3s_version
  })

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required" # IMDSv2만 허용
    http_put_response_hop_limit = var.imds_hop_limit
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size
    encrypted             = true
    delete_on_termination = true
  }

  credit_specification {
    cpu_credits = var.cpu_credits
  }

  dynamic "instance_market_options" {
    for_each = var.use_spot ? [1] : []

    content {
      market_type = "spot"

      spot_options {
        # 회수될 때 삭제하지 않고 중지한다. 중지를 쓰려면 persistent 요청이어야 한다
        spot_instance_type             = "persistent"
        instance_interruption_behavior = "stop"
      }
    }
  }

  tags = { Name = var.name }

  lifecycle {
    # 새 AMI가 나오거나 bootstrap 스크립트를 고쳐도 운영 중인 노드를 교체하지 않는다.
    # 교체가 필요하면 `terraform apply -replace`로 명시적으로 한다.
    ignore_changes = [ami, user_data]
  }
}

resource "aws_volume_attachment" "data" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.data.id
  instance_id = aws_instance.node.id

  stop_instance_before_detaching = true
}

resource "aws_eip" "node" {
  count = var.associate_eip ? 1 : 0

  domain   = "vpc"
  instance = aws_instance.node.id

  tags = { Name = var.name }
}
