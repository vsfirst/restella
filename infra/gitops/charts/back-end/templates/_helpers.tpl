{{- define "back-end.labels" -}}
app.kubernetes.io/name: back-end
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: restella
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end }}

{{/* MariaDB NetworkPolicy가 이 레이블(app.kubernetes.io/name: back-end)로 접속을 허용한다. API와 Job 모두 붙인다 */}}
{{- define "back-end.selectorLabels" -}}
app.kubernetes.io/name: back-end
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "back-end.image" -}}
{{- $registry := required "image.registry가 필요하다 (ApplicationSet이 클러스터 Secret annotation에서 넣는다)" .Values.image.registry -}}
{{- if .Values.image.digest -}}
{{ $registry }}/{{ .Values.image.repository }}@{{ .Values.image.digest }}
{{- else -}}
{{ $registry }}/{{ .Values.image.repository }}:{{ required "image.digest나 image.tag가 필요하다 (CI가 values/<환경>/back-end-image.yaml에 쓴다)" .Values.image.tag }}
{{- end -}}
{{- end }}

{{/* API와 Job이 함께 쓰는 환경변수 */}}
{{- define "back-end.env" -}}
- name: NODE_ENV
  value: production
- name: PORT
  value: "3000"
- name: DB_HOST
  value: {{ .Values.db.host | quote }}
- name: DB_PORT
  value: {{ .Values.db.port | quote }}
- name: DB_NAME
  value: {{ .Values.db.name | quote }}
- name: DB_USER
  value: {{ .Values.db.user | quote }}
{{- range $k, $v := .Values.env }}
{{- if $v }}
- name: {{ $k }}
  value: {{ $v | quote }}
{{- end }}
{{- end }}
{{- range .Values.secret.apiKeys }}
- name: {{ . }}
  valueFrom:
    secretKeyRef:
      name: {{ $.Values.secret.name }}
      key: {{ . }}
{{- end }}
{{- end }}

{{- define "back-end.podSecurityContext" -}}
runAsUser: 1000 # node 이미지의 node 사용자
runAsGroup: 1000
runAsNonRoot: true
seccompProfile:
  type: RuntimeDefault
{{- end }}

{{- define "back-end.containerSecurityContext" -}}
allowPrivilegeEscalation: false
readOnlyRootFilesystem: true
capabilities:
  drop: ["ALL"]
{{- end }}
