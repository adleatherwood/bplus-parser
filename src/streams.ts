import { Option } from "bplus-composer"

export interface Stream<T> {
    tryTake(value: T): Option<[T, Stream<T>]>
    eof(): boolean
    value: T
}
