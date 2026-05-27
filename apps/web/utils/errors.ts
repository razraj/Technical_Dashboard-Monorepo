export class HTTPError extends Error {
    code: string;
    constructor(msg: string, code: string) {
        super(msg);

        Object.setPrototypeOf(this, HTTPError.prototype);
        this.code = code;
    }
}

export class NotFoundError extends HTTPError {
    constructor(msg: string, code: string) {
        super(msg, code);

        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}

export class UnauthorizedError extends HTTPError {
    constructor(msg: string, code: string) {
        super(msg, code);

        Object.setPrototypeOf(this, UnauthorizedError.prototype);
    }
}

export class ForbiddenError extends HTTPError {
    constructor(msg: string, code: string) {
        super(msg, code);

        Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
}

export class BadRequestError extends HTTPError {
    constructor(msg: string, code: string) {
        super(msg, code);

        Object.setPrototypeOf(this, BadRequestError.prototype);
    }
}

export class InternalServerError extends HTTPError {
    constructor(msg: string, code: string) {
        super(msg, code);

        Object.setPrototypeOf(this, InternalServerError.prototype);
    }
}

export class SessionExpiredError extends HTTPError {
    constructor(msg: string, code: string) {
        super(msg, code);

        Object.setPrototypeOf(this, SessionExpiredError.prototype);
    }
}
