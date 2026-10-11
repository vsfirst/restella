# GitHub Actions가 장기 액세스 키 없이 AWS에 접근하도록 OIDC 공급자를 등록한다.
# 같은 URL의 공급자는 계정에 하나만 둘 수 있어서 환경별 스택이 아니라 계정 공용(global) 스택에 둔다.
# bootstrap이 아니라 global에 두는 이유: bootstrap의 state는 로컬 파일이라 잃어버리기 쉽다. global의 state는 S3에 남는다.
# 실제 권한은 환경별 스택의 IAM 역할이 저장소·브랜치 단위로 좁혀서 준다.

resource "aws_iam_openid_connect_provider" "github_actions" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}
