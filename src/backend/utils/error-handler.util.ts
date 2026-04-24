import { NextResponse } from "next/server";
import { ZodError } from "zod";

// RFC 7807 problem+json, per Developer Guide §7.10.
export interface ProblemJson {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[]>;
}

function problem(p: ProblemJson) {
  return NextResponse.json(p, {
    status: p.status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

export function badRequest(code: string, detail: string) {
  return problem({
    type: `https://docs.pablo.ai/errors/${code}`,
    title: "Bad request",
    status: 400,
    code,
    detail,
  });
}

export function unauthorized(code = "unauthorized", detail = "Authentication required") {
  return problem({
    type: `https://docs.pablo.ai/errors/${code}`,
    title: "Unauthorized",
    status: 401,
    code,
    detail,
  });
}

export function conflict(code: string, detail: string) {
  return problem({
    type: `https://docs.pablo.ai/errors/${code}`,
    title: "Conflict",
    status: 409,
    code,
    detail,
  });
}

export function validationError(err: ZodError) {
  const errors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    errors[key] = errors[key] ?? [];
    errors[key].push(issue.message);
  }
  return problem({
    type: "https://docs.pablo.ai/errors/validation_error",
    title: "Validation failed",
    status: 400,
    code: "validation_error",
    detail: "One or more fields failed validation.",
    errors,
  });
}

export function serverError(detail = "Something went wrong") {
  return problem({
    type: "https://docs.pablo.ai/errors/internal",
    title: "Internal server error",
    status: 500,
    code: "internal",
    detail,
  });
}
