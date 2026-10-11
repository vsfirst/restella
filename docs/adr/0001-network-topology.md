# ADR-0001: 네트워크 구성을 demo와 실무용(prod)으로 나눈다

- 상태: 채택
- 날짜: 2026-10-09

## 맥락

- 서비스는 EC2 1대의 k3s 단일 노드에서 실행한다.
- HTTPS가 필요하다. 그런데 ACM 무료 인증서는 개인키를 꺼낼 수 없어서 ALB, NLB, CloudFront 같은 앞단에만 붙일 수 있다. EC2 안의 Traefik에는 설치할 수 없다.
- EC2를 프라이빗 서브넷에 두면 밖으로 나갈 출구가 필요하다. 나가야 하는 곳은 GitHub(Argo CD), GHCR(앱 이미지), docker.io·quay.io(외부 이미지), OS 패키지 저장소다.
- 과제 심사용 데모는 실제로 AWS에 띄워야 하지만 비용은 최소로 하고 싶다. 동시에 실무라면 어떻게 구성할지도 보여주고 싶다.

## 검토한 대안

| 안 | 구성 | 월 추가 비용(대략) | 판단 |
|---|---|---|---|
| A | 퍼블릭 서브넷 EC2 + EIP + Let's Encrypt(cert-manager) | 공인 IPv4 약 $4 | **demo로 채택** |
| B | 퍼블릭(ALB, NAT Gateway) + 프라이빗(EC2) + ACM | ALB 약 $20~25 + NAT Gateway 약 $33~45 + 공인 IPv4 | **prod로 채택 (코드만)** |
| C | B에서 NAT Gateway 대신 NAT 인스턴스 | ALB + 약 $3~5 | 실무에서는 관리 부담 때문에 관리형 NAT Gateway를 택한다 |
| D | 프라이빗(EC2) + VPC 엔드포인트만, NAT 없음 | 인터페이스 엔드포인트 5~6개 × 약 $7~10 | 기각. GitHub와 GHCR는 엔드포인트로 접근할 수 없어 GitOps 흐름이 깨진다. 비용도 NAT Gateway와 비슷하거나 더 비싸다 |
| E | CloudFront VPC Origin + 프라이빗 EC2 + ACM | 사용량 기준(소량) | 보류. 충돌 알림용 SSE 연결이 CloudFront 원본 응답 타임아웃에 걸릴 수 있어 검증이 필요하다 |

비용은 다른 리전의 공시 가격을 바탕으로 한 대략치다. 서울 리전 가격은 적용 전에 AWS 계산기로 확인한다.

## 결정

**demo (실제 배포)**: 안 A

```
VPC
└── 퍼블릭 서브넷 (가용영역 1곳, 스팟 가격을 보고 선택. 기본 2d)
    └── EC2 (k3s) + EIP + 데이터 EBS
        보안 그룹: 들어오는 80·443만 허용, SSH 없음(SSM 접속), 6443 비공개
        TLS: Traefik + cert-manager + Let's Encrypt
```

**prod (실무용 설계, 배포하지 않음)**: 안 B

```
VPC
├── 퍼블릭 서브넷 (가용영역 a, c) ── ALB(443, ACM 인증서), NAT Gateway(가용영역마다 1개)
├── 프라이빗 서브넷 (가용영역 a, c) ── EC2 (k3s, 공인 IP 없음, 노드 수는 변수)
└── S3 게이트웨이 엔드포인트 (무료, S3 트래픽은 NAT를 거치지 않음)
    보안 그룹: EC2는 ALB에서 오는 트래픽만 허용
    TLS: ALB에서 종료, ALB → Traefik은 VPC 내부 HTTP
```

prod는 **비용 문제로 실제 AWS에 반영하지 않고 소스 코드로만 남긴다.**

## 결과

> 이후 이미지 저장소는 GHCR에서 ECR로 바뀌었다([ADR-0003](0003-delivery-pipeline.md)). Argo CD의 GitHub 의존은 그대로라서 안 D를 기각한 결론은 같다.

- Terraform은 `envs/demo`, `envs/prod` 두 환경으로 나눈다. 모듈(`network`, `k3s-node`, `alb`)은 두 환경이 함께 쓴다. network 모듈은 "퍼블릭만" 구성과 "퍼블릭 + 프라이빗 + NAT" 구성을 모두 지원한다.
- prod는 `terraform apply`를 하지 않는다. 대신 `terraform validate`와 tflint로 코드가 유효한지 검증한다.
- GitOps도 환경별로 나눈다(`infra/gitops/apps/{demo,prod}`, `infra/gitops/values/{demo,prod}`).
  - cert-manager는 demo에만 배포한다.
  - prod는 ALB가 TLS를 처리하므로 Traefik은 HTTP만 받는다.
- 두 환경 모두 도메인이 필요하다. demo는 Let's Encrypt, prod는 ACM이 도메인 소유를 확인한 뒤 인증서를 발급한다.
- demo는 EC2가 인터넷에 직접 노출된다. 다음 장치로 공격 면을 줄인다.
  - 보안 그룹으로 80·443만 연다.
  - SSH 대신 SSM으로 접속한다.
  - Kubernetes API는 공개하지 않는다.
