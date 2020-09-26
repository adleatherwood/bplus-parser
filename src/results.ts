
export type Success<T> = {
    kind: "success",
    value: T
}

export type Failure<T> = {
    kind: "failure",
    error: T
}

export type Result<T, F> =
    | Success<T>
    | Failure<F>

export module Result {

    export function success<T, F>(value: T): Result<T, F> {
        return {
            kind: "success",
            value: value,
        }
    }

    export function failure<T, F>(error: F): Result<T, F> {
        return {
            kind: "failure",
            error: error,
        }
    }

    export function isSuccess<T, F>(result: Result<T, F>): result is Success<T> {
        return result.kind === "success"
    }

    export function isFailure<T, F>(result: Result<T, F>): result is Failure<F> {
        return result.kind === "failure"
    }

    export function match<S, F, U>(result: Result<S, F>, fsuccess: (s: S) => U, ffailure: (f: F) => U): U {
        return (isSuccess(result))
            ? fsuccess(result.value)
            : ffailure(result.error)
    }
}