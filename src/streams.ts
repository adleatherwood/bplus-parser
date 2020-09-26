import { Option } from "./options"

export interface Stream<T> {
    tryTake(value: T): Option<[T, Stream<T>]>
    eof(): boolean
    value: T // interal only?
}
