# 노드 역할: SSM Session Manager 접속용. SSH 키는 쓰지 않는다

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "node" {
  name               = "${var.name}-node"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# 클러스터 안의 External Secrets Operator가 노드 역할로 쓰는 권한
# - ECR: 이미지 pull용 토큰 발급(ECRAuthorizationToken 생성기)과 지정한 저장소의 이미지 읽기
# - Secrets Manager: 지정한 비밀값 읽기

data "aws_iam_policy_document" "node_access" {
  count = length(var.ecr_repository_arns) + length(var.secret_arns) > 0 ? 1 : 0

  dynamic "statement" {
    for_each = length(var.ecr_repository_arns) > 0 ? [1] : []

    content {
      sid       = "EcrAuthToken"
      actions   = ["ecr:GetAuthorizationToken"]
      resources = ["*"] # 이 API는 리소스 단위 제한을 지원하지 않는다
    }
  }

  dynamic "statement" {
    for_each = length(var.ecr_repository_arns) > 0 ? [1] : []

    content {
      sid = "EcrPull"
      actions = [
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer",
      ]
      resources = var.ecr_repository_arns
    }
  }

  dynamic "statement" {
    for_each = length(var.secret_arns) > 0 ? [1] : []

    content {
      sid       = "ReadAppSecrets"
      actions   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
      resources = var.secret_arns
    }
  }
}

resource "aws_iam_role_policy" "node_access" {
  count = length(data.aws_iam_policy_document.node_access)

  name   = "${var.name}-node-access"
  role   = aws_iam_role.node.id
  policy = data.aws_iam_policy_document.node_access[0].json
}

resource "aws_iam_instance_profile" "node" {
  name = "${var.name}-node"
  role = aws_iam_role.node.name
}

# 데이터 볼륨 일일 스냅샷 (Data Lifecycle Manager). enable_snapshots가 false면 만들지 않는다

data "aws_iam_policy_document" "dlm_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["dlm.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "dlm" {
  count = var.enable_snapshots ? 1 : 0

  name               = "${var.name}-dlm"
  assume_role_policy = data.aws_iam_policy_document.dlm_assume.json
}

resource "aws_iam_role_policy_attachment" "dlm" {
  count = var.enable_snapshots ? 1 : 0

  role       = aws_iam_role.dlm[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSDataLifecycleManagerServiceRole"
}

resource "aws_dlm_lifecycle_policy" "data" {
  count = var.enable_snapshots ? 1 : 0

  description        = "${var.name} data volume daily snapshot"
  execution_role_arn = aws_iam_role.dlm[0].arn
  state              = "ENABLED"

  policy_details {
    resource_types = ["VOLUME"]

    target_tags = {
      Snapshot = "${var.name}-data"
    }

    schedule {
      name      = "daily"
      copy_tags = true

      create_rule {
        interval      = 24
        interval_unit = "HOURS"
        times         = ["18:00"] # UTC 18:00 = KST 03:00
      }

      retain_rule {
        count = var.snapshot_retention_count
      }
    }
  }
}
