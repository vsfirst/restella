{{- define "front-end.labels" -}}
app.kubernetes.io/name: front-end
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: restella
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end }}

{{/* back-end NetworkPolicy가 이 레이블(app.kubernetes.io/name: front-end)로 API 접속을 허용한다 */}}
{{- define "front-end.selectorLabels" -}}
app.kubernetes.io/name: front-end
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "front-end.image" -}}
{{- $registry := required "image.registry가 필요하다 (ApplicationSet이 클러스터 Secret annotation에서 넣는다)" .Values.image.registry -}}
{{- if .Values.image.digest -}}
{{ $registry }}/{{ .Values.image.repository }}@{{ .Values.image.digest }}
{{- else -}}
{{ $registry }}/{{ .Values.image.repository }}:{{ required "image.digest나 image.tag가 필요하다 (CI가 values/<환경>/front-end-image.yaml에 쓴다)" .Values.image.tag }}
{{- end -}}
{{- end }}
