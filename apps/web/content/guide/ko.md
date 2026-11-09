<!-- section: overview -->
## 개요 및 워크스페이스 구조

UserHQ는 팀이 고객 피드백을 수집하고 신속하게 대응할 수 있도록 지원합니다. 워크스페이스의 기본 구성은 다음과 같습니다:

<cards>
- **1. Workspace (워크스페이스)**: 팀의 핵심 본부입니다. 팀 멤버, 결제, API 키, 웹훅, 그리고 모든 제품을 아우르는 통합 피드백 받은편지함을 관리합니다.
- **2. Products (제품)**: 팀이 개발하는 개별 애플리케이션 또는 서비스(예: 웹 앱, iOS 앱, API)입니다. 각 제품마다 고유한 피드백 보드, 로드맵, 변경 로그, 카테고리, 브랜딩을 가집니다.
- **3. Customer Portals (고객 포털)**: 사용자가 아이디어를 제안하고, 기능 요청에 투표하며, 공개 로드맵을 확인하고, 릴리스 공지를 확인할 수 있는 전용 브랜드 포털입니다.
</cards>

<!-- section: roles-permissions -->
## 역할 및 팀 권한

워크스페이스 설정에 대한 강력한 보안을 유지하면서 팀 전체와 원활하게 협업할 수 있습니다:

<cards>
- **Workspace Owner (소유자)**: 완전한 제어 권한: 구독 관리, 관리자 초대, API 키 생성, 웹훅 구성 및 소유권 이전.
- **Workspace Admin (관리자)**: 제품 관리, 피드백 분류(트리아지), 고객에 대한 공식 답변 작성, 로드맵 카드 관리, 릴리스 노트 발행.
- **Workspace Member (멤버)**: 제출된 피드백 열람, 팀 내부 토론 참여, 고객 요청 트래킹.
</cards>

<!-- section: requests-inbox -->
## 피드백 요청(모든 보드) 및 분류(Triage)

`/dashboard/[ws]/requests`에 위치한 통합 받은편지함은 모든 제품의 고객 피드백을 단일 고성능 분류 화면으로 모아줍니다.

<cards>
- **다차원 필터링**: 제품, 상태 단계(백로그, 진행 중, 완료), 카테고리, 키워드 검색, 기간별로 즉시 필터링합니다.
- **빠른 상태 업데이트**: 클릭 한 번으로 단계(검토 중, 계획됨, 개발 중, 완료)를 전환할 수 있으며, 투표한 고객에게 자동으로 알림이 전송됩니다.
</cards>

<!-- section: comments-attention -->
## 댓글 및 집중 관리(Needs Attention) 받은편지함

`/dashboard/[ws]/comments`에 위치한 이 받은편지함은 피드백 대화에 신속하게 대응하는 고객 지원 데스크 역할을 합니다.

### 워크플로 단계

<stages>
- **Needs Attention (주의 필요)**: 팀의 공식 답변을 아직 받지 못한 고객 댓글입니다. 주황색 표시기로 강조되어 어떤 문의도 놓치지 않습니다.
- **Handled (처리 완료)**: 팀 멤버가 공식 배지로 답변을 작성하면 큐에서 자동으로 제거되며, 수동으로 처리 완료 처리할 수도 있습니다.
</stages>

<!-- section: author-location -->
## 작성자 연락처 및 위치 정보 인사이트

피드백을 제출한 사용자에 대한 맥락을 파악할 수 있도록 요청 및 댓글 카드에 작성자 상세 정보가 표시됩니다:

- **직접 이메일 연락**: 작성자 이름 옆의 이메일 버튼을 클릭하여 사용자 인터뷰나 추가 질문을 신속하게 진행할 수 있습니다.
- **지리적 위치 파악**: 고객의 대략적인 위치(예: `London, United Kingdom [GB]`)를 확인하여 지역별 사용 트렌드를 분석할 수 있습니다.
- **개인정보 보호 설계**: 작성자의 이메일 주소와 위치 정보는 워크스페이스 팀 멤버에게만 공개되며, 공개 포털에는 절대 노출되지 않습니다.

