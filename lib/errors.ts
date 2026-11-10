export class DiscogsError extends Error {
  readonly status: number;
  readonly kind: "config" | "auth" | "request";

  constructor(
    message: string,
    status = 500,
    kind: "config" | "auth" | "request" = "request",
  ) {
    super(message);
    this.name = "DiscogsError";
    this.status = status;
    this.kind = kind;
  }
}

export class CollectionError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CollectionError";
    this.status = status;
  }
}
