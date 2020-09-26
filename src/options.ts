
export type Option<T> = T | undefined

export module Option {

    export function match<T, U>(option: Option<T>, fsome: (s: T) => U, fnone: (n: undefined) => U) {
        return option !== undefined
            ? fsome(option)
            : fnone(undefined)
    }
}
