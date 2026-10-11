/** 입력 오류 항목 (problem+json의 errors) */
export interface FieldError {
  field: string;
  message: string;
}

/**
 * back-end의 RFC 9457 problem+json을 화면에서 쓰기 좋게 담는다.
 * 분기는 문구가 아니라 type(urn:restella:problem:<유형>의 <유형>)으로 한다 (docs/2-design/api.md "오류 유형")
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly type?: string,
    readonly requestId?: string,
    readonly errors: FieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** 특정 입력칸의 오류 문구 */
  fieldError(field: string): string | undefined {
    return this.errors.find((e) => e.field === field)?.message;
  }
}

interface Problem {
  type?: string;
  title?: string;
  detail?: string;
  requestId?: string;
  errors?: FieldError[];
}

const PROBLEM_PREFIX = 'urn:restella:problem:';

export async function toApiError(res: Response): Promise<ApiError> {
  let problem: Problem = {};
  try {
    problem = (await res.json()) as Problem;
  } catch {
    // 본문이 JSON이 아니면 상태 코드만 쓴다
  }
  return new ApiError(
    res.status,
    problem.detail || problem.title || `요청이 실패했습니다 (${res.status})`,
    problem.type?.startsWith(PROBLEM_PREFIX) ? problem.type.slice(PROBLEM_PREFIX.length) : problem.type,
    problem.requestId ?? res.headers.get('x-request-id') ?? undefined,
    problem.errors ?? [],
  );
}

/** 화면에 보일 문구. 서버 오류는 요청 ID를 붙여 로그를 찾을 수 있게 한다 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status >= 500 && error.requestId) return `${error.message} (요청 ID: ${error.requestId})`;
  return error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';
}