<!-- section: customer-portals -->
## 공개 고객 포털

워크스페이스 내의 모든 제품은 `/[ws]/[product]`에서 자체 공개 포털을 운영할 수 있습니다.

<cards>
- **모듈식 기능 토글**: 제품별 준비 상태에 따라 피드백 보드, 로드맵, 변경 로그, FAQ를 독립적으로 활성화하거나 비활성화할 수 있습니다.
- **맞춤형 브랜딩 및 색상**: 로고, 브랜드 이름, 맞춤형 강조 색상을 설정하여 제품과 자연스럽게 어우러지는 디자인을 완성합니다.
- **다국어 및 RTL 지원**: 방문자 언어 자동 감지, 언어 선택기, 13개 언어로 현지화된 콘텐츠 작성을 지원합니다.
- **기본 언어 변경**: 기존 번역이 기본 필드로 승격되고 이전 텍스트는 대체 번역으로 안전하게 보존됩니다.
- **사용자 배지**: 게시물과 댓글 옆에 배지를 표시하여 주요 고객을 인정하고 우대할 수 있습니다.
</cards>

<!-- section: roadmap-changelog -->
## 로드맵 계획 및 릴리스 노트

<cards>
- **인터랙티브 로드맵**: 기능 개발 과정을 시각적 컬럼(검토 중, 계획됨, 진행 중 등)으로 정리하고 피드백을 카드에 직접 연결합니다.
- **변경 로그 및 릴리스 공지**: 카테고리별(신규 기능, 개선, 버그 수정) 릴리스 노트를 발행하고 제안 고객에게 자동으로 완료 알림을 제공합니다.
</cards>

<!-- section: faq-system -->
## 셀프서비스 FAQ 지식 베이스

제품 포털에 카테고리별로 자주 묻는 질문을 추가하세요. 즉각적인 답변을 제공하면 중복 문의와 고객 지원 부담을 줄일 수 있습니다.

<!-- section: themes-push -->
## 테마 및 웹 푸시 알림

UserHQ는 네 가지 테마를 지원합니다: **시스템**, **라이트**, **다크**(딥 네이비), **차콜**(차분한 그레이블랙). 팀 멤버는 `/account`에서 브라우저 웹 푸시 알림을 켤 수 있습니다.

<!-- section: api-overview -->
## 자동화 API 및 인증

UserHQ REST Automation API를 통해 외부 시스템, CI/CD 파이프라인, Slack, Discord, Linear, GitHub 또는 내부 대시보드를 연결하세요.

### 인증 헤더

```http
Authorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

<cards>
- **요청 속도 제한**: API 키당 분당 120회 요청의 넉넉한 한도를 제공하며 토큰 버킷 방식으로 매끄럽게 조절됩니다.
- **범위 기반 권한**: 키를 특정 제품으로 제한하고 리소스별 읽기/쓰기 권한을 정밀하게 제어할 수 있습니다.
</cards>

<!-- section: swagger-explorer -->
## 인터랙티브 API 탐색기

엔드포인트를 직접 테스트하고, 매개변수와 요청/응답 스키마를 확인하며, cURL, TypeScript, Python 코드 스니펫을 바로 생성할 수 있습니다.

[component:swagger-explorer]

<!-- section: webhooks-hmac -->
## 웹훅 및 HMAC 서명 검증

UserHQ는 요청 생성, 상태 변경, 새 댓글 등록 시 실시간 HTTP POST 이벤트를 전송합니다. 모든 전송에는 `x-userhq-signature` 헤더에 안전한 HMAC-SHA256 서명이 포함됩니다.

### Node.js / Express HMAC 서명 검증 예시

```typescript
import crypto from "crypto";

export function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const expectedHeader = `sha256=${expectedSignature}`;
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expectedHeader)
  );
}
```
