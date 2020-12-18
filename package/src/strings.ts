import { Option } from "bplus-composer"
import { Parser, exact, many, maybe, any, flatten4, many1 } from "./parsers"
import { isIterable, Stream } from "./streams"

export type StringStream = Stream<string> & {
    tryTest(char: RegExp): Option<[string, StringStream]>
}

export type StringsStream = Stream<string> & {
    tryTest(char: RegExp): Option<[string, StringsStream]>
}

export type StringOptions = {
    caseInsensitive: boolean
}

export const DefaultOptions: StringOptions = {
    caseInsensitive: false,
}

const ciCollator = { sensitivity: 'accent' }

function equalCi(a: string, b: string) {
    return a.localeCompare(b, undefined, ciCollator) === 0
}

export module StringStream {

    export function create(input: string): StringStream
    export function create(input: string, options: StringOptions): StringStream
    export function create(input: string, options: StringOptions = DefaultOptions): StringStream {
        let stream = {
            tryTake(value: string): Option<[string, StringStream]> {
                if (!options.caseInsensitive && input.startsWith(value))
                    return [value, create(input.slice(value.length), this.options)]
                else if (options.caseInsensitive) {
                    let next = input.slice(0, value.length)
                    if (equalCi(next, value))
                        return [next, create(input.slice(value.length), this.options)]
                }

            },
            tryTest(char: RegExp): Option<[string, StringStream]> {
                let next = input.charAt(0)
                if (char.test(next))
                    return [next, create(input.slice(1), this.options)]
            },
            eof() {
                return !input
            },
            value: input,
            options: options
        }

        return stream
    }
}

export module StringsStream {

    export function create(input: Iterable<string>): StringsStream
    export function create(input: Iterator<string>, options: StringOptions): StringsStream
    export function create(input: Iterable<string> | Iterator<string>, options: StringOptions = DefaultOptions): StringsStream {
        const iterator = isIterable<string>(input)
            ? input[Symbol.iterator]()
            : input

        const next = iterator.next()

        let stream = {
            tryTake(value: string): Option<[string, StringsStream]> {
                if (!options.caseInsensitive && next.value.startsWith(value))
                    return [value, create(iterator, this.options)]
                else if (options.caseInsensitive) {
                    if (equalCi(next.value, value))
                        return [next.value, create(iterator, this.options)]
                }
            },
            tryTest(char: RegExp): Option<[string, StringsStream]> {
                if (char.test(next.value))
                    return [next.value, create(iterator, this.options)]
            },
            eof() {
                return next.done == true
            },
            value: next.value,
            options: options
        }

        return stream
    }
}

// STRING DEFINITIONS

const wsExp = /\s/
const digitExp = /\d/
const letterExp = /\w/i

// STRING PARSERS

export function char(label: string, exp: RegExp): Parser<string, string> {
    return Parser.create(label, (stream: Stream<string>) => {
        return Option.match((stream as StringStream).tryTest(exp),
            some => Parser.success(some[0], some[1]),
            none => Parser.failure(label, "Expected: " + label, stream))

    })
}

export const space = char("SPACE", wsExp)
export const letter = char("LETTER", letterExp)
export const digit = char("DIGIT", digitExp)

export const number =
    Parser.combine(maybe(any(exact("+"), exact("-"))))
        .and(many1(digit))
        .and(maybe(exact(".")))
        .and(many(digit))
        .map(flatten4)
        .map((a) => {
            const text = (a[0] || "") + (a[1].join("")) + (a[2] || "") + (a[3].join(""))
            return Number.parseFloat(text)
        })
        .build("NUMBER")
