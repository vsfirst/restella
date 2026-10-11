# ADR-0002: demo 노드는 Amazon Linux 2023, t4g.large 스팟으로 한다

- 상태: 채택
- 날짜: 2026-10-09

## 맥락

- demo 클러스터 하나에 k3s, Argo CD, kube-prometheus-stack, cert-manager, MariaDB, front-end, back-end가 함께 올라간다. 상시 메모리 사용량은 약 3.5~5GiB로 추정한다.
- 비용은 최소로 하되, 데모 품질을 떨어뜨리는 구성 축소는 피한다.

## 결정 1: 인스턴스 타입은 t4g.large(ARM, 2 vCPU, 8GiB) 스팟

서울 리전 가격은 AWS Pricing API로 조회했고, 스팟 가격은 조회 시점 값이다.

| 후보 | 월 비용 | 판단 |
|---|---|---|
| t4g.medium (4GiB) | 온디맨드 ~$30 / 스팟 ~$7~9 | 메모리가 부족해 메모리 부족 종료(OOM) 위험이 크다 |
| **t4g.large (8GiB)** | 온디맨드 ~$61 / **스팟 ~$12~21** | **채택** |
| t3.large, t3a.large (x86, 8GiB) | 온디맨드 ~$68~76 | 같은 메모리에서 더 비싸다 |
| m7g.large, m8g.large (8GiB, 성능 고정형) | 온디맨드 ~$73~81 | 상시 부하가 낮은 데모에는 과하다 |

- 스팟이 회수되면 인스턴스를 삭제하지 않고 **중지**한다. 그래서 스팟 요청은 `persistent`, 회수 동작은 `stop`으로 둔다. 데이터 EBS와 EIP는 그대로 남고, 다시 켜지면 k3s가 자동으로 올라온다(회수 후 복구는 아직 시험하지 않았다).
- 꺼지면 안 되는 기간(심사 당일 등)에는 `use_spot = false`로 바꿔 온디맨드로 운영한다.
- CPU 크레딧은 `standard`로 둔다. 기준선을 넘는 사용에 추가 요금을 내는 대신 성능을 제한해서 비용을 예측할 수 있게 한다.
- ARM이므로 우리 앱 이미지도 arm64로 빌드한다. 외부 이미지(k3s, Argo CD, Prometheus, Grafana, MariaDB, cert-manager)는 모두 arm64를 지원한다.

## 결정 2: OS는 Amazon Linux 2023 (커널 6.18, arm64)

AI는 Ubuntu 26.04를 추천했지만, 사람이 Amazon Linux 2023을 선택했다.

| | Amazon Linux 2023 | Ubuntu 26.04 LTS |
|---|---|---|
| k3s v1.36 공식 지원표 | 이름이 따로 없다. RHEL 계열 줄에 "RHEL 테스트로 검증된 것으로 간주"로 묶여 있다 | 명시적으로 검증됨 |
| 지원 기간 | 2029-06-30까지 | 2031년까지 |
| 장점 | AWS가 관리하고 EC2에 맞춰져 있다. 가볍다. 패키지 저장소가 S3에 있어 프라이빗 서브넷에서도 NAT 없이 업데이트할 수 있다(prod에 유리) | k3s 자료와 사례가 많다 |

- 다음 세대인 AL2027은 아직 preview라 제외했다.
- 커널은 AL2023이 제공하는 6.1, 6.12, 6.18 중 최신 LTS인 6.18을 쓴다.

## 결과와 위험

- **k3s 설치 스크립트의 OS 판별 문제를 우회한다.**
  - k3s v1.36.5 설치 스크립트(`install.sh`)는 `ID=amzn`, `VERSION_ID=2023`을 받으면 숫자 비교(`> 36`)에 걸려 **el8(CentOS 8)용 SELinux 패키지**를 설치하려 한다.
  - AL2023은 Fedora 계열이라 대상이 맞지 않는다. 그래서 `INSTALL_K3S_SKIP_SELINUX_RPM=true`로 이 단계를 건너뛴다.
  - SELinux는 AL2023 기본값인 permissive를 유지한다. 그만큼 강제 격리 수준은 Ubuntu의 AppArmor 기본 적용보다 낮다.
- **k3s 공식 검증이 간접적이다.** demo를 실제로 띄워 k3s와 전체 구성이 정상 동작하는지 확인하는 것으로 검증을 대신한다. 2026-10-11 demo 노드(AL2023, 커널 6.18, arm64)에서 k3s v1.36.5가 Ready가 됐고, 모든 Argo CD Application이 Synced/Healthy가 됐다. 이때는 모니터링(kube-prometheus-stack)을 올리지 않았고, ESO와 cert-manager가 추가됐다.
- **문제가 생기면 Ubuntu로 돌아갈 수 있다.** `k3s-node` 모듈의 AMI 파라미터와 user-data(파일시스템 등)만 바꾸면 된다.
