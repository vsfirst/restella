# 앱 배포 파이프라인: GitHub Actions → ECR 푸시 → infra/gitops에 이미지 다이제스트 커밋 → Argo CD 동기화
# 구성 근거: docs/adr/0003-delivery-pipeline.md

module "ecr" {
  source = "../../modules/ecr"

  namespace    = local.name # restella-demo/front-end, restella-demo/back-end
  apps         = ["front-end", "back-end"]
  force_delete = true # demo를 정리할 때 이미지가 남아 있어도 지울 수 있게 한다
}

# GitHub Actions용 역할: OIDC로만 맡을 수 있고, 지정한 저장소의 main 브랜치에서만 허용한다
# OIDC 공급자는 global 스택이 만든다 (global을 먼저 적용)

data "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "github_actions_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github_actions.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name                 = "${local.name}-github-actions"
  assume_role_policy   = data.aws_iam_policy_document.github_actions_assume.json
  max_session_duration = 3600
}

# 이미지 푸시에 필요한 권한만 준다. gitops 커밋은 GitHub 토큰으로 하므로 AWS 권한이 필요 없다
data "aws_iam_policy_document" "github_actions_push" {
  statement {
    sid       = "EcrAuthToken"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"] # 이 API는 리소스 단위 제한을 지원하지 않는다
  }

  statement {
    sid = "EcrPush"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = values(module.ecr.repository_arns)
  }
}

resource "aws_iam_role_policy" "github_actions_push" {
  name   = "${local.name}-ecr-push"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.github_actions_push.json
}
