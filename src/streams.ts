import { Comparer, Option } from "bplus-composer"

export interface Stream<T> {
    tryTake(value: T): Option<[T, Stream<T>]>
    eof(): boolean
    value: T
}

export type IterableStream<T> = Stream<T>

export module IterableStream {

    export function create<T>(input: Iterable<T>, compare: Comparer<T>): IterableStream<T>
    export function create<T>(input: Iterator<T>, compare: Comparer<T>): IterableStream<T>
    export function create<T>(input: Iterable<T> | Iterator<T>, compare: Comparer<T>): IterableStream<T> {
        const iterator = isIterable<T>(input)
            ? input[Symbol.iterator]()
            : input

        const next = iterator.next()

        let stream = {
            tryTake(value: T): Option<[T, IterableStream<T>]> {
                if (compare(next.value, value) === 0) {
                    return [value, create(iterator, compare)]
                }
            },
            eof() {
                return next.done == true
            },
            value: next.value,
        }

        return stream
    }
}

export function isIterable<T>(input: Iterable<T> | Iterator<T>): input is Iterable<T> {
    return Symbol.iterator in Object(input)
}
